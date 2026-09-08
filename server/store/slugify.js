/* Shared by both drivers, and kept separate from db.js so selecting the
   Supabase driver never touches the local SQLite file. */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
