// Auditoría COMPLETA de la BD (solo lectura — nada de escrituras)
// Verifica que TODA la data implementada siga intacta en Supabase.
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ datasources: { db: { url: process.env.SUPA_URL } } })

async function count(model, where) {
  try { return await p[model].count({ where: where || {} }) }
  catch (e) { return 'ERR:' + e.message.slice(0, 40) }
}

;(async () => {
  console.log('════════ AUDITORÍA BD DEVPLAY (solo lectura) ════════')
  const users = await p.user.findMany({ select: { username: true, birthDate: true, fullName: true, isGuest: true, role: true, devCoins: true, tourCompleted: true, language: true } })
  console.log('👥 USERS total:', users.length)
  console.log('   con birthDate (registro edad):', users.filter(u => u.birthDate).length)
  console.log('   con fullName:', users.filter(u => u.fullName).length)
  console.log('   invitados:', users.filter(u => u.isGuest).length)
  console.log('   tour completado:', users.filter(u => u.tourCompleted).length)
  console.log('   con idioma elegido:', users.filter(u => u.language).length)
  console.log('   residuales qa_: ', users.filter(u => u.username.startsWith('qa_')).length)

  console.log('📄 POSTS total:', await count('post'))
  console.log('   betas:', await count('post', { type: 'BETA' }))
  console.log('   texto:', await count('post', { type: 'TEXT' }))
  console.log('   encuestas:', await count('post', { type: 'POLL' }))
  console.log('   streams:', await count('post', { type: 'STREAM' }))
  const betas = await p.beta.findMany({ select: { coverImage: true, screenshots: true, downloadType: true } })
  console.log('🎮 BETAS:', betas.length)
  console.log('   con portada:', betas.filter(b => b.coverImage).length)
  console.log('   con capturas:', betas.filter(b => (b.screenshots || []).length > 0).length)
  console.log('   download DIRECT:', betas.filter(b => b.downloadType === 'DIRECT').length)

  console.log('💬 CHAT mundial msgs:', await count('chatMessage'))
  console.log('✉️  DMs:', await count('directMessage'))
  console.log('🗨️  Comments:', await count('comment'))
  console.log('❤️  Likes:', await count('like'))
  console.log('🔖 Bookmarks:', await count('bookmark'))
  console.log('🤝 Follows:', await count('follow'))
  console.log('🔔 Notifications:', await count('notification'))
  console.log('📊 Polls:', await count('poll'), '| opciones:', await count('pollOption'), '| votos:', await count('pollVote'))
  console.log('🛍️  StoreItems:', await count('storeItem'), '| compras:', await count('storePurchase'))
  console.log('🪙 DevCoin txs:', await count('devCoinTransaction'))
  console.log('🚫 Blocks:', await count('block'), '| 🚩 Reports:', await count('report'))
  console.log('🔐 LoginCodes:', await count('loginCode'), '| LoginEvents:', await count('loginEvent'))

  // Muestra de las betas sembradas (las de itch.io)
  const sample = await p.beta.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { title: true, version: true, genre: true, downloads: true } })
  console.log('── muestra betas:', sample.map(b => `${b.title} (${b.genre}, ${b.downloads} desc)`).join(' | '))
  await p.$disconnect()
})().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
