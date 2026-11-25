import { defineConfig } from 'cypress'
import { build, preview } from 'vite'

// The specs build and serve their own copies of the app, so `npx cypress run` needs nothing
// running first. Every API call is answered by cy.intercept (see cypress/support), so no
// backend either. They're production builds, not the dev server: that one compiles each page on
// its first visit and can reload it halfway through a test, which made the specs flaky.
//
// - LOCAL: the app without VITE_BASE_DOMAIN, as local development runs it: one band, signing
//   in on the same host. The default for the specs.
// - CENTRAL: the app as production runs it, with VITE_BASE_DOMAIN=localhost:
//   http://localhost:PORT is the central login host and http://<slug>.localhost:PORT is a band.
//   Browsers send *.localhost to this machine, so no hosts file is needed.
const LOCAL_PORT = 5190
const CENTRAL_PORT = 5191

const configFile = new URL('./vite.config.js', import.meta.url).pathname

async function startApp(port, baseDomain = '') {
  const outDir = `node_modules/.cypress-app-${port}`
  await build({
    configFile,
    define: { 'import.meta.env.VITE_BASE_DOMAIN': JSON.stringify(baseDomain) },
    build: { outDir, emptyOutDir: true },
    logLevel: 'warn',
  })
  return preview({
    configFile,
    build: { outDir },
    preview: { port, strictPort: true, host: 'localhost' },
    logLevel: 'warn',
  })
}

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${LOCAL_PORT}`,
    env: { centralPort: CENTRAL_PORT },
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    video: false,
    screenshotOnRunFailure: false,
    async setupNodeEvents(on) {
      const servers = [
        await startApp(LOCAL_PORT),
        await startApp(CENTRAL_PORT, 'localhost'),
      ]
      on('after:run', () => Promise.all(servers.map((s) => s.close())))
    },
  },
})
