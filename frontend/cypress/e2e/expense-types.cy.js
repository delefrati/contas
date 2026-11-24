describe('Expense Types', () => {
  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/financeiro')
    cy.wait(['@health', '@expenses', '@members', '@report', '@types'])
  })

  it('should offer only the types in use in the add expense form', () => {
    cy.contains('button', 'Add Expense').click()
    cy.get('#type option:not([disabled])').then((options) => {
      expect([...options].map((o) => o.textContent.trim())).to.deep.equal(['Food', 'Transport'])
    })
  })

  it('should create a new expense type from the form and select it', () => {
    cy.intercept('POST', '**/api/expense-types', {
      statusCode: 201,
      body: { data: { id: 4, name: 'Entertainment', deletedAt: null } },
    }).as('createType')

    cy.contains('button', 'Add Expense').click()
    cy.get('.type-quick-add input').type('Entertainment')
    // The page loads the types again after creating one
    cy.intercept('GET', '**/api/expense-types*', {
      statusCode: 200,
      body: {
        data: [
          { id: 1, name: 'Food', deletedAt: null },
          { id: 2, name: 'Transport', deletedAt: null },
          { id: 4, name: 'Entertainment', deletedAt: null },
        ],
      },
    }).as('typesAgain')
    cy.get('.type-quick-add button').click()

    cy.wait('@createType').its('request.body').should('deep.equal', { name: 'Entertainment' })
    cy.wait('@typesAgain')
    cy.get('#type').should('have.value', '4')
    cy.get('#type option:selected').invoke('text').invoke('trim').should('eq', 'Entertainment')
  })
})
