const { chromium } = require('playwright'); const { spawn } = require('child_process');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => { const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data14', PORT: '3114' } }); await sleep(1200);
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto('http://localhost:3114/'); await sleep(600); await p.evaluate(() => go('settings')); await sleep(300); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true)); await sleep(200);
  console.log('panneau tests caché:', await p.locator('#eval-panel').count() === 0, '· mode IA visible:', await p.locator('#ai-speed').count() === 1);
  await b.close(); s.kill(); process.exit(0); })();
