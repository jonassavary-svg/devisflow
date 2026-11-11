import http from "node:http"; import fs from "node:fs";
let n = 0; const call = (name, args) => ({ id: "call_" + (++n), type: "function", function: { name, arguments: JSON.stringify(args) } });
http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const body = JSON.parse(b); fs.appendFileSync("oai.jsonl", JSON.stringify({ url: req.url, body }) + "\n");
  const user = body.messages.find(m => m.role === "user"); const first = Array.isArray(user.content) ? user.content.map(p => p.text || "").join(" ") : user.content;
  const steps = body.messages.filter(m => m.role === "assistant").length; let msg;
  if (/Salon : murs 42/.test(first)) msg = steps === 0 ? { role: "assistant", content: null, tool_calls: [call("get_catalogue", {})] }
    : steps === 1 ? { role: "assistant", content: null, tool_calls: [["protect", 1], ["prep", 42], ["paint", 42], ["ceil", 18], ["wood", 1]].map(([id, q]) => call("add_line", { room: "Salon", item_id: id, qty: q })) }
    : { role: "assistant", content: "Salon chiffré. Autre pièce ?" };
  else if (/M\. Martin/.test(first)) msg = steps === 0 ? { role: "assistant", content: null, tool_calls: [call("create_dossier", { client_name: "M. Martin", title: "3 chambres", place: "Marly" })] } : { role: "assistant", content: "Dossier créé." };
  else msg = { role: "assistant", content: "Noté ?" };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "x", object: "chat.completion", model: body.model, choices: [{ index: 0, message: msg, finish_reason: msg.tool_calls ? "tool_calls" : "stop" }], usage: { prompt_tokens: 800, completion_tokens: 50 } }));
}); }).listen(4011, "127.0.0.1");
