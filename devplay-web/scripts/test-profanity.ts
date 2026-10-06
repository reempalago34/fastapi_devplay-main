// Prueba rápida del filtro anti-groserías
import { filterProfanity, hasProfanity } from '../src/lib/profanity'

const cases: [string, string][] = [
  ['vaya mierda de día', 'vaya ****** de día'],
  ['hola 🎮puta', 'hola 🎮****'],
  ['PU.TA no', 'PU.TA no'],
  ['qué pUt0 eres', 'qué **** eres'],
  ['put0 mal hecho', '**** mal hecho'],
  ['pat0 es un pato', 'pat0 es un pato'],
  ['m13rda', '******'],
  ['puuuuta madre', '******* madre'],
  ['vamos a conocer la reputación del sistema', 'vamos a conocer la reputación del sistema'],
  ['penélope dibuja un pene', 'penélope dibuja un ****'],
  ['el cockpit del juego', 'el cockpit del juego'],
  ['hello world fuck this shit', 'hello world **** this ****'],
  ['eres un idiota pero amable', 'eres un ****** pero amable'],
  ['m1£rda rara', 'm1£rda rara'],
  ['cuuulos por todos lados', '******* por todos lados'],
  ['mis amigos hdp', 'mis amigos ***'],
  ['el juego está chido, cero toxico', 'el juego está chido, cero toxico'],
  ['a la v3rga wey', 'a la ***** wey'],
  ['emoji 😡Grosería: mierda!', 'emoji 😡Grosería: ******!'],
]

let fails = 0
for (const [input, expected] of cases) {
  const got = filterProfanity(input)
  const ok = got === expected
  if (!ok) fails++
  console.log(`${ok ? 'OK ' : 'FAIL'} "${input}" → "${got}"${ok ? '' : ` (esperado "${expected}")`}`)
}
console.log(fails === 0 ? '\n✅ Todo pasó' : `\n❌ ${fails} fallos`)
console.log('hasProfanity("hola mundo") =', hasProfanity('hola mundo'))
