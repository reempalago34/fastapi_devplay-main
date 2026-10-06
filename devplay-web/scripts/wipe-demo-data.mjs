/**
 * Wipe de datos de prueba — deja DevPlay vacío para perfiles REALES 🧹
 *
 * - Borra TODO el contenido (posts, betas, comentarios, likes, DMs, chat,
 *   notificaciones, follows, blocks, reports, encuestas, streams, códigos,
 *   compras/monedas y la tienda de ejemplo).
 * - Borra TODOS los usuarios EXCEPTO el dueño (frankalexander064@gmail.com),
 *   al que también se le limpia el contenido pero se conserva el perfil.
 * - Los invitados visuales también se van.
 *
 * Uso (SIEMPRE con DATABASE_URL inline — trampa #1 del sandbox):
 *   DATABASE_URL='postgresql://...' node scripts/wipe-demo-data.mjs
 */

import { PrismaClient } from '@prisma/client'

const OWNER_EMAIL = 'frankalexander064@gmail.com'

const url = process.env.DATABASE_URL
if (!url || !url.startsWith('postgresql')) {
  console.error('❌ Falta DATABASE_URL de Supabase (inline). Abortando.')
  process.exit(1)
}

const db = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log('🧹 Limpiando contenido de prueba...')

  // Contenido (orden seguro por FK)
  const r = {}
  r.dms = await db.directMessage.deleteMany({})
  r.chat = await db.chatMessage.deleteMany({})
  r.notifs = await db.notification.deleteMany({})
  r.pollVotes = await db.pollVote.deleteMany({})
  r.pollOptions = await db.pollOption.deleteMany({})
  r.polls = await db.poll.deleteMany({})
  r.likes = await db.like.deleteMany({})
  r.bookmarks = await db.bookmark.deleteMany({})
  r.comments = await db.comment.deleteMany({})
  r.betas = await db.beta.deleteMany({})
  r.streams = await db.stream.deleteMany({})
  r.posts = await db.post.deleteMany({})
  r.follows = await db.follow.deleteMany({})
  r.blocks = await db.block.deleteMany({})
  r.reports = await db.report.deleteMany({})
  r.loginCodes = await db.loginCode.deleteMany({})
  r.deletionCodes = await db.accountDeletionCode.deleteMany({})
  r.loginEvents = await db.loginEvent.deleteMany({})
  r.storePurchases = await db.storePurchase.deleteMany({})
  r.coinTx = await db.devCoinTransaction.deleteMany({})
  r.storeItems = await db.storeItem.deleteMany({})

  for (const [k, v] of Object.entries(r)) {
    if (v.count > 0) console.log(`  · ${k}: ${v.count} borrados`)
  }

  // Usuarios: todo fuera, salvo el dueño
  const deletedUsers = await db.user.deleteMany({
    where: { email: { not: OWNER_EMAIL } },
  })
  console.log(`  · usuarios: ${deletedUsers.count} borrados (dueño ${OWNER_EMAIL} conservado)`)

  // El dueño queda sin contenido y listo para su perfil real
  await db.user.update({
    where: { email: OWNER_EMAIL },
    data: { tourCompleted: false },
  }).catch(() => {})

  const remaining = await db.user.count()
  console.log(`✅ BD lista. Usuarios restantes: ${remaining}`)
  console.log(`   Posts: ${await db.post.count()} · Betas: ${await db.beta.count()} · DMs: ${await db.directMessage.count()} · Tienda: ${await db.storeItem.count()}`)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => db.$disconnect())
