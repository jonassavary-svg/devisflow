# DevisFlow (version locale)

Demandes de clients, devis avec ton catalogue de prix, PDF et relances, avec un assistant IA. Cette version tourne sur ton ordinateur et enregistre tes données sur ton ordinateur.

## Installation (une seule fois, environ 10 minutes)

1. **Installer Node.js** (version 20.12 ou plus récente) : télécharge la version « LTS » sur https://nodejs.org et installe-la.
2. **Télécharger DevisFlow avec git** (pour les mises à jour automatiques). Dans le Terminal (Cmd + Espace, tape « Terminal ») :
   ```
   cd ~/Desktop
   git clone https://github.com/jonassavary-svg/devisflow.git
   cd devisflow
   ```
   Si le Mac propose d'installer les « outils de développement », accepte, puis relance la commande `git clone`.
3. **Ajouter une clé API** pour l'assistant IA, au choix OpenAI (https://platform.openai.com/api-keys) ou Anthropic (https://console.anthropic.com), avec un peu de crédit (5 à 10 $ suffisent pour commencer) :
   ```
   cp .env.example .env
   open -e .env
   ```
   Colle ta clé après `OPENAI_API_KEY=` (ou après `ANTHROPIC_API_KEY=`), puis enregistre (Cmd + S). Une seule clé suffit.
4. **Installer DevisFlow en continu** :
   ```
   bash installer-mac.sh
   ```
   C'est tout. L'app s'ouvre sur **http://localhost:3000**.

## Au quotidien

- DevisFlow tourne en permanence, même après un redémarrage du Mac : ouvre simplement http://localhost:3000 (ajoute-le à tes favoris).
- **Mises à jour automatiques** : toutes les 2 minutes, DevisFlow regarde s'il y a une nouvelle version sur GitHub, l'installe et redémarre. La page se recharge toute seule quand tu n'es pas en train d'écrire.
- Ton fichier `.env` et tes données (`data/`) ne sont jamais touchés par les mises à jour.
- Journal (en cas de problème) : `~/Library/Logs/DevisFlow.log`. Pour le voir : `open ~/Library/Logs/DevisFlow.log`
- Pour arrêter DevisFlow et ne plus le lancer au démarrage : `bash desinstaller-mac.sh`
- Après avoir changé ta clé dans `.env` : relance `bash installer-mac.sh` pour que le changement soit pris en compte.

Sans clé API, l'app fonctionne quand même (dossiers, devis, PDF), mais sans l'assistant IA.

## Où sont mes données ?

- Dans le dossier `data/` de DevisFlow (`data/devisflow.json`).
- Une sauvegarde automatique par jour dans `data/sauvegardes/` (les 30 derniers jours).
- Paramètres, en bas : « Exporter » pour télécharger une copie.

## Vérifier que l'IA chiffre juste

Paramètres, section **Tests de l'IA** : l'assistant refait des devis dont on connaît la bonne réponse et te montre ce qui est juste ou faux. Coût : environ 0.50 à 1 CHF par série.

Quand un vrai devis est juste, ouvre-le, onglet **Devis**, bouton **Utiliser comme test de l'IA**. Plus tu ajoutes de vrais devis, plus le test est fiable.

## Ce que l'assistant ne fait jamais

- Il n'invente pas de prix : il prend ceux de ton catalogue, sinon il te demande.
- Il n'envoie rien : les emails et SMS sont des brouillons que tu relis.
- Il refuse d'ajouter deux fois la même prestation dans la même pièce et signale les quantités anormales.

## Bon à savoir

- **Dictée** : utilise la reconnaissance vocale du navigateur. Dans Chrome, l'audio passe par les serveurs de Google pour être transcrit.
- **Coût de l'IA** : affiché dans Paramètres (« Utilisation de l'IA ce mois »). Modèle utilisé : `gpt-5-mini` avec une clé OpenAI, `claude-opus-5-5` avec une clé Anthropic, réglable dans `.env`.
- **Sur le téléphone** : cette version locale est faite pour l'ordinateur. La version en ligne (téléphone, plusieurs artisans, TestFlight) est l'étape suivante.
