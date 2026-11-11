const { chromium } = require('playwright'); const { spawn, execSync } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('data16', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data16', PORT: '3116' } });
  await sleep(1200); const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3116/'); await sleep(800);
  const logo = 'data:image/png;base64,' + fs.readFileSync(require('path').join(__dirname, '..', '..', 'public/icon-180.png')).toString('base64');
  for (const [name, setup] of [['simple', 'simple'], ['long', 'long']]) {
    const b64 = await p.evaluate(([logo, kind]) => {
      S.company = { name: "Alpina Peinture Sàrl", trade: "Peinture", address: "Route des Artisans 12, 1700 Fribourg", phone: "079 836 82 01", email: "info@alpina-peinture.ch", ide: "CHE-123.456.789", logo, iban: "CH93 0076 2011 6238 5295 7" };
      const d = clone(dossier('d1')); d.client = { name: "Léo Bapst", place: "Corminboeuf", address: "Impasse des Lilas 1, 1720 Corminboeuf", phone: "079 555 66 77", email: "leo@exemple.ch" }; d.title = "Peinture murs chambre";
      const c = (id) => S.catalogue.find(x => x.id === id);
      const line = (room, id, qty) => ({ id: uid(), room, label: c(id).label, unit: c(id).unit, qty, price: c(id).price });
      d.quote.lines = kind === 'simple' ? [line("Chambre", "paint", 30), line("Chambre", "prep", 30), line("Général", "protect", 1)]
        : ["Salon", "Chambre 1", "Chambre 2", "Cuisine", "Couloir", "Bureau"].flatMap(r => [line(r, "prep", 40), line(r, "paint", 40), line(r, "ceil", 15), line(r, "wood", 2)]).concat([line("Général", "travel", 1)]);
      if (kind === 'long') { d.quote.discount = 5; d.quote.notes = "Les travaux supplémentaires seront facturés en régie après accord."; }
      return buildPdf(d).output('datauristring').split(',')[1];
    }, [logo, setup]);
    fs.writeFileSync(`devis-${name}.pdf`, Buffer.from(b64, 'base64'));
    execSync(`pdftoppm -png -r 70 devis-${name}.pdf pdf-${name}`);
  }
  console.log(fs.readdirSync('.').filter(f => f.startsWith('pdf-')).join(' '), 'erreurs', errs); await b.close(); s.kill(); process.exit(0);
})();
