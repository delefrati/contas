import { defineConfig } from 'cypress'
import { createServer } from 'vite'

// The specs start their own copies of the app, so `npx cypress run` needs nothing running first.
// Every API call is answered by cy.intercept (see cypress/support), so no backend either.
//
// - LOCAL: the app as `npm run dev` runs it, without VITE_BASE_DOMAIN: one band, signing in on
//   the same host. The default for the specs.
// - CENTRAL: the app as production runs it, with VITE_BASE_DOMAIN=localhost:
//   http://localhost:PORT is the central login host and http://<slug>.localhost:PORT is a band.
//   Browsers send *.localhost to this machine, so no hosts file is needed.
const LOCAL_PORT = 5190
const CENTRAL_PORT = 5191

async function startApp(port, baseDomain = '') {
  const server = await createServer({
    configFile: new URL('./vite.config.js', import.meta.url).pathname,
    server: { port, strictPort: true, host: 'localhost' },
    define: { 'import.meta.env.VITE_BASE_DOMAIN': JSON.stringify(baseDomain) },
    logLevel: 'warn',
  })
  await server.listen()
  return server
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
