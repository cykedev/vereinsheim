Run the database seed manually (only needed after `/db-reset`).

Run: `docker compose -f docker-compose.dev.yml run --rm app npx prisma db seed`

After running, confirm:

- Was the seed data created (or was it already present)?
- If errors: output the full error message
