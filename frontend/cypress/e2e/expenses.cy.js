describe('Expenses', () => {
  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/dashboard')
    cy.wait(['@health', '@expenses', '@members', '@report', '@types', '@logs'])
  })

  it('should display expenses list', () => {
    cy.get('.expenses-table').should('exist')
    cy.get('.expense-row').should('have.length', 2)
  })

  it('should display expense details correctly', () => {
    cy.get('.expense-row').first().within(() => {
      cy.get('.description').should('contain', 'Groceries')
      cy.get('.amount').should('contain', '150.00')
    })
  })

  it('should show negative amounts styled differently', () => {
    cy.get('.expense-row').eq(1).find('.amount-negative').should('exist')
  })

  it('should open add expense modal', () => {
    cy.contains('button', 'Add Expense').click()
    cy.get('.modal-overlay, .modal-stub').should('exist')
  })

  it('should create a new expense', () => {
    cy.intercept('POST', '**/api/expenses', {
      statusCode: 201,
      body: {
        data: {
          id: 3, description: 'New expense', typeId: 1, amount: 25.00,
          date: '2024-01-17', createdAt: '2024-01-17T10:00:00.000Z',
          memberId: 1, memberIds: [1], members: ['Alice'],
        },
      },
    }).as('createExpense')

    cy.contains('button', 'Add Expense').click()

    // Fill form (these selectors depend on actual DOM structure)
    cy.get('input[type="text"], input[placeholder]').first().type('New expense')
    cy.get('input[type="number"]').first().type('25')

    cy.get('form').submit()
    cy.wait('@createExpense')
  })

  it('should delete an expense', () => {
    cy.intercept('DELETE', '**/api/expenses/1', { statusCode: 200 }).as('deleteExpense')

    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true)
    })

    cy.get('.expense-row').first().find('.btn-delete').click()
    cy.wait('@deleteExpense')
  })

  it('should open edit modal', () => {
    cy.get('.expense-row').first().find('.btn-edit').click()
    cy.get('.modal-overlay').should('exist')
  })

  it('should filter expenses by text', () => {
    // Open filters
    cy.get('button[title]').first().click()
    cy.get('.filters input[type="text"]').type('Groceries')
    cy.get('.expense-row').should('have.length', 1)
    cy.get('.expense-row').first().should('contain', 'Groceries')
  })

  it('should clear filters', () => {
    cy.get('button[title]').first().click()
    cy.get('.filters input[type="text"]').type('Groceries')
    cy.get('.expense-row').should('have.length', 1)
    cy.contains('button', 'Clear').click()
    cy.get('.expense-row').should('have.length', 2)
  })

  it('should show expense total', () => {
    cy.get('.summary').should('contain', 'Total')
  })

  it('should refresh data', () => {
    cy.contains('button', 'Refresh').click()
    cy.wait('@expenses')
  })
})
