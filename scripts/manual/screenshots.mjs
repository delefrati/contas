// Takes the user manual's screenshots (frontend/public/manual/*.png) from the local stack that
// scripts/manual-screenshots.sh starts and seed.mjs fills. Pass names to take only some:
//   node screenshots.mjs agenda evento
// Each manual part shows its image with ![...](/manual/<name>.png).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', '..', 'frontend', 'public', 'manual')
const APP = process.env.MANUAL_APP_URL || 'http://localhost:51731'
const session = JSON.parse(readFileSync(join(here, '.session.json'), 'utf8'))

const DESKTOP = { width: 1100, height: 760 }
const SHORT = { width: 1100, height: 640 }
const PHONE = { width: 390, height: 760 }

// as: who is signed in (member, admin or nobody); full: the whole page instead of the window;
// element: only that part of the page
const SHOTS = [
  { name: 'entrar', path: '/login', as: null, size: { width: 800, height: 600 }, element: '.login-card' },
  { name: 'inicio', path: '/dashboard', size: DESKTOP },
  { name: 'agenda', path: `/agenda?ver=calendario&mes=${session.month}`, size: DESKTOP },
  { name: 'agenda-lista', path: '/agenda?ver=lista', size: DESKTOP },
  { name: 'evento', path: `/agenda/${session.eventId}`, size: DESKTOP, full: true },
  { name: 'palco', path: `/agenda/${session.eventId}?visualizar=1`, size: PHONE },
  { name: 'musicas', path: '/musicas', size: SHORT },
  { name: 'financeiro', path: '/financeiro', size: DESKTOP, full: true },
  { name: 'relatorio', path: '/financeiro', size: DESKTOP, full: true, click: 'button.tab-button:has-text("Relatório")' },
  { name: 'integrantes', path: '/integrantes', size: SHORT },
  { name: 'registros', path: '/registros', size: SHORT },
  { name: 'configuracoes', path: '/configuracoes', size: DESKTOP, full: true },
  { name: 'admin', path: '/admin', as: 'admin', size: { width: 1100, height: 360 } },
]

function signedInAs(who) {
  const storage = { language: 'pt' }
  if (who === 'member') {
    storage.auth_token = session.member.token
    storage.auth_member = JSON.stringify(session.member.user)
  } else if (who === 'admin') {
    storage.admin_token = session.admin.token
    storage.admin_user = JSON.stringify(session.admin.user)
  }
  return storage
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  // Fonts, icons and the last re-render after the data arrives
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
}

const wanted = process.argv.slice(2)
const shots = wanted.length ? SHOTS.filter((shot) => wanted.includes(shot.name)) : SHOTS
const unknown = wanted.filter((name) => !SHOTS.some((shot) => shot.name === name))
if (unknown.length) {
  console.error(`Unknown screenshot(s): ${unknown.join(', ')}. Known: ${SHOTS.map((s) => s.name).join(', ')}`)
  process.exit(1)
}

const browser = await chromium.launch()
try {
  for (const shot of shots) {
    const who = shot.as === undefined ? 'member' : shot.as
    // The manual shows the light theme in Portuguese, whatever this computer prefers
    const context = await browser.newContext({ viewport: shot.size, colorScheme: 'light', locale: 'pt-BR' })
    await context.addInitScript((storage) => {
      for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, signedInAs(who))
    const page = await context.newPage()
    await page.goto(`${APP}${shot.path}`)
    await settle(page)
    if (shot.click) {
      await page.click(shot.click)
      await settle(page)
    }
    const image = shot.element
      ? await page.locator(shot.element).screenshot()
      : await page.screenshot({ fullPage: Boolean(shot.full) })
    // The app keeps the manual's images for offline use, so every phone downloads them all
    const png = await sharp(image).png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 }).toBuffer()
    writeFileSync(join(out, `${shot.name}.png`), png)
    console.log(`    ${shot.name}.png (${Math.round(png.length / 1024)} KB)`)
    await context.close()
  }
} finally {
  await browser.close()
}
