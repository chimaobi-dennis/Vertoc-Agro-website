/*
 * Bootstrap the first admin. There is no signup page, so the very first
 * account has to be created from the command line:
 *
 *   node create-admin.js you@example.com 'a-strong-password' 'Your Name'
 *
 * After that, every further user is invited from the panel.
 */
import './load-env.js'
import { supabase } from './store/supabase.js'

const [email, password, name = 'Admin'] = process.argv.slice(2)
if (!email || !password) {
  console.error('usage: node create-admin.js <email> <password> [name]')
  process.exit(1)
}
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.')
  process.exit(1)
}

const { data, error } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { name },
})
if (error) { console.error('createUser failed:', error.message); process.exit(1) }

const { error: pErr } = await supabase.from('profiles')
  .upsert({ id: data.user.id, email, name, role: 'admin', active: true }, { onConflict: 'id' })
if (pErr) { console.error('profile upsert failed:', pErr.message); process.exit(1) }

console.log(`admin created: ${email} (${data.user.id})`)
console.log('Sign in at /admin/login')
