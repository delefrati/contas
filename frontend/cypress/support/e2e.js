import './commands'

// No spec reaches a real backend: a call a spec doesn't stub gets a 404, as from a server that
// doesn't know it. Stubs added later in a spec take precedence over this one.
beforeEach(() => {
  cy.intercept('/api/**', { statusCode: 404, body: { error: 'Not stubbed in the spec' } })
})

// The app under test is a production build, which installs a service worker once the band
// loads. One left from an earlier test would answer the next test's pages from its cache.
Cypress.on('window:before:load', (win) => {
  if (win.navigator.serviceWorker) {
    win.navigator.serviceWorker.register = () => Promise.reject(new Error('No service worker in the specs'))
  }
})
