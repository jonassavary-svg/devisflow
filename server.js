// DevisFlow – serveur local
// Sert l'application, enregistre les données sur le disque (dossier data/)
// et relaie les demandes de l'assistant vers l'API Claude (la clé reste sur le serveur).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(here, ".env")); } catch { /* pas de fichier .env : on continue */ }

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.DEVISFLOW_MODEL || "claude-opus-5-5";
const EFFORT = process.env.DEVISFLOW_EFFORT || "medium";
const PUBLIC = path.join(here, "public");
const DATA_DIR = process.env.DEVISFLOW_DATA || path.join(here, "data");
const DATA_FILE = path.join(DATA_DIR, "devisflow.json");
const BACKUP_DIR = path.join(DATA_DIR, "sauvegardes");
const LOG_FILE = path.join(DATA_DIR, "ia-usage.jsonl");
const MAX_BODY = 25 * 1024 * 1024;
// Prix indicatifs en USD par million de tokens (entrée, sortie), pour estimer la facture.
const PRICES = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);
const client = hasKey() ? new Anthropic() : null;

/* ---------- Données ---------- */
function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch { return null; }
}
function writeData(obj) {
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.dossiers) || typeof obj.settings !== "object") throw new Error("Données invalides");
  const json = JSON.stringify(obj);
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, DATA_FILE); // écriture atomique : jamais de fichier à moitié écrit
  // Une sauvegarde par jour, on garde les 30 dernières.
  const day = new Date().toISOString().slice(0, 10);
  const backup = path.join(BACKUP_DIR, `devisflow-${day}.json`);
  fs.writeFileSync(backup, json);
  const all = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json")).sort();
  all.slice(0, Math.max(0, all.length - 30)).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
}

/* ---------- Suivi des coûts IA ---------- */
function logUsage(model, usage) {
  const line = { at: new Date().toISOString(), model, in: (usage?.input_tokens || 0) + (usage?.cache_creation_input_tokens || 0) + (usage?.cache_read_input_tokens || 0), out: usage?.output_tokens || 0 };
  fs.appendFile(LOG_FILE, JSON.stringify(line) + "\n", () => {});
}
function usageThisMonth() {
  const month = new Date().toISOString().slice(0, 7);
  let calls = 0, usd = 0;
  try {
    for (const l of fs.readFileSync(LOG_FILE, "utf8").split("\n")) {
      if (!l.startsWith(`{"at":"${month}`)) continue;
      const u = JSON.parse(l); const p = PRICES[u.model] || PRICES["claude-opus-5-5"];
      calls++; usd += (u.in * p[0] + u.out * p[1]) / 1e6;
    }
  } catch { /* pas encore de journal */ }
  return { month, calls, usd: Math.round(usd * 100) / 100 };
}

/* ---------- Appel à Claude ---------- */
function cleanTools(tools) {
  if (!Array.isArray(tools)) return [];
  return tools.slice(0, 40).map(t => ({ name: String(t.name), description: String(t.description || ""), input_schema: t.input_schema && typeof t.input_schema === "object" ? t.input_schema : { type: "object", properties: {} } }));
}
async function callClaude(body) {
  const req = {
    model: MODEL,
    max_tokens: 16000,
    messages: body.messages,
    output_config: { effort: EFFORT }
  };
  // Si un filtre de sécurité refuse à tort, l'API réessaie sur un autre modèle.
  if (/^claude-(opus|sonnet|fable)/.test(MODEL)) { req.betas = ["server-side-fallback-2026-07-01"]; req.fallbacks = "default"; }
  if (body.system) req.system = [{ type: "text", text: String(body.system), cache_control: { type: "ephemeral" } }];
  const tools = cleanTools(body.tools);
  if (tools.length) req.tools = tools;
  const res = await client.beta.messages.create(req);
  logUsage(MODEL, res.usage);
  return { content: res.content, stop_reason: res.stop_reason };
}
function aiError(e) {
  if (e instanceof Anthropic.AuthenticationError) return [401, "bad_key", "La clé API est refusée. Vérifie ANTHROPIC_API_KEY dans le fichier .env."];
  if (e instanceof Anthropic.PermissionDeniedError) return [403, "not_granted", "Cette clé API n'a pas accès au modèle demandé."];
  if (e instanceof Anthropic.RateLimitError) return [429, "rate_limited", "Trop de demandes en même temps, réessaie dans quelques secondes."];
  if (e instanceof Anthropic.BadRequestError) return [400, "bad_request", e.message];
  if (e instanceof Anthropic.APIConnectionError) return [502, "offline", "Pas de connexion à l'API Claude. Vérifie internet."];
  if (e instanceof Anthropic.APIError) return [502, "upstream_error", e.message];
  return [500, "server_error", String(e?.message || e)];
}

/* ---------- Petit serveur HTTP ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > MAX_BODY) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new Error("bad_json")); } });
    req.on("error", reject);
  });
}
function indexHtml() {
  const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  const data = JSON.stringify(readData()).replace(/</g, "\\u003c");
  return html.replace("<!--DF_DATA-->", `<script>window.__DF_DATA = ${data}; window.__DF_AI = ${JSON.stringify({ ready: hasKey(), model: MODEL })};</script>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/status") return send(res, 200, { ai: hasKey(), model: MODEL, effort: EFFORT, usage: usageThisMonth() });
    if (url.pathname === "/api/data" && req.method === "GET") return send(res, 200, readData() || {});
    if (url.pathname === "/api/data" && (req.method === "PUT" || req.method === "POST")) {
      writeData(await readBody(req)); return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/ai" && req.method === "POST") {
      if (!client) return send(res, 503, { code: "no_key", error: "Pas de clé API : ajoute ANTHROPIC_API_KEY dans le fichier .env puis relance l'app." });
      const body = await readBody(req);
      if (!Array.isArray(body.messages) || !body.messages.length) return send(res, 400, { code: "bad_request", error: "messages manquants" });
      try { return send(res, 200, await callClaude(body)); }
      catch (e) { const [st, code, msg] = aiError(e); console.error("[IA]", code, msg); return send(res, st, { code, error: msg }); }
    }
    if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not_found" });
    // Fichiers de l'application
    if (url.pathname === "/" || url.pathname === "/index.html") return send(res, 200, indexHtml(), TYPES[".html"]);
    const file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "Introuvable", "text/plain");
    return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || "application/octet-stream");
  } catch (e) {
    const msg = e.message === "too_large" ? "Fichier trop gros" : e.message === "bad_json" ? "Requête invalide" : e.message;
    console.error("[serveur]", e);
    return send(res, e.message === "too_large" ? 413 : 400, { error: msg });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nDevisFlow est lancé : http://localhost:${PORT}`);
  console.log(hasKey() ? `Assistant IA : actif (${MODEL}, effort ${EFFORT})` : "Assistant IA : INACTIF, ajoute ta clé dans le fichier .env (voir LISEZMOI.md)");
  console.log(`Données : ${DATA_FILE}\n`);
});
