// 🔍 Estructura completa de un beta + su post (para replicar en el seed)
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: process.env.SUPA } } });

const beta = await db.beta.findFirst({
  orderBy: { createdAt: 'desc' },
  include: { post: { select: { id: true, authorId: true, createdAt: true, type: true, mediaUrls: true } } },
});
console.log('=== BETA CAMPOS ===');
for (const [k, v] of Object.entries(beta)) {
  if (k === 'post') { console.log('post:', JSON.stringify(v)); continue; }
  const s = typeof v === 'string' && v.length > 90 ? v.slice(0, 90) + '…' : v;
  console.log(`${k}: ${JSON.stringify(s)}`);
}
// autores de betas previos (para reutilizar)
const authors = await db.post.findMany({ where: { type: 'BETA', beta: { isNot: null } }, select: { authorId: true }, distinct: ['authorId'], take: 8 });
console.log('\nAUTHORS beta:', authors.map(a => a.authorId));
// un par de usuarios para autores nuevos
const users = await db.user.findMany({ select: { id: true, username: true }, take: 5, orderBy: { createdAt: 'asc' } });
console.log('USERS sample:', users.map(u => `${u.username}:${u.id}`));
await db.$disconnect();
