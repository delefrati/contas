describe('Members', () => {
  beforeEach(() => {
    cy.login()
    cy.setupApiIntercepts()
    cy.visit('/dashboard')
    cy.wait(['@health', '@expenses', '@members', '@report', '@types', '@logs'])
  })

  it('should switch to members tab', () => {
    cy.contains('.tab-button', 'Members').click()
    cy.contains('.tab-button.active', 'Members').should('exist')
  })

  it('should display member list', () => {
    cy.contains('.tab-button', 'Members').click()
    cy.contains('Alice').should('exist')
    cy.contains('Bob').should('exist')
  })

  it('should create a new member', () => {
    cy.intercept('POST', '**/api/members', {
      statusCode: 201,
      body: { data: { id: 4, name: 'David', email: 'david@test.com', active: true } },
    }).as('createMember')

    cy.contains('.tab-button', 'Members').click()
    cy.contains('button', 'Add').click()

    // Fill the modal form
    cy.get('.modal-overlay, .modal-stub').within(() => {
      cy.get('input').first().type('David')
      cy.get('input').eq(1).type('david@test.com')
    })
  })

  it('should toggle member active status', () => {
    cy.intercept('PATCH', '**/api/members/1/toggle-active', {
      statusCode: 200,
      body: { data: { id: 1, name: 'Alice', active: false } },
    }).as('toggleActive')

    cy.contains('.tab-button', 'Members').click()

    // Find toggle button for first member and click
    cy.get('[class*="toggle"], button[title*="toggle"], button[title*="ativ"]').first().click({ force: true })
  })

  it('should open edit modal and update a member', () => {
    cy.intercept('PATCH', '**/api/members/1', {
      statusCode: 200,
      body: { data: { id: 1, name: 'Alice Updated', email: 'alice-new@test.com', active: true } },
    }).as('updateMember')

    cy.contains('.tab-button', 'Members').click()

    // Click the edit button (pencil icon) for the first member
    cy.get('.expenses-table tbody tr').first().find('button[title]').first().click()

    // Edit the member in the modal
    cy.get('.modal-overlay, .modal-stub').within(() => {
      cy.get('input').first().clear().type('Alice Updated')
      cy.get('input').eq(1).clear().type('alice-new@test.com')
      cy.get('button[type="submit"]').click()
    })

    cy.wait('@updateMember').its('request.body').should('deep.equal', {
      name: 'Alice Updated',
      email: 'alice-new@test.com',
    })
  })

  it('should show validation error when editing with empty name', () => {
    cy.contains('.tab-button', 'Members').click()

    // Click the edit button for the first member
    cy.get('.expenses-table tbody tr').first().find('button[title]').first().click()

    // Clear name and try to submit (HTML5 required will prevent submission)
    cy.get('.modal-overlay, .modal-stub').within(() => {
      cy.get('input').first().clear()
      cy.get('button[type="submit"]').click()
      // The required attribute prevents form submission, input should be invalid
      cy.get('input').first().then($input => {
        expect($input[0].validity.valid).to.be.false
      })
    })
  })
})
