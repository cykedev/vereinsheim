Fully reset the dev database (all data will be lost).

Only use in the local development environment — never in production.

1. Stop and remove containers with volumes: `docker compose -f docker-compose.dev.yml down -v`
2. Start the database service: `docker compose -f docker-compose.dev.yml up -d db`
3. Wait until the database is ready (healthcheck)
4. Run migrations: `docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate deploy`
5. Run seed: `docker compose -f docker-compose.dev.yml run --rm app npx prisma db seed`

Confirm: login with the seed admin account works.
