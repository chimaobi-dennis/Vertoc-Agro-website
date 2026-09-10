/*
 * Document uploads: metadata through our API, bytes straight to Supabase
 * Storage on a signed upload URL (Vercel caps function bodies at 4.5 MB),
 * then a confirm call so the record is only ever "ready" once the object
 * really exists. Reads use short-lived signed URLs — the bucket is private.
 */
import { supabase } from '../lib/supabase'
import { adminFetch } from '../lib/adminApi'
import { openInNewTab } from './format'

export const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt'
export const ACCEPT_IMAGE = 'image/*'
export const MAX_BYTES = 20 * 1024 * 1024

const BY_EXT = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
}
const typeOf = file => file.type || BY_EXT[file.name.split('.').pop().toLowerCase()] || 'application/octet-stream'

/** @param {File} file  @param {{client_id?:number, quote_id?:number}} scope */
export async function uploadDocument(file, scope = {}) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`)
  const content_type = typeOf(file)
  const { document, upload } = await adminFetch('/documents', { method: 'POST', body: { ...scope, name: file.name, content_type, bytes: file.size } })
  const { error } = await supabase.storage.from('documents').uploadToSignedUrl(upload.path, upload.token, file, { contentType: content_type, upsert: false })
  if (error) throw new Error(error.message || 'The upload failed. Please try again.')
  return adminFetch(`/documents/${document.id}/complete`, { method: 'POST' })
}

export const documentUrl = (id, { download = false } = {}) =>
  adminFetch(`/documents/${id}/url${download ? '?download=1' : ''}`).then(r => r.url)

export const openDocument = (id, { download = false } = {}) => openInNewTab(documentUrl(id, { download }))

export const isImage = doc => doc?.kind === 'image' || String(doc?.content_type || '').startsWith('image/')
