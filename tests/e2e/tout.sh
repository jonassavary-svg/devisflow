#!/bin/bash
# Lance tous les tests automatiques de DevisFlow (fausses IA locales : aucun appel payant).
# Il faut Node 20+, Playwright avec Chromium (npm i -g playwright) et pdftoppm / pdftotext (poppler).
cd "$(dirname "$0")" || exit 1
total=0
for t in secu run run_oai oracle notests tpl settings blank home notes extra preview swipe guard ownq facture; do
  out=$(timeout 400 node "$t.cjs" 2>&1)
  f=$(echo "$out" | grep -c '^FAIL'); p=$(echo "$out" | grep -c '^PASS')
  echo "$t : $p réussis, $f ratés"
  [ "$f" -gt 0 ] && echo "$out" | grep '^FAIL'
  total=$((total + f))
done
echo "Total des tests ratés : $total"
exit $total
