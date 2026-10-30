-- Die Besitzer aller Einheiten, Ziele und Abläufe in Treffsicher, für die Übernahme im Container (`owners.txt`, gelesen
-- von `parseOwners` in `source-export.ts`; `vereinsheim transfer` holt sie auf dem Host). Je Zeile `id|userId`, nur
-- Kennungen, keine Namen, E-Mails oder Texte. Nur lesend.
select "id", "userId" from "TrainingSession"
union all select "id", "userId" from "Goal"
union all select "id", "userId" from "ShotRoutine";
