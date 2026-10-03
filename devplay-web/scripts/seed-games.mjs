// 🎮 SEED: 18 juegos nuevos (betas) con imágenes generadas en /public/games/
// — NO toca usuarios, ni encuestas, ni el chat; solo AÑADE betas + sus posts.
// Repite el patrón exacto de las betas existentes (réplicas de peek-beta.mjs).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasources: { db: { url: process.env.SUPA } } });

// autores reales de betas previas (rotamos entre ellos)
const AUTHORS = [
  'cmtt8tem40000onrbgthgepew', 'cmtt8tfh30001onrbhthblq0i', 'cmtt8th710003onrb1j05b29c',
  'cmtt8ti1z0004onrbht12btir', 'cmtt8tiww0005onrbbb3982ue', 'cmtt8tjrv0006onrbo8heirso',
  'cmtt8to2q000bonrbfajvmqi2', 'cmtt8tpz4000donrbadxm6bl4',
];

const steam = (id) => `https://store.steampowered.com/app/${id}/`;
const g = (slug, file) => `/games/${slug}-${file}.png`;

// [title, genre, version, status, downloads, steamId, slug, description, tags, createdAt]
const GAMES = [
  ['Hollow Knight', 'Aventura', 'Beta 1.4', 'open_beta', 462, 367520, 'hollow-knight',
    'Baja a un antiguo reino de insectos lleno de ruinas hermosas y secretos. Exploración estilo metroidvania, combates afilados y una atmósfera que no te suelta. Esta beta trae la primera zona completa y dos jefes.',
    ['Metroidvania', 'Indie', '2D', 'Story Rich', 'Atmospheric'], '2026-08-24T15:20:00Z'],
  ['Celeste', 'Plataformas', 'Alpha 2.1', 'alpha', 448, 504230, 'celeste',
    'Ayuda a Madeline a escalar la montaña Celeste enfrentando sus propios miedos. Plataformas preciso con dash, cientos de muertes (son parte del viaje) y una historia preciosa. Versión alpha del capítulo 3.',
    ['Plataformas', 'Pixel Art', 'Difícil', 'Narrativa'], '2026-08-26T18:45:00Z'],
  ['Shovel Knight', 'Plataformas', 'Beta 2.0', 'open_beta', 421, 250760, 'shovel-knight',
    'Un clásico moderno con sabor a 8-bit: pica tesoros, bate caballeros y salva a tu compañera. Esta beta añade el mundo del Barón del Reloj y mejoras de armadura.',
    ['Retro', '8-bit', 'Plataformas', 'Indie'], '2026-08-28T21:10:00Z'],
  ['Dead Cells', 'Plataformas', 'v0.9', 'closed_beta', 389, 588650, 'dead-cells',
    'Roguelite de acción frenético: mueres, vuelves a empezar y cada corrida es distinta. Armas nuevas cada partida y jefes que te van a doler. Beta cerrada, buscamos feedback del sistema de células.',
    ['Roguelite', 'Acción', 'Pixel Art', 'Difícil'], '2026-08-29T16:30:00Z'],
  ['Undertale', 'RPG', 'Demo 0.3', 'alpha', 466, 391540, 'undertale',
    'Un RPG donde NADIE tiene que morir: habla, perdona y haz amigos de tus enemigos. La demo trae las Ruinas completas y dos finales secretos. Los puzzles son parte de la gracia.',
    ['RPG', 'Pixel Art', 'Narrativa', 'Humor'], '2026-08-31T13:05:00Z'],
  ['Cult of the Lamb', 'RPG', 'Beta 1.1', 'open_beta', 434, 1313140, 'cult-of-the-lamb',
    'Fundas un culto adorable y siniestro: recluta animales, haz rituales y siembra caos en nombre del Cordero. Beta abierta con el sistema de doctrinas recién implementado.',
    ['Simulación', 'Roguelite', 'Cartoon', 'Gestión'], '2026-09-01T20:15:00Z'],
  ['Disco Elysium', 'RPG', 'v0.6', 'early_access', 402, 632470, 'disco-elysium',
    'Eres un detective con la memoria en blanco en un distrito portuario que se cae a pedazos. Diálogo profundo, sin combate y 24 habilidades que te discuten en la cabeza. Acceso anticipado del primer acto.',
    ['RPG', 'Narrativa', 'Detective', 'Isométrico'], '2026-09-02T17:40:00Z'],
  ['Vampire Survivors', 'Shooter', 'Alpha 1.0', 'alpha', 470, 1794680, 'vampire-survivors',
    'Sobrevive 30 minutos a hordas imposibles esquivando y mejorando armas automáticas. Simple de jugar, imposible de soltar. Alpha con 4 personajes y el mapa del bosque.',
    ['Roguelite', 'Pixel Art', 'Casual', 'Supervivencia'], '2026-09-03T22:00:00Z'],
  ['Enter the Gungeon', 'Shooter', 'Beta 1.5', 'open_beta', 415, 311690, 'enter-the-gungeon',
    'Twin-stick roguelike donde TODO es balas: esquiva, rueda y dispara en una mazmorra llena de armas absurdas. Beta abierta con la nueva sala del mercader.',
    ['Roguelite', 'Twin-stick', 'Pixel Art', 'Difícil'], '2026-09-04T19:25:00Z'],
  ['Hotline Miami', 'Shooter', 'v0.4', 'tech_test', 443, 219150, 'hotline-miami',
    'Acción top-down ultrarrápida con estética neón de los 80: una llamada telefónica, una máscara y un edificio lleno de mafiosos. Probamos el nuevo sistema de puntuación.',
    ['Acción', 'Neón', 'Retrowave', 'Difícil'], '2026-09-05T23:50:00Z'],
  ['Baba Is You', 'Puzzle', 'Alpha 1.2', 'alpha', 356, 736260, 'baba-is-you',
    'Puzzle donde las REGLAS son piezas que puedes empujar: rompe la lógica del nivel y gana. 120 niveles alpha y el editor recién salido del horno, buscamos testers que nos rompan todo.',
    ['Puzzle', 'Lógica', 'Pixel Art', 'Creativo'], '2026-09-06T14:55:00Z'],
  ['INSIDE', 'Puzzle', 'Beta 0.8', 'closed_beta', 388, 480490, 'inside',
    'Un niño huye por una instalación oscura donde todo es una amenaza. Plataformas 2.5D cinematográficas, sin textos y con una tensión brutal. Beta cerrada del primer tercio del juego.',
    ['Plataformas', 'Puzzle', 'Cinemático', 'Atmospheric'], '2026-09-07T16:10:00Z'],
  ['Little Nightmares', 'Terror', 'v0.7', 'closed_beta', 407, 424840, 'little-nightmares',
    'Eres Seis, una niña de impermeable amarillo atrapada en Las Fauces, un barco lleno de adultos monstruosos. Terror sin palabras, pura atmósfera. Beta cerrada, trae la zona de la cocina.',
    ['Terror', 'Plataformas', 'Atmospheric', 'Narrativa'], '2026-09-08T21:35:00Z'],
  ['Poppy Playtime', 'Terror', 'Alpha 0.5', 'alpha', 449, 1721470, 'poppy-playtime',
    'Explora la fábrica de juguetes abandonada de Playtime Co. con tu GrabPack. Un amigo azul muy cariñoso te persigue. Alpha del capítulo 1 con el nuevo sistema de cintas VHS.',
    ['Terror', 'Puzzle', 'Fábrica', 'Indie'], '2026-09-09T18:20:00Z'],
  ['Bendy and the Ink Machine', 'Terror', 'Demo 0.2', 'tech_test', 428, 622510, 'bendy',
    'Vuelves al estudio de animación donde trabajaste hace 30 años y la tinta… está viva. Terror estilo cartoon de los 30s. Demo técnica, probamos el renderizado de tinta en tiempo real.',
    ['Terror', 'Cartoon', 'Retro', 'Puzzle'], '2026-09-10T20:40:00Z'],
  ['Untitled Goose Game', 'Otro', 'Beta 1.0', 'open_beta', 409, 837470, 'goose-game',
    'Eres un ganso horrible. Arruina el día de un pueblo entero robando cosas, graznando y huyendo. Beta abierta con la nueva lista de tareas del jardín.Pureza cómica.',
    ['Comedia', 'Stealth', 'Puzzle', 'Casual'], '2026-09-11T15:30:00Z'],
  ['Journey', 'Aventura', 'v0.3', 'alpha', 395, 638230, 'journey',
    'Cruza un desierto infinito hacia la montaña brillante con solo una túnica y una bufeta mágica. Multijugador silencioso donde nunca hablas, solo cantas. Alpha del primer acto.',
    ['Aventura', 'Atmospheric', 'Multijugador', 'Narrativa'], '2026-09-11T23:15:00Z'],
  ['Katana ZERO', 'Plataformas', 'Beta 0.9', 'closed_beta', 437, 460950, 'katana-zero',
    'Neo-Dojo, distrito lleno de neón: eres un asesino samurái que planea cada golpe y lo ejecuta en segundos. Una vida por misión, tiempo manipulable. Beta cerrada con el nivel de la discoteca.',
    ['Acción', 'Neón', 'Pixel Art', 'Narrativa'], '2026-09-12T02:10:00Z'],
];

