// Accueil à 3 boutons et notes (sans IA)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
(async () => {
  fs.rmSync('data7', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data7', PORT: '3107' } });
  await sleep(1200);
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3107/?tests'); await sleep(800);
  await p.evaluate(() => { document.querySelector('.warnbox') && document.querySelector('.warnbox').remove(); });
  ok(await p.locator('.start-btn').count() === 3, '3 gros boutons sur l\'accueil');
  ok(!(await p.locator('.sugg').count()) && !(await p.locator('#ask').count()), 'plus d\'exemples ni de champ sur l\'accueil');
  await p.screenshot({ path: __dirname + '/captures/accueil.png' });
  // Dicter
  await p.click('#start-dict'); await sleep(300);
  const hasMic = await p.locator('#cap-mic').count(); ok(hasMic === 1 || await p.locator('.cap .warnbox').count() === 1, 'Dicter ouvre le grand micro' + (hasMic ? '' : ' (dictée absente du navigateur de test)'));
  await p.evaluate(() => { dictState = 'listening'; renderBigMic(); });
  await p.fill('#ask', 'Chez M. Rossier à Bulle, cuisine murs 25 m², rappeler demain');
  await p.screenshot({ path: __dirname + '/captures/dicter.png' });
  await p.evaluate(() => { dictState = 'idle'; renderBigMic(); });
  await p.click('#dest-note'); await sleep(500);
  ok(await p.evaluate(() => N.length === 1 && /Rossier/.test(N[0].text)), 'dictée rangée en note');
  ok(await p.locator('.okbox').count() === 1, 'confirmation « Enregistré dans tes notes »');
  // Message d'un client -> note
  await p.click('#start-msg'); await sleep(200);
  ok(await p.locator('[data-src="client"][aria-pressed="true"]').count() === 1, 'Message : « Message d\'un client » choisi par défaut');
  await p.fill('#ask', 'Bonjour, pourriez-vous me faire un devis pour repeindre ma chambre ? Anne Clerc, Marly');
  await p.screenshot({ path: __dirname + '/captures/message.png' });
  await p.click('#dest-note'); await sleep(400);
  ok(await p.evaluate(() => /^Message du client :/.test(N[0].text)), 'message client marqué comme tel dans la note');
  // Photos
  await p.click('#start-photo'); await sleep(200);
  ok(await p.locator('#cap-cam[capture]').count() === 1 && await p.locator('#cap-gal').count() === 1, 'Photos : caméra et galerie');
  await p.setInputFiles('#cap-gal', require('path').join(__dirname, '..', '..', 'public/icon-180.png')); await sleep(600);
  ok(await p.locator('.cap .thumbs img').count() === 1, 'photo ajoutée');
  await p.screenshot({ path: __dirname + '/captures/photos.png' });
  await p.click('#dest-note'); await sleep(400);
  ok(await p.evaluate(() => N[0].photos.length === 1), 'note avec photo');
  // Ouvrir la note, mettre le client
  await p.click('#open-saved'); await sleep(300);
  ok(await p.locator('#note-client').count() === 1 && await p.locator('#note-cam[capture]').count() === 1, 'note : champ client + caméra + galerie');
  await p.fill('#note-title', 'Photos Clerc'); await p.fill('#note-client', 'Mme Anne Clerc'); await p.fill('#note-text', 'Chambre à repeindre');
  await p.screenshot({ path: __dirname + '/captures/note-client.png' });
  await sleep(1200);
  const saved = JSON.parse(fs.readFileSync('data7/devisflow.json')).notes.find(n => n.client === 'Mme Anne Clerc');
  ok(saved && saved.title === 'Photos Clerc' && saved.text === 'Chambre à repeindre', 'note modifiée enregistrée sur le disque');
  // Annuler
  await p.click('#tabs button[data-tab="home"]'); await p.click('#start-msg'); await p.fill('#ask', 'x'); await p.click('#cap-cancel'); await sleep(200);
  ok(await p.locator('.start-btn').count() === 3 && await p.evaluate(() => N.length) === 3, 'Annuler revient à l\'accueil sans rien créer');
  // En dossier (sans IA : dossier simple)
  await p.click('#start-msg'); await p.click('[data-src="moi"]'); await p.fill('#ask', 'Madame Favre veut repeindre son salon'); await p.click('#dest-dossier'); await sleep(800);
  ok(await p.evaluate(() => ui.dossierId && /Favre/.test(cur().client.name)), 'En dossier : dossier créé et ouvert');
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 0, 'pas de débordement à 390 px');
  console.log('erreurs', errs); await b.close(); s.kill(); process.exit(0);
})();
