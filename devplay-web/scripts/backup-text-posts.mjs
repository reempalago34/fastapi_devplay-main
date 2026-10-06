// 💾 RESPALDO de posts de texto (tipo POST sin beta/poll/stream) → JSON reversible
// Ejecutar ANTES de delete-text-posts.mjs
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';

const SUPA = process.env.SUPA;
const db = new PrismaClient({ datasources: { db: { url: SUPA } } });

const FILTER = { type: 'POST', beta: null, poll: null, stream: null };

const posts = await db.post.findMany({
  where: FILTER,
  select: {
    id: true, authorId: true, type: true, content: true, mediaUrls: true,
    repostOfId: true, createdAt: true, updatedAt: true,
    comments: { select: { id: true, userId: true, content: true, createdAt: true } },
    likes: { select: { id: true, userId: true, createdAt: true } },
    bookmarks: { select: { id: true, userId: true, createdAt: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const dir = '/home/z/my-project/scripts/backups';
mkdirSync(dir, { recursive: true });
const file = `${dir}/text-posts-${stamp}.json`;
writeFileSync(file, JSON.stringify({ respaldadoEn: new Date().toISOString(), filtro: 'type=POST sin beta/poll/stream', total: posts.length, posts }, null, 2));

console.log(`✅ Respaldo: ${posts.length} posts → ${file}`);
console.log(`   comentarios: ${posts.reduce((a, p) => a + p.comments.length, 0)}, likes: ${posts.reduce((a, p) => a + p.likes.length, 0)}, bookmarks: ${posts.reduce((a, p) => a + p.bookmarks.length, 0)}`);
await db.$disconnect();
