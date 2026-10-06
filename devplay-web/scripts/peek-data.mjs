// 🔍 Inspección rápida de patrones de datos (solo lectura)
import { PrismaClient } from '@prisma/client';

const SUPA = process.env.SUPA;
const db = new PrismaClient({ datasources: { db: { url: SUPA } } });

const b = await db.beta.findFirst({ orderBy: { createdAt: 'desc' }, select: { title: true, coverImage: true, screenshots: true } });
console.log('TITULO:', b.title);
console.log('COVER:', b.coverImage);
console.log('SHOT[0]:', (b.screenshots ?? [])[0]);
console.log('SHOT[1]:', (b.screenshots ?? [])[1]);

const p = await db.post.findFirst({ where: { type: 'POST' }, select: { id: true, content: true, mediaUrls: true } });
console.log('POST_TEXTO:', JSON.stringify({ id: p.id.slice(0, 8), content: p.content?.slice(0, 60), media: p.mediaUrls?.slice(0, 50) }));

const counts = await db.post.groupBy({ by: ['type'], _count: { _all: true } });
console.log('TIPOS:', counts.map(c => `${c.type}:${c._count._all}`).join(', '));

const withBeta = await db.post.count({ where: { type: 'POST', beta: { isNot: null } } });
const withPoll = await db.post.count({ where: { type: 'POST', poll: { isNot: null } } });
console.log(`POST con beta: ${withBeta}, POST con poll: ${withPoll}`);

// ¿cuántos POST de texto tienen comentarios/likes? (para saber qué se borra en cascada)
const textPosts = await db.post.findMany({ where: { type: 'POST', beta: null, poll: null, stream: null }, select: { id: true, _count: { select: { comments: true, likes: true } } } });
const totCom = textPosts.reduce((a, p) => a + p._count.comments, 0);
const totLikes = textPosts.reduce((a, p) => a + p._count.likes, 0);
console.log(`Posts de texto puro: ${textPosts.length} (comentarios asociados: ${totCom}, likes: ${totLikes})`);

await db.$disconnect();
