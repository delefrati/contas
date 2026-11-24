// Signing in as production does (cypress.config.js runs this app with VITE_BASE_DOMAIN=localhost):
// Google sign-in happens only on the central host, which hands the browser to the band's
// subdomain with a one-time code; the band's page trades the code for a session.
//
// The app sends the browser to https://… addresses, as in production. Those navigations are
// answered here with a stand-in page, so a test checks where the browser was sent.
describe('Central login', () => {
  const port = Cypress.env('centralPort')
  const central = `http://localhost:${port}`
  const bandHost = (slug) => `http://${slug}.localhost:${port}`

  function interceptHandOff(slug) {
    cy.intercept('GET', `https://${slug}.localhost/auth/callback*`, {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: '<p>Band page</p>',
    }).as('handOff')
  }

  function handOffUrl() {
    return cy.wait('@handOff').then(({ request }) => new URL(request.url))
  }

  function stubCentralLogin(...answers) {
    let call = 0
    cy.intercept('POST', '**/api/auth/central/google', (req) => {
      req.reply({ statusCode: 200, body: { data: answers[Math.min(call++, answers.length - 1)] } })
    }).as('centralLogin')
  }

  const bothBands = [
    { slug: 'maverick', name: 'Maverick' },
    { slug: 'os-exemplos', name: 'Os Exemplos' },
  ]

  it('should send a band\'s visitor to the central host to sign in', () => {
    cy.intercept('GET', '**/api/band', { statusCode: 200, body: { data: { name: 'Maverick', logoUrl: null } } })
    cy.intercept('GET', 'https://localhost/entrar*', {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: '<p>Central login</p>',
    }).as('central')

    cy.visit(`${bandHost('maverick')}/registros`)

    cy.wait('@central').then(({ request }) => {
      const url = new URL(request.url)
      expect(url.pathname).to.eq('/entrar')
      expect(url.searchParams.get('band')).to.eq('maverick')
      expect(url.searchParams.get('redirect')).to.eq('/registros')
    })
  })

  it('should send a member of one band straight to that band', () => {
    stubCentralLogin({ code: 'one-time-code', band: 'maverick' })
    interceptHandOff('maverick')

    cy.visitWithGoogle(`${central}/entrar?band=maverick&redirect=%2Fregistros`)
    cy.get('.fake-google-signin').click()

    cy.wait('@centralLogin').its('request.body').should('deep.equal', {
      credential: 'fake-google-credential',
      band: 'maverick',
    })
    handOffUrl().then((url) => {
      expect(url.searchParams.get('code')).to.eq('one-time-code')
      expect(url.searchParams.get('redirect')).to.eq('/registros')
    })
  })

  it('should let a member of several bands pick one', () => {
    stubCentralLogin({ bands: bothBands }, { code: 'one-time-code', band: 'os-exemplos' })
    interceptHandOff('os-exemplos')

    cy.visitWithGoogle(`${central}/`)
    cy.location('pathname').should('eq', '/entrar')
    cy.get('.fake-google-signin').click()

    cy.wait('@centralLogin').its('request.body.band').should('be.undefined')
    cy.get('#google-signin-btn').should('not.be.visible')
    cy.get('.band-choice-btn').should('have.length', 2)
    cy.contains('.band-choice-btn', 'Os Exemplos').click()

    cy.wait('@centralLogin').its('request.body').should('deep.equal', {
      credential: 'fake-google-credential',
      band: 'os-exemplos',
    })
    handOffUrl().its('searchParams').invoke('get', 'code').should('eq', 'one-time-code')
  })

  it('should let a super admin pick a band and enter it', () => {
    // The server offers a super admin every band, member of them or not
    stubCentralLogin({ bands: bothBands }, { code: 'admin-code', band: 'maverick' })
    interceptHandOff('maverick')

    cy.visitWithGoogle(`${central}/entrar`, 'super-admin-credential')
    cy.get('.fake-google-signin').click()
    cy.contains('.band-choice-btn', 'Maverick').click()

    cy.wait('@centralLogin')
    cy.wait('@centralLogin').its('request.body').should('deep.equal', {
      credential: 'super-admin-credential',
      band: 'maverick',
    })
    handOffUrl().its('searchParams').invoke('get', 'code').should('eq', 'admin-code')
  })

  it('should say so when the member isn\'t in the band they came from', () => {
    cy.intercept('POST', '**/api/auth/central/google', {
      statusCode: 401,
      body: { message: 'Member not found in this band.', code: 'MEMBER_NOT_IN_BAND' },
    }).as('centralLogin')

    cy.visitWithGoogle(`${central}/entrar?band=maverick`)
    cy.get('.fake-google-signin').click()

    cy.wait('@centralLogin')
    cy.get('.error-message').should('contain', 'Your account is not registered in this band.')
    cy.location('host').should('eq', `localhost:${port}`)
  })

  describe('on the band\'s host', () => {
    beforeEach(() => {
      cy.setupApiIntercepts()
    })

    it('should trade the code for a session and open the page asked for', () => {
      const member = { id: 1, name: 'Test User', email: 'test@test.com', superAdmin: false }
      cy.intercept('POST', '**/api/auth/central/exchange', {
        statusCode: 200,
        body: { data: { token: 'band-session-token', member } },
      }).as('exchange')

      cy.visit(`${bandHost('maverick')}/auth/callback?code=one-time-code&redirect=%2Fregistros`)

      cy.wait('@exchange').its('request.body').should('deep.equal', { code: 'one-time-code' })
      cy.location('pathname').should('eq', '/registros')
      cy.window().its('localStorage.auth_token').should('eq', 'band-session-token')
    })

    it('should offer the way back to sign-in when the code is refused', () => {
      cy.intercept('POST', '**/api/auth/central/exchange', {
        statusCode: 400,
        body: { message: 'Invalid or expired login code' },
      }).as('exchange')

      cy.visit(`${bandHost('maverick')}/auth/callback?code=stale-code`)

      cy.wait('@exchange')
      cy.get('.error-message').should('contain', 'Could not complete the login.')
      cy.contains('a', 'Back to login').should('have.attr', 'href', '/login')
      cy.window().its('localStorage.auth_token').should('be.undefined')
    })
  })
})
