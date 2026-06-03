describe('Language Switching', () => {
  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/dashboard')
    cy.wait(['@health', '@expenses', '@members', '@report', '@types', '@logs'])
  })

  it('should display language selector', () => {
    cy.get('.language-selector, #language-select, select').should('exist')
  })

  it('should switch to English', () => {
    cy.get('#language-select, .language-select').select('en')
    cy.contains('Expenses').should('exist')
  })

  it('should switch to Spanish', () => {
    cy.get('#language-select, .language-select').select('es')
    cy.contains('Gastos').should('exist')
  })

  it('should switch to Portuguese', () => {
    cy.get('#language-select, .language-select').select('pt')
    cy.contains('Despesas').should('exist')
  })

  it('should persist language selection', () => {
    cy.get('#language-select, .language-select').select('en')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('language')).to.eq('en')
    })
  })
})
