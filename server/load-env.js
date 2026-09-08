/*
 * Side-effect module: loads server/.env into process.env.
 *
 * MUST be the first import in any entry point. ES module imports are hoisted
 * and evaluated before top-level statements, so calling loadEnvFile() inline
 * in an entry file runs too late — store/index.js would already have chosen
 * its driver from an empty process.env. Imports are evaluated in order, so
 * putting this first guarantees the env is populated before anything reads it.
 *
 * On Vercel there is no .env file; the platform supplies the variables.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env')
if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}
