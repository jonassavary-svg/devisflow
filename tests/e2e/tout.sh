#!/bin/bash
# Lance tous les tests automatiques de DevisFlow (fausses IA locales : aucun appel payant).
# Il faut Node 20+, Playwright avec Chromium (npm i -g playwright) et pdftoppm / pdftotext (poppler).
cd "$(dirname "$0")" || exit 1
total=0
for t in pdf secu run run_oai oracle notests tpl settings blank home notes extra preview swipe guard ownq facture assistant; do
  out=$(timeout 400 node "$t.cjs" 2>&1); rc=$?
  f=$(echo "$out" | grep -c '^FAIL'); p=$(echo "$out" | grep -c '^PASS')
  # Un script qui plante compte comme un test raté (sinon une panne passe inaperçue).
  if [ "$rc" -ne 0 ]; then f=$((f + 1)); echo "FAIL $t s'est arrêté sur une erreur :"; echo "$out" | grep -m1 -E 'Error|Timeout'; fi
  echo "$t : $p réussis, $f ratés"
  [ "$f" -gt 0 ] && echo "$out" | grep '^FAIL'
  total=$((total + f))
done
echo "Total des tests ratés : $total"
exit $total
