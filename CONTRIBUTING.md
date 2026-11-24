# Contributing

Thank you for considering contributing to this project!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/contas.git
   cd contas
   ```
3. Copy the environment file and configure it:
   ```bash
   cp .env.example .env
   ```
4. Start the development environment:
   ```bash
   docker compose up --build
   ```

## Development

- **Frontend**: http://localhost:51731 (hot-reload enabled via volume mount)
- **Backend API**: http://localhost:8001
- **Database**: MySQL on localhost:33061

### Running Tests

```bash
# Backend tests
cd backend-nest && npm test

# Frontend tests
cd frontend && npx vitest run

# End-to-end tests (Cypress)
cd frontend && npx cypress run
```

The Cypress specs need nothing running: `cypress.config.js` starts its own copies of the app on
ports 5190 and 5191, and the specs answer every API call themselves, Google sign-in included.
Port 5190 runs the app as local development does. Port 5191 runs it as production does, with
`localhost` as the central login host and `<slug>.localhost` as a band, for the central login
specs. In VS Code's terminal, run `env -u ELECTRON_RUN_AS_NODE npx cypress run`: VS Code sets
that variable, and Cypress won't start with it.

## Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your changes and ensure tests pass.
3. Commit with a descriptive message.
4. Push and open a pull request against `main`.

## Code Style

- **Backend**: TypeScript, follows NestJS conventions. Run `npm run lint` to check.
- **Frontend**: Vue 3 with Composition API, SCSS for styling.

## Reporting Issues

Open an issue describing:
- What you expected to happen
- What actually happened
- Steps to reproduce
