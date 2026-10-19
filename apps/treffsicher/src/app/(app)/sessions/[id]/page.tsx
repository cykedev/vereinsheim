import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { CheckCircle2, Gauge, Heart, MessageSquare, Paperclip } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { getSessionById } from "@/lib/sessions/actions"
import { sessionRingDistribution } from "@/lib/sessions/ringDistribution"
import { buildSessionDetailViewModel } from "@/lib/sessions/sessionDetailViewModel"
import { RingBars } from "@vereinsheim/shot-ui/analysis/charts/RingBars"
import { AttachmentSection } from "@/components/app/sessions/AttachmentSection"
import { FeedbackSection } from "@/components/app/sessions/FeedbackSection"
import { PrognosisSection } from "@/components/app/sessions/PrognosisSection"
import { ReflectionSection } from "@/components/app/sessions/ReflectionSection"
import { SessionPrognosisFeedbackComparisonCard } from "@/components/app/sessions/SessionPrognosisFeedbackComparisonCard"
import { SessionSeriesResultCard } from "@/components/app/sessions/SessionSeriesResultCard"
import { WellbeingSection } from "@/components/app/sessions/WellbeingSection"
import { ExplainProvider, ExplainSwitch } from "@/components/app/help/Explain"
import { SessionDetailHeader, SessionDetailSectionCard } from "@/components/app/sessions/detail"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/design2/card"
import { Separator } from "@vereinsheim/ui/separator"

export const metadata: Metadata = {
  title: "Einheit",
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const displayTimeZone = getDisplayTimeZone()
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const { id } = await params
  const sessionRecord = await getSessionById(id)
  if (!sessionRecord) notFound()

  const viewModel = buildSessionDetailViewModel(sessionRecord)
  const rings = sessionRingDistribution(viewModel.scoringShots)

  return (
    <ExplainProvider>
      <div className="space-y-6">
        <SessionDetailHeader session={sessionRecord} displayTimeZone={displayTimeZone} />

        <Separator />

        <div className="flex justify-end">
          <ExplainSwitch />
        </div>

        {viewModel.hasSeriesResults && (
          <SessionSeriesResultCard
            session={sessionRecord}
            totalScore={viewModel.totalScore}
            isDecimal={viewModel.isDecimal}
          />
        )}

        {viewModel.showShotDistribution && (
          <Card>
            <CardHeader>
              <CardTitle>Ringverteilung</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {/* Ringwert-Farben wie Spiegel, je Ring Anzahl und Anteil als Zahl */}
              <RingBars dist={rings} />
              <p className="text-[13px] text-muted-foreground">
                {`${rings.n} Wertungsschüsse, Probe zählt nicht`}
              </p>
            </CardContent>
          </Card>
        )}

        {viewModel.hasAttachmentSection && (
          <SessionDetailSectionCard
            title="Anhänge"
            icon={Paperclip}
            headerSuffix={
              sessionRecord.attachments.length > 0 ? (
                <span className="text-base font-normal text-muted-foreground">
                  ({sessionRecord.attachments.length})
                </span>
              ) : undefined
            }
          >
            <AttachmentSection
              sessionId={sessionRecord.id}
              attachments={sessionRecord.attachments.map((attachment) => ({
                id: attachment.id,
                filePath: attachment.filePath,
                fileType: attachment.fileType,
                originalName: attachment.originalName,
                label: attachment.label,
              }))}
            />
          </SessionDetailSectionCard>
        )}

        <SessionDetailSectionCard title="Befinden" icon={Heart} help="wellbeing">
          <WellbeingSection sessionId={sessionRecord.id} initialData={sessionRecord.wellbeing} />
        </SessionDetailSectionCard>

        {viewModel.hasPrognosisFeedback && (
          <SessionDetailSectionCard title="Prognose" icon={Gauge}>
            <PrognosisSection sessionId={sessionRecord.id} initialData={sessionRecord.prognosis} />
          </SessionDetailSectionCard>
        )}

        {viewModel.hasPrognosisFeedback && (
          <SessionDetailSectionCard title="Feedback" icon={CheckCircle2}>
            <FeedbackSection sessionId={sessionRecord.id} initialData={sessionRecord.feedback} />
          </SessionDetailSectionCard>
        )}

        {viewModel.hasPrognosisFeedback && sessionRecord.prognosis && sessionRecord.feedback && (
          <SessionPrognosisFeedbackComparisonCard
            prognosis={sessionRecord.prognosis}
            feedback={sessionRecord.feedback}
          />
        )}

        <SessionDetailSectionCard title="Reflexion" icon={MessageSquare}>
          <ReflectionSection sessionId={sessionRecord.id} initialData={sessionRecord.reflection} />
        </SessionDetailSectionCard>
      </div>
    </ExplainProvider>
  )
}
