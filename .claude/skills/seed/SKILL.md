---
name: seed
description: Run an app's database seed manually. Usually unnecessary — both apps self-seed the first admin + default disciplines on first request; use only after a full db-reset if needed.
---

```bash
pnpm --filter <app> exec prisma db seed
```

`<app>` = `ringwerk` or `treffsicher`. Note: both apps initialise the first admin account
and default disciplines automatically on the first request (startup init), so a manual
seed is rarely needed.
