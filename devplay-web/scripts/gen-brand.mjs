/**
 * Genera los nuevos assets de marca DevPlay 🎨
 * Identidad: Terracota & Crema 70s (crema #F6EFDE, terracota #C05B2E, espresso #40302A)
 *   1. Mascota (logo + avatar): sujeto encapuchado con cara de mando, estilo 70s
 *   2. Banner ilustrado: sol retro, arcoíris 70s, TV vintage — SIN texto (se agrega con PIL)
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'node:fs'

const OUT = '/home/z/my-project/brand-new'
fs.mkdirSync(OUT, { recursive: true })

const MASCOT_PROMPT = `Retro 1970s mascot logo illustration. A cute hooded character, the face is shaped like a video game controller: a white d-pad cross as the left eye, four white button dots as the right eye, big friendly white smile. Hoodie in warm terracotta burnt orange with cream colored outline and olive green drawstrings. Centered on a warm cream beige circular badge background. Groovy 70s color palette: terracotta orange, warm cream beige, mustard yellow, olive green. Flat vector style, sun-faded vintage colors, bold clean shapes, generous margin around the badge. No text, no letters, no words, no watermark.`

const BANNER_PROMPT = `Wide retro 1970s poster illustration. Warm cream beige paper background with subtle vintage print texture. On the left a big terracotta burnt orange retro sun with groovy wavy rays. Retro rainbow arcs in muted terracotta, mustard yellow and olive green. A vintage beige television set with rabbit ears antennas on the right. Tiny pixel-art characters and sparkles and stars scattered around, warm and playful. Flat vector style, sun-faded 70s palette: terracotta orange, warm cream, mustard yellow, olive green, espresso brown outlines. Large empty negative space across the horizontal center for a title. No text, no letters, no words, no watermark.`

async function gen(zai, prompt, size, out) {
  const res = await zai.images.generations.create({ prompt, size })
  const buf = Buffer.from(res.data[0].base64, 'base64')
  fs.writeFileSync(out, buf)
  console.log(`✓ ${out} (${(buf.length / 1024).toFixed(0)} KB)`)
}

const zai = await ZAI.create()
await gen(zai, MASCOT_PROMPT, '1024x1024', `${OUT}/mascot-raw.png`)
await gen(zai, BANNER_PROMPT, '1440x704', `${OUT}/banner-raw.png`)
console.log('LISTO')
