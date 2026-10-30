-- Das Merkmal „umgezogen“ (`User.movedToSpiegelAt`) eines Kontos in Treffsicher setzen (`-v clear=0`, die Zeit in UTC
-- ohne Zone wie Treffsicher speichert) oder aufheben (`-v clear=1`). Das Konto über die E-Mail (`-v from=…`, ohne Groß-
-- und Kleinschreibung und Rand). Gibt je getroffenem Konto eine Zeile `1` aus; `vereinsheim transfer` verlangt genau
-- eine. Nach einem echten, gespeicherten Lauf der Übernahme oder über `vereinsheim transfer mark`.
update "User"
set "movedToSpiegelAt" = case when :'clear' = '1' then null else (now() at time zone 'UTC') end
where lower(btrim("email")) = lower(btrim(:'from'))
returning 1;
