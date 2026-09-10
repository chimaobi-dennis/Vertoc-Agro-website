/*
 * Audit log writer. Every admin-panel and MCP mutation goes through here, so
 * "who changed the cocoa MOQ" is answerable whether a person or Claude did it.
 * Failures are logged but never block the underlying action.
 */
let clientPromise = null
const client = () => clientPromise ??= import('./store/supabase.js').then(m => m.supabase)

export async function audit({ actor, action, entity, entityId, before = null, after = null }) {
  try {
    const supabase = await client()
    await supabase.from('audit_log').insert({
      actor_id: actor?.id ?? null,
      actor_label: actor?.email ?? actor?.label ?? 'system',
      action, entity,
      entity_id: entityId != null ? String(entityId) : null,
      before, after,
    })
  } catch (e) {
    console.error('[audit] failed to write:', e.message)
  }
}

export const MCP_ACTOR = { id: null, label: 'mcp' }
