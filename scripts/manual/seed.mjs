// Builds the made-up band "Os Exemplos" that the user manual's screenshots show, in the local
// stack started by scripts/manual-screenshots.sh. Everything except what only the database can do
// (the band, the first member, the super admin and the sessions) goes through the API, signed in
// as Ana Souza, so the Registros look like real use. Dates are relative to today, so the agenda
// always has upcoming events.
//
// Writes the sessions to scripts/manual/.session.json for screenshots.mjs, and for signing in by
// hand (see the instructions the shell script prints).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const API = process.env.VITE_API_URL || 'http://localhost:8001'
export const BAND = { slug: 'os-exemplos', name: 'Os Exemplos' }

function compose(...args) {
  return execFileSync('docker', ['compose', ...args], { cwd: root, encoding: 'utf8' }).trim()
}

function sql(statement) {
  return compose(
    'exec', '-T', '-e', `MYSQL_PWD=${process.env.MYSQL_ROOT_PASSWORD || 'root'}`,
    'db', 'mysql', '-N', '-s', '-uroot',
    process.env.MYSQL_DATABASE || 'contas', '-e', statement,
  )
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

// The same token AuthService.createToken issues, signed with the backend's own secret, plus the
// sessions row every request checks
function signIn(payload) {
  const token = compose(
    'exec', '-T', 'backend', 'node', '-e',
    `const jwt = require('jsonwebtoken');
     console.log(jwt.sign(${JSON.stringify(payload)},
       process.env.JWT_SECRET || 'your-secret-key-change-in-production', { expiresIn: '24h' }))`,
  )
  const owner = payload.superAdminId ? 'super_admin_id' : 'member_id'
  const id = payload.superAdminId ?? payload.memberId
  sql(`INSERT INTO sessions (${owner}, token, expires_at) VALUES (${id}, ${quote(token)}, NOW() + INTERVAL 1 DAY)`)
  return token
}

let token = ''
async function api(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`)
  return data?.data
}

function day(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const LYRICS = {
  'Estrada de Terra': `Poeira no retrovisor
o sol se pondo devagar
a estrada de terra me leva
pra onde eu quero voltar

Refrão:
Vai, vai, que a noite é longa
vai, vai, que o som não para`,
  'Luz do Farol': `Lá longe a luz do farol
pisca pra quem ficou no mar
eu canto baixo essa canção
pra ela me ajudar a voltar`,
}

const SONGS = [
  { title: 'Estrada de Terra', artist: 'Os Exemplos', notes: 'Tom: G' },
  { title: 'Luz do Farol', artist: 'Banda Inventada', notes: 'Tom: D' },
  { title: 'Café Sem Açúcar', artist: 'Trio Fictício' },
  { title: 'Segunda-feira', artist: 'Os Exemplos' },
  { title: 'Vento Norte', artist: 'Banda Inventada' },
  { title: 'Domingo no Parque de Papel', artist: 'Trio Fictício' },
  { title: 'Rádio Velho', artist: 'Os Exemplos' },
  { title: 'Passo Lento' },
  // Last, so the Início shows it as the latest one
  { title: 'Saideira', artist: 'Os Exemplos' },
]

export async function seed() {
  // A fresh database has the band of DEFAULT_BAND from the migrations, with Show and Ensaio
  sql(`UPDATE bands SET slug = ${quote(BAND.slug)}, name = ${quote(BAND.name)} WHERE id = 1`)
  sql(`INSERT INTO members (band_id, name, email) VALUES (1, 'Ana Souza', 'ana@example.com')`)
  const anaId = Number(sql(`SELECT id FROM members WHERE email = 'ana@example.com'`))
  sql(`INSERT INTO super_admins (name, email) VALUES ('Paula Admin', 'paula@example.com')`)
  const paulaId = Number(sql(`SELECT id FROM super_admins WHERE email = 'paula@example.com'`))

  const ana = { id: anaId, name: 'Ana Souza', email: 'ana@example.com', superAdmin: false }
  token = signIn({ memberId: anaId, bandId: 1, name: ana.name, email: ana.email })

  const bruno = await api('POST', '/api/members', { name: 'Bruno Lima', email: 'bruno@example.com' })
  const carla = await api('POST', '/api/members', { name: 'Carla Mendes', email: 'carla@example.com' })
  const diego = await api('POST', '/api/members', { name: 'Diego Rocha', email: 'diego@example.com' })
  await api('PATCH', `/api/members/${diego.id}/toggle-active`)
  const everyone = [anaId, bruno.id, carla.id]

  const songs = {}
  for (const song of SONGS) {
    songs[song.title] = await api('POST', '/api/songs', { ...song, lyrics: LYRICS[song.title] })
  }

  const types = Object.fromEntries((await api('GET', '/api/event-types')).map((t) => [t.name, t.id]))
  const song = (title) => ({ type: 'song', songId: songs[title].id })
  const pause = (label) => ({ type: 'pause', label })

  const setlist = [
    song('Estrada de Terra'), song('Luz do Farol'), song('Café Sem Açúcar'), song('Segunda-feira'),
    pause('Intervalo'),
    song('Vento Norte'), song('Domingo no Parque de Papel'), song('Rádio Velho'),
    pause('BIS'),
    song('Saideira'),
  ]

  const events = {}
  const EVENTS = [
    { key: 'pastShow', typeId: types.Show, title: 'Bar do Zé', date: day(-24), time: '21:00', endTime: '00:30', location: 'Rua das Flores, 120', items: setlist },
    { key: 'pastRehearsal', typeId: types.Ensaio, date: day(-5), time: '19:30', endTime: '22:00', location: 'Estúdio Som Livre' },
    { key: 'rehearsal1', typeId: types.Ensaio, date: day(2), time: '19:30', endTime: '22:00', location: 'Estúdio Som Livre' },
    {
      key: 'show',
      typeId: types.Show,
      title: 'Bar do Zé',
      date: day(4),
      time: '21:00',
      endTime: '00:30',
      location: 'Rua das Flores, 120',
      notes: 'Passagem de som às 19h',
      items: setlist,
    },
    { key: 'rehearsal2', typeId: types.Ensaio, date: day(9), time: '19:30', endTime: '22:00', location: 'Estúdio Som Livre' },
    { key: 'festival', typeId: types.Show, title: 'Festa da Vila', date: day(11), time: '18:00', location: 'Praça da Matriz' },
    { key: 'wedding', typeId: types.Show, title: 'Casamento Júlia e Pedro', date: day(18), time: '20:00', location: 'Sítio Recanto' },
  ]
  for (const { key, ...event } of EVENTS) events[key] = await api('POST', '/api/events', event)

  const fee = (await api('POST', '/api/expense-types', { name: 'Cachê' })).id
  const gear = (await api('POST', '/api/expense-types', { name: 'Gasto com Equipamento' })).id
  const ads = (await api('POST', '/api/expense-types', { name: 'Publicidade' })).id
  const EXPENSES = [
    { description: 'Cachê Bar do Zé', typeId: fee, amount: 1200, date: day(-23), paid: true, memberIds: everyone },
    { description: 'Cordas e palhetas', typeId: gear, amount: -180, date: day(-13), paid: true, memberIds: [anaId, bruno.id] },
    { description: 'Impulsionar post do show', typeId: ads, amount: -60, date: day(-9), memberIds: everyone },
    { description: 'Aluguel do estúdio', typeId: gear, amount: -150, date: day(-5), memberIds: everyone },
    { description: 'Cachê Festa da Vila (sinal)', typeId: fee, amount: 500, date: day(-2), memberIds: everyone },
  ]
  for (const expense of EXPENSES) await api('POST', '/api/expenses', expense)

  const admin = { id: paulaId, name: 'Paula Admin', email: 'paula@example.com' }
  const adminToken = signIn({ scope: 'platform', superAdminId: paulaId, email: admin.email, name: admin.name })

  const session = {
    member: { token, user: ana },
    admin: { token: adminToken, user: admin },
    eventId: events.show.id,
    // The month the calendar screenshot shows: the one with most of the upcoming events
    month: day(7).slice(0, 7),
  }
  writeFileSync(join(here, '.session.json'), JSON.stringify(session, null, 2))
  return session
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await seed()
  console.log(`==> "${BAND.name}" is ready`)
}
