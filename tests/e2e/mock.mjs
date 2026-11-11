import http from "node:http"; import fs from "node:fs";
const LOG = process.argv[2] || "requests.jsonl";
let n = 0;
const tu = (name, input) => ({ type: "tool_use", id: "tu_" + (++n), name, input });
function reply(body) {
  const msgs = body.messages;
  const firstText = (msgs[0].content.find(b => b.type === "text") || {}).text || "";
  const steps = msgs.filter(m => m.role === "assistant").length;
  const lastUser = msgs[msgs.length - 1];
  const results = lastUser.content.filter(b => b.type === "tool_result");
  if (/Salon : murs 42/.test(firstText)) {
    if (steps === 0) return [[{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: "Je regarde ton catalogue." }, tu("get_catalogue", {})], "tool_use"];
    if (steps === 1) return [[tu("add_line", { room: "Salon", item_id: "protect", qty: 1 }), tu("add_line", { room: "Salon", item_id: "prep", qty: 42 }), tu("add_line", { room: "Salon", item_id: "paint", qty: 42 }), tu("add_line", { room: "Salon", item_id: "ceil", qty: 18 }), tu("add_line", { room: "Salon", item_id: "wood", qty: 1 })], "tool_use"];
    if (steps === 2) return [[tu("add_line", { room: "Salon", item_id: "paint", qty: 42 })], "tool_use"]; // doublon : doit être refusé
    return [[{ type: "text", text: "C'est fait : salon chiffré avec tes tarifs. Autre pièce ?" }], "end_turn"];
  }
  if (/nouveau client M\. Martin/.test(firstText)) {
    if (steps === 0) return [[tu("list_dossiers", {})], "tool_use"];
    if (steps === 1) return [[tu("create_dossier", { client_name: "M. Martin", place: "Marly", title: "Repeindre 3 chambres", source: "Appel", facts: ["3 chambres"], missing: ["Surfaces des murs"] })], "tool_use"];
    if (steps === 2) return [[tu("propose_choices", { options: ["Je passe demain", "Demander des photos"] })], "tool_use"];
    return [[{ type: "text", text: "Dossier créé pour M. Martin à Marly. Tu organises une visite ?" }], "end_turn"];
  }
  if (/Donne un titre très court/.test(firstText)) return [[{ type: "text", text: "« Devis Gérard »" }], "end_turn"];
  if (/Note de l'artisan/.test(firstText)) {
    if (steps === 0) return [[tu("create_dossier", { client_name: "M. Gérard", place: "Givisiez", title: "Salon", source: "Visite", facts: ["Salon"], missing: [] })], "tool_use"];
    if (steps === 1) return [[tu("add_line", { room: "Salon", item_id: "prep", qty: 30 }), tu("add_line", { room: "Salon", item_id: "paint", qty: 30 }), tu("save_message_draft", { kind: "Envoi du devis", subject: "Votre devis", body: "Bonjour M. Gérard,\n\nVoici notre devis.\n\nMeilleures salutations" })], "tool_use"];
    return [[{ type: "text", text: "Dossier créé, devis prêt et message d'envoi préparé." }], "end_turn"];
  }
  if (/pour plus tard/.test(firstText)) {
    if (steps === 0) return [[tu("save_note", { title: "Rappeler Mme Rey", text: "Rappeler Mme Rey pour sa salle de bain." })], "tool_use"];
    return [[{ type: "text", text: "C'est noté dans tes notes." }], "end_turn"];
  }
  if (/prochains devis lui ressemblent/.test(firstText)) return [[{ type: "text", text: JSON.stringify({ title: "Offre", color: "#9A3B26", font: "serif", parts_by: "Pièce", intro: "Suite à notre visite, nous avons le plaisir de vous soumettre notre offre pour les travaux suivants.", closing: "Dans l'attente de votre accord, nous vous adressons nos meilleures salutations.", payment: "Paiement à 30 jours net, acompte de 30 % à la commande.", validity_days: 60, conditions: ["Les échafaudages ne sont pas compris.", "Offre valable 60 jours."], style: "Libellés détaillés avec le nom du produit et le nombre de couches.", examples: ["Peinture murs 2 couches dispersion mate Sikkens"], lines: [{ label: "Peinture radiateur", unit: "pce", price: 45 }] }) }], "end_turn"];
  if (/ancien devis/.test(firstText)) return [[{ type: "text", text: '[{"label":"Peinture radiateur","unit":"pce","price":45}]' }], "end_turn"];
  return [[{ type: "text", text: "D'accord, c'est noté ?" }], "end_turn"];
}
http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const body = JSON.parse(b);
    fs.appendFileSync(LOG, JSON.stringify({ url: req.url, headers: { beta: req.headers["anthropic-beta"], key: req.headers["x-api-key"] }, body }) + "\n");
    const [content, stop_reason] = reply(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_" + n, type: "message", role: "assistant", model: body.model, content, stop_reason, usage: { input_tokens: 1000, output_tokens: 100 } }));
  });
}).listen(4010, "127.0.0.1", () => console.log("mock up"));
