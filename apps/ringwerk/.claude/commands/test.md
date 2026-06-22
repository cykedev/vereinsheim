Run only the test suite (no lint, format check, or type check).

Run: `docker compose -f docker-compose.dev.yml run --rm app npm run test`

Report:

- How many tests pass / fail?
- If failures: full error message with file name and line
- Do not suggest code changes until the root cause is clear
