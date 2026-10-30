-- Je Konto in Treffsicher der Hash der E-Mail und das Merkmal „umgezogen“, für `vereinsheim transfer status`: Zeilen
-- `<sha256 hex von lower(btrim(email))>|<0 oder 1>`, ohne E-Mail (`parseTreffsicherStatus` in `mapping.ts`). Nur lesend.
select
  encode(sha256(convert_to(lower(btrim("email")), 'UTF8')), 'hex'),
  case when "movedToSpiegelAt" is null then 0 else 1 end
from "User";
