-- Konten aus Spiegel für den Abgleich vor der Übernahme (ADR-033, Stufe 3), eine Zeile je Konto, als CSV über
-- `psql --csv`. Nur lesend. Spalten wie `SpiegelAccount` in `src/lib/transfer/accountMatch.ts`.
-- Scheiben wie `COUNTED_CARD`: nicht gelöscht, nicht wartend. Zustimmung: die jüngste per Sportpass, im Zustand wie
-- `consentStatus` (abgelehnt geht vor). Tage in der Zone Europe/Berlin.
select
  u."id" as id,
  u."name" as name,
  u."email" as email,
  u."role" as role,
  u."isActive" as is_active,
  u."mustChangePassword" as must_change_password,
  to_char(u."createdAt" at time zone 'Europe/Berlin', 'YYYY-MM-DD') as created_at,
  (
    select count(*) from "Card" c
    where c."ownerId" = u."id" and c."deletedAt" is null and not c."ownerPending"
  ) as cards,
  (
    select to_char(max(c."startedAt") at time zone 'Europe/Berlin', 'YYYY-MM-DD')
    from "Card" c
    where c."ownerId" = u."id" and c."deletedAt" is null and not c."ownerPending"
  ) as last_card,
  (
    select case
      when p."rejectedAt" is not null then 'rejected'
      when p."confirmedAt" is not null then 'active'
      when p."returnedAt" is not null then 'returned'
      else 'requested'
    end
    from "SportpassConsent" p
    where p."userId" = u."id"
    order by p."createdAt" desc, p."id" desc
    limit 1
  ) as consent
from "User" u
order by lower(u."email");
