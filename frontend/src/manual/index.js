import { marked } from 'marked'

// The user manual: one markdown file per part, in Portuguese, bundled with the app so it opens
// offline. Each file starts with its "# Title". The order here is the order of the index.
const files = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true })

const ORDER = [
  'entrar',
  'inicio',
  'agenda',
  'evento',
  'musicas',
  'financeiro',
  'integrantes',
  'registros',
  'permissoes',
  'celular',
  'configuracoes',
  'admin',
]

// Only super admins see these in the index and can open them
const SUPER_ADMIN_ONLY = new Set(['admin'])

function titleOf(source) {
  return source.match(/^# (.+)$/m)?.[1].trim() ?? ''
}

export const parts = ORDER.filter((slug) => files[`./${slug}.md`] !== undefined).map((slug) => {
  const source = files[`./${slug}.md`]
  return {
    slug,
    title: titleOf(source),
    html: marked.parse(source),
    superAdminOnly: SUPER_ADMIN_ONLY.has(slug),
  }
})

export function visibleParts(isSuperAdmin) {
  return parts.filter((part) => isSuperAdmin || !part.superAdminOnly)
}

// The part that explains each screen, by route name, for the Help links
const PART_BY_ROUTE = {
  Login: 'entrar',
  CentralLogin: 'entrar',
  Dashboard: 'inicio',
  Agenda: 'agenda',
  Event: 'evento',
  Songs: 'musicas',
  Finance: 'financeiro',
  Members: 'integrantes',
  Logs: 'registros',
  Settings: 'configuracoes',
  AdminBands: 'admin',
  AdminBand: 'admin',
  AdminSuperAdmins: 'admin',
}

export function helpPath(routeName) {
  const slug = PART_BY_ROUTE[routeName]
  return slug ? `/ajuda/${slug}` : '/ajuda'
}
