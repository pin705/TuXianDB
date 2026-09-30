import postgres from 'postgres'

// One pool per process (reused across dev hot reloads). `prepare: false` keeps it compatible with
// transaction-mode poolers such as Neon's pgbouncer endpoint.
const g = globalThis as unknown as { __sql?: postgres.Sql }
export const sql = g.__sql ?? postgres(process.env.DATABASE_URL ?? '', { max: 5, idle_timeout: 20, prepare: false })
if (process.env.NODE_ENV !== 'production') g.__sql = sql
