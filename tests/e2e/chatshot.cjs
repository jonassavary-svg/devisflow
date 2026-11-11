const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.rmSync('data9', { recursive: true, force: true });
  const s = spawn('node', ['server.js'], { cwd: require('path').join(__dirname, '..', '..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', DEVISFLOW_DATA: __dirname + '/data9', PORT: '3109' } });
  await sleep(1200);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3109/?tests'); await sleep(800);
  await p.evaluate(() => {
    const d = dossier('d4'); d.client.name = "Sarah Bapst"; d.title = "Salon et chambre, Givisiez"; d.status = "chiffrage"; d.missing = ["Adresse complète", "Email du client"];
    d.chat = [
      { role: "user", text: "[Note de l'artisan : Peinture Bapst Givisiez]\nClient : bapst givisiez\nMessage du client :\nBonjour, j’aimerais repeindre mon salon et ma chambre à Givisiez, c’est possible avant Noël ? Sarah Bapst, 079 555 66 77" },
      { role: "action", text: "Nouveau dossier créé (Accueil: message client)" },
      { role: "action", text: "+ Salon : Préparation des surfaces (lessivage, ponçage) · quantité à préciser" },
      { role: "action", text: "+ Salon : Peinture murs, dispersion mate · quantité à préciser" },
      { role: "action", text: "+ Chambre : Préparation des surfaces (lessivage, ponçage) · quantité à préciser" },
      { role: "action", text: "+ Chambre : Peinture murs, dispersion mate · quantité à préciser" },
      { role: "assistant", text: "C'est noté pour Sarah Bapst à Givisiez. Quelles sont les surfaces des murs du salon et de la chambre ?" },
      { role: "action", text: "⚠ À vérifier : Quantité manquante : Préparation (Salon)" },
      { role: "user", text: "Salon 45 m² de murs, plafond 20. Chambre 32 m² de murs, une porte. Préparation et peinture partout, plus le déplacement." },
      { role: "action", text: "Dossier mis à jour" },
      { role: "action", text: "+ Salon : Peinture plafond · 20 m²" }, { role: "action", text: "+ Chambre : Laque boiseries (portes, encadrements) · 1 pce" },
      { role: "action", text: "+ Général : Déplacement et nettoyage de fin de chantier · 1 forfait" },
      { role: "action", text: "✎ Préparation des surfaces (lessivage, ponçage) · 45 m²" }, { role: "action", text: "✎ Peinture murs, dispersion mate · 45 m²" },
      { role: "action", text: "✎ Préparation des surfaces (lessivage, ponçage) · 32 m²" }, { role: "action", text: "✎ Peinture murs, dispersion mate · 32 m²" },
      { role: "assistant", text: "Devis à jour : CHF 3'077.– TTC. Tu veux que je compte aussi la protection des sols (CHF 150.–) ?" }
    ];
    openDossier('d4', 'chat');
  }); await sleep(400);
  await p.locator('.acts summary').last().click(); await sleep(200);
  await p.screenshot({ path: __dirname + '/captures/discussion.png', fullPage: true });
  console.log('erreurs', errs); await b.close(); s.kill(); process.exit(0);
})();
