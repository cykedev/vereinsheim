-- Konten aus Treffsicher für den Abgleich vor der Übernahme (ADR-033, Stufe 3), eine Zeile je Konto, als CSV über
-- `psql --csv`. Nur lesend. Spalten wie `TreffsicherAccount` in `src/lib/transfer/accountMatch.ts`.
-- Einheiten mit Ergebnis: mindestens eine Wertungsserie mit Gesamtwert. Tage in der Zone Europe/Berlin; Treffsicher
-- speichert UTC ohne Zone.
select
  u."id" as id,
  u."name" as name,
  u."email" as email,
  u."role" as role,
  u."isActive" as is_active,
  to_char(u."createdAt" at time zone 'UTC' at time zone 'Europe/Berlin', 'YYYY-MM-DD') as created_at,
  (select count(*) from "TrainingSession" s where s."userId" = u."id") as sessions,
  (
    select count(*)
    from "TrainingSession" s
    where s."userId" = u."id"
      and exists (
        select 1 from "Series" r
        where r."sessionId" = s."id" and not r."isPractice" and r."scoreTotal" is not null
      )
  ) as sessions_with_result,
  (
    select to_char(max(s."date") at time zone 'UTC' at time zone 'Europe/Berlin', 'YYYY-MM-DD')
    from "TrainingSession" s
    where s."userId" = u."id"
  ) as last_session,
  (select count(*) from "TrainingSession" s where s."userId" = u."id" and s."isFavourite") as favourites,
  (select count(*) from "Discipline" d where d."ownerId" = u."id") as own_disciplines,
  (select count(*) from "Goal" g where g."userId" = u."id") as goals,
  (select count(*) from "ShotRoutine" r where r."userId" = u."id") as routines
from "User" u
order by lower(u."email");
