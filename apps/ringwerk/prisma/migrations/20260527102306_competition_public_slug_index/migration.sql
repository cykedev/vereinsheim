-- Aktive Slug-Reservierung: nur ein ACTIVE+isPublic Wettbewerb pro publicSlug.
CREATE UNIQUE INDEX "Competition_publicSlug_active_unique"
  ON "Competition" ("publicSlug")
  WHERE "isPublic" = true AND "status" = 'ACTIVE';
