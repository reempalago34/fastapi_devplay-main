// 🎨 Generación de portadas + escenas para los juegos nuevos
// Guarda en public/games/<slug>-{cover,s1,s2}.png — se sirven como /games/...
import ZAI from 'z-ai-web-dev-sdk';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

const OUT = '/home/z/my-project/public/games';
mkdirSync(OUT, { recursive: true });
const SIZE = '1344x768';

// [slug, coverPrompt, scene1Prompt, scene2Prompt]
const GAMES = [
  ['hollow-knight',
    'indie metroidvania game key art, small silent knight with horned pale mask holding a nail sword, glowing blue caverns filled with giant bugs and ruined gothic arches, dark atmospheric, hand-painted 2D, high quality',
    '2D gameplay scene, horned mask knight standing on a mossy stone platform in a glowing blue underground cavern, gothic bug kingdom ruins, atmospheric side-scroller, high quality',
    '2D gameplay scene, horned mask knight facing a giant armored beetle boss in a dark arena lit by glowing orange lamps, gothic bug kingdom, high quality'],
  ['celeste',
    'indie platformer key art, a girl with long red hair climbing a snowy purple mountain at night, stars and pink clouds, retro pixel art style, high quality',
    'pixel art gameplay scene, red-haired girl mid-dash across icy cliff platforms high on a purple mountain, crystals and snow particles, retro pixel art, high quality',
    'pixel art gameplay scene, red-haired girl resting by a campfire on a mountain ledge at night, cabin in the distance, cozy retro pixel art, high quality'],
  ['shovel-knight',
    'retro 8-bit platformer key art, blue armored knight with a shovel weapon standing proud, golden treasure and torch-lit castle behind, NES pixel art style, high quality',
    '8-bit pixel gameplay scene, blue shovel knight jumping between stone platforms over spikes, torches and treasure chests in a castle, retro NES style, high quality',
    '8-bit pixel gameplay scene, blue shovel knight facing a big black knight boss on a bridge above lava, retro NES style, high quality'],
  ['dead-cells',
    'roguelite action game key art, headless prisoner with a glowing green flame for a head holding a sword, dark dungeon with red banners, stylized 2D, high quality',
    'stylized 2D gameplay scene, green flaming headed prisoner fighting slime monsters in a stone dungeon prison level, torches, high quality',
    'stylized 2D gameplay scene, green flaming headed prisoner leaping across broken ramparts of a medieval castle at dusk, high quality'],
  ['undertale',
    'retro RPG key art, cute pixel art human child with blue striped shirt meeting a friendly skeleton in a dark cave with purple lighting, retro pixel art, high quality',
    'retro pixel art RPG battle scene, child with striped shirt dodging floating white bone attack bullets, dark cave with purple tones, high quality',
    'retro pixel art scene, child walking through a long purple corridor with golden flowers and falling leaves, cozy mystery, high quality'],
  ['cult-of-the-lamb',
    'cute dark game key art, small white lamb wearing a red crown leading furry animal followers in a candlelit forest shrine, cartoon style with spooky accents, high quality',
    'cartoon gameplay scene, lamb character with red crown building a wooden village camp with animal followers in a dark forest clearing, high quality',
    'cartoon gameplay scene, lamb with red crown fighting an enormous one-eyed forest god boss among giant roots, high quality'],
  ['disco-elysium',
    'detective RPG key art, oil painting style portrait of a disheveled detective with a loud tie standing in a rainy harbor town, muted colors, expressionist brushstrokes, high quality',
    'oil painting style scene, two detectives talking on a rainy coastal street with boarded up shops, muted expressionist palette, high quality',
    'oil painting style scene, view of a war-torn harbor district at dusk from a balcony, seagulls and cranes, muted colors, expressionist, high quality'],
  ['vampire-survivors',
    'pixel art arcade game key art, tiny hero surrounded by hundreds of bats skeletons and monsters in a gothic field, dramatic purple night, retro pixel art, high quality',
    'retro pixel gameplay scene, top-down view of a hero shooting golden beams at a horde of skeleton bats in a moonlit graveyard, high quality',
    'retro pixel gameplay scene, top-down view of a hero collecting gems and garlic power-ups among a monster horde in a dark library, high quality'],
  ['enter-the-gungeon',
    'twin-stick shooter key art, cute bullet-shaped hero characters with pistols in a dungeon full of guns and gold, cartoon pixel art, high quality',
    'pixel gameplay scene, bullet-headed heroes dodging rolling bullet enemies in a gun-themed dungeon arena, high quality',
    'pixel gameplay scene, two bullet heroes facing a giant gun-armed shopkeeper boss behind an ammo counter, high quality'],
  ['hotline-miami',
    'neon 80s action game key art, masked man with a baseball bat standing in a neon pink and cyan lit room, VHS grain, Miami retro style, high quality',
    'top-down neon gameplay scene, masked man in a pink lit apartment hallway, 80s VHS aesthetic, palm trees outside the window, high quality',
    'top-down neon gameplay scene, man with a rooster mask riding a motorbike through a neon Miami street at night, VHS style, high quality'],
  ['baba-is-you',
    'minimal puzzle game key art, simple white pixel creatures pushing word tiles that form rule sentences on a colorful grid, flat retro style, high quality',
    'pixel puzzle scene, white rabbit-like creature and a flag on a grid with movable word tiles forming a rule, flat retro style, high quality',
    'pixel puzzle scene, white creature pushing a rock tile past a water hazard on a colorful grid, flat retro style, high quality'],
  ['inside',
    'cinematic puzzle platformer key art, small boy silhouette running through a dark industrial facility with a red glow, minimalist, moody fog, high quality',
    'side-scrolling scene, small boy sneaking past searchlights and hooded workers in a dark industrial warehouse, cinematic fog, high quality',
    'side-scrolling scene, small boy swimming underwater past a submerged fence with drones hunting above, green murky light, high quality'],
  ['little-nightmares',
    'dark whimsical key art, tiny girl in a yellow raincoat holding a lighter in a giant gloomy ship full of towering masked adults, painterly style, high quality',
    'painterly scene, yellow raincoat girl with a tiny lighter walking past giant shoes and furniture in a dark ship hallway, high quality',
    'painterly scene, yellow raincoat girl sneaking across a dinner table with enormous sleeping guests in a grand dark hall, high quality'],
  ['poppy-playtime',
    'toy horror game key art, abandoned toy factory with a giant blue furry monster with long arms and a wide smile, VHS security camera mood, high quality',
    'horror scene, giant blue furry monster with long arms reaching through an abandoned toy factory with colorful broken toys, high quality',
    'horror scene, empty dark factory corridor with a huge smiling toy mouth painted on the wall and flickering lights, high quality'],
  ['bendy',
    'vintage cartoon horror key art, grinning black and white cartoon demon with a halo among ink puddles in an old animation studio, 1930s rubber hose style, high quality',
    '1930s cartoon style scene, smiling ink demon silhouette dripping ink in an old animation studio with film reels and cel drawings, high quality',
    '1930s cartoon style scene, boarded workshop corridor covered in cartoon ink posters with a glowing pentagram on the floor, high quality'],
  ['goose-game',
    'charming stealth comedy key art, mischievous white goose with an orange beak stealing a golden key from a village gardener, bright pastel English village, flat cartoon style, high quality',
    'flat cartoon scene, white goose running through a village garden with a stolen tomato in its beak, panicked gardener with a rake behind, high quality',
    'flat cartoon scene, white goose honking at a frightened shopkeeper outside a little village store, sunny day, pastel colors, high quality'],
  ['journey',
    'emotional adventure key art, robed traveler with a long red scarf gliding over golden sand dunes toward a distant glowing mountain, soft sunset light, painterly, high quality',
    'painterly scene, red robed traveler with flowing scarf sand-surfing down a giant dune among floating cloth creatures at sunset, high quality',
    'painterly scene, two red robed travelers resting inside an ancient half-buried temple as a sandstorm passes, warm light, high quality'],
  ['katana-zero',
    'neon noir action key art, white haired samurai assassin with a katana in a rainy neon alley, pink and cyan lights, 2D stylized, high quality',
    'stylized scene, samurai assassin deflecting bullets in a rainy neon-lit apartment corridor, pink and cyan palette, high quality',
    'stylized scene, samurai assassin sitting in a dim psychiatric office chair across from a therapist, rain on the window, moody, high quality'],
];

