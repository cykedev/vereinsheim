# Git Worktrees – Bekannte Einschränkungen

## Problem: Worktrees + docker-compose

Wenn ein Worktree unter `.claude/worktrees/<name>/` liegt, funktioniert der `/check`-Befehl (`docker compose -f docker-compose.dev.yml run --rm app ...`) **nicht korrekt** für den Worktree:

- Docker Compose bestimmt das Projektverzeichnis (und damit den Volume-Mount `- .:/app`) anhand des Speicherorts der `docker-compose.dev.yml` — immer das **Hauptrepo-Verzeichnis**
- Das `--project-directory`-Flag würde den Mount zwar auf den Worktree umleiten, startet aber neue Datenbank-Container mit eigenem Namen (eigenes Docker-Projekt) und führt Migrationen erneut aus
- Worktree-Änderungen werden daher vom Container bei normalem `/check`-Aufruf nicht gesehen

## Lösung: Für dieses Projekt keinen Worktree verwenden

Stattdessen direkt im Hauptverzeichnis auf einem Branch arbeiten:

```bash
git checkout -b fix/<name>   # neuen Branch anlegen
# ... arbeiten ...
git checkout main            # danach zurückwechseln
```

Docker Compose funktioniert dann normal, weil das Hauptverzeichnis sowohl Branch-Quelle als auch Volume-Mount ist.

## Vitest + Worktrees

Ohne Konfiguration pickt Vitest alle Testdateien aus `.claude/worktrees/**` auf und führt sie doppelt aus — die Duplikate schlagen fehl weil Mock-Imports im Worktree-Kontext anders auflösen.

Fix ist bereits in `vitest.config.ts` eingetragen:

```ts
exclude: [".claude/worktrees/**", "**/node_modules/**"]
```

Falls ein Worktree trotzdem benötigt wird: sicherstellen, dass dieser Exclude-Eintrag vorhanden ist, bevor Tests ausgeführt werden.
