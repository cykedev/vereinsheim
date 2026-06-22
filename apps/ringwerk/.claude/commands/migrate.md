Create a new schema migration.

Runner: `docker compose -f docker-compose.dev.yml run --rm app`

1. Use the first argument token as migration name (kebab-case, English, descriptive). If no name was given, ask before proceeding.
2. Run: `docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev --name <name>`

After running:

- Confirm the migration file was created in the migrations directory
- Remind that the migration file must be committed
- Check that the generated client was updated
- Reminder: no destructive migrations without a comment in the SQL file
