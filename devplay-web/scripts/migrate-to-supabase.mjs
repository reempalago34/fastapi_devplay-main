#!/usr/bin/env bun
/**
 * DevPlay · Migración de datos SQLite → Supabase (PostgreSQL) 🐘
 *
 * PASOS PREVIOS (una sola vez):
 *   1. bash scripts/use-supabase.sh          (schema postgres + cliente regenerado)
 *   2. .env con DATABASE_URL del pooler de Supabase
 *   3. bunx prisma db push                    (crea las tablas en Supabase)
 *
 * EJECUTAR:
 *   bun scripts/migrate-to-supabase.mjs
 *
 * Lee tu SQLite local (db/custom.db) y copia TODAS las tablas a Supabase
 * conservando los IDs (las relaciones quedan intactas). Si una tabla ya
 * tiene datos en Supabase, se salta automáticamente (skipDuplicates).
 */

import { Database } from 'bun:sqlite'
import { PrismaClient } from '@prisma/client'
import { join } from 'path'
import { existsSync } from 'fs'

const db = new PrismaClient()

// Localizar el SQLite de desarrollo
const SQLITE_CANDIDATES = [
  join(process.cwd(), 'db', 'custom.db'),
  process.env.SQLITE_PATH,
].filter(Boolean)

const sqlitePath = SQLITE_CANDIDATES.find((p) => existsSync(p))
if (!sqlitePath) {
  console.error('❌ No encontré el archivo SQLite (busqué db/custom.db). Pasa la ruta con SQLITE_PATH=...')
  process.exit(1)
}
console.log(`📖 Leyendo SQLite: ${sqlitePath}`)
const sqlite = new Database(sqlitePath, { readonly: true })

// Orden de inserción respetando dependencias (FKs)
const TABLES = [
  'User',
  'StoreItem',
  'Post',
  'Beta',
  'Stream',
  'Comment',
  'Like',
  'Bookmark',
  'Follow',
  'Notification',
  'ChatMessage',
  'Block',
  'Report',
  'LoginEvent',
  'AccountDeletionCode',
  'Poll',
  'PollOption',
  'PollVote',
  'StorePurchase',
  'DevCoinTransaction',
]

const DATE_HINT = /At$|Expiry$|birthDate|expiresAt/

function toPrismaDelegate(table) {
  const name = table.charAt(0).toLowerCase() + table.slice(1)
  return db[name]
}

// Campos Boolean por modelo (DMMF) — SQLite guarda 0/1, PostgreSQL quiere true/false
const BOOLEAN_FIELDS = {}
for (const model of (await import('@prisma/client')).Prisma.dmmf.datamodel.models) {
  BOOLEAN_FIELDS[model.name] = model.fields.filter(f => f.type === 'Boolean').map(f => f.name)
}

// Campos DateTime por modelo (por si el DATE_HINT por nombre se queda corto)
const DATETIME_FIELDS = {}
for (const model of (await import('@prisma/client')).Prisma.dmmf.datamodel.models) {
  DATETIME_FIELDS[model.name] = model.fields.filter(f => f.type === 'DateTime').map(f => f.name)
}

let totalRows = 0
for (const table of TABLES) {
  let rows
  try {
    rows = sqlite.query(`SELECT * FROM "${table}"`).all()
  } catch {
    console.log(`⚠️  Tabla ${table} no existe en SQLite, se omite`)
    continue
  }
  if (rows.length === 0) {
    console.log(`· ${table}: 0 filas`)
    continue
  }

  const bools = BOOLEAN_FIELDS[table] || []
  const dates = DATETIME_FIELDS[table] || []

  const data = rows.map((row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === null) { out[k] = null; continue }
      if (bools.includes(k)) { out[k] = v === 1 || v === '1' || v === true; continue }
      if (dates.includes(k) || (typeof v === 'string' && DATE_HINT.test(k))) {
        const d = new Date(v)
        out[k] = isNaN(d.getTime()) ? v : d
      } else {
        out[k] = v
      }
    }
    return out
  })

  try {
    const delegate = toPrismaDelegate(table)
    const res = await delegate.createMany({ data, skipDuplicates: true })
    totalRows += res.count
    console.log(`✅ ${table}: ${res.count}/${rows.length} filas copiadas`)
  } catch (e) {
    const msg = (e.message || String(e)).replace(/\s+/g, ' ').slice(0, 260)
    console.error(`❌ ${table}: ${msg}`)
  }
}

console.log(`\n🎉 Migración terminada — ${totalRows} filas copiadas a Supabase.`)
await db.$disconnect()
sqlite.close()
