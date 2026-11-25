// Signing in as local development does, on the band's own host (production signs in on the
// central host instead: see central-login.cy.js)
describe('Login Page', () => {
  const session = {
    token: 'fake-jwt-token-for-cypress',
    member: { id: 1, name: 'Test User', email: 'test@test.com', superAdmin: false },
  }

  it('should redirect unauthenticated user to login', () => {
    cy.visit('/dashboard')
    cy.url().should('include', '/login')
  })

  it('should render the login page', () => {
    cy.visit('/login')
    cy.get('h1').should('exist')
    cy.get('#google-signin-btn').should('exist')
    cy.get('.login-info').should('exist')
  })

  it('should sign in with Google and open the page that asked for it', () => {
    cy.intercept('POST', '**/api/auth/login/google', { statusCode: 200, body: { data: session } }).as('login')
    cy.setupApiIntercepts()

    cy.visitWithGoogle('/registros')
    cy.url().should('include', '/login')
    cy.get('.fake-google-signin').click()

    cy.wait('@login').its('request.body').should('deep.equal', { credential: 'fake-google-credential' })
    cy.location('pathname').should('eq', '/registros')
    cy.window().its('localStorage.auth_token').should('eq', session.token)
  })

  it('should explain a refused sign-in in the user\'s language', () => {
    cy.intercept('POST', '**/api/auth/login/google', {
      statusCode: 401,
      body: { message: 'Member not found. Please contact an administrator.', code: 'MEMBER_NOT_FOUND' },
    }).as('login')

    cy.visitWithGoogle('/login')
    cy.get('.fake-google-signin').click()

    cy.wait('@login')
    cy.get('.error-message').should('be.visible').and('contain', 'Your account is not registered. Please contact a band administrator.')
    cy.location('pathname').should('eq', '/login')
  })

  it('should ask to wait a moment after too many sign-in attempts', () => {
    cy.intercept('POST', '**/api/auth/login/google', {
      statusCode: 429,
      body: { statusCode: 429, message: 'Too many sign-in attempts. Please try again in a moment.', code: 'TOO_MANY_ATTEMPTS' },
    }).as('login')

    cy.visitWithGoogle('/login')
    cy.get('.fake-google-signin').click()

    cy.wait('@login')
    cy.get('.error-message').should('contain', 'Too many sign-in attempts. Please wait a moment and try again.')
  })

  it('should ask the same on the admin panel\'s sign-in', () => {
    cy.intercept('POST', '**/api/admin/auth/google', {
      statusCode: 429,
      body: { statusCode: 429, message: 'Too many sign-in attempts. Please try again in a moment.', code: 'TOO_MANY_ATTEMPTS' },
    }).as('adminLogin')

    cy.visitWithGoogle('/admin')
    cy.get('.fake-google-signin').click()

    cy.wait('@adminLogin')
    cy.get('.admin-login .alert-error').should('have.text', 'Too many sign-in attempts. Please wait a moment and try again.')
  })

  it('should redirect authenticated user to dashboard', () => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/login')
    cy.url().should('include', '/dashboard')
  })

  it('should show the home page once signed in', () => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/dashboard')
    cy.url().should('include', '/dashboard')
    cy.get('h1').should('contain', 'Maverick')
  })
})
