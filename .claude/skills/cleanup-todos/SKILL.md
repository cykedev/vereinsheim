---
name: cleanup-todos
description: Tidy an app's .claude/tasks/todo.md — remove completed tasks, compress, archive older entries. Use when the todo file has grown stale or long.
---

For the app you're working in (`apps/<app>/.claude/tasks/todo.md`):

- Remove finished tasks from the "Aktuell" section.
- Compress verbose entries to one line each.
- Archive older done items (move to an archive section or delete if trivial).

Keep the file short — it is loaded at session start. The operation is **idempotent**
(running it twice changes nothing further).
