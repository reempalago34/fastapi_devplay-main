// 🔍 AUDITORÍA DEFINITIVA SUPABASE — SOLO LECTURA (0 escrituras)
// Verifica que TODOS los datos de las sesiones anteriores estén intactos.
import { PrismaClient } from '@prisma/client';

const SUPA = process.env.SUPA;
if (!SUPA) { console.error('❌ Falta SUPA'); process.exit(1); }
const db = new PrismaClient({ datasources: { db: { url: SUPA } } });

const n = (v) => (v == null ? '—' : v.toLocaleString('es'));

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  AUDITORÍA SUPABASE — DevPlay (solo lectura)');
  console.log('════════════════════════════════════════════════');

  // 1. USUARIOS
  const users = await db.user.count();
  const usersWithProfile = await db.user.count({ where: { avatar: { not: null } } });
  console.log(`\n👤 USUARIOS: ${n(users)} (con avatar: ${n(usersWithProfile)})`);

  // 2. POSTS por tipo
  const postsTotal = await db.post.count();
  const byType = await db.post.groupBy({ by: ['type'], _count: { _all: true } });
  console.log(`\n📝 POSTS: ${n(postsTotal)}`);
  for (const t of byType) console.log(`   · ${t.type}: ${n(t._count._all)}`);

  // 3. BETAS (lo importante: portadas + capturas)
  const betas = await db.beta.findMany({
    select: { id: true, title: true, version: true, genre: true, coverImage: true, screenshots: true, downloads: true, postId: true },
    orderBy: { createdAt: 'desc' },
  });
  const withCover = betas.filter((b) => !!b.coverImage);
  const withShots = betas.filter((b) => (b.screenshots ?? []).length > 0);
  console.log(`\n🎮 BETAS: ${n(betas.length)}`);
  console.log(`   · con portada (coverImage): ${withCover.length}/${betas.length}`);
  console.log(`   · con capturas (screenshots): ${withShots.length}/${betas.length}`);
  for (const b of betas) {
    const shots = (b.screenshots ?? []).length;
    console.log(`   → ${b.title} v${b.version ?? '?'} [${b.genre ?? '—'}] portada:${b.coverImage ? 'SÍ' : 'NO'} capturas:${shots} descargas:${n(b.downloads)}`);
  }

  // 4. POSTS BETA con mediaUrls (verificar qué referencia cada post)
  const betaPosts = await db.post.findMany({
    where: { type: 'BETA', beta: { isNot: null } },
    select: { id: true, mediaUrls: true, authorId: true, createdAt: true, beta: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  console.log(`\n🔗 POSTS-BETA recientes: ${n(betaPosts.length)} (muestro ${betaPosts.length})`);
  for (const p of betaPosts.slice(0, 10)) {
    let mediaCount = 0; try { const arr = JSON.parse(p.mediaUrls ?? '[]'); mediaCount = arr.length; } catch { mediaCount = p.mediaUrls ? 1 : 0; }
    console.log(`   → post ${p.id.slice(0, 8)} beta:«${p.beta?.title ?? '—'}» media:${mediaCount}`);
  }

  // 5. CHAT MUNDIAL
  const chat = await db.chatMessage.count();
  const lastChat = await db.chatMessage.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, content: true } });
  console.log(`\n💬 CHAT MUNDIAL: ${n(chat)} mensajes · último: ${lastChat ? `${new Date(lastChat.createdAt).toISOString()} «${(lastChat.content ?? '').slice(0, 40)}»` : '—'}`);

  // 6. DMs
  const dms = await db.directMessage.count();
  console.log(`\n✉️  MENSAJES DIRECTOS: ${n(dms)}`);

  // 7. INTERACCIONES
  const [likes, comments, bookmarks, follows, notifs, blocks, reports] = await Promise.all([
    db.like.count(), db.comment.count(), db.bookmark.count(), db.follow.count(),
    db.notification.count(), db.block.count(), db.report.count(),
  ]);
  console.log(`\n❤️  LIKES: ${n(likes)} · 💬 COMENTARIOS: ${n(comments)} · 🔖 BOOKMARKS: ${n(bookmarks)}`);
  console.log(`👥 FOLLOWS: ${n(follows)} · 🔔 NOTIFICACIONES: ${n(notifs)} · 🚫 BLOQUEOS: ${n(blocks)} · 🚩 REPORTES: ${n(reports)}`);

  // 8. POLLS (encuestas)
  const [polls, pollOpts, pollVotes] = await Promise.all([
    db.poll.count(), db.pollOption.count(), db.pollVote.count(),
  ]);
  console.log(`\n📊 ENCUESTAS: ${n(polls)} (opciones: ${n(pollOpts)}, votos: ${n(pollVotes)})`);

  // 9. TIENDA + DEVCOINS
  const [items, purchases, txs] = await Promise.all([
    db.storeItem.count(), db.storePurchase.count(), db.devCoinTransaction.count(),
  ]);
  console.log(`\n🛒 TIENDA: ${n(items)} items · ${n(purchases)} compras · ${n(txs)} transacciones DevCoin`);

  // 10. LOGIN (OTP + eventos)
  const [codes, delCodes, logEvents] = await Promise.all([
    db.loginCode.count(), db.accountDeletionCode.count(), db.loginEvent.count(),
  ]);
  console.log(`\n🔑 CÓDIGOS LOGIN (OTP): ${n(codes)} · códigos borrado cuenta: ${n(delCodes)} · eventos login: ${n(logEvents)}`);

  // 11. STREAMS
  const streams = await db.stream.count();
  console.log(`\n📡 STREAMS: ${n(streams)}`);

  console.log('\n════════════════════════════════════════════════');
  console.log('  ✅ AUDITORÍA COMPLETA — 0 datos modificados');
  console.log('════════════════════════════════════════════════');
}

main()
  .catch((e) => { console.error('❌ ERROR:', e.message); process.exit(1); })
  .finally(() => db.$disconnect());
