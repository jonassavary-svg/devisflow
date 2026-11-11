const { chromium } = require('playwright'); const { spawn, execSync } = require('child_process'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('datax', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', PORT: '3156', DEVISFLOW_DATA: __dirname + '/datax' } });
  await sleep(1200); const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
  await p.goto('http://localhost:3156/'); await sleep(1200);
  // Paramètres
  await p.evaluate(() => go('settings')); await sleep(300); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true)); await sleep(200);
  await p.fill('#s-contact', 'Marc Rossier'); await p.fill('#s-regie', '78');
  // Fiche
  await p.evaluate(() => openDossier('d2', 'fiche')); await sleep(300);
  await p.fill('#f-site', 'Ch. des Tilleuls 12, 1752 Villars-sur-Glâne'); await p.locator('#f-site').blur();
  await p.evaluate(() => openDossier('d2', 'devis')); await sleep(300);
  await p.click('details.opts summary'); await p.fill('#q-period', 'semaine 48, environ 4 jours'); await sleep(800);
  const data = JSON.parse(fs.readFileSync('datax/devisflow.json'));
  const d2 = data.dossiers.find(x => x.id === 'd2');
  ok(data.settings.company.contact === 'Marc Rossier' && data.settings.company.regie === '78', 'responsable + régie enregistrés');
  ok(d2.site && d2.quote.period === 'semaine 48, environ 4 jours', 'chantier + période enregistrés');
  const tools = await p.evaluate(() => JSON.stringify(dossierForAgent(D.find(x => x.id === 'd2'))) + companyForAgent());
  ok(/Tilleuls 12/.test(tools) && /semaine 48/.test(tools) && /Marc Rossier/.test(tools) && /78 CHF\/h/.test(tools), 'l\'IA reçoit les 4 infos');
  await p.evaluate(() => openDossier('d2', 'pdf')); await p.waitForSelector('#pdf-view img.pdf-page', { timeout: 15000 });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdf')]); await dl.saveAs('extra.pdf');
  execSync('pdftoppm -png -r 70 extra.pdf extra');
  const txt = execSync('pdftotext extra.pdf -').toString();
  ok(/Lieu des travaux/.test(txt) && /Travaux prévus : semaine 48/.test(txt) && /Marc Rossier/.test(txt) && /Tarif en régie : CHF 78.00 par heure/.test(txt), 'les 4 infos sont dans le PDF');
  console.log('erreurs', errs); await b.close(); s.kill();
})();
