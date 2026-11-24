// The logs page lists the band's latest 100 entries, newest first as the API sends them. It has
// no filters or pagination of its own.
describe('Logs', () => {
  const longDetails = `{"description":"${'x'.repeat(120)}"}`
  const entries = [
    {
      id: 12, action: 'UPDATE', resource: 'expense', resourceId: 7, userId: 1, userName: 'Alice',
      details: longDetails, createdAt: '2024-01-15T10:00:00.000Z',
    },
    {
      id: 11, action: 'LOGIN', resource: 'auth', resourceId: null, userId: null, userName: null,
      details: null, createdAt: '2024-01-15T09:00:00.000Z',
    },
  ]

  function stubLogs(data, statusCode = 200) {
    cy.intercept('GET', '**/api/logs*', { statusCode, body: statusCode === 200 ? { data } : { message: 'boom' } }).as('logs')
  }

  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
  })

  it('should ask for the latest 100 entries and list them', () => {
    stubLogs(entries)
    cy.visit('/registros')

    cy.wait('@logs').its('request.url').should('match', /\/api\/logs\?limit=100$/)
    cy.get('.logs-table tbody tr.expense-row').should('have.length', 2)
    cy.get('.logs-table tbody tr.expense-row').first().within(() => {
      cy.get('.id').should('have.text', '12')
      cy.get('.action-badge').should('have.text', 'UPDATE').and('have.class', 'action-update')
      cy.get('.type').should('have.text', 'expense')
      cy.get('.log-resource-id').should('have.text', '7')
      cy.contains('td', 'Alice')
    })
    cy.get('.logs-table tbody tr.expense-row').eq(1).within(() => {
      cy.get('.action-badge').should('have.text', 'LOGIN')
      cy.get('.log-resource-id').should('have.text', '-')
      cy.get('.log-details').should('have.text', '-')
    })
  })

  it('should cut long details short', () => {
    stubLogs(entries)
    cy.visit('/registros')

    cy.get('.expense-row').first().find('.log-details code')
      .should('have.text', `${longDetails.substring(0, 100)}...`)
    cy.get('.log-details-btn').should('not.be.visible')
  })

  it('should show the details whole on request on a phone, where their column is hidden', () => {
    cy.viewport(390, 800)
    stubLogs(entries)
    cy.visit('/registros')

    cy.get('.expense-row').first().find('.log-details').should('not.be.visible')
    cy.get('.log-expanded-row').should('not.exist')

    cy.get('.expense-row').first().find('.btn-dots').click()
    cy.get('.log-expanded-row').should('have.length', 1).and('contain', longDetails)

    cy.get('.expense-row').first().find('.btn-dots').click()
    cy.get('.log-expanded-row').should('not.exist')
  })

  it('should load the entries again on refresh', () => {
    stubLogs(entries.slice(1))
    cy.visit('/registros')
    cy.wait('@logs')
    cy.get('.expense-row').should('have.length', 1)

    stubLogs(entries)
    cy.contains('button', 'Refresh').click()
    cy.wait('@logs')
    cy.get('.expense-row').should('have.length', 2)
  })

  it('should say when there are no entries', () => {
    stubLogs([])
    cy.visit('/registros')

    cy.get('.empty-state').should('contain', 'No logs found')
    cy.get('.logs-table').should('not.exist')
  })

  it('should say when the entries could not be loaded', () => {
    stubLogs(null, 500)
    cy.visit('/registros')

    cy.get('.alert-error').should('contain', 'Could not load the logs.')
  })
})
