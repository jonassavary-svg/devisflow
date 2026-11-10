// DevisFlow – superviseur
// Garde le serveur allumé (le relance s'il s'arrête) et installe les mises à jour de GitHub
// toutes les 2 minutes : git pull, npm install si besoin, puis redémarrage du serveur.
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK_EVERY = Number(process.env.DEVISFLOW_UPDATE_SECONDS || 120) * 1000;
const log = (...a) => console.log(new Date().toLocaleString("fr-CH"), ...a);

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let child = null, stopping = false;
function startServer() {
  child = spawn(process.execPath, ["server.js"], { cwd: ROOT, stdio: "inherit", env: process.env });
  child.on("exit", (code) => {
    child = null;
    if (stopping) return;
    log(`Serveur arrêté (code ${code}), redémarrage dans 3 s`);
    setTimeout(startServer, 3000);
  });
}
function restartServer() {
  if (!child) return startServer();
  stopping = true;
  child.once("exit", () => { stopping = false; startServer(); });
  child.kill("SIGTERM");
}

function checkUpdates() {
  try {
    const before = git("rev-parse", "HEAD");
    git("fetch", "--quiet", "origin");
    const remote = git("rev-parse", "@{u}");
    if (remote === before) return;
    git("merge", "--ff-only", "@{u}");
    const changed = git("diff", "--name-only", before, "HEAD").split("\n");
    log("Mise à jour installée :", git("log", "-1", "--format=%s"));
    if (changed.some(f => f === "package.json" || f === "package-lock.json")) {
      log("Installation des nouvelles dépendances…");
      execFileSync(npmCmd, ["install", "--no-audit", "--no-fund"], { cwd: ROOT, stdio: "inherit" });
    }
    restartServer();
  } catch (e) {
    log("Mise à jour impossible pour l'instant :", (e.stderr || e.message || "").toString().trim().split("\n")[0]);
  }
}

process.on("SIGTERM", () => { stopping = true; if (child) child.kill("SIGTERM"); process.exit(0); });
process.on("SIGINT", () => { stopping = true; if (child) child.kill("SIGTERM"); process.exit(0); });

log("Superviseur DevisFlow démarré dans", ROOT);
checkUpdates();
if (!child) startServer();
setInterval(checkUpdates, CHECK_EVERY);
