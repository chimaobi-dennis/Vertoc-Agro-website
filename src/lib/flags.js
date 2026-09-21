/* Country flags by ISO 3166-1 alpha-2 code. The eight bundled PNGs are used when present; any other code falls back to flagcdn.com. */
export const flagSrc = code => `/assets/img/flag-${String(code || '').toLowerCase()}.png`
export const flagFallback = code => `https://flagcdn.com/w80/${String(code || '').toLowerCase()}.png`
/** onError handler: swap to the CDN once, never loop. */
export const onFlagError = code => e => { const img = e.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = flagFallback(code) } }
