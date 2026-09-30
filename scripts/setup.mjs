// Runs after `npm install` in the repo root: installs backend and frontend
// dependencies and creates their env files from the examples if missing.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

for (const [dir, envFile] of [['backend', '.env'], ['frontend', '.env.local']]) {
  const cwd = resolve(root, dir)
  console.log(`\n> Installing ${dir} dependencies`)
  execSync('npm install', { cwd, stdio: 'inherit' })

  const target = resolve(cwd, envFile)
  if (!existsSync(target)) {
    copyFileSync(resolve(cwd, '.env.example'), target)
    console.log(`> Created ${dir}/${envFile} from .env.example`)
  }
}

execSync('npx prisma generate', { cwd: resolve(root, 'backend'), stdio: 'inherit' })
