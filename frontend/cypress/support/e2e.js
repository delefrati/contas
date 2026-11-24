import './commands'

// No spec reaches a real backend: a call a spec doesn't stub gets a 404, as from a server that
// doesn't know it. Stubs added later in a spec take precedence over this one.
beforeEach(() => {
  cy.intercept('/api/**', { statusCode: 404, body: { error: 'Not stubbed in the spec' } })
})
