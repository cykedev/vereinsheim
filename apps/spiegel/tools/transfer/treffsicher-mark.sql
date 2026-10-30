-- Das Merkmal „umgezogen“ (`User.movedToSpiegelAt`) eines Kontos in Treffsicher setzen (`-v clear=0`, die Zeit in UTC
-- ohne Zone wie Treffsicher speichert) oder aufheben (`-v clear=1`). Das Konto über die E-Mail (`-v from=…`, ohne Groß-
-- und Kleinschreibung und Rand), geändert nur, wenn genau eines passt. Gibt eine Zeile `<Treffer>|<geändert>` aus:
-- `1|1` gesetzt bzw. aufgehoben, `0|0` kein Konto, sonst nicht eindeutig. Nach einem echten, gespeicherten Lauf der
-- Übernahme oder über `vereinsheim transfer mark`.
with hit as (
  select "id" from "User" where lower(btrim("email")) = lower(btrim(:'from'))
), changed as (
  update "User"
  set "movedToSpiegelAt" = case when :'clear' = '1' then null else (now() at time zone 'UTC') end
  where "id" in (select "id" from hit) and (select count(*) from hit) = 1
  returning 1
)
select (select count(*) from hit) || '|' || (select count(*) from changed);
