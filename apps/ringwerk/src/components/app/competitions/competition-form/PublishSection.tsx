import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SLUG_REGEX } from "@/lib/competitions/publicSlug"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"

interface Props {
  form: CompetitionFormState
  competition?: CompetitionDetail
}

export function PublishSection({ form, competition }: Props) {
  const {
    isPending,
    isEdit,
    isPublic,
    setIsPublic,
    publicSlug,
    setPublicSlug,
    publicPassword,
    setPublicPassword,
    removePublicPassword,
    setRemovePublicPassword,
    hasExistingPassword,
  } = form

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id="isPublic"
          name="isPublic"
          checked={isPublic}
          onCheckedChange={(v) => setIsPublic(v === true)}
          disabled={isPending}
        />
        <div className="space-y-1">
          <Label htmlFor="isPublic">Auf Vereins-Website veröffentlichen</Label>
          <p className="text-sm text-muted-foreground">
            Stellt das Haupt-PDF dieses Wettbewerbs unter einer öffentlichen URL bereit.
          </p>
        </div>
      </div>

      {isPublic && (
        <div className="space-y-4 pl-7">
          <div className="space-y-2">
            <Label htmlFor="publicSlug">Slug</Label>
            <Input
              id="publicSlug"
              name="publicSlug"
              value={publicSlug}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder="z.B. jahrespreisschiessen"
              maxLength={60}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              URL: <code className="text-xs">/api/public/c/{publicSlug || "<slug>"}/pdf</code>
            </p>
            {publicSlug && !SLUG_REGEX.test(publicSlug) && (
              <p className="text-xs text-destructive">
                Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche.
              </p>
            )}
            {isEdit && competition?.publicSlug && competition.publicSlug !== publicSlug && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Hinweis: Die bestehende öffentliche URL (/api/public/c/
                {competition.publicSlug}/pdf) wird ungültig.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicPassword">Passwort (optional)</Label>
            <Input
              id="publicPassword"
              name="publicPassword"
              type="password"
              value={publicPassword}
              onChange={(e) => setPublicPassword(e.target.value)}
              placeholder={hasExistingPassword ? "●●●●●●●●" : ""}
              autoComplete="new-password"
              disabled={isPending || removePublicPassword}
            />
            <p className="text-xs text-muted-foreground">
              {hasExistingPassword
                ? "Passwort ist gesetzt. Leer lassen, um es beizubehalten."
                : "Optional — leer lassen für ungeschützten Zugriff. Mindestens 4 Zeichen."}
            </p>
            {publicPassword && publicPassword.length < 4 && (
              <p className="text-xs text-destructive">Passwort muss mindestens 4 Zeichen haben.</p>
            )}
            {hasExistingPassword && (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="removePublicPassword"
                  name="removePublicPassword"
                  checked={removePublicPassword}
                  onCheckedChange={(v) => setRemovePublicPassword(v === true)}
                  disabled={isPending}
                />
                <Label htmlFor="removePublicPassword" className="text-sm font-normal">
                  Passwort entfernen
                </Label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
