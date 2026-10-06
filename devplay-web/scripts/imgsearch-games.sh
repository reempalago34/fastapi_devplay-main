#!/bin/bash
# 🖼️ Búsqueda de imágenes para los juegos nuevos (3 tandas en paralelo)
# Cada búsqueda devuelve 5 imágenes OSS estables → cover = [0], capturas = [1..3]
set -e
cd /home/z/my-project
DIR=scripts/tmp/imgsearch
mkdir -p $DIR

declare -A QUERIES=(
  [hollow-knight]="Hollow Knight video game artwork knight with nail Team Cherry"
  [celeste]="Celeste video game Madeline climbing mountain pixel art artwork"
  [shovel-knight]="Shovel Knight video game retro pixel art knight with shovel"
  [dead-cells]="Dead Cells video game prisoner with glowing flame head artwork"
  [undertale]="Undertale video game pixel art characters Sans Papyrus"
  [cult-of-the-lamb]="Cult of the Lamb video game cute lamb cult artwork"
  [disco-elysium]="Disco Elysium video game oil painting portrait artwork"
  [vampire-survivors]="Vampire Survivors video game pixel art monsters gameplay"
  [enter-the-gungeon]="Enter the Gungeon video game bullet characters artwork"
  [hotline-miami]="Hotline Miami video game neon retro mask jacket artwork"
  [baba-is-you]="Baba Is You video game puzzle white creature pixel art"
  [inside]="INSIDE Playdead video game boy silhouette dark artwork"
  [little-nightmares]="Little Nightmares video game Six yellow raincoat artwork"
  [poppy-playtime]="Poppy Playtime video game Huggy Wuggy toy factory"
  [bendy]="Bendy and the Ink Machine video game cartoon demon artwork"
  [goose-game]="Untitled Goose Game white goose mischief artwork"
  [journey]="Journey video game red robed traveler sand dunes artwork"
  [katana-zero]="Katana ZERO video game samurai neon city artwork"
)

run_batch() {
  for slug in "$@"; do
    if [ ! -s "$DIR/$slug.json" ]; then
      z-ai image-search -q "${QUERIES[$slug]}" --count 5 --gl us --no-rank -o "$DIR/$slug.json" > /dev/null 2>&1 &
    fi
  done
  wait
  echo "tanda completa"
}

case "$1" in
  1) run_batch hollow-knight celeste shovel-knight dead-cells undertale cult-of-the-lamb ;;
  2) run_batch disco-elysium vampire-survivors enter-the-gungeon hotline-miami baba-is-you inside ;;
  3) run_batch little-nightmares poppy-playtime bendy goose-game journey katana-zero ;;
  check) for slug in "${!QUERIES[@]}"; do
      ok=$(bun -e "const j=require('./$DIR/$slug.json'); console.log(j.success && j.results.length >= 2 ? 'OK' : 'FALTA')" 2>/dev/null || echo FALTA)
      echo "$slug: $ok"
    done ;;
  *) echo "uso: $0 1|2|3|check" ;;
esac
