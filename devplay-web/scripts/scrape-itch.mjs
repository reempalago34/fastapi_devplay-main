/**
 * scrape-itch.mjs — Rasca itch.io (juegos gratis por género) pa' llenar
 * DevPlay con betas REALES de la presentación.
 *
 * Devuelve scripts/itch-games.json con:
 *   { url, title, author, authorUrl, cover, description, platforms[], genreES }
 *
 * Notas:
 * - Sin dependencias nuevas (fetch nativo de bun) — regla de oro del repo.
 * - Portada preferida: og:image de la página del juego (más grande y nítida).
 * -Descripción: og:description real del dev (honesto, sin inventar).
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// Género itch.io → género ES del schema de Betas
const GENRES = [
  { slug: 'platformer', es: 'Plataformas' },
  { slug: 'rpg', es: 'RPG' },
  { slug: 'puzzle', es: 'Puzzle' },
  { slug: 'adventure', es: 'Aventura' },
  { slug: 'shooter', es: 'Shooter' },
  { slug: 'horror', es: 'Terror' },
  { slug: 'simulation', es: 'Simulación' },
  { slug: 'arcade', es: 'Otro' },
]

const PER_GENRE = 5 // tomamos los 5 más populares gratis por género
const MAX_GAMES = 34

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
  return res.text()
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
}

function parseCells(html) {
  const cells = html.split('<div class="game_cell').slice(1)
  const out = []
  for (const cell of cells) {
    // Título + URL: <a ... class="title game_link" ... href="..." ...>Título</a>
    const mTitle = cell.match(
      /<a[^>]*class="title game_link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/
    )
    if (!mTitle) continue
    const url = mTitle[1]
    const title = decodeEntities(mTitle[2].replace(/<[^>]+>/g, '')).trim()

    // Autor: <div class="game_author"><a ... href="https://x.itch.io" ...>Nombre</a>
    const mAuthor = cell.match(/<div class="game_author"><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    const author = mAuthor ? decodeEntities(mAuthor[2].trim()) : null
    const authorUrl = mAuthor ? mAuthor[1] : null

    // Portada: <img ... data-lazy_src="...">
    const mCover = cell.match(/data-lazy_src="([^"]+)"/)
    const cover = mCover ? mCover[1] : null

    // Plataformas: web_flag o iconos
    const platforms = []
    if (cell.includes('web_flag')) platforms.push('Web')
    if (cell.includes('icon-windows8')) platforms.push('PC')
    if (cell.includes('icon-apple')) platforms.push('Mac')
    if (cell.includes('icon-linux')) platforms.push('Linux')
    if (cell.includes('icon-android')) platforms.push('Android')
    if (platforms.length === 0) platforms.push('PC')

    out.push({ url, title, author, authorUrl, cover, platforms })
  }
  return out
}

function parseGamePage(html) {
  // og:image y og:description de la página del juego
  const mImg = html.match(/property="og:image" content="([^"]+)"/)
  const mDesc =
    html.match(/property="og:description" content="([^"]*)"/) ||
    html.match(/name="description" content="([^"]*)"/)
  return {
    bigCover: mImg ? mImg[1].replace(/&amp;/g, '&') : null,
    description: mDesc
      ? decodeEntities(mDesc[1]).trim().slice(0, 280)
      : null,
  }
}

// ============ Main ============
const byUrl = new Map()

for (const g of GENRES) {
  const url = `https://itch.io/games/free/genre-${g.slug}`
  try {
    const html = await fetchPage(url)
    const cells = parseCells(html)
    let taken = 0
    for (const c of cells) {
      if (taken >= PER_GENRE) break
      if (byUrl.has(c.url)) continue
      byUrl.set(c.url, { ...c, genreES: g.es })
      taken++
    }
    console.log(`✓ ${g.slug}: ${cells.length} celdas, tomé ${taken}`)
  } catch (e) {
    console.warn(`✗ ${g.slug}: ${e.message}`)
  }
  await sleep(700)
}

console.log(`\nTotal únicos: ${byUrl.size}. Bajando páginas de juego...`)

const games = [...byUrl.values()].slice(0, MAX_GAMES)
for (const g of games) {
  try {
    const page = await fetchPage(g.url)
    const extra = parseGamePage(page)
    g.cover = extra.bigCover || g.cover
    g.description = extra.description
  } catch (e) {
    console.warn(`✗ página ${g.url}: ${e.message}`)
  }
  await sleep(600)
}

const out = { scrapedAt: new Date().toISOString(), games }
await Bun.write(new URL('./itch-games.json', import.meta.url).pathname, JSON.stringify(out, null, 2))
console.log(`\n🎉 Guardados ${games.length} juegos en scripts/itch-games.json`)
