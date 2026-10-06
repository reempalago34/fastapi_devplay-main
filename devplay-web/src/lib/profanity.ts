/**
 * Filtro anti-groserías de DevPlay 🧼
 * Reemplaza palabras groseras en mensajes públicos por asteriscos (****).
 * - Normaliza trampas típicas: leet (p@tro, m13rda), acentos (coño→cono), mayúsculas y letras repetidas (puuuta).
 * - El reemplazo conserva la longitud original: "mierda" → "******".
 * - Sin dependencias: también lo usa el servicio realtime (mini-services).
 * - Alineado por puntos de código: funciona con emojis pegados a las groserías ("🎮puta" → "🎮****").
 */

// Nivel 1: groserías claras. Coinciden aunque traigan letras después (putita, mierdosas...).
const TIER1 = [
  // español
  'puta', 'puto', 'mierda', 'carajo', 'joder', 'chinga', 'chingue', 'chingo',
  'verga', 'cabron', 'cabrona', 'pendejo', 'pendeja', 'boludo', 'boluda',
  'gilipollas', 'jilipollas', 'maricon', 'maricona', 'zorra', 'culero', 'culera',
  'malparido', 'malparida', 'capullo', 'desgraciado', 'cagar',
  // inglés
  'fuck', 'motherfuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt',
  'whore', 'slut', 'nigga', 'nigger', 'faggot', 'wanker', 'bollocks',
  'prick', 'dick', 'porn',
]

// Nivel 2: palabras con doble uso. Solo cuentan como grosería la palabra suelta
// (con plural o diminutivo), nunca dentro de otra palabra ("conocer", "penélope").
const TIER2 = ['cono', 'culo', 'pene', 'idiota', 'imbecil', 'estupido', 'twat', 'cock', 'retard', 'retarded', 'hdp', 'ptm', 'ctm']

const SUFFIX = '(?:s|ito|ita|itos|itas|azo|aza|azos|azas|ote|ota|otes|otas|so|sa|sos|sas)?'

// Trampas de escritura → letra "limpia" (1 punto de código → 1 punto de código)
const LEET: Record<string, string> = {
  '@': 'a', '4': 'a', 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a',
  '3': 'e', 'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
  '1': 'i', '¡': 'i', 'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  '0': 'o', 'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
  '5': 's', '$': 's', 'ß': 's', '7': 't',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
  'ñ': 'n',
}

function normPoint(ch: string): string {
  const low = ch.toLowerCase()
  return LEET[low] ?? low
}

// Cada letra admite hasta 4 repeticiones: "puuuta" también pega.
function flexible(word: string): string {
  return word
    .split('')
    .map((c) => `${c}{1,4}`)
    .join('')
}

const RES = [
  new RegExp(`(?<![a-z])(${TIER1.map(flexible).join('|')})`, 'g'),
  new RegExp(`(?<![a-z])(${TIER2.map(flexible).join('|')})${SUFFIX}(?![a-z])`, 'g'),
]

/**
 * Devuelve el texto con las groserías tapadas con asteriscos.
 * Ejemplo: "vaya mierda de día" → "vaya ****** de día"
 */
export function filterProfanity(text: string): string {
  if (!text || typeof text !== 'string') return text

  const points = [...text] // puntos de código (emojis = 1 punto)
  const normPoints = points.map(normPoint)
  const norm = normPoints.join('')

  // Mapa índice-de-unidad-de-código (en norm) → índice-de-punto (en text)
  const unitToPoint: number[] = []
  normPoints.forEach((np, pi) => {
    for (let u = 0; u < np.length; u++) unitToPoint.push(pi)
  })

  // Rangos en espacio de puntos que hay que tapar
  const ranges: [number, number][] = []
  for (const re of RES) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(norm)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue }
      const pa = unitToPoint[m.index]
      const pb = unitToPoint[m.index + m[0].length - 1] + 1
      ranges.push([pa, pb])
    }
  }
  if (ranges.length === 0) return text

  // Fusiona rangos que se tocan o solapan
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }

  for (const [a, b] of merged) {
    for (let i = a; i < b && i < points.length; i++) points[i] = '*'
  }
  return points.join('')
}

/** true si el texto contiene alguna grosería. */
export function hasProfanity(text: string): boolean {
  if (!text) return false
  return filterProfanity(text) !== text
}
