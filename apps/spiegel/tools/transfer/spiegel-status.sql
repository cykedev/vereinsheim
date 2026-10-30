-- Je Konto in Spiegel mit Läufen der Übernahme der Hash der E-Mail, die Zahl der Läufe und der Tag des letzten (UTC),
-- für `vereinsheim transfer status`: Zeilen `<sha256 hex von lower(btrim(email))>|<Läufe>|<JJJJ-MM-TT>`, ohne E-Mail
-- (`parseSpiegelStatus` in `mapping.ts`). Nur lesend.
select
  encode(sha256(convert_to(lower(btrim(u."email")), 'UTF8')), 'hex'),
  count(*),
  to_char(max(r."at") at time zone 'UTC', 'YYYY-MM-DD')
from "TransferRun" r
join "User" u on u."id" = r."userId"
group by u."email";
