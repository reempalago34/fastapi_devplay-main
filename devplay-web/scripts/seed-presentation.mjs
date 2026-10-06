/**
 * seed-presentation.mjs — Llena DevPlay de gente y juegos REALES de itch.io
 * pa' la presentación. Todo con licencias libres:
 *   - Avatares: DiceBear "bottts" (gratis para uso comercial) via URL remota
 *   - Banners: SVG generados localmente (paleta Terracota & Crema 70s)
 *   - Juegos: betas reales y GRATIS de itch.io (enlaces reales al juego)
 *
 * Idempotente: si se corre dos veces, borra las personas sembradas y re-crea.
 * NO toca al dueño (alex) ni a los invitados.
 *
 * Correr con: DATABASE_URL=<supabase> bun scripts/seed-presentation.mjs
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ============================================================
// 1. PERSONAS (30 devs/artistas/testers/streamers latinos)
// ============================================================
// [nombre, username, edad, ciudad, profesión, tags[], bio, esDev]
const PERSONAS = [
  ['Luna Vera', 'lunavera', 24, 'Bogotá, Colombia', 'Dev de videojuegos', ['dev-2d', 'pixel-art', 'platformer'], 'Hago plataformas pixel art en Godot y me pierdo en los detalles jaja. Ahora mismo: metroidvania de luciérnagas 🌙', true],
  ['Juan Pico', 'piko_juan', 31, 'Medellín, Colombia', 'Programador', ['programmer', 'retro', 'roguelike'], 'Programador de día, roguelikes de noche. Los bugs me temen (mentira, yo a ellos jaja)', true],
  ['Mariana González', 'mari_glez', 19, 'CDMX, México', 'Estudiante de animación', ['animator', 'pixel-art', 'retro'], 'Estudio animación y dibujo pixel art pa\' no dormir 💀 Bienvenida la crítica dura', false],
  ['Erik Kraft', 'krafterik', 28, 'Buenos Aires, Argentina', 'Game Designer', ['game-designer', 'rpg-fan', 'metroidvania'], 'Diseño niveles como si fueran rompecabezas crueles. Fan #1 de los RPG de SNES', true],
  ['Tomás Rojas', 'tomasdev', 16, 'Santiago, Chile', 'Estudiante dev', ['programmer', 'platformer', 'retro'], '16 años, 2 juegos de jam en el bolsillo y muchas ganas. Siempre respondo los DMs ✌️', true],
  ['Valentina Ruiz', 'valemakes', 22, 'Guayaquil, Ecuador', 'Dev + artista', ['dev-2d', 'pixel-artist', 'horror'], 'Hago jueguitos de terror con mi hermana. Cuidado con el callback del ascensor jaja', true],
  ['Diego Núñez', 'nube42', 35, 'Lima, Perú', 'Dev backend', ['programmer', 'rpg-fan'], 'Backend de profesión, RPG de vocación. Ahora le entro a mi primera novela visual 👀', true],
  ['Teo Sánchez', 'teo_pixel', 21, 'Madrid, España', 'Pixel artist', ['pixel-artist', 'retro', 'animator'], 'Pixel art, walkcycles y una obsesión ilegal con las paletas de 4 colores', false],
  ['Camila Ortega', 'camiorta', 18, 'Bogotá, Colombia', 'Tester QA', ['tester', 'horror', 'visual-novel'], 'Tester de betas: encuentro bugs que ni el dev sabía que tenía jaja. Mándame tu build', false],
  ['Andrés Peña', 'andres_p', 27, 'Monterrey, México', 'Compositor', ['composer', 'retro', 'rpg-fan'], 'Chiptune y baladas de calabozos. ¿Tu juego necesita tema de boss? Escríbeme 🎵', false],
  ['Sofía Lara', 'sofi_lara', 20, 'Quito, Ecuador', 'Streamer', ['streamer', 'horror', 'pixel-art'], 'Streameo indies de madrugada. Si sales en mi canal ya somos amigos 💜', false],
  ['Nicolás Ferrer', 'nicofer', 30, 'Valencia, España', 'Dev 3D', ['dev-3d', '3d-artist', 'rpg-fan'], 'Blender + Unreal y proyectos demasiado grandes pa\' mí. Como todos jaja', true],
  ['Julieta Ramos', 'jujuramos', 23, 'Rosario, Argentina', 'Guionista', ['writer', 'visual-novel', 'horror'], 'Escribo novelas visuales con finales feos 🖤 Fan de los juegos que te dejan pensando', false],
  ['Mateo Cárdenas', 'mateo_c', 17, 'Cali, Colombia', 'Estudiante dev', ['programmer', 'platformer', 'roguelike'], 'Mi computadora es una papa pero mis juegos corren bien jaja. Godot team 🤙', true],
  ['Daniela Cruz', 'danicruz', 26, 'San José, Costa Rica', 'Community Manager', ['community-mgr', 'pixel-art', 'rpg-fan'], 'CM de estudios indie chiquitos. Amo ver crecer una comunidad desde cero ✨', false],
  ['Pablo Mieres', 'pablo_m', 33, 'Montevideo, Uruguay', 'Dev', ['dev-2d', 'programmer', 'retro'], 'Remakeando el juego de mi infancia con permiso de nadie (es mío jaja)', true],
  ['Laura Restrepo', 'laura_rest', 29, 'Medellín, Colombia', 'SFX Designer', ['sfx-designer', 'horror', 'retro'], 'Hago sonidos con la cocina de mi casa. El sartén es mi laboratorio 🔊', false],
  ['Bruno Salas', 'bruno_salas', 22, 'La Paz, Bolivia', 'Dev', ['programmer', 'roguelike', 'platformer'], 'Roguelikes con física rota (a propósito... casi siempre jaja)', true],
  ['Emma Duarte', 'emma_d', 15, 'Santo Domingo, R. Dominicana', 'Estudiante', ['pixel-art', 'visual-novel'], 'En la escuela me aburro, en mi notebook hago mundos 💫 Aventura gráfica en camino', false],
  ['Kevin Rojas', 'kevinr', 38, 'Guadalajara, México', 'Level Designer', ['level-designer', 'metroidvania', 'retro'], '20 años jugando metroidvanias, ahora los diseño. El mapa es sagrado 🗺️', false],
  ['Isa Moreno', 'isa_moreno', 19, 'Barranquilla, Colombia', 'Artista 3D', ['3d-artist', 'retro'], 'Low poly y colores melaza. Blender es mi segundo hogar 🍯', false],
  ['Fabián Ortiz', 'fabianortiz', 25, 'Asunción, Paraguay', 'Dev', ['dev-2d', 'pixel-art', 'horror'], 'Terror 2D con más ambiente que sustos baratos. Demo nueva muy pronto 👀', true],
  ['Renata Silva', 'renata_s', 21, 'São Paulo, Brasil', 'Animadora', ['animator', 'pixel-art', 'platformer'], 'Brasileña haciendo animación frame a frame. Falo português y español jaja', false],
  ['Óscar Vega', 'ovega', 34, 'Sevilla, España', 'Programador', ['programmer', 'unity', 'retro'], 'Estrategia por turnos y café. Mucho café. Y bugs jaja', true],
  ['Paula Niño', 'paulan', 18, 'Bucaramanga, Colombia', 'Tester', ['tester', 'platformer', 'rpg-fan'], 'Beta tester sin piedad pero con cariño 💅 Rompo tu juego antes que los usuarios', false],
  ['Samuel Ibarra', 'sam_ibarra', 24, 'Cuenca, Ecuador', 'Compositor', ['composer', 'pixel-art', 'roguelike'], 'Musiquita pa\' juegos chiquitos con alma grande 🎧', false],
  ['Manuela Torres', 'manu_torres', 27, 'Caracas, Venezuela', 'Game Designer', ['game-designer', 'visual-novel', 'horror'], 'Diseño decisiones que duelen jaja. Escribo y diseño en equipo con mi novio', true],
  ['Joaquín Vera', 'joaquin_v', 31, 'Córdoba, Argentina', 'Dev', ['dev-3d', 'programmer', 'rpg-fan'], 'Devolviéndole golpes a Unity desde 2019. Mi RPG tiene 400h de dev y 20 de gameplay jaja', true],
  ['Catalina Duarte', 'cata_duarte', 20, 'Panamá', 'Streamer + artista', ['streamer', 'pixel-art', 'retro'], 'Retos de pixel art en vivo los viernes. Vengan a perder conmigo 🎨', false],
  ['Hugo Martínez', 'hugo_m', 40, 'Zaragoza, España', 'Programador', ['programmer', 'godot', 'roguelike'], 'Padre de dos, dev de uno (mi juego). Duermo poco pero feliz jaja', true],
]

// ============================================================
// 2. CONTENIDO (posts, comentarios, chat, encuestas)
// ============================================================
// Posts comunitarios: [texto, índice de autor]
const COMMUNITY_POSTS = [
  ['¿Godot o Unity pa\' un primer juego de plataformas? Ando perdido entre tutoriales 😅', 2],
  ['Llevo 3 semanas peleando con el sistema de guardado y POR FIN funciona jajaja 🎉 Nunca subestimen una coma', 1],
  ['Gente, ¿ya vieron que se viene un jam de Halloween? ¿Alguien se anima a hacer equipo? Yo dibujo, alguien más programa 👀', 14],
  ['Dato: si tu juego corre a 60fps en tu PC de guerra, no significa que corra en la mía jaja (probénlo en una laptop de 2015, plis)', 24],
  ['Hoy terminé el sprite del boss después de 9 intentos. Le puse cara de traicionado porque así me sentía yo 😂', 7],
  ['Pregunta seria: ¿cuánto cobrar por una banda sonora chiptune de 6 tracks? Es mi primer encargo 🎵', 9],
  ['El tester me mandó un video rompiendo mi juego en 40 segundos. 40 SEGUNDOS. Contratada jaja', 22],
  ['Viernes de betas 🕹️ ¿Qué están jugando estos días? Yo ando en una demo de plataformas que me tiene viciado', 25],
  ['Mi mamá vio mi juego y dijo "ah pero ¿y cuándo te recibes?" jajaja el apoyo familiar 🙃', 4],
  ['Terminé de escribir el final de mi novela visual. Lloré. Lo voy a dejar así, no soy tan cruel de cambiarlo 🖤', 12],
  ['Tips pa\' las jams nuevas: duerman, coman, y NO refactoricen a las 3am. Escrito con dolor de experiencia jaja', 16],
  ['¿Alguien más usa papel cuadriculado pa\' diseñar niveles? Me siento arquitecto de calabozos 🗺️', 19],
  ['Streameo hoy a las 9pm una demo de terror que encontré por aquí. Vengan con la luz prendida 💡', 10],
  ['Dibujé mi primer tileset completo: 32x32, paleta de 8 colores, cero arrepentimientos 🎨', 7],
  ['El mal del desarrollador: abrir el proyecto y solo mirarlo 20 minutos. Hoy lo vencí, avancé 2 quests ✊', 27],
  ['¿Recomendaciones de juegos cortos pa\' un stream de 2 horas? Nada de survival craft, porfa 🙏', 28],
  ['Compositor busco equipo pa\' el jam 🎧 Hago chiptune y algo de orquestal casero. ¡Escríbanme!', 25],
  ['Mi juego de estrategia por fin tiene IA que no se queda quieta mirando la pared. Es un día histórico jaja', 23],
  ['Hice el sonido de pasos con papitas fritas. El pitch down lo cambia TODO 🔊 Qué maravilla es el audio casero', 16],
  ['Aprendiendo shader para hacer agua pixel art. Tutorial de 10 minutos dijo. Van 4 horas jaja 💦', 0],
]

// Comentarios genéricos
const COMMENTS = [
  'Brutal 🔥🔥',
  'Probado y me encantó jaja, el arte está increíble',
  'Va directo a bookmarks 👀',
  '¿Cuándo sale pa\' Linux? 🐧',
  'Mucha suerte con el launch 💪',
  'El sonido es lo mejor que tiene, no me discutan',
  'Lo jugué anoche y no dormí jaja gracias por nada',
  'Qué bueno ver más gente haciendo juegos por acá ✨',
  'Feedback: el nivel 2 está difícil pero justo. Sigan así',
  'Me uno a la jam si aún hay cupo!',
  'Ese sprite del boss está indignante (de lo bueno que está) 😤🔥',
  'Súper recomendado, la demo es cortita pero con alma',
  'Jaja el final me rompió el corazón 🖤',
  '¿Con qué motor lo hiciste?',
  'Esto merece más visibilidad, compartido 💜',
  'Vengo del stream y sí, es buenísimo jaja',
  'Lo probé con mi hermano y nos quedamos hasta tarde jugando 🎮',
  'El pixel art de este lado de la comunidad está de otro nivel jaja',
  'Agreguen modo fa\' dos jugadores plis 🙏',
  'Suena brutal, cuándo sacas más música? 🎵',
  'Bajado y jugado. Reportando: adictivo jaja',
  'La estética 70s de la web me tiene flechado también ✌️',
]

// Chat de la plaza (se sembrará con timestamps recientes)
const CHAT = [
  'hola gente 👋',
  '¿alguien probó la demo de plataformas nueva? jaja buenísimo',
  'buenas! ando buscando tester pa\' mi demo, voluntarios? 👀',
  'aquí reportándome desde Bogotá 🇨🇴',
  'el jam del finde va a estar buenísimo, ya tengo equipo ✨',
  'gente del chat, ¿Godot o Unity? pregunta seria',
  'Godot, next question jaja',
  'acabo de subir mi beta, lluevan críticas (no tanto jaja)',
  'mañana sigo con el boss final 💤 hoy no puedo más',
  'quién es de México? voy a una expo indie el mes que viene',
  'yo 🙋 la Expo Indie de GDL está buenísima',
  'acabo de ver el perfil de la comunidad, hay gente con talento acá 🎨',
  'plugin de pixel art pa\' Aseprite me salvó la vida hoy',
  'buenas noches devs 🌙 que los bugs se duerman solos',
  'vengo a avisar que streameo indies hoy 9pm 💜',
  'okis me paso a verlo jaja',
  'alguien tiene el link del discord de la jam? lo perdí 🙏',
  'va con todo este finde 💪🎮',
]

const POLL_1 = {
  question: '¿Cuál motor usan (o usarían) pa\' su próximo juego?',
  options: ['Godot', 'Unity', 'Unreal', 'GDevelop / Construct', 'Motor propio'],
  authorIdx: 1,
}
const POLL_2 = {
  question: 'Polémica del día: ¿pixel art o 3D low poly?',
  options: ['Pixel art siempre 🙌', '3D low poly', 'Depende del juego (cobarde jaja)'],
  authorIdx: 11,
}

// Promos de juego (6 plantillas rotativas)
const PROMO_TEMPLATES = [
  '🎉 Salió la demo de «{title}»!! Corre pa\' itch.io, juega un rato y cuéntame qué te pareció 💜',
  'Nuevo build de {title} en línea 🛠️ Arreglé el salto (sí, por fin jaja). Pruébenlo y cuéntenme:',
  '¿Se animan a probar {title}? Es cortito pero está hecho con mucho cariño 🎮 Feedback welcome!',
  'Meta del mes: 100 descargas de {title}. Vamos por la 60 jaja 💪 Link abajo 👇',
  'Después de 3 jams seguidas, {title} por fin tiene versión jugable 🔥 Corran la voz!',
  'Actualización de {title}: mejoré el sonido y el balance del nivel 2. Jueguenlo y me dicen 👇',
]

// Descripciones genéricas ES pa' juegos sin descripción (rotativas)
const GENERIC_DESCS = [
  'Demo gratis en itch.io. Bájala, juega un rato y suéltale feedback honesto al dev 🔥',
  'Un {genre} corto y gratis, perfecto pa\' una pausa de café ☕ Corre directo en el navegador',
  'Proyecto indie disponible gratis en itch.io. Pruébalo y cuéntale al dev qué te pareció 🎮',
  'Versión jugable gratis. Si te gusta, déjale un comentario al dev que eso alimenta jaja',
  'Un {genre} hecho con cariño y muchos mates/caés jaja. Descarga gratis desde itch.io',
]

// ============================================================
// 3. HELPERS
// ============================================================
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const DAYS = (n) => new Date(Date.now() - n * 24 * 3600 * 1000)
const MINS = (n) => new Date(Date.now() - n * 60 * 1000)

function genreText(g) {
  const map = { 'Plataformas': 'plataformas', 'RPG': 'RPG', 'Puzzle': 'puzzle', 'Aventura': 'aventura', 'Shooter': 'shooter', 'Terror': 'terror', 'Simulación': 'simulador', 'Otro': 'arcade' }
  return map[g] || 'juego indie'
}

function tagsForGenre(g) {
  const base = ['Indie', 'Singleplayer']
  const byG = {
    'Plataformas': ['2D', 'Pixel Art', 'Difficult'],
    'RPG': ['2D', 'Story Rich'],
    'Puzzle': ['2D', 'Relaxing'],
    'Aventura': ['2D', 'Story Rich', 'Atmospheric'],
    'Shooter': ['2D'],
    'Terror': ['Atmospheric'],
    'Simulación': ['Relaxing'],
    'Otro': ['2D', 'Pixel Art'],
  }
  return JSON.stringify([...base, ...(byG[g] || ['2D'])])
}

function socialsFor(username, esDev, esStreamer) {
  const s = {}
  if (esDev || esStreamer || Math.random() < 0.4) {
    s.github = `https://github.com/${username}-dev`
    s.youtube = `https://youtube.com/@${username}`
  }
  return Object.keys(s).length ? JSON.stringify(s) : null
}

// ============================================================
// 4. BANNERS SVG (paleta Terracota & Crema, 70s)
// ============================================================
const BANNER_COLORS = [
  ['#C05B2E', '#D9A441'], ['#8A6FB4', '#C05B2E'], ['#D9A441', '#C97B63'],
  ['#7A8B5C', '#D9A441'], ['#B84A3A', '#E0B45A'], ['#9C5B8E', '#D97E4A'],
  ['#C05B2E', '#7A5C3E'], ['#5C7A8B', '#D9A441'],
]
const bannerUrl = (i) => `/uploads/banners/banner${i + 1}.svg`

function bannerSvg([c1, c2]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="1200" height="300" fill="url(#g)"/>
  <circle cx="1000" cy="210" r="150" fill="${c1}" opacity="0.55"/>
  <circle cx="1000" cy="210" r="95" fill="${c2}" opacity="0.5"/>
  <rect y="212" width="1200" height="6" fill="#F6EFDE" opacity="0.35"/>
  <rect y="230" width="1200" height="6" fill="#F6EFDE" opacity="0.25"/>
  <rect y="248" width="1200" height="6" fill="#F6EFDE" opacity="0.15"/>
</svg>`
}

// ============================================================
// 5. MAIN
// ============================================================
async function main() {
  console.log('🧹 Limpiando siembras anteriores (si las hay)...')
  const usernames = PERSONAS.map((p) => p[1])
  const old = await prisma.user.deleteMany({ where: { username: { in: usernames } } })
  console.log(`   ${old.count} personas viejas eliminadas`)

  console.log('🎨 Escribiendo banners SVG...')
  for (let i = 0; i < BANNER_COLORS.length; i++) {
    await Bun.write(
      new URL(`../public/uploads/banners/banner${i + 1}.svg`, import.meta.url).pathname,
      bannerSvg(BANNER_COLORS[i])
    )
  }

  console.log('🔑 Generando hash de contraseñas...')
  const passwordHash = bcrypt.hashSync('Semilla-' + Math.random().toString(36).slice(2, 14) + '!Jam', 10)

  console.log(`👥 Creando ${PERSONAS.length} personas...`)
  const users = []
  for (let i = 0; i < PERSONAS.length; i++) {
    const [fullName, username, age, location, profession, tags, bio, esDev] = PERSONAS[i]
    const u = await prisma.user.create({
      data: {
        email: `${username}@devplay.online`,
        username,
        passwordHash,
        fullName,
        age,
        bio,
        location,
        profession,
        avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(username)}&size=256`,
        banner: i % 3 === 2 ? null : bannerUrl(i % BANNER_COLORS.length),
        website: null,
        socialLinks: socialsFor(username, esDev, tags.includes('streamer')),
        tags: JSON.stringify(tags),
        role: 'USER',
        tourCompleted: true,
        language: 'es',
        devCoins: rnd(40, 420),
        createdAt: DAYS(rnd(30, 90)),
        lastSeen: i < 6 ? MINS(rnd(1, 8)) : MINS(rnd(30, 4320)),
      },
    })
    users.push(u)
  }
  console.log('   ✓ personas listas')

  // Dueño
  const owner = await prisma.user.findUnique({ where: { username: 'alex' } })

  // ===== JUEGOS (betas reales de itch.io) =====
  console.log('🎮 Creando betas desde itch-games.json...')
  const { games } = await Bun.file(new URL('./itch-games.json', import.meta.url).pathname).json()
  const jugables = games.filter((g) => g.cover)
  console.log(`   ${jugables.length} juegos con portada de ${games.length}`)

  const devs = users.filter((_, i) => PERSONAS[i][7])
  let devIdx = 0
  const promoPosts = []
  let descRot = 0

  for (const g of jugables) {
    const author = devs[devIdx % devs.length]
    devIdx++
    const createdDaysAgo = rnd(1, 20)
    const createdAt = DAYS(createdDaysAgo)
    const desc =
      g.description ||
      GENERIC_DESCS[descRot++ % GENERIC_DESCS.length].replace('{genre}', genreText(g.genreES))
    const promo = PROMO_TEMPLATES[devIdx % PROMO_TEMPLATES.length].replace('{title}', g.title)
    const statuses = ['open_beta', 'early_access', 'tech_test', 'alpha', 'open_beta', 'coming_soon']
    const versions = ['v0.1', 'v0.4', 'Alpha 1.2', 'v0.9', 'Beta 2.0', 'v1.0']
    const hasWeb = g.platforms.includes('Web')

    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        type: 'BETA',
        content: promo,
        mediaUrls: JSON.stringify([{ url: g.cover, kind: 'image' }]),
        createdAt,
        updatedAt: createdAt,
        beta: {
          create: {
            title: g.title,
            description: desc,
            downloadType: 'LINK',
            externalUrl: g.url,
            externalPlatform: 'itch.io',
            betaStatus: pick(statuses),
            genre: g.genreES,
            version: pick(versions),
            platforms: JSON.stringify(g.platforms),
            tags: tagsForGenre(g.genreES),
            installInstructions: hasWeb
              ? 'Juega directo en el navegador desde itch.io, sin instalar nada 🎮'
              : 'Descarga el ZIP desde itch.io, descomprímelo y ejecuta el juego',
            coverImage: g.cover,
            downloads: rnd(15, 480),
            createdAt,
          },
        },
      },
    })
    promoPosts.push(post)
  }
  console.log('   ✓ betas listas')

  // ===== POSTS COMUNITARIOS =====
  console.log('📝 Creando posts comunitarios...')
  const communityPosts = []
  for (const [text, authorIdx] of COMMUNITY_POSTS) {
    const author = users[Math.min(authorIdx, users.length - 1)]
    const createdAt = DAYS(rnd(0.2, 16))
    const p = await prisma.post.create({
      data: { authorId: author.id, type: 'POST', content: text, createdAt, updatedAt: createdAt },
    })
    communityPosts.push(p)
  }

  // ===== ENCUESTAS =====
  console.log('🗳️ Creando encuestas...')
  const createdPolls = []
  for (const pollDef of [POLL_1, POLL_2]) {
    const author = users[pollDef.authorIdx]
    const createdAt = DAYS(rnd(1, 8))
    await prisma.post.create({
      data: {
        authorId: author.id,
        type: 'POST',
        content: pollDef.question,
        createdAt,
        updatedAt: createdAt,
        poll: {
          create: {
            question: pollDef.question,
            closesAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
            // Votantes ÚNICOS por encuesta, repartidos entre opciones (una sola por persona).
            // Los votos se crean DESPUÉS: PollVote exige pollId explícito (no se infiere).
            options: { create: pollDef.options.map((text) => ({ text })) },
          },
        },
      },
    })
    createdPolls.push({ pollDef })
  }

  // Votos de las encuestas (PollVote exige pollId + optionId explícitos)
  for (const { pollDef } of createdPolls) {
    const poll = await prisma.poll.findFirstOrThrow({
      where: { question: pollDef.question },
      include: { options: true },
    })
    const shuffled = [...users].sort(() => Math.random() - 0.5).slice(0, rnd(14, 20))
    const votes = []
    for (let vi = 0; vi < shuffled.length; vi++) {
      const opt = poll.options[vi % poll.options.length]
      votes.push({ pollId: poll.id, optionId: opt.id, userId: shuffled[vi].id })
    }
    await prisma.pollVote.createMany({ data: votes, skipDuplicates: true })
    // Sincronizar el conteo denormalizado
    for (const opt of poll.options) {
      const n = votes.filter((v) => v.optionId === opt.id).length
      await prisma.pollOption.update({ where: { id: opt.id }, data: { voteCount: n } })
    }
  }
  const allPosts = [...promoPosts, ...communityPosts]

  // ===== COMENTARIOS =====
  console.log('💬 Comentarios y likes...')
  let commentCount = 0
  for (const p of allPosts) {
    const n = rnd(0, 4)
    for (let i = 0; i < n; i++) {
      const u = pick(users)
      if (u.id === p.authorId) continue
      const createdAt = new Date(Math.max(new Date(p.createdAt).getTime() + 3600 * 1000, Date.now() - rnd(1, 96) * 3600 * 1000))
      await prisma.comment.create({
        data: { postId: p.id, userId: u.id, content: pick(COMMENTS), createdAt },
      })
      commentCount++
    }
  }

  // ===== LIKES =====
  let likeCount = 0
  const likeData = []
  for (const p of allPosts) {
    const likers = new Set()
    const n = rnd(2, 14)
    for (let i = 0; i < n; i++) likers.add(pick(users).id)
    likers.delete(p.authorId)
    for (const uid of likers) {
      likeData.push({ postId: p.id, userId: uid, createdAt: new Date(Date.now() - rnd(1, 300) * 3600 * 1000) })
      likeCount++
    }
  }
  // likes del dueño a algunos posts (su perfil se ve vivo)
  if (owner) {
    for (const p of allPosts.slice(0, 6)) likeData.push({ postId: p.id, userId: owner.id, createdAt: MINS(rnd(30, 400)) })
  }
  await prisma.like.createMany({ data: likeData, skipDuplicates: true })

  // ===== FOLLOWS =====
  console.log('🤝 Red de follows...')
  const followSet = new Set()
  const followData = []
  const addFollow = (aId, bId, agoDays) => {
    if (aId === bId || followSet.has(aId + '>' + bId)) return
    followSet.add(aId + '>' + bId)
    followData.push({ followerId: aId, followeeId: bId, createdAt: DAYS(agoDays) })
  }
  for (const u of users) {
    const n = rnd(4, 9)
    for (let i = 0; i < n; i++) addFollow(u.id, pick(users).id, rnd(1, 45))
  }
  if (owner) {
    for (const u of users) if (Math.random() < 0.4) addFollow(u.id, owner.id, rnd(1, 30))
    for (const u of users.slice(0, 5)) addFollow(owner.id, u.id, rnd(1, 20))
  }
  await prisma.follow.createMany({ data: followData, skipDuplicates: true })

  // ===== CHAT DE LA PLAZA =====
  console.log('🗨️ Chat de la plaza...')
  let chatTime = Date.now() - 110 * 60 * 1000
  for (const msg of CHAT) {
    chatTime += rnd(2, 12) * 60 * 1000
    const u = pick(users)
    await prisma.chatMessage.create({
      data: { userId: u.id, username: u.username, content: msg, createdAt: new Date(Math.min(chatTime, Date.now() - 60 * 1000)) },
    })
  }

  // ===== RESUMEN =====
  const [uC, pC, bC, cC, lC, fC, chC, poC] = await Promise.all([
    prisma.user.count(), prisma.post.count(), prisma.beta.count(), prisma.comment.count(),
    prisma.like.count(), prisma.follow.count(), prisma.chatMessage.count(), prisma.poll.count(),
  ])
  console.log('\n══════════ SIEMBRA COMPLETA ══════════')
  console.log(`usuarios: ${uC} | posts: ${pC} | betas: ${bC} | encuestas: ${poC}`)
  console.log(`comentarios: ${cC} | likes: ${lC} | follows: ${fC} | mensajes chat: ${chC}`)
  console.log('🎉 DevPlay listo pa\' la presentación')
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
