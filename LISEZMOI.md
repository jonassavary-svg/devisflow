# DevisFlow (version locale)

Demandes de clients, devis avec ton catalogue de prix, PDF et relances, avec un assistant IA. Cette version tourne sur ton ordinateur et enregistre tes données sur ton ordinateur.

## Installation (une seule fois, environ 10 minutes)

1. **Installer Node.js** (version 20.12 ou plus récente) : télécharge la version « LTS » sur https://nodejs.org et installe-la.
2. **Télécharger DevisFlow** : sur la page GitHub du projet, bouton vert « Code », puis « Download ZIP ». Décompresse le dossier, par exemple dans `Documents/devisflow`.
3. **Ouvrir le Terminal** (Mac : touches Cmd + Espace, tape « Terminal ») et va dans le dossier :
   ```
   cd ~/Documents/devisflow
   ```
4. **Installer les dépendances** :
   ```
   npm install
   ```
5. **Ajouter ta clé API Anthropic** (pour l'assistant IA) :
   - crée une clé sur https://console.anthropic.com (menu « API Keys ») et ajoute un peu de crédit (5 à 10 $ suffisent pour commencer) ;
   - copie le fichier modèle :
     ```
     cp .env.example .env
     ```
   - ouvre `.env` avec TextEdit et colle ta clé après `ANTHROPIC_API_KEY=`, puis enregistre.

## Lancer l'app

Dans le Terminal, depuis le dossier DevisFlow :
```
npm start
```
Puis ouvre **http://localhost:3000** dans Chrome, Edge ou Safari. Pour arrêter : Ctrl + C dans le Terminal.

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
- **Coût de l'IA** : affiché dans Paramètres (« Utilisation de l'IA ce mois »). Modèle utilisé : `claude-opus-5-5`, réglable dans `.env`.
- **Sur le téléphone** : cette version locale est faite pour l'ordinateur. La version en ligne (téléphone, plusieurs artisans, TestFlight) est l'étape suivante.
