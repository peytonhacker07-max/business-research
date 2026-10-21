#!/bin/bash
# Download each URL in a list to raw/<slug>.html, politely, skipping ones already fetched.
list=$1; out=$2; ok=0; fail=0
while read -r u; do
  slug=$(echo "$u" | sed -E 's#https://www.anglestopplumbing.com/?##; s#/#__#g'); [ -z "$slug" ] && slug=home
  f="$out/$slug.html"; [ -s "$f" ] && { ok=$((ok+1)); continue; }
  code=$(curl -sS -m 40 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" -o "$f" -w "%{http_code}" "$u")
  if [ "$code" = 200 ]; then ok=$((ok+1)); else fail=$((fail+1)); echo "FAIL $code $u"; rm -f "$f"; fi
  sleep 0.4
done < "$list"
echo "ok=$ok fail=$fail"
