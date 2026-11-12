// Assistant à l'accueil : zone « Parler à mon assistant », vue d'ensemble calculée par le logiciel, factures par la parole.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ok = (c, t) => console.log((c ? 'PASS ' : 'FAIL ') + t);
(async () => {
  const data = path.join(__dirname, 'data18'); fs.rmSync(data, { recursive: true, force: true }); fs.rmSync(path.join(__dirname, 'oracle.jsonl'), { force: true });
  const mock = spawn('node', ['oracle.mjs'], { cwd: __dirname });
  const s = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: 'k', OPENAI_API_KEY: '', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4012', DEVISFLOW_DATA: data, PORT: '3118' } });
  await sleep(1300); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 430, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3118/'); await sleep(900);
  await p.evaluate(() => { D = askWorld(); save(); go('home'); }); await sleep(400);
  ok(await p.locator('#start-ask').count() === 1, "accueil : bouton « Parler à mon assistant »");
  // Vue d'ensemble : calculée par le logiciel
  const ov = await p.evaluate(() => { const o = overviewForAgent(); const exp = D.filter(d => d.invoice && d.invoice.sentAt && !d.invoice.paidAt).reduce((a, d) => a + invTotals(d).tot, 0); return { s: o.summary, exp, n: o.dossiers.length, first: o.dossiers[0].client }; });
  ok(Math.abs(ov.s.invoices_to_cash.total_chf - ov.exp) < 0.01 && ov.s.invoices_to_cash.count === 3, `à encaisser : ${ov.s.invoices_to_cash.count} factures, CHF ${ov.s.invoices_to_cash.total_chf}`);
  ok(ov.s.quotes_accepted_this_month === 2 && ov.s.quotes_waiting_for_answer.count === 2, "devis acceptés ce mois : 2 ; en attente de réponse : 2");
  ok(JSON.stringify(ov.s.quotes_to_relance_now) === '["Mme S. Dupont"]', "à relancer : seulement Mme Dupont (Martin a été envoyé hier)");
  ok(JSON.stringify(ov.s.payment_reminders_to_send_now) === '["M. A. Gobet"]' && JSON.stringify(ov.s.accepted_without_invoice) === '["M. R. Favre"]', "rappel de paiement : Gobet ; accepté sans facture : Favre");
  ok(ov.n === 7 && ov.first === 'M. A. Gobet', "7 dossiers, les factures à encaisser d'abord");
  // Dates d'acceptation et de premier envoi
  const st = await p.evaluate(() => { const d = { status: "envoye", sentAt: 5000, quote: { lines: [] } }; stampStatus(d); const a = d.firstSentAt; d.status = "accepte"; stampStatus(d); const b = d.acceptedAt > 0; d.status = "chiffrage"; stampStatus(d); return [a, b, d.acceptedAt]; });
  ok(st[0] === 5000 && st[1] && st[2] === undefined, "le premier envoi et le jour d'acceptation sont retenus, et effacés si le devis est rouvert");
  // Garde-fous des outils
  const g = await p.evaluate(() => { const T = (id) => invoiceTools((i) => dossier(id), () => {}); const run = (id, name, inp = {}) => { try { return T(id).find(t => t.name === name).execute(inp); } catch (e) { return "ERR " + e.message; } };
    const out = {}; out.dup = run('w3', 'create_invoice'); out.noInv = run('w7', 'mark_invoice_paid');
    const q = dossier('w2').quote.lines[0]; q.qty = ""; out.missingQty = run('w2', 'create_invoice'); q.qty = 50;
    const keep = dossier('w1').quote.lines; dossier('w1').quote.lines = []; out.empty = run('w1', 'create_invoice'); dossier('w1').quote.lines = keep;
    out.created = run('w7', 'create_invoice'); out.remNotSent = run('w7', 'prepare_invoice_message', { kind: 'rappel' });
    out.sent = run('w7', 'mark_invoice_sent'); out.remOk = run('w7', 'prepare_invoice_message', { kind: 'rappel' }); out.draft = dossier('w7').messages[0] && dossier('w7').messages[0].kind;
    out.paid = run('w7', 'mark_invoice_paid'); out.afterPaid = run('w7', 'prepare_invoice_message', { kind: 'rappel' }); return out; });
  ok(/already exists/.test(g.dup) && /no invoice/.test(g.noInv), "refuse de créer une 2e facture, ou de marquer payée une facture qui n'existe pas");
  ok(/no quantity or no price/.test(g.missingQty) && /no lines/.test(g.empty), "refuse de facturer un devis incomplet ou vide");
  ok(g.created.ok && g.created.invoice_no === '2026-005' && g.created.qr_payment_slip && /not possible/.test(g.created.qr_payment_slip), "crée la facture 2026-005 et dit que le QR manque (pas d'IBAN dans ce test)");
  ok(/not sent yet/.test(g.remNotSent) && g.sent.ok && g.remOk.ok && g.draft === 'Rappel de paiement', "pas de rappel avant l'envoi ; après l'envoi, le brouillon de rappel est préparé");
  ok(g.paid.ok && /already paid/.test(g.afterPaid), "payée : plus de rappel possible");
  // Parler à l'assistant : zone, boutons de suggestion
  await p.evaluate(() => { D = askWorld(); save(); go('home'); }); await sleep(300);
  await p.click('#start-ask'); await sleep(300);
  ok(await p.locator('#ask').count() === 1 && await p.locator('[data-askq]').count() === 3 && await p.locator('.big-new h3', { hasText: 'Mon assistant' }).count() === 1, "zone de conversation ouverte, avec 3 questions toutes prêtes");
  await p.fill('#ask', 'Qui dois-je relancer ?'); await p.click('#send-ask');
  await p.waitForFunction(() => ui.homeChat.some(m => m.role === 'assistant'), null, { timeout: 15000 }); await sleep(200);
  const r1 = await p.evaluate(() => ui.homeChat.filter(m => m.role === 'assistant').pop().text);
  ok(/Dupont/.test(r1) && !/Martin/.test(r1), "réponse : " + r1);
  const req = fs.readFileSync(path.join(__dirname, 'oracle.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).pop(), txt = JSON.stringify(req);
  ok(/VUE D'ENSEMBLE/.test(txt) && /quotes_to_relance_now/.test(txt) && !/create_dossier/.test(JSON.stringify(req.tools || [])), "l'IA reçoit la vue d'ensemble, et n'a pas l'outil « créer un dossier » ici");
  ok(await p.evaluate(() => D.length === 7 && ui.tab === 'home' && !ui.dossierId), "aucun dossier créé, on reste à l'accueil");
  // Un ordre : « Gobet a payé »
  await p.fill('#ask', 'M. Gobet a payé sa facture.'); await p.click('#send-ask');
  await p.waitForFunction(() => ui.homeChat.filter(m => m.role === 'assistant').length >= 2, null, { timeout: 15000 }); await sleep(300);
  const o = await p.evaluate(() => ({ paid: !!dossier('w3').invoice.paidAt, others: D.filter(d => d.invoice && d.invoice.paidAt).length, act: ui.homeChat.filter(m => m.role === 'action').map(m => m.text), tab: ui.tab, dot: !!document.querySelector('#tabs button[data-tab="factures"] .dot') }));
  ok(o.paid && o.others === 2 && /payée/.test(o.act.join()) && /Gobet/.test(o.act.join()) && o.tab === 'home', "« Gobet a payé » : facture marquée payée, action visible dans la discussion, on reste à l'accueil");
  ok(await p.locator('.todo', { hasText: 'Gobet' }).count() === 0 && await p.locator('#ask-ideas').count() === 0, "l'accueil se met à jour (Gobet n'est plus « à faire ») et les suggestions ont disparu");
  ok(o.dot === false, "le point rouge de l'onglet Factures disparaît (plus de rappel à envoyer)");
  await p.screenshot({ path: path.join(__dirname, 'assistant-accueil.png'), fullPage: true });
  // Terminer, puis une suggestion, puis un autre usage de l'accueil
  await p.click('#home-clear'); await sleep(200);
  ok(await p.locator('#start-ask').count() === 1 && await p.evaluate(() => !ui.homeAsk && !ui.homeMode && !ui.homeChat.length), "« Terminer » : retour à l'accueil normal");
  await p.click('#start-ask'); await sleep(200); await p.click('[data-askq]:nth-child(2)');
  await p.waitForFunction(() => ui.homeChat.some(m => m.role === 'assistant'), null, { timeout: 15000 });
  ok(/CHF/.test(await p.evaluate(() => ui.homeChat.filter(m => m.role === 'assistant').pop().text)), "bouton de suggestion : la question part toute seule");
  await p.click('#home-clear'); await sleep(200); await p.click('#start-ask'); await sleep(200); await p.evaluate(() => startCapture('msg')); await sleep(200);
  ok(await p.evaluate(() => !ui.homeAsk && ui.homeMode === null && !ui.homeChat.length && !!ui.cap), "démarrer une saisie (Dicter, Message, Photos) quitte le mode question");
  // Garde-fous d'ajout de ligne (échecs t1 et t19 du vrai test)
  const al = await p.evaluate(() => { S.aiNotes = "Toujours proposer la protection des sols pour les intérieurs."; const d = clone(D[2]); d.id = 'zz'; d.quote.lines = []; const tools = makeTools(() => d, false, { user: "Salon 45 m² de murs, plus le déplacement.", prevBot: "" }); const add = tools.find(t => t.name === "add_line"); const run = (inp) => { try { return add.execute(inp); } catch (e) { return "ERR " + e.message; } };
    const o = {}; o.free = run({ room: "Général", label: "Protection des sols et du mobilier", unit: "forfait", unit_price: 150 }); o.freeLines = d.quote.lines.length;
    run({ room: "Général", item_id: "travel" }); const f = d.quote.lines[0]; o.forfait = f && [f.qty, f.missingQty];
    o.paper = run({ room: "Entrée", label: "Pose de papier peint", unit: "m²", qty: 15 }); o.paperLine = d.quote.lines.find(l => /papier/.test(l.label)); S.aiNotes = ""; return o; });
  ok(/PROPOSE/.test(al.free) && al.freeLines === 0, "une ligne libre au nom d'un article à « proposer » est refusée (comme avec l'identifiant)");
  ok(al.forfait && al.forfait[0] === 1 && al.forfait[1] === false, "un forfait ajouté sans quantité vaut 1 (pas « quantité manquante »)");
  ok(al.paperLine && al.paperLine.missingPrice === true && al.paperLine.price === 0, "une vraie ligne libre reste sans prix inventé");
  const sc = await p.evaluate(() => { D = askWorld(); const id = "ds0c0it"; D[0].id = id; const l = D[0].quote.lines[0].id; return [scrubIds(`Dossier créé pour Sarah Bapst à Givisiez (${id}). Il manque les surfaces.`), scrubIds(`La ligne ${l} est à 150.00 (dossier ${id}).`), scrubIds("Tu dois relancer Mme Dupont."), scrubIds("Facture 2026-001 payée, total CHF 1'295.05.")]; });
  ok(sc[0] === "Dossier créé pour Sarah Bapst à Givisiez. Il manque les surfaces." && !/ds0c0it/.test(sc[1]) && sc[2] === "Tu dois relancer Mme Dupont." && sc[3] === "Facture 2026-001 payée, total CHF 1'295.05.", "un identifiant technique recopié par l'IA est effacé, le reste de la réponse n'est pas touché : " + JSON.stringify(sc));
  ok(errs.length === 0, "aucune erreur dans la page " + errs.join(' | '));
  await b.close(); s.kill(); mock.kill(); process.exit(0);
})();