console.log(`Insertando ${GAMES.length} juegos nuevos…`);
let i = 0;
for (const [title, genre, version, status, downloads, steamId, slug, description, tags, createdAt] of GAMES) {
  const cover = g(slug, 'cover');
  const shots = JSON.stringify([g(slug, 's1'), g(slug, 's2')]);
  const authorId = AUTHORS[i % AUTHORS.length];
  const when = new Date(createdAt);

  const post = await db.post.create({
    data: {
      authorId,
      type: 'BETA',
      content: null,
      mediaUrls: JSON.stringify([{ url: cover, kind: 'image' }]),
      createdAt: when,
      beta: {
        create: {
          title,
          description,
          downloadType: 'LINK',
          externalUrl: steam(steamId),
          betaStatus: status,
          genre,
          version,
          platforms: JSON.stringify(['PC']),
          tags: JSON.stringify(tags),
          installInstructions: 'Entra al enlace, descarga la beta desde Steam y ejecuta el instalador. Si el juego no abre, instala DirectX y Visual C++ Redistributable.',
          coverImage: cover,
          screenshots: shots,
          externalPlatform: 'Steam',
          downloads,
          createdAt: when,
        },
      },
    },
  });
  console.log(`✅ ${title} → post ${post.id.slice(0, 8)} (autor ${authorId.slice(0, 6)}, ${createdAt.slice(0, 10)})`);
  i++;
}

// verificación final
const total = await db.beta.count();
const posts = await db.post.groupBy({ by: ['type'], _count: { _all: true } });
console.log(`\n🏁 Betas totales ahora: ${total}`);
console.log(`Posts por tipo: ${posts.map(p => `${p.type}:${p._count._all}`).join(', ')}`);
await db.$disconnect();