const zai = await ZAI.create();
let done = 0, fail = 0;
const total = GAMES.length * 3;

async function gen(prompt, path) {
  if (existsSync(path)) { done++; console.log(`⏭️  ya existe ${path}`); return; }
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await zai.images.generations.create({ prompt, size: SIZE });
      const b64 = r?.data?.[0]?.base64;
      if (!b64) throw new Error('respuesta sin base64');
      writeFileSync(path, Buffer.from(b64, 'base64'));
      done++; console.log(`✅ [${done}/${total}] ${path.split('/').pop()}`);
      return;
    } catch (e) {
      console.log(`   ⚠️ intento ${a} falló para ${path.split('/').pop()}: ${e.message}`);
      if (a < 3) await new Promise(r => setTimeout(r, 1500 * a));
      else fail++;
    }
  }
}

// concurrencia limitada a 4
const JOBS = [];
for (const [slug, cover, s1, s2] of GAMES) {
  JOBS.push(() => gen(cover, `${OUT}/${slug}-cover.png`));
  JOBS.push(() => gen(s1, `${OUT}/${slug}-s1.png`));
  JOBS.push(() => gen(s2, `${OUT}/${slug}-s2.png`));
}
const CONC = 2;
let idx = 0;
async function worker() {
  while (idx < JOBS.length) { const j = JOBS[idx++]; await j(); await new Promise(r => setTimeout(r, 1200)); }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(`\n🏁 Generadas: ${done}, fallidas: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
