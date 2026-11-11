const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('data11', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data11', PORT: '3111' } });
  await sleep(1200); const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:3111/?tests'); await sleep(800);
  const r = await p.evaluate(() => {
    const d = dossier('d4'); const out = [];
    for (const user of ['Cuisine 28 m² de murs, préparation et peinture.', 'Protéger sols (150 CHF forfait)', 'Ne pas proposer la protection', 'oui']) {
      const t = makeTools(() => d, false, { user, prevBot: 'Tu veux que je compte la protection des sols ?' }).find(x => x.name === 'add_line');
      try { t.execute({ room: 'Général', item_id: 'protect', qty: 1 }); out.push(user + ' -> ajoutée'); d.quote.lines = d.quote.lines.filter(l => l.label !== 'Protection des sols et du mobilier'); }
      catch (e) { out.push(user + ' -> refusée'); }
    }
    return out;
  });
  console.log(r.join('\n')); await b.close(); s.kill(); process.exit(0);
})();
