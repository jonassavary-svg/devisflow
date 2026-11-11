const { chromium } = require('playwright');
const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const APP = require('path').join(__dirname, '..', '..');
function start(env, port) {
  const p = spawn('node', ['server.js'], { cwd: APP, env: { ...process.env, ...env, PORT: String(port) } });
  p.stdout.on('data', d => process.stdout.write('[srv' + port + '] ' + d)); p.stderr.on('data', d => process.stdout.write('[srv' + port + ' ERR] ' + d));
  return p;
}
(async () => {
  fs.rmSync('data1', { recursive: true, force: true }); fs.rmSync('data2', { recursive: true, force: true }); fs.rmSync('requests.jsonl', { force: true });
  const mock = spawn('node', ['mock.mjs', 'requests.jsonl']);
  const s1 = start({ ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4010', DEVISFLOW_DATA: __dirname + '/data1' }, 3101);
  const s2 = start({ ANTHROPIC_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data2' }, 3102);
  await sleep(1200);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
  await p.goto('http://localhost:3101/?tests'); await sleep(1500);
  ok(fs.existsSync('data1/devisflow.json'), 'fichier de données créé au premier lancement');
  ok(!(await p.locator('.warnbox', { hasText: 'non activé' }).count()), 'pas de bandeau quand la clé est là');
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 0, 'pas de débordement à 400px (' + ov + ')');
  // Accueil : nouveau client
  await p.click('#start-msg'); await p.click('[data-src="moi"]'); await p.fill('#ask', 'nouveau client M. Martin à Marly, 3 chambres à repeindre'); await p.click('#dest-dossier'); await sleep(2500);
  let data = JSON.parse(fs.readFileSync('data1/devisflow.json'));
  const martin = data.dossiers.find(d => d.client.name === 'M. Martin');
  ok(!!martin, 'dossier créé par l\'IA et enregistré sur le disque');
  ok(martin && martin.chat.some(m => m.role === 'assistant' && /Dossier créé/.test(m.text)), 'réponse de l\'IA rangée dans le dossier');
  ok(await p.locator('[data-qr]').count() === 2, 'boutons de réponse rapide affichés');
  // Dossier Dupont : chiffrage
  await p.goto('http://localhost:3101/?tests'); await sleep(800);
  await p.evaluate(() => openDossier('d1', 'chat')); await sleep(300);
  await p.fill('#ask', 'Salon : murs 42 m² à préparer et à peindre, plafond 18 m². Une porte à laquer. Protection des sols.'); await p.click('#send-ask'); await sleep(3000);
  data = JSON.parse(fs.readFileSync('data1/devisflow.json'));
  const d1 = data.dossiers.find(d => d.id === 'd1');
  ok(d1.quote.lines.length === 5, 'lignes ajoutées : ' + d1.quote.lines.length + ' (doublon refusé)');
  const reqs = fs.readFileSync('requests.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  const dupReq = reqs.find(r => r.body.messages.some(m => m.role === 'user' && Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result' && c.is_error && /already in/.test(c.content))));
  ok(!!dupReq, 'le serveur renvoie bien l\'erreur de doublon à l\'IA');
  const r0 = reqs[0];
  ok(r0.headers.beta && r0.headers.beta.includes('server-side-fallback'), 'en-tête fallback envoyé : ' + r0.headers.beta);
  ok(r0.body.model === 'claude-opus-5-5' && r0.body.fallbacks === 'default' && r0.body.output_config.effort === 'medium', 'modèle, fallbacks, effort');
  ok(Array.isArray(r0.body.system) && /assistant DevisFlow/.test(r0.body.system[0].text), 'consignes envoyées en system');
  ok(r0.body.tools.length > 10 && r0.body.tools.every(t => t.input_schema), 'outils au bon format (' + r0.body.tools.length + ')');
  const withThinking = reqs.find(r => r.body.messages.some(m => m.role === 'assistant' && m.content.some(c => c.type === 'thinking')));
  ok(!!withThinking, 'bloc thinking renvoyé tel quel');
  // Persistance après rechargement
  await p.reload(); await sleep(800);
  const n = await p.evaluate(() => D.find(d => d.id === 'd1').quote.lines.length); ok(n === 5, 'devis toujours là après rechargement');
  // PDF
  await p.evaluate(() => openDossier('d1', 'pdf')); await sleep(300);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#pdf')]);
  const year = new Date().getFullYear();
  ok(dl.suggestedFilename() === `devis-${year}-118.pdf`, 'PDF téléchargé : ' + dl.suggestedFilename());
  await dl.saveAs('devis.pdf'); ok(fs.readFileSync('devis.pdf').slice(0, 4).toString() === '%PDF', 'fichier PDF valide');
  // Utiliser comme test
  await p.evaluate(() => openDossier('d1', 'devis')); await sleep(300);
  ok(await p.locator('#as-test').count() === 1, 'bouton « Utiliser comme test » présent');
  await p.click('#as-test'); await sleep(600);
  // Tests de l'IA
  await p.evaluate(() => go('settings')); await sleep(500); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true)); await sleep(200);
  ok(await p.locator('#eval-panel .test-row').count() === 44, 'tests listés : ' + await p.locator('#eval-panel .test-row').count());
  await p.click('#run-tests'); await sleep(9000);
  const res = await p.evaluate(() => Object.fromEntries(Object.entries(ui.evalResults || {}).map(([k, v]) => [k, v.ok])));
  console.log('   résultats', JSON.stringify(res));
  ok(res.t1 === true, 'test « Salon complet » réussi avec la réponse simulée');
  ok(res.t2 === false, 'test « Correction » échoue bien quand l\'IA ne fait rien');
  const custom = Object.keys(res).find(k => k.startsWith('c'));
  ok(custom && res[custom] === true, 'test créé depuis le dossier réussi');
  data = JSON.parse(fs.readFileSync('data1/devisflow.json'));
  ok(data.settings.catalogue.length === 9 && data.settings.aiNotes.startsWith('On ne travaille'), 'paramètres réels intacts après les tests');
  ok(!data.dossiers.some(d => String(d.id).startsWith('test-')), 'aucun dossier de test enregistré');
  ok(data.settings.lastEval && data.settings.lastEval.total === 44, 'résumé des tests enregistré');
  await p.screenshot({ path: 'settings.png', fullPage: true });
  // Import ancien devis (photo)
  await p.setInputFiles('#oldquote-in', require('path').join(__dirname, '..', '..', 'public/icon-180.png')); await sleep(1500);
  ok(await p.locator('[data-addsugg]').count() === 1, 'import ancien devis : suggestion lue');
  // Vue client
  await p.evaluate(() => setMode('client')); await sleep(300);
  await p.fill('#ask', 'Je veux repeindre mon salon'); await p.click('#send-ask'); await sleep(1500);
  ok(await p.evaluate(() => ui.client.chat.length) >= 3, 'vue client répond');
  // Sans clé
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push('p2 ' + e.message));
  await p2.goto('http://localhost:3102/?tests'); await sleep(800);
  ok(await p2.locator('.warnbox', { hasText: 'non activé' }).count() === 1, 'bandeau affiché sans clé');
  await p2.click('#start-msg'); await p2.click('[data-src="moi"]'); await p2.fill('#ask', 'Madame Rochat veut repeindre 20 m2'); await p2.click('#dest-dossier'); await sleep(800);
  ok(await p2.evaluate(() => D.some(d => /Rochat/.test(d.client.name))), 'mode sans IA : dossier simple créé');
  // Serveur arrêté -> message d'erreur d'enregistrement
  s1.kill(); await sleep(500);
  await p.evaluate(() => { setMode('artisan'); D[0].title += ' x'; save(); }); await sleep(1500);
  ok(await p.locator('#toast', { hasText: 'Enregistrement impossible' }).count() === 1, 'alerte si le serveur est arrêté');
  console.log('erreurs page:', errs.filter(e => !/Failed to load resource|ERR_CONNECTION_REFUSED|fonts.g/.test(e)));
  await b.close(); s2.kill(); mock.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
