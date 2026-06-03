Cypress.Commands.add('login', (member = { id: 1, name: 'Test User', email: 'test@test.com' }) => {
  const token = 'fake-jwt-token-for-cypress'
  window.localStorage.setItem('auth_token', token)
  window.localStorage.setItem('auth_member', JSON.stringify(member))
})

Cypress.Commands.add('setupApiIntercepts', () => {
  cy.intercept('GET', '**/api/health', { statusCode: 200, body: { status: 'ok' } }).as('health')

  cy.intercept('GET', '**/api/expenses', {
    statusCode: 200,
    body: {
      data: [
        {
          id: 1, description: 'Groceries', typeId: 1, typeName: 'Food',
          amount: 150.00, date: '2024-01-15', createdAt: '2024-01-15T10:00:00.000Z',
          memberId: 1, memberIds: [1, 2], members: ['Alice', 'Bob'],
        },
        {
          id: 2, description: 'Bus ticket', typeId: 2, typeName: 'Transport',
          amount: -5.50, date: '2024-01-16', createdAt: '2024-01-16T08:00:00.000Z',
          memberId: 1, memberIds: [1], members: ['Alice'],
        },
      ],
    },
  }).as('expenses')

  cy.intercept('GET', '**/api/members', {
    statusCode: 200,
    body: {
      data: [
        { id: 1, name: 'Alice', email: 'alice@test.com', active: true },
        { id: 2, name: 'Bob', email: 'bob@test.com', active: true },
        { id: 3, name: 'Charlie', email: null, active: false },
      ],
    },
  }).as('members')

  cy.intercept('GET', '**/api/expenses/report/by-member', {
    statusCode: 200,
    body: {
      data: [
        { id: 1, name: 'Alice', active: true, total: 100.50 },
        { id: 2, name: 'Bob', active: true, total: 75.00 },
      ],
    },
  }).as('report')

  cy.intercept('GET', '**/api/expense-types*', {
    statusCode: 200,
    body: {
      data: [
        { id: 1, name: 'Food', deletedAt: null },
        { id: 2, name: 'Transport', deletedAt: null },
        { id: 3, name: 'Old Category', deletedAt: '2024-01-01T00:00:00.000Z' },
      ],
    },
  }).as('types')

  cy.intercept('GET', '**/api/logs*', {
    statusCode: 200,
    body: {
      data: [
        { id: 1, action: 'CREATE', resource: 'expense', resourceId: 1, createdAt: '2024-01-15T10:00:00.000Z', userId: 1, userName: 'Alice' },
        { id: 2, action: 'LOGIN', resource: 'auth', createdAt: '2024-01-15T09:00:00.000Z', userId: 1, userName: 'Alice' },
      ],
    },
  }).as('logs')
})
