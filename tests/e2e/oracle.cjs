const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('data6', { recursive: true, force: true }); fs.rmSync('oracle.jsonl', { force: true });
  const mock = spawn('node', ['oracle.mjs']);
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: '', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4012', DEVISFLOW_DATA: __dirname + '/data6', PORT: '3106' } });
  s.stderr.on('data', d => process.stdout.write('ERR ' + d));
  await sleep(1200);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3106/?tests'); await sleep(800);
  await p.evaluate(() => go('settings')); await sleep(300); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true)); await sleep(200);
  await p.selectOption('#ai-speed', 'rapide');
  const t0 = Date.now(); await p.click('#run-tests');
  for (let i = 0; i < 120 && await p.evaluate(() => ui.evalRunning); i++) await sleep(250);
  console.log('durée de la série', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const res = await p.evaluate(() => Object.fromEntries(Object.entries(ui.evalResults).map(([k, v]) => [k, v.ok ? 'OK' : v.checks.filter(c => !c.ok).map(c => c.text).join(' | ')])));
  console.log(res);
  const bad = Object.entries(res).filter(([k, v]) => v !== 'OK'); console.log((bad.length || Object.keys(res).length < 50 ? 'FAIL ' : 'PASS ') + 'fausse IA parfaite : ' + (Object.keys(res).length - bad.length) + '/' + Object.keys(res).length + ' tests intégrés réussis');
  const reqs = fs.readFileSync('oracle.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  console.log('effort low (rapide/Claude):', reqs.every(r => r.output_config.effort === 'low'));
  const sys = reqs[0].system[0].text; console.log('infos entreprise:', /IDE CHE-000/.test(sys), /validité des devis 30 jours/.test(sys), /CATALOGUE/.test(sys));
  const first = JSON.stringify(reqs.find(r => /total du devis/.test(JSON.stringify(r)))); console.log('dossier + date dans le message:', /DOSSIER OUVERT/.test(first), /DATE ET HEURE : .*\d\d:\d\d/.test(first), /relance_due_on|quote_sent_on/.test(first));
  await p.screenshot({ path: 'tests13.png', fullPage: true });
  // Contrôle automatique dans le devis
  await p.evaluate(() => { const d = dossier('d2'); d.quote.lines[1].qty = 170; openDossier('d2', 'devis'); }); await sleep(300);
  console.log('encart contrôle:', await p.locator('.warnbox', { hasText: 'À vérifier' }).innerText());
  console.log('journal:', (await (await fetch('http://localhost:3106/api/journal')).text()).trim().split('\n').length, 'lignes');
  console.log('erreurs', errs); await b.close(); s.kill(); mock.kill(); process.exit(0);
})();
