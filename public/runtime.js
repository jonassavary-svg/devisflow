// DevisFlow – capacités du navigateur pour la version locale.
// Fournit window.claude.use(nom) avec : sample (assistant IA via le serveur local),
// dictation (dictée du navigateur), tts (lecture à voix haute) et downloads (enregistrer un fichier).
(function () {
  const MAX_STEPS = 14; // nombre maximum d'actions de l'IA pour un seul message

  async function post(url, body) {
    let r;
    try { r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
    catch (e) { const err = new Error("Serveur local injoignable"); err.code = "offline"; throw err; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error || "Erreur " + r.status); err.code = j.code || "upstream_error"; throw err; }
    return j;
  }

  // Photo (File ou data URL) -> bloc image JPEG réduit à 1568 px max.
  function imageBlock(src) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = typeof src === "string" ? src : URL.createObjectURL(src);
      img.onload = () => {
        const k = Math.min(1, 1568 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        if (typeof src !== "string") URL.revokeObjectURL(url);
        resolve({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] } });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function toMessages(history) {
    const out = [];
    for (const m of history) {
      const content = typeof m.content === "string" ? [{ type: "text", text: m.content || "…" }] : m.content;
      const last = out[out.length - 1];
      if (last && last.role === m.role) last.content.push(...content); // l'API veut des rôles alternés
      else out.push({ role: m.role, content: [...content] });
    }
    while (out.length && out[0].role !== "user") out.shift();
    return out;
  }

  // Boucle de l'agent : l'IA demande des outils, la page les exécute, on renvoie les résultats.
  async function sample(history, opts = {}) {
    const messages = toMessages(typeof history === "string" ? [{ role: "user", content: history }] : history);
    if (!messages.length) return { text: "" };
    if (opts.images && opts.images.length) {
      const blocks = (await Promise.all(opts.images.slice(0, 4).map(imageBlock))).filter(Boolean);
      messages[messages.length - 1].content.unshift(...blocks);
    }
    const tools = opts.tools || [];
    const defs = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: "object", properties: {} } }));
    let lastText = "";
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await post("/api/ai", { system: opts.system, messages, tools: defs });
      const content = Array.isArray(res.content) ? res.content : [];
      messages.push({ role: "assistant", content }); // renvoyé tel quel, sans modification
      const text = content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      if (text) { lastText = text; if (opts.onText) try { opts.onText({ text }); } catch (e) {} }
      if (res.stop_reason === "refusal") return { text: lastText || "Je ne peux pas traiter cette demande." };
      if (res.stop_reason !== "tool_use") return { text: lastText };
      const results = [];
      for (const b of content.filter(b => b.type === "tool_use")) {
        const t = tools.find(x => x.name === b.name);
        let out, isError = false;
        try { if (!t) throw new Error("Unknown tool " + b.name); out = await t.execute(b.input || {}); }
        catch (e) { out = { error: String((e && e.message) || e) }; isError = true; }
        results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out === undefined ? { ok: true } : out), ...(isError ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
    }
    return { text: lastText || "J'ai fait plusieurs modifications, vérifie le dossier." };
  }
  sample.json = async function (prompt, opts = {}) {
    const r = await sample([{ role: "user", content: prompt + "\n\nRéponds uniquement avec le JSON, sans texte autour." }], { images: opts.images, system: opts.system });
    const t = r.text || "";
    const start = t.search(/[\[{]/), end = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (start < 0 || end < start) throw new Error("Réponse sans JSON");
    return JSON.parse(t.slice(start, end + 1));
  };
  sample.limits = async () => ({ images: true });

  // Dictée avec la reconnaissance vocale du navigateur (Chrome, Edge, Safari).
  function makeDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const fin = [], par = [], st = [];
    let rec = null, state = "idle", reason = "viewer_stopped", stopping = null;
    const setState = (s, r) => { state = s; st.forEach(f => f({ state: s, reason: r })); };
    return {
      onFinal: f => fin.push(f), onPartial: f => par.push(f), onState: f => st.push(f),
      start() {
        return new Promise((resolve, reject) => {
          if (rec) return resolve();
          rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true;
          let started = false;
          rec.onstart = () => { started = true; setState("listening"); resolve(); };
          rec.onresult = (e) => {
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              if (r.isFinal) { const t = r[0].transcript.trim(); if (t) fin.forEach(f => f({ text: " " + t })); }
              else interim += r[0].transcript;
            }
            par.forEach(f => f({ text: interim }));
          };
          rec.onerror = (e) => {
            reason = (e.error === "not-allowed" || e.error === "service-not-allowed") ? "not_granted"
              : (e.error === "no-speech" || e.error === "aborted") ? "viewer_stopped" : "upstream_error";
            if (!started) { const err = new Error(e.error); err.code = reason === "not_granted" ? "not_granted" : "unavailable"; rec = null; reject(err); }
          };
          rec.onend = () => {
            const r = reason; reason = "viewer_stopped"; rec = null;
            par.forEach(f => f({ text: "" }));
            if (started) setState("idle", r);
            if (stopping) { stopping(); stopping = null; }
          };
          try { rec.start(); } catch (e) { rec = null; e.code = "unavailable"; reject(e); }
        });
      },
      stop() {
        return new Promise((resolve) => {
          if (!rec) return resolve();
          stopping = resolve; setState("finishing"); rec.stop();
        });
      }
    };
  }

  // Lecture à voix haute.
  function makeTts() {
    if (!("speechSynthesis" in window)) return null;
    return {
      speak(text) {
        return new Promise((resolve) => {
          const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR";
          const v = speechSynthesis.getVoices().find(x => x.lang && x.lang.startsWith("fr")); if (v) u.voice = v;
          u.onend = u.onerror = () => resolve(); speechSynthesis.cancel(); speechSynthesis.speak(u);
        });
      },
      stop() { speechSynthesis.cancel(); return Promise.resolve(); }
    };
  }

  // Enregistrer un fichier (PDF).
  const downloads = {
    save({ filename, data }) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = document.createElement("a"); a.href = url; a.download = filename || "fichier";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return Promise.resolve();
    }
  };

  const aiReady = !!(window.__DF_AI && window.__DF_AI.ready);
  window.claude = {
    use(name) {
      if (name === "sample") return Promise.resolve(aiReady ? sample : null);
      if (name === "dictation") return Promise.resolve(makeDictation());
      if (name === "tts") return Promise.resolve(makeTts());
      if (name === "downloads") return Promise.resolve(downloads);
      return Promise.resolve(null);
    }
  };
})();
