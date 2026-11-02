// In production every band lives on <slug>.<BASE_DOMAIN> and Google login happens on
// BASE_DOMAIN itself, the only origin registered with Google. Without VITE_BASE_DOMAIN
// (local development) the app logs in directly on the current host.
const baseDomain = (import.meta.env.VITE_BASE_DOMAIN || '').toLowerCase()

export function isCentralHost(host = window.location.hostname) {
  return Boolean(baseDomain) && host.toLowerCase() === baseDomain
}

export function currentBandSlug(hostname = window.location.hostname) {
  if (!baseDomain) return null
  const host = hostname.toLowerCase()
  return host.endsWith(`.${baseDomain}`) ? host.slice(0, -(baseDomain.length + 1)) : null
}

// Only same-site paths are accepted as post-login destinations
export function safeRedirectPath(path) {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) ? path : '/dashboard'
}

export function centralLoginUrl(redirect) {
  const params = new URLSearchParams({ band: currentBandSlug(), redirect: safeRedirectPath(redirect) })
  return `https://${baseDomain}/entrar?${params}`
}

export function bandCallbackUrl(slug, code, redirect) {
  const params = new URLSearchParams({ code, redirect: safeRedirectPath(redirect) })
  return `https://${slug}.${baseDomain}/auth/callback?${params}`
}

// The admin panel lives on the central host; locally, on the current one
export function adminUrl(path = '/admin') {
  return baseDomain ? `https://${baseDomain}${safeRedirectPath(path)}` : safeRedirectPath(path)
}

// Where a band is served; null locally, where every host is DEFAULT_BAND
export function bandUrl(slug) {
  return baseDomain ? `https://${slug}.${baseDomain}/` : null
}
