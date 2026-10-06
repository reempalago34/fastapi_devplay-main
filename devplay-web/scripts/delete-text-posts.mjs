// 🗑️ ELIMINAR posts de texto (tipo POST sin beta/poll/stream)
// ⚠️ Ejecutar SOLO DESPUÉS de backup-text-posts.mjs (respaldo JSON reversible)
// Comentarios, likes y bookmarks se borran en cascada (schema onDelete: Cascade)
import { PrismaClient } from '@prisma/client';

const SUPA = process.env.SUPA;
const db = new PrismaClient({ datasources: { db: { url: SUPA } } });

const FILTER = { type: 'POST', beta: null, poll: null, stream: null };

// Cuenta lo que va a borrar (para el log)
const antes = await db.post.count({ where: FILTER });
const coms = await db.comment.count({ where: { post: FILTER } });
const likes = await db.like.count({ where: { post: FILTER } });
const marks = await db.bookmark.count({ where: { post: FILTER } });

console.log(`A borrar: ${antes} posts de texto, ${coms} comentarios, ${likes} likes, ${marks} bookmarks`);
console.log(`INTACTOS: betas (32), encuestas (8+2), usuarios, follows, chat — nada de eso se toca`);

const res = await db.post.deleteMany({ where: FILTER });
console.log(`🗑️  Eliminados: ${res.count} posts (cascada incluida)`);

// Verificación posterior
const quedan = await db.post.count({ where: FILTER });
const tipos = await db.post.groupBy({ by: ['type'], _count: { _all: true } });
console.log(`Posts de texto restantes: ${quedan}`);
console.log(`Estado final: ${tipos.map(c => `${c.type}:${c._count._all}`).join(', ')}`);
await db.$disconnect();
