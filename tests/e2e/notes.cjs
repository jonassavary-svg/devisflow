const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
(async () => {
  fs.rmSync('data5', { recursive: true, force: true }); fs.rmSync('requests.jsonl', { force: true });
  const mock = spawn('node', ['mock.mjs', 'requests.jsonl']);
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: '', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4010', DEVISFLOW_DATA: __dirname + '/data5', PORT: '3105' } });
  await sleep(1200);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3105/?tests'); await sleep(800);
  ok(await p.locator('#tabs button').count() === 5, '5 onglets');
  // Garder en note depuis l'accueil (sans IA)
  await p.click('#start-msg'); await p.click('[data-src="moi"]'); await p.fill('#ask', 'M. Gérard à Givisiez, salon murs 30 m², préparation et peinture, appeler le 079 111 22 33'); await p.click('#dest-note'); await sleep(2000);
  let notes = await p.evaluate(() => N.map(n => ({ t: n.title, x: n.text })));
  ok(notes.length === 1 && /Gérard/.test(notes[0].x), 'note enregistrée depuis l\'accueil');
  ok(notes[0].t === 'Devis Gérard', 'note nommée par l\'IA : ' + notes[0].t);
  // Onglet Notes
  await p.click('#tabs button[data-tab="notes"]'); await sleep(300);
  ok(await p.locator('.note-card').count() === 1, 'note listée');
  await p.screenshot({ path: 'notes-list.png' });
  await p.click('.note-card'); await sleep(300);
  await p.fill('#note-text', (await p.inputValue('#note-text')) + '\nPlafond pas compris.'); await sleep(800);
  ok(/Plafond/.test(await p.evaluate(() => N[0].text)), 'modification de la note enregistrée');
  await p.screenshot({ path: 'note-edit.png' });
  // Nouvelle note vide puis retour : supprimée automatiquement
  await p.click('#note-back'); await p.click('#note-new'); await sleep(200); await p.click('#note-back'); await sleep(200);
  ok(await p.evaluate(() => N.length) === 1, 'note vide non gardée');
  // Créer le dossier avec l'IA
  await p.click('.note-card'); await sleep(200); await p.click('#note-convert'); await sleep(3500);
  const st = await p.evaluate(() => ({ tab: ui.tab, d: ui.dossierId, n: N[0].dossierId, lines: ui.dossierId && dossier(ui.dossierId).quote.lines.length, msgs: ui.dossierId && dossier(ui.dossierId).messages.length }));
  ok(st.tab === 'dossiers' && st.d && st.n === st.d, 'dossier créé depuis la note et ouvert');
  ok(st.lines === 2 && st.msgs === 1, 'devis rempli et message d\'envoi préparé');
  // Messages : boutons d'envoi
  await p.evaluate(() => { const d = dossier(ui.dossierId); d.client.email = 'gerard@exemple.ch'; d.client.phone = '079 111 22 33'; openDossier(d.id, 'messages'); }); await sleep(300);
  const hrefs = await p.$$eval('.send-row a', as => as.map(a => a.getAttribute('href')));
  ok(hrefs.some(h => h.startsWith('mailto:gerard%40exemple.ch?subject=')), 'lien Mail');
  ok(hrefs.some(h => h.startsWith('https://wa.me/41791112233?text=')), 'lien WhatsApp au format suisse');
  ok(await p.locator('[data-mpdf]').count() === 1, 'bouton PDF à côté du message');
  await p.screenshot({ path: 'messages.png', fullPage: true });
  await p.click('[data-msent]'); await sleep(300);
  ok(await p.evaluate(() => dossier(ui.dossierId).status) === 'envoye', '« C\'est envoyé » passe le dossier en envoyé');
  // Note retrouvée avec le lien vers le dossier
  await p.click('#tabs button[data-tab="notes"]'); await sleep(200);
  ok(await p.locator('.note-card .chip.ok').count() === 1, 'note marquée « Dossier créé »');
  // Accueil : l'IA range en note
  await p.click('#tabs button[data-tab="home"]'); await sleep(200);
  await p.evaluate(() => ask(null, 'note ça pour plus tard : rappeler Mme Rey')); await sleep(2000);
  ok(await p.evaluate(() => N.some(n => n.title === 'Rappeler Mme Rey')), 'l\'IA crée une note depuis l\'accueil');
  // Persistance
  await p.reload(); await sleep(800);
  ok(await p.evaluate(() => N.length) === 2, 'notes gardées après rechargement');
  ok(JSON.parse(fs.readFileSync('data5/devisflow.json')).notes.length === 2, 'notes écrites sur le disque');
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 0, 'pas de débordement mobile');
  console.log('erreurs', errs); await b.close(); s.kill(); mock.kill(); process.exit(0);
})();
