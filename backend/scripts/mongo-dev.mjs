// Starts a local single-node MongoDB replica set for development.
// Prisma needs a replica set because every financial write runs in a transaction.
//
//   npm run mongo        (keep it running in its own terminal)
//
// Data lives in backend/.mongo-data. Override with MONGO_PORT / MONGO_DBPATH / MONGOD_BIN.
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const port = process.env.MONGO_PORT ?? '27018'
const dbpath = resolve(process.env.MONGO_DBPATH ?? '.mongo-data')
const mongod = process.env.MONGOD_BIN ?? 'mongod'
const mongosh = process.env.MONGOSH_BIN ?? 'mongosh'

mkdirSync(dbpath, { recursive: true })
const child = spawn(mongod, ['--dbpath', dbpath, '--port', port, '--replSet', 'rs0', '--bind_ip', '127.0.0.1', '--quiet'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))

const init = `try { rs.status().ok } catch (e) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:${port}' }] }).ok }`
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  try {
    execFileSync(mongosh, ['--port', port, '--quiet', '--eval', init], { stdio: 'ignore' })
    console.log(`MongoDB replica set rs0 ready on mongodb://127.0.0.1:${port} (data: ${dbpath})`)
    // Create collections and indexes so a fresh database works without a manual db:push.
    try {
      execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { stdio: 'inherit' })
    } catch {
      console.error('prisma db push failed — run `npm run db:push` to see why')
    }
    break
  } catch {
    if (i === 29) console.error('Could not initiate the replica set — is mongosh installed?')
  }
}
