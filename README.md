# contas

Sistema de Prestação de Contas com:

- Backend PHP com API em arquitetura MVC + DDD
- Banco MySQL
- Frontend VueJS consumindo a API
- Infraestrutura com Docker Compose

## Estrutura

- `/backend`: API PHP
- `/frontend`: aplicação VueJS
- `/mysql/init`: scripts de inicialização do banco
- `docker-compose.yml`: orquestração dos serviços

## Subindo o ambiente

```bash
docker compose up --build
```

Serviços:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/health
- MySQL: localhost:3306
