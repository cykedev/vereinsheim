-- Ein Konto aus Treffsicher mit allen Einheiten als eine Zeile JSON, für das Vorschau-Werkzeug des Tagebuchs
-- (`tools/diary-preview.ts`, Form wie `treffsicherExport` in `src/parts/transfer/diary-preview.ts`). Nur lesend. Das
-- Konto über die E-Mail (`-v from=…`); ohne Treffer keine Zeile. Treffsicher speichert Zeiten in UTC ohne Zone.
select json_build_object(
  'sessions', coalesce((
    select json_agg(json_build_object(
      'id', s."id",
      'date', to_char(s."date", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'type', s."type",
      'location', s."location",
      'trainingGoal', s."trainingGoal",
      'isFavourite', s."isFavourite",
      'discipline', (
        select json_build_object(
          'name', d."name",
          'scoringType', d."scoringType",
          'shotsPerSeries', d."shotsPerSeries"
        )
        from "Discipline" d where d."id" = s."disciplineId"
      ),
      'hitLocation', case
        when s."hitLocationHorizontalMm" is null or s."hitLocationVerticalMm" is null then null
        else json_build_object(
          'xMm', s."hitLocationHorizontalMm",
          'yMm', s."hitLocationVerticalMm",
          'horizontal', coalesce(s."hitLocationHorizontalDirection"::text, 'RIGHT'),
          'vertical', coalesce(s."hitLocationVerticalDirection"::text, 'HIGH')
        )
      end,
      'wellbeing', (
        select json_build_object(
          'sleep', w."sleep", 'energy', w."energy", 'stress', w."stress", 'motivation', w."motivation"
        )
        from "Wellbeing" w where w."sessionId" = s."id"
      ),
      'prognosis', (
        select json_build_object(
          'fitness', p."fitness", 'nutrition', p."nutrition", 'technique', p."technique",
          'tactics', p."tactics", 'mentalStrength', p."mentalStrength", 'environment', p."environment",
          'equipment', p."equipment", 'expectedScore', p."expectedScore",
          'expectedCleanShots', p."expectedCleanShots", 'performanceGoal', p."performanceGoal"
        )
        from "Prognosis" p where p."sessionId" = s."id"
      ),
      'feedback', (
        select json_build_object(
          'fitness', f."fitness", 'nutrition', f."nutrition", 'technique', f."technique",
          'tactics', f."tactics", 'mentalStrength', f."mentalStrength", 'environment', f."environment",
          'equipment', f."equipment", 'explanation', f."explanation", 'goalAchieved', f."goalAchieved",
          'goalAchievedNote', f."goalAchievedNote", 'progress', f."progress",
          'fiveBestShots', f."fiveBestShots", 'wentWell', f."wentWell", 'insights', f."insights"
        )
        from "Feedback" f where f."sessionId" = s."id"
      ),
      'reflection', (
        select json_build_object(
          'observations', r."observations", 'insight', r."insight",
          'learningQuestion', r."learningQuestion", 'routineDeviation', r."routineDeviation"
        )
        from "Reflection" r where r."sessionId" = s."id"
      ),
      'series', coalesce((
        select json_agg(json_build_object(
          'position', x."position",
          'isPractice', x."isPractice",
          'scoreTotal', x."scoreTotal",
          'shots', case when json_typeof(x."shots"::json) = 'array' then (
            select coalesce(json_agg(coalesce(e #>> '{}', '')), '[]'::json)
            from json_array_elements(x."shots"::json) e
          ) end,
          'executionQuality', x."executionQuality"
        ) order by x."position")
        from "Series" x where x."sessionId" = s."id"
      ), '[]'::json)
    ) order by s."date", s."id")
    from "TrainingSession" s where s."userId" = u."id"
  ), '[]'::json)
)
from "User" u
where lower(trim(u."email")) = lower(trim(:'from'));
