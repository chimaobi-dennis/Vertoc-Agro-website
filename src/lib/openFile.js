/*
 * Open or save a stored file the way the invoice PDFs open: the bytes are
 * fetched, wrapped in a typed Blob and shown from a blob: URL — never by
 * sending the person to the long signed storage address (which exposes the
 * bucket, expires, and shows .txt/.pdf however the storage server labels it).
 */
const BY_EXT = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
}
export const typeFromName = name => BY_EXT[String(name || '').split('.').pop().toLowerCase()] || ''

/** Fetch a signed URL into a typed Blob. */
async function toBlob(url, name, type) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('The file could not be loaded. Please try again.')
  const raw = await res.blob()
  const t = typeFromName(name) || type || raw.type || 'application/octet-stream'
  return new Blob([raw], { type: t })
}

const save = (blobUrl, name) => {
  const a = document.createElement('a'); a.href = blobUrl; a.download = name || 'download'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}

/**
 * @param {Promise<{url:string, name?:string, type?:string}>|(() => Promise<...>)} source  resolves to a signed URL (and the file's name)
 * @param {{download?:boolean, name?:string}} opts
 */
export async function openFile(source, { download = false, name = '' } = {}) {
  // The tab is opened inside the click, before anything is awaited, so popup blockers allow it.
  const w = download ? null : window.open('', '_blank')
  if (w) { try { w.opener = null; w.document.title = 'Opening document…'; w.document.body.innerHTML = '<p style="font:14px system-ui;padding:24px;color:#555">Opening the document…</p>' } catch { /* cross-origin guard */ } }
  try {
    const src = await (typeof source === 'function' ? source() : source)
    const file = src.name || name
    const blob = await toBlob(src.url, file, src.type)
    const url = URL.createObjectURL(blob)
    if (download) return save(url, file)
    if (w && !w.closed) w.location.replace(url); else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60000)
  } catch (e) { w?.close(); throw e }
}
