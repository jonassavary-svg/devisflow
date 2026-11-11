const { chromium } = require('playwright'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const env = { ...process.env, PORT: '3104', DEVISFLOW_DATA: __dirname + '/data4', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' };
(async () => {
  let s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env }); await sleep(1000);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('http://localhost:3104/?tests'); await sleep(800);
  await p.evaluate(() => { window.__marker = 1; D[0].title = 'Titre modifié'; save(); }); await sleep(1000);
  s.kill(); await sleep(500); s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env });
  await sleep(24000);
  const m = await p.evaluate(() => window.__marker); const t = await p.evaluate(() => D[0].title);
  console.log(m === undefined ? 'PASS page rechargée' : 'FAIL pas rechargée', t === 'Titre modifié' ? 'PASS données gardées' : 'FAIL ' + t);
  await b.close(); s.kill(); process.exit(0);
})();
