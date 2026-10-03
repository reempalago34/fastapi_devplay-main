#!/bin/bash
# Recambio de paleta: violeta gaming → vintage editorial
# Mapeo: violet/purple→wine · fuchsia/orange→bronze · rose→wine
#        pink/teal/indigo/blue→sepia · emerald/green→olive
# Se conservan: red (errores), amber/yellow (estrellas/ratings)

cd /home/z/my-project

FILES=$(rg -l 'violet-|purple-|fuchsia-|rose-|pink-|orange-|emerald-|green-|teal-|indigo-|blue-|sky-|cyan-' src/components src/app src/types src/lib src/hooks src/services 2>/dev/null)

echo "Archivos a procesar:"
echo "$FILES"

for f in $FILES; do
  sed -i \
    -e 's/\bviolet-\([0-9]\{2,3\}\)/wine-\1/g' \
    -e 's/\bpurple-\([0-9]\{2,3\}\)/wine-\1/g' \
    -e 's/\bfuchsia-\([0-9]\{2,3\}\)/bronze-\1/g' \
    -e 's/\brose-\([0-9]\{2,3\}\)/wine-\1/g' \
    -e 's/\bpink-\([0-9]\{2,3\}\)/sepia-\1/g' \
    -e 's/\borange-\([0-9]\{2,3\}\)/bronze-\1/g' \
    -e 's/\bemerald-\([0-9]\{2,3\}\)/olive-\1/g' \
    -e 's/\bgreen-\([0-9]\{2,3\}\)/olive-\1/g' \
    -e 's/\bteal-\([0-9]\{2,3\}\)/sepia-\1/g' \
    -e 's/\bindigo-\([0-9]\{2,3\}\)/sepia-\1/g' \
    -e 's/\bblue-\([0-9]\{2,3\}\)/sepia-\1/g' \
    -e 's/\bsky-\([0-9]\{2,3\}\)/bronze-\1/g' \
    -e 's/\bcyan-\([0-9]\{2,3\}\)/bronze-\1/g' \
    "$f"
done

echo "--- Verificación restante ---"
rg -c 'violet-|purple-|fuchsia-|rose-|pink-|orange-|emerald-|teal-|indigo-|blue-|sky-|cyan-' src/components src/app src/types src/lib src/hooks src/services 2>/dev/null || echo "OK: sin restos del tema anterior"
