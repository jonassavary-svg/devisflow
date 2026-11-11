const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('datap', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', PORT: '3155', DEVISFLOW_DATA: __dirname + '/datap' } });
  await sleep(1200); const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
  await p.goto('http://localhost:3155/'); await sleep(1200);
  await p.evaluate(() => openDossier('d2', 'pdf'));
  await p.waitForSelector('#pdf-view img.pdf-page', { timeout: 15000 });
  const n = await p.locator('#pdf-view img.pdf-page').count(); ok(n >= 1, 'aperçu = vraies pages du PDF (' + n + ')');
  await p.locator('#pdf-view').screenshot({ path: 'apercu-pdf.png' });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#pdf')]); await dl.saveAs('apercu-dl.pdf');
  ok(fs.readFileSync('apercu-dl.pdf').slice(0, 4).toString() === '%PDF', 'téléchargement toujours OK');
  // l'aperçu se met à jour après un changement du devis
  await p.evaluate(() => { const d = D.find(x => x.id === 'd2'); d.quote.discount = 10; save(); render(); });
  await sleep(2500); ok(await p.locator('#pdf-view img.pdf-page').count() >= 1, 'aperçu régénéré après changement');
  console.log('erreurs', errs); await b.close(); s.kill();
})();
