describe('Login Page', () => {
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

  it('should redirect authenticated user to dashboard', () => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/login')
    cy.url().should('include', '/dashboard')
  })

  it('should redirect to dashboard after login', () => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/dashboard')
    cy.url().should('include', '/dashboard')
    cy.get('h1').should('contain', 'Contas')
  })
})
