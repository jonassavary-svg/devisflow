const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('data12', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data12', PORT: '3112' } });
  await sleep(1200); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3112/?tests'); await sleep(800); await p.evaluate(() => go('settings')); await sleep(300); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true)); await sleep(200);
  await p.click('details.more summary'); await p.selectOption('#tpl-trade', 'nettoyage'); await p.click('#tpl-apply'); await p.click('#tpl-apply'); await sleep(300);
  const r = await p.evaluate(() => ({ trade: S.company.trade, part: S.partLabel, n: S.catalogue.length, first: S.catalogue[0].label, prompt: companyForAgent().slice(0, 160) }));
  console.log(JSON.stringify(r, null, 1));
  await p.evaluate(() => openDossier('d1', 'devis')); await sleep(300);
  console.log('placeholder:', await p.getAttribute('#q-room', 'placeholder'));
  await sleep(1000); console.log('disque:', JSON.parse(fs.readFileSync('data12/devisflow.json')).settings.partLabel);
  console.log('erreurs', errs); await b.close(); s.kill(); process.exit(0);
})();
