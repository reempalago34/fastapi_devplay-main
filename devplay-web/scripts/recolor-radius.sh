#!/bin/bash
# Radios editoriales: esquinas casi rectas estilo imprenta
# rounded-3xl/2xl→lg · rounded-xl→md (tokens = 0.125–0.25rem)
# Botones btn-gradient y buscador: rounded-full→rounded-sm (esquinas vivas)
# Los avatares, dots y badges circulares NO se tocan.

cd /home/z/my-project

FILES=$(find src/components/devplay src/app -name '*.tsx' 2>/dev/null)

for f in $FILES; do
  sed -i \
    -e 's/\brounded-3xl\b/rounded-lg/g' \
    -e 's/\brounded-2xl\b/rounded-lg/g' \
    -e 's/\brounded-xl\b/rounded-md/g' \
    -e '/btn-gradient/s/\brounded-full\b/rounded-sm/g' \
    -e '/glass w-full flex items-center gap-2 h-9/s/\brounded-full\b/rounded-sm/g' \
    "$f"
done

echo "--- rounded-2xl/3xl restantes ---"
rg -c 'rounded-2xl|rounded-3xl' src/components/devplay src/app 2>/dev/null || echo "OK"
echo "--- btn-gradient con rounded-full restantes ---"
rg -c 'btn-gradient.*rounded-full|rounded-full.*btn-gradient' src/components/devplay src/app 2>/dev/null || echo "OK"
