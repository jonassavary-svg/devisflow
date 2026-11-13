# Tests automatiques

`bash tests/e2e/tout.sh` lance toutes les séries. Elles ouvrent l'app dans un navigateur sans écran et remplacent l'IA par de fausses IA locales, donc elles ne coûtent rien.

- `mock.mjs`, `mock_oai.mjs` : fausses IA simples (format Anthropic et OpenAI).
- `oracle.mjs` : fausse IA « parfaite » qui donne la bonne réponse à chaque test intégré. Elle sert à vérifier les tests eux-mêmes (`oracle.cjs`).
- `secu.cjs` : le serveur refuse les demandes qui ne viennent pas de la page Artipilote.
- Les autres fichiers `.cjs` testent chacun un écran ou une fonction.

Ces tests ne mesurent pas la qualité de la vraie IA. Pour cela : ouvrir `http://localhost:3000/?tests`, Paramètres, « Tests de l'IA », « Lancer les tests », puis « Copier les résultats ».
