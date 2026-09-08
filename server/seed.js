/*
 * Bootstraps the configured store from the recovered site content.
 *
 * Targets whichever driver is active, so the same command seeds either the
 * local SQLite file or Supabase:
 *
 *   npm run seed
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Safe to re-run: existing slugs are updated rather than duplicated.
 */
import './load-env.js'
import { products, posts } from './seed-data.js'
import * as content from './content.js'
import { driver } from './store/index.js'

console.log(`Seeding store: ${driver}\n`)

let created = 0, updated = 0
for (const p of products) {
  if (await content.getProduct(p.slug)) {
    await content.updateProduct(p.slug, p); updated++
  } else {
    await content.createProduct(p); created++
  }
}

let pc = 0, pu = 0
for (const p of posts) {
  if (await content.getPost(p.slug)) {
    await content.updatePost(p.slug, p); pu++
  } else {
    await content.createPost(p); pc++
  }
}

console.log(`products: ${created} created, ${updated} updated`)
console.log(`posts:    ${pc} created, ${pu} updated`)
console.log(`\nTotals now: ${(await content.listProducts({ limit: 999 })).length} products, ${(await content.listPosts({ limit: 999 })).length} posts`)
