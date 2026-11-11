// Factures : création depuis le devis, QR-facture suisse (lu et vérifié), échéance, rappels, paiement, notification.
const { chromium } = require('playwright'); const { spawn, execSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
(async () => {
  const data = path.join(__dirname, 'data17'), notif = path.join(__dirname, 'notif.txt');
  fs.rmSync(data, { recursive: true, force: true }); fs.rmSync(notif, { force: true });
  const s = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: data, PORT: '3117', DEVISFLOW_NOTIFY_FILE: notif, DEVISFLOW_NOTIFY_SECONDS: '2' } });
  await sleep(1200); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 430, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3117/'); await sleep(800);
  await p.addScriptTag({ path: path.join(__dirname, 'lib', 'jsQR.js') });
  // Calculs de la norme
  const v = await p.evaluate(() => ({ scor: scorRef("539007547034"), qrr: qrrRef("21000000000313947143000901"), ok1: ibanOk("CH9300762011623852957"), ok2: ibanOk("CH9300762011623852958"), qri: isQrIban("CH4431999123000889012"), nqri: isQrIban("CH9300762011623852957"),
    a1: swissAddr("Alpina Sàrl", "Route des Artisans 12, 1700 Fribourg"), a2: swissAddr("X", "Ch. du Lac 3b\n1723 Marly"), a3: swissAddr("X", "Fribourg") }));
  ok(v.scor === "RF18539007547034", "référence SCOR (exemple officiel RF18…) : " + v.scor);
  ok(v.qrr === "210000000003139471430009017", "référence QR à 27 chiffres (exemple officiel) : " + v.qrr);
  ok(v.ok1 && !v.ok2, "contrôle de l'IBAN (bon accepté, faux refusé)"); ok(v.qri && !v.nqri, "reconnaît un QR-IBAN");
  ok(v.a1 && v.a1.street === "Route des Artisans" && v.a1.no === "12" && v.a1.zip === "1700" && v.a1.town === "Fribourg", "adresse découpée : " + JSON.stringify(v.a1));
  ok(v.a2 && v.a2.street === "Ch. du Lac" && v.a2.no === "3b" && v.a2.town === "Marly" && v.a3 === null, "adresse sur deux lignes, et adresse sans NPA refusée");
  // Entreprise et dossier accepté
  await p.evaluate(() => { S.company = Object.assign(S.company, { name: "Alpina Peinture Sàrl", address: "Route des Artisans 12, 1700 Fribourg", ide: "CHE-123.456.789", iban: "CH93 0076 2011 6238 5295 7", contact: "Jonas Exemple" }); save(); openDossier('d3'); });
  await sleep(300);
  ok(await p.locator('.seg button', { hasText: 'Facture' }).count() === 1, "onglet Facture visible sur un devis accepté");
  await p.evaluate(() => openDossier('d1')); await sleep(200);
  ok(await p.locator('.seg button', { hasText: 'Facture' }).count() === 0, "pas d'onglet Facture avant l'acceptation");
  await p.evaluate(() => openDossier('d3', 'facture')); await sleep(200);
  await p.click('#inv-create'); await sleep(300);
  let st = await p.evaluate(() => ({ inv: dossier('d3').invoice, k: invState(dossier('d3')).k, tot: invTotals(dossier('d3')).tot, q: totals(dossier('d3')).tot }));
  ok(st.inv && /^\d{4}-001$/.test(st.inv.no) && st.k === "afaire" && st.tot === st.q && st.inv.days === 30, `facture créée ${st.inv && st.inv.no}, même total que le devis (${st.tot}), à envoyer, 30 jours`);
  ok(await p.locator('.warnbox', { hasText: 'QR' }).count() === 0, "aucun avertissement QR quand tout est rempli");
  // PDF + QR lu
  const pdfOf = async (name) => { const b64 = await p.evaluate(() => buildPdf(dossier('d3'), "facture").output('datauristring').split(',')[1]); const f = path.join(__dirname, name + '.pdf'); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f; };
  const readQr = async (f) => { const n = +execSync(`pdfinfo "${f}" | grep Pages | awk '{print $2}'`).toString().trim(); fs.readdirSync(__dirname).filter(x => x.startsWith(path.basename(f, '.pdf') + '-') && x.endsWith('.png')).forEach(x => fs.rmSync(path.join(__dirname, x))); execSync(`pdftoppm -png -r 200 -f ${n} -l ${n} "${f}" "${f.replace('.pdf', '')}"`); const png = fs.readdirSync(__dirname).filter(x => x.startsWith(path.basename(f, '.pdf') + '-') && x.endsWith('.png')).sort().pop();
    const url = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, png)).toString('base64');
    return p.evaluate(async (url) => { const im = new Image(); await new Promise(r => { im.onload = r; im.src = url; }); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, d.width, d.height); return r ? r.data : null; }, url); };
  let f = await pdfOf('facture'); let txt = execSync(`pdftotext -layout "${f}" -`).toString();
  ok(/FACTURE/.test(txt) && txt.includes('N° ' + st.inv.no) && /Payable jusqu'au/.test(txt) && /Selon devis/.test(txt), "PDF : titre FACTURE, numéro, échéance, renvoi au devis");
  ok(/Section paiement/.test(txt) && /Récépissé/.test(txt) && /CH93 0076 2011 6238 5295 7/.test(txt) && /Point de dépôt/.test(txt), "PDF : section paiement et récépissé avec l'IBAN");
  ok(!/Bon pour accord/.test(txt) && !/Valable jusqu/.test(txt), "PDF : pas de signature ni de validité sur une facture");
  ok(/TVA 8,1 %/.test(txt) && /CHE-123.456.789/.test(txt), "PDF : TVA et numéro IDE présents");
  ok(+execSync(`pdfinfo "${f}" | grep Pages | awk '{print $2}'`).toString().trim() === 1, "facture courte : tout tient sur une page, QR compris");
  let qr = await readQr(f); const L = (qr || "").split("\n");
  ok(!!qr, "le QR de la facture se lit avec un lecteur de QR");
  ok(L.length === 31 && L[0] === "SPC" && L[1] === "0200" && L[2] === "1" && L[30] === "EPD", "QR : 31 lignes, en-tête SPC 0200 et fin EPD");
  ok(L[3] === "CH9300762011623852957" && L[4] === "S" && L[5] === "Alpina Peinture Sàrl" && L[6] === "Route des Artisans" && L[7] === "12" && L[8] === "1700" && L[9] === "Fribourg" && L[10] === "CH", "QR : compte et adresse structurée de l'entreprise (accents compris)");
  ok(L[18] === st.tot.toFixed(2) && L[19] === "CHF", "QR : montant " + L[18] + " CHF");
  ok(L[20] === "S" && L[21] === "M. A. Gobet" && L[22] === "Ch. Fictif" && L[23] === "3" && L[24] === "1723" && L[25] === "Marly", "QR : adresse du client");
  const rfOk = await p.evaluate((r) => mod97(r.slice(4) + r.slice(0, 4)) === 1, L[28] || "RF00");
  ok(L[27] === "SCOR" && rfOk && L[29] === "Facture " + st.inv.no, "QR : référence SCOR valable " + L[28] + " et message « " + L[29] + " »");
  // QR-IBAN -> référence QR
  await p.evaluate(() => { S.company.iban = "CH44 3199 9123 0008 8901 2"; });
  f = await pdfOf('facture-qriban'); qr = await readQr(f); const L2 = (qr || "").split("\n");
  ok(L2[27] === "QRR" && /^\d{27}$/.test(L2[28] || "") && await p.evaluate((r) => qrrRef(r.slice(0, 26)) === r, L2[28] || ""), "QR-IBAN : référence QR à 27 chiffres avec bon chiffre de contrôle");
  // Facture longue : le QR passe sur une page où il a la place
  await p.evaluate(() => { S.company.iban = "CH93 0076 2011 6238 5295 7"; const d = dossier('d3'); d._keep = clone(d.invoice.lines); const c = S.catalogue; d.invoice.lines = ["Salon", "Chambre 1", "Chambre 2", "Cuisine", "Couloir"].flatMap(r => c.slice(0, 5).map(x => ({ id: uid(), room: r, label: x.label, unit: x.unit, qty: 12, price: x.price }))); });
  f = await pdfOf('facture-longue'); const pages = +execSync(`pdfinfo "${f}" | grep Pages | awk '{print $2}'`).toString().trim();
  const last = execSync(`pdftotext -layout -f ${pages} -l ${pages} "${f}" -`).toString();
  ok(pages >= 2 && /Section paiement/.test(last) && /Page \d \/ \d/.test(last), `facture longue : ${pages} pages, QR sur la dernière`);
  await p.evaluate(() => { const d = dossier('d3'); d.invoice.lines = d._keep; delete d._keep; });
  // Sans IBAN, IBAN faux
  await p.evaluate(() => { S.company.iban = ""; render(); }); await sleep(200);
  ok(await p.locator('.warnbox', { hasText: 'IBAN' }).count() === 1, "sans IBAN : l'app dit ce qui manque");
  f = await pdfOf('facture-sansqr'); txt = execSync(`pdftotext -layout "${f}" -`).toString();
  ok(!/Section paiement/.test(txt) && /FACTURE/.test(txt), "sans IBAN : facture sans QR, mais faite");
  await p.evaluate(() => { S.company.iban = "CH93 0076 2011 6238 5295 8"; render(); }); await sleep(200);
  ok(await p.locator('.warnbox', { hasText: 'erreur' }).count() === 1, "IBAN avec une faute de frappe : signalé, pas de QR faux");
  await p.evaluate(() => { S.company.iban = "CH93 0076 2011 6238 5295 7"; save(); render(); }); await sleep(200);
  // Aperçu
  await p.click('[data-dtab="fpdf"]'); await p.waitForSelector('img.pdf-page', { timeout: 15000 });
  ok(await p.locator('img.pdf-page').count() >= 1, "aperçu de la facture affiché");
  await p.screenshot({ path: path.join(__dirname, 'facture-apercu.png'), fullPage: true });
  await p.click('[data-dtab="facture"]'); await sleep(200);
  // Envoi : message puis « c'est envoyé »
  await p.click('#inv-msg'); await sleep(300);
  let m = await p.evaluate(() => dossier('d3').messages[0]);
  ok(m.kind === "Envoi de la facture" && m.body.includes(st.inv.no) && /payable jusqu'au/.test(m.body) && m.status === "brouillon", "message d'envoi de la facture préparé");
  ok(await p.locator('[data-mfpdf]').count() === 1, "bouton « Télécharger la facture » dans le message");
  await p.click(`[data-msent="${m.id}"]`); await sleep(300);
  st = await p.evaluate(() => ({ i: dossier('d3').invoice, k: invState(dossier('d3')).k, t: invState(dossier('d3')).t, todo: todos().some(x => x.d.id === 'd3') }));
  ok(!!st.i.sentAt && st.k === "attente" && /Paiement attendu jusqu'au/.test(st.t) && !st.todo, "facture envoyée : en attente, échéance suivie, rien à faire pour l'instant");
  // Le temps passe
  const at = async (days) => p.evaluate((days) => { const d = dossier('d3'); const s = invState(d, dayStart(d.invoice.date) + days * 86400000 + 3600000); return s.k; }, days);
  ok(await at(30) === "attente" && await at(31) === "retard" && await at(35) === "retard" && await at(36) === "rappel", "jour 30 en attente, jour 31 en retard, rappel dès le jour 36 (5 jours de retard)");
  ok(fs.existsSync(notif) === false, "pas de notification tant que la facture n'est pas en retard");
  await p.evaluate(() => { const d = dossier('d3'); d.invoice.date = Date.now() - 40 * 86400000; d.invoice.sentAt = d.invoice.date; save(); go('home'); }); await sleep(600);
  ok(await p.locator('.todo', { hasText: 'envoyer un rappel' }).count() === 1 && await p.locator('#tabs .dot').count() === 1, "accueil : « envoyer un rappel » dans À faire, avec le point rouge");
  ok(await p.locator('#go-factures').count() === 1, "accueil : total des factures à encaisser");
  await p.screenshot({ path: path.join(__dirname, 'facture-accueil.png') });
  await sleep(3500);
  let nt = fs.existsSync(notif) ? fs.readFileSync(notif, 'utf8').trim().split("\n") : [];
  ok(nt.length === 1 && /rappel de paiement/.test(nt[0]) && nt[0].includes(st.i.no) && /Gobet/.test(nt[0]) && /10 jours de retard/.test(nt[0]), "notification du Mac demandée une fois : " + (nt[0] || "rien"));
  await sleep(2500); nt = fs.readFileSync(notif, 'utf8').trim().split("\n");
  ok(nt.length === 1, "pas de notification en double");
  await p.click('#go-factures'); await sleep(300);
  ok(await p.locator('.card', { hasText: 'Gobet' }).count() === 1 && await p.locator('.chip.late').count() === 1 && await p.locator('.card-sub', { hasText: 'échéance' }).count() === 1, "liste Factures : échéance et étiquette « Rappel à envoyer »");
  await p.screenshot({ path: path.join(__dirname, 'facture-liste.png') });
  await p.click('.card[data-open="d3"]'); await sleep(300);
  ok(await p.locator('#inv-paid').count() === 1, "la carte ouvre directement l'onglet Facture");
  await p.screenshot({ path: path.join(__dirname, 'facture-onglet.png'), fullPage: true });
  await p.click('#ns-rappel'); await sleep(300);
  m = await p.evaluate(() => dossier('d3').messages[0]);
  ok(m.kind === "Rappel de paiement" && /n'a pas encore été réglée/.test(m.body) && /^Rappel/.test(m.subject), "1er rappel préparé (ton aimable)");
  await p.click(`[data-msent="${m.id}"]`); await sleep(300);
  st = await p.evaluate(() => ({ i: dossier('d3').invoice, k: invState(dossier('d3')).k, later: invState(dossier('d3'), Date.now() + 10.5 * 86400000) }));
  ok(st.i.reminders.length === 1 && st.k === "retard" && st.later.k === "rappel" && /2e rappel/.test(st.later.t), "rappel noté ; 10 jours plus tard l'app demande le 2e rappel");
  await p.evaluate(() => { const d = dossier('d3'); d.invoice.reminders[0] = Date.now() - 11 * 86400000; invoiceMessage(d, "rappel"); save(); });
  m = await p.evaluate(() => dossier('d3').messages[0]);
  ok(/^2e rappel/.test(m.subject) && /Malgré/.test(m.body), "2e rappel : texte plus ferme");
  await sleep(3000); nt = fs.readFileSync(notif, 'utf8').trim().split("\n");
  ok(nt.length === 2 && /2e rappel/.test(nt[1]), "nouvelle notification pour le 2e rappel");
  // Paiement
  await p.evaluate(() => openDossier('d3', 'facture')); await sleep(200); await p.click('#inv-paid'); await sleep(300);
  st = await p.evaluate(() => ({ k: invState(dossier('d3')).k, todo: todos().some(x => x.d.id === 'd3'), ctx: dossierForAgent(dossier('d3')).invoice }));
  ok(st.k === "paye" && !st.todo && await p.locator('.chip.ok', { hasText: 'Payée' }).count() >= 1, "« Payée » : plus rien à faire, étiquette verte");
  ok(st.ctx && st.ctx.paid_on && st.ctx.reminders_sent === 1, "l'IA connaît l'état de la facture");
  // Le devis change après coup : la facture ne bouge pas
  const tot = await p.evaluate(() => { const d = dossier('d3'); const a = invTotals(d).tot; d.quote.lines[0].qty = 99; return [a, invTotals(d).tot, totals(d).tot]; });
  ok(tot[0] === tot[1] && tot[2] !== tot[0], "changer le devis après coup ne change pas la facture");
  // Numéro suivant, détails modifiables
  await p.evaluate(() => { const d = dossier('d2'); d.status = "accepte"; createInvoice(d); save(); openDossier('d2', 'facture'); }); await sleep(200);
  ok(/-002$/.test(await p.evaluate(() => dossier('d2').invoice.no)), "la facture suivante prend le numéro suivant");
  await p.evaluate(() => { document.querySelector('details.opts').open = true; }); await p.fill('#inv-days', '10'); await p.locator('#inv-days').blur(); await sleep(200);
  ok(await p.evaluate(() => { const d = dossier('d2'); return d.invoice.days === 10 && invDue(d) === dayStart(d.invoice.date) + 10 * 86400000; }), "délai de paiement modifiable par facture");
  // Réglages et rechargement
  await p.evaluate(() => go('settings')); await sleep(200); await p.evaluate(() => document.querySelectorAll('details.blk').forEach(x => x.open = true));
  await p.fill('#s-paydays', '20'); await p.fill('#s-rappel', '0'); await sleep(700);
  ok(await p.evaluate(() => payDays() === 20 && rappelDays() === 0), "Paramètres : délai de paiement et délai de rappel");
  await p.reload(); await sleep(900);
  ok(await p.evaluate(() => !!dossier('d3').invoice.paidAt && dossier('d2').invoice.days === 10 && S.defaults.payDays === 20), "tout est enregistré après rechargement");
  ok(errs.length === 0, "aucune erreur dans la page " + errs.join(" | "));
  await b.close(); s.kill(); process.exit(0);
})();
