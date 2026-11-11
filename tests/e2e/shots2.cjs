const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const tag = process.argv[2] || 'avant';
  fs.rmSync('data8', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data8', PORT: '3108' } });
  await sleep(1200);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3108/?tests'); await sleep(800);
  for (const [id, tab] of [['d1','chat'],['d1','fiche'],['d2','devis'],['d2','messages'],['d2','pdf'],['d3','chat']]) {
    await p.evaluate(([id, tab]) => openDossier(id, tab), [id, tab]); await sleep(300);
    await p.screenshot({ path: `${__dirname}/captures/dossier-${id}-${tab}.png`, fullPage: true });
  }
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log('débordement', ov);
  console.log('erreurs', errs); await b.close(); s.kill(); process.exit(0);
})();
