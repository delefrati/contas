// The language is chosen in Settings (on the admin panel too, see AdminLayout)
describe('Language Switching', () => {
  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/configuracoes')
  })

  it('should display language selector', () => {
    cy.get('#settings-language').should('exist')
  })

  it('should switch to English', () => {
    cy.get('#settings-language').select('en')
    cy.get('h1').should('contain', 'Settings')
  })

  it('should switch to Spanish', () => {
    cy.get('#settings-language').select('es')
    cy.get('h1').should('contain', 'Configuración')
  })

  it('should switch to Portuguese', () => {
    cy.get('#settings-language').select('pt')
    cy.get('h1').should('contain', 'Configurações')
  })

  it('should persist language selection', () => {
    cy.get('#settings-language').select('es')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('language')).to.eq('es')
    })
    cy.reload()
    cy.get('#settings-language').should('have.value', 'es')
  })
})
