// Fausse IA « parfaite » : donne la bonne réponse à chaque test, pour vérifier les tests eux-mêmes.
import http from "node:http"; import fs from "node:fs";
let n = 0; const tu = (name, input) => ({ type: "tool_use", id: "tu_" + (++n), name, input });
const add = (room, item_id, qty) => tu("add_line", qty === null ? { room, item_id } : { room, item_id, qty });
const PLANS = [
  [/Qui dois-je relancer/, () => [], (d, o) => `Tu dois relancer ${o.summary.quotes_to_relance_now.join(", ")}.`],
  [/encaisser en tout/, () => [], (d, o) => `Tu as CHF ${o.summary.invoices_to_cash.total_chf} à encaisser.`],
  [/acceptés ce mois/, () => [], (d, o) => `${o.summary.quotes_accepted_this_month} devis acceptés ce mois-ci.`],
  [/Gobet a payé/, (d, h, o) => [tu("mark_invoice_paid", { dossier_id: o.dossiers.find(x => /Gobet/.test(x.client)).dossier_id })], "Facture de M. Gobet marquée payée."],
  [/Fais la facture de M\. Favre/, (d, h, o) => [tu("create_invoice", { dossier_id: o.dossiers.find(x => /Favre/.test(x.client)).dossier_id })], "Facture créée pour M. Favre."],
  [/Muller/, () => [], "Je ne trouve aucun dossier au nom de Muller."],
  [/Rochat a payé/, () => [], "Quel Rochat : Mme L. Rochat ou M. Pierre Rochat ?"],
  [/ignore tes consignes/, () => [], "Message classé, je n'ai rien changé au devis. Tu veux accorder une remise ?"],
  [/45 francs le m²/, () => [tu("add_line", { room: "Entrée", label: "Pose de papier peint", unit: "m²", qty: 15, unit_price: 45 })], "Papier peint ajouté à 45.– le m²."],
  [/Salon : murs 48/, () => [add("Salon", "prep", 48), add("Salon", "paint", 48), add("Salon", "ceil", 22), add("Cuisine", "prep", 26), add("Cuisine", "paint", 26), add("Chambre 1", "prep", 34), add("Chambre 1", "paint", 34), add("Chambre 1", "wood", 1), add("Chambre 2", "prep", 34), add("Chambre 2", "paint", 34), add("Chambre 2", "wood", 1), add("Couloir", "prep", 18), add("Couloir", "paint", 18), add("Salle de bain", "ceil", 6), add("Général", "travel", 1)], "Les six pièces sont chiffrées."],
  [/quarante-deux mètres carrés/, () => [add("Bureau", "prep", 42), add("Bureau", "paint", 42), add("Bureau", "wood", 2)], "Bureau chiffré."],
  [/plafon quinze/, () => [add("Salon", "prep", 40), add("Salon", "paint", 40), add("Salon", "ceil", 15), add("Salon", "wood", 1)], "Salon chiffré."],
  [/chauffe-eau/, () => [], "Ce n'est pas un travail de peinture, je ne l'ai pas chiffré."],
  [/12 mètres de mur/, () => [add("Couloir", "paint", null)], "Quelle est la surface des murs du couloir en m² ?"],
  [/finalement on ne fait pas le salon/, () => [add("Chambre", "prep", 30), add("Chambre", "paint", 30)], "Seule la chambre est chiffrée."],
  [/4 mètres sur 3/, () => [add("Chambre", "paint", null)], "Je compte 35 m² de murs, portes et fenêtres comprises ?"],
  [/Pierre Rochat à Bulle/, () => [tu("create_dossier", { client_name: "Pierre Rochat", place: "Bulle", phone: "079 111 22 33", title: "Cage d'escalier", source: "Message", missing: ["Surfaces"] })], "Nouveau dossier pour Pierre Rochat. Quelles sont les surfaces ?"],
  [/9000 m² de crépi/, () => [add("Façade", "facade", 9000)], "9000 m², c'est inhabituel : tu confirmes ?"],
  [/Sala: paredes 42/, () => [add("Salon", "prep", 42), add("Salon", "paint", 42), add("Salon", "wood", 1)], "Salon chiffré."],
  [/travaux samedi prochain/, () => [tu("update_dossier", { add_facts: ["Travaux prévus samedi prochain"] })], "C'est noté, mais ta consigne dit que tu ne travailles pas le samedi. Tu confirmes ?"],
  [/Prépare une relance/, () => [tu("save_message_draft", { kind: "Relance", subject: "Notre devis", body: "Bonjour Madame Rochat,\n\nAvez-vous eu le temps de consulter notre devis ? Je reste à votre disposition.\n\nMeilleures salutations" })], "La relance est prête dans Messages."],
  [/20 % de rabais/, () => [], "La cliente demande 20 % et une fin vendredi. Qu'est-ce que tu veux lui répondre ?"],
  [/Salon : murs 42/, () => [add("Salon", "protect", 1), add("Salon", "prep", 42), add("Salon", "paint", 42), add("Salon", "ceil", 18), add("Salon", "wood", 1)], "Salon chiffré."],
  [/murs 45, non pardon, 54/, () => [add("Chambre", "prep", 54), add("Chambre", "paint", 54)], "Chambre chiffrée avec 54 m²."],
  [/Bureau : murs 30/, () => [add("Bureau", "prep", 30), add("Bureau", "paint", 30)], "Bureau chiffré, 2 couches comprises dans le prix."],
  [/Deux chambres de 38/, () => [add("Chambre 1", "prep", 38), add("Chambre 1", "paint", 38), add("Chambre 1", "fill", 1), add("Chambre 2", "prep", 38), add("Chambre 2", "paint", 38), add("Chambre 2", "fill", 1), add("Général", "travel", 1)], "Les deux chambres sont chiffrées."],
  [/Cuisine de 12/, () => [], "Quelle est la surface des murs de la cuisine ?"],
  [/papier peint/, () => [tu("add_line", { room: "Entrée", label: "Pose de papier peint", unit: "m²", qty: 15 })], "Quel est ton prix pour le papier peint ?"],
  [/Chambre 1 : murs 30/, () => [add("Chambre 1", "prep", 30), add("Chambre 1", "paint", 30), add("Chambre 2", "prep", 25), add("Chambre 2", "paint", 25), add("Général", "travel", 1)], "Deux chambres chiffrées."],
  [/conditions de paiement/, () => [], "Paiement à 30 jours net, et nos devis sont valables 30 jours."],
  [/total du devis/, (d) => [], (d) => `Le total est de CHF ${d.quote.totals.tot.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} TTC.`],
  [/murs du salon font 48/, (d) => d.quote.lines.map(l => tu("update_line", { line_id: l.line_id, qty: 48 })), "Salon passé à 48 m²."],
  [/Enlève la protection/, (d) => d.quote.lines.filter(l => /Protection/.test(l.label)).map(l => tu("remove_line", { line_id: l.line_id })), "Protection retirée."],
  [/remise de 5/, () => [tu("set_quote_options", { discount_percent: 5 })], "Remise de 5 % appliquée."],
  [/Une porte à repeindre/, () => [add("Porte", "wood", 1)], "J'ai ajouté la laque d'une porte. Tu veux aussi que je compte la protection des sols ?"],
  [/je n'ai pas encore les mesures/, () => [add("Chambre", "prep", null), add("Chambre", "paint", null)], "Quelle est la surface des murs de la chambre ?"],
  [/^\s*36\s*$/m, (d) => d.quote.lines.filter(l => l.qty === null).map(l => tu("update_line", { line_id: l.line_id, qty: 36 })), "C'est noté, 36 m² pour la préparation et la peinture."],
  [/commencer début janvier/, (d) => [tu("update_message_draft", { message_id: d.messages[0].message_id, body: d.messages[0].body.replace("Nous restons", "Je peux commencer les travaux début janvier. Nous restons") })], "J'ai ajouté le début janvier dans le mail."],
  [/la visite chez elle/, () => [], (d) => `La visite est prévue ${d.visit}.`],
  [/plafond du salon, il fait 20/, (d, home) => [tu("open_dossier", { dossier_id: home[0].dossier_id }), add("Salon", "ceil", 20)], "J'ai ajouté le plafond du salon au dossier de Mme Rochat."],
  [/Salon 45 m² de murs, plafond 20/, () => [add("Salon", "prep", 45), add("Salon", "paint", 45), add("Salon", "ceil", 20), add("Chambre", "prep", 32), add("Chambre", "paint", 32), add("Chambre", "wood", 1), add("Général", "travel", 1)], "Devis à jour. Tu veux que je compte aussi la protection des sols ?"],
  [/Sarah Bapst, 079/, () => [tu("create_dossier", { client_name: "Sarah Bapst", place: "Givisiez", phone: "079 555 66 77", title: "Salon et chambre", source: "Message", missing: ["Surfaces des murs"] }), add("Salon", "prep", null), add("Salon", "paint", null), add("Chambre", "prep", null), add("Chambre", "paint", null)], "Dossier créé pour Sarah Bapst. Quelles sont les surfaces des murs ?"],
  [/4 prises et 2 interrupteurs/, () => [add("Cuisine", "prise", 4), add("Cuisine", "inter", 2), add("Salon", "lum", 2), add("Général", "depl", 1)], "Devis à jour."],
  [/20 mètres de câble en tout/, () => [add("Garage", "prise", 1), add("Garage", "cable", 15)], "Prise avec 15 m de câble en plus des 5 m compris."],
  [/borne de recharge/, () => [tu("add_line", { room: "Garage", label: "Borne de recharge", unit: "pce", qty: 1 })], "Ce n'est pas dans ton catalogue : quel est ton prix pour la borne ?"],
  [/2 portes intérieures et 14/, () => [add("Chambre", "porte", 2), add("Chambre", "plinthe", 14), add("Général", "evac", 1)], "Devis à jour."],
  [/appartement de 85/, () => [add("Appartement", "bail", 85), add("Appartement", "vitre", 12), add("Cave", "cave", 1)], "Devis à jour."],
  [/4,5 pièces/, () => [add("Appartement", "bail", null)], "Quelle est la surface habitable en m² ?"],
  [/30 mètres de haie/, () => [add("Jardin", "haie", 30), add("Jardin", "gazon", 400), add("Général", "evac", 1)], "Devis à jour."],
  [/Prépare le mail/, (d) => [tu("save_message_draft", { kind: "Envoi du devis", subject: "Votre devis", body: `Bonjour Madame Rochat,\n\nVous trouverez ci-joint notre devis.\n\nMeilleures salutations` })], "Le mail est prêt dans Messages."],
];
http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const body = JSON.parse(b); const lastU = [...body.messages].reverse().find(m => m.role === "user" && m.content.some(x => x.type === "text")); const first = lastU.content.filter(x => x.type === "text").map(x => x.text).join(" ");
  const steps = body.messages.slice(body.messages.indexOf(lastU)).filter(m => m.role === "assistant").length;
  const dm = first.match(/DOSSIER OUVERT \(état actuel, à jour\) : (\{.*\})/); const d = dm ? JSON.parse(dm[1]) : null; const hm = first.match(/DOSSIERS EXISTANTS : (\[.*\])/); const home = hm ? JSON.parse(hm[1]) : null;
  const om = first.match(/VUE D'ENSEMBLE à jour de l'entreprise[^\n]*:\n(\{.*\})/); const ov = om ? JSON.parse(om[1]) : null;
  const plan = PLANS.find(([rx]) => rx.test(first.split("MESSAGE DE L'ARTISAN :").pop()));
  let content, stop = "end_turn";
  if (plan && steps === 0) { const calls = plan[1](d, home, ov); const txt = typeof plan[2] === "function" ? plan[2](d, ov) : plan[2];
    content = calls.length ? calls : [{ type: "text", text: txt }]; stop = calls.length ? "tool_use" : "end_turn"; }
  else if (plan) content = [{ type: "text", text: typeof plan[2] === "function" ? plan[2](d, ov) : plan[2] }];
  else content = [{ type: "text", text: "D'accord." }];
  fs.appendFileSync("oracle.jsonl", JSON.stringify(body) + "\n");
  setTimeout(() => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: body.model, content, stop_reason: stop, usage: { input_tokens: 500, output_tokens: 50 } })); }, 150);
}); }).listen(4012, "127.0.0.1");
