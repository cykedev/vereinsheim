"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@vereinsheim/ui/button"

import { createQrReader, qrLink, type QrReader } from "@/lib/scan/qr"

/** so oft liest Spiegel ein Bild aus dem Video */
const SCAN_EVERY_MS = 200

const DENIED =
  "Spiegel darf die Kamera nicht nutzen. Erlaube sie in den Einstellungen des Browsers oder nimm ein Foto auf."
const NO_CAMERA =
  "Dieses Gerät bietet hier keine Kamera an. Nimm ein Foto auf oder füge den Link ein."
const NO_CODE = "Auf dem Foto ist kein QR-Code zu erkennen. Versuche es näher und gerade von vorn."
const NO_LINK = "Dieser QR-Code führt nicht auf einen Ausdruck."

/**
 * QR-Code scannen: die Kamera (hinten) liest etwa alle 200 ms ein Bild, bis ein Code erkannt ist; dann geht sie aus und
 * der Link geht an `onLink`. Aus geht sie auch über „Kamera beenden“, beim Verlassen der Seite und wenn der Tab in den
 * Hintergrund geht. „Foto aufnehmen“ geht immer, auch ohne Kamera im Browser (ohne HTTPS gibt es keine).
 */
export function CameraScan({
  onLink,
  disabled,
}: {
  onLink: (url: string) => void
  /** während Spiegel den Ausdruck liest */
  disabled: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | null>(null)
  const reader = useRef<Promise<QrReader> | null>(null)
  // während der Browser nach der Kamera fragt: kein zweiter Start, und wer inzwischen beendet, bekommt keinen Strom
  const starting = useRef(false)
  const wanted = useRef(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const stop = useCallback(() => {
    wanted.current = false
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = null
    if (video.current) video.current.srcObject = null
    setRunning(false)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      stop()
    }
  }, [stop])

  const readerOf = () => (reader.current ??= createQrReader())

  const found = (text: string) => {
    stop()
    const url = qrLink(text)
    if (url) onLink(url)
    else setMessage(NO_LINK)
  }

  const start = async () => {
    if (starting.current) return
    setMessage(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage(NO_CAMERA)
      return
    }
    starting.current = true
    wanted.current = true
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      // beendet, während der Browser fragte (Tab im Hintergrund, Seite verlassen): den Strom gleich wieder zu
      if (!wanted.current || document.hidden) {
        for (const track of media.getTracks()) track.stop()
        return
      }
      stream.current = media
      const node = video.current
      if (!node) return stop()
      node.srcObject = media
      await node.play()
      setRunning(true)
      const qr = await readerOf()
      let busy = false
      timer.current = window.setInterval(async () => {
        if (busy || !stream.current || node.readyState < 2) return
        busy = true
        try {
          const text = await qr.read(node, "video")
          if (text && stream.current) found(text)
        } catch {
          // ein Bild, das sich nicht lesen ließ: das nächste versucht es wieder
        } finally {
          busy = false
        }
      }, SCAN_EVERY_MS)
    } catch (error) {
      stop()
      setMessage(error instanceof Error && error.name === "NotAllowedError" ? DENIED : NO_CAMERA)
    } finally {
      starting.current = false
    }
  }

  const readPhoto = async (file: File) => {
    setMessage(null)
    stop()
    try {
      const bitmap = await createImageBitmap(file)
      try {
        const text = await (await readerOf()).read(bitmap, "photo")
        if (text) found(text)
        else setMessage(NO_CODE)
      } finally {
        bitmap.close()
      }
    } catch {
      setMessage(NO_CODE)
    }
  }

  return (
    <div className="grid gap-3">
      <video
        ref={video}
        playsInline
        muted
        aria-label="Bild der Kamera"
        className={running ? "aspect-[4/3] w-full rounded-xl bg-surface-2 object-cover" : "hidden"}
      />
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Button type="button" variant="outline" className="h-10" onClick={stop}>
            Kamera beenden
          </Button>
        ) : (
          <Button
            type="button"
            data-camera-start
            className="h-10"
            disabled={disabled}
            onClick={() => void start()}
          >
            Kamera starten
          </Button>
        )}
        <div>
          <input
            id="fetch-photo"
            type="file"
            accept="image/*"
            capture="environment"
            className="peer sr-only"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void readPhoto(file)
            }}
          />
          <label
            htmlFor="fetch-photo"
            data-camera-photo
            className="inline-flex h-10 cursor-pointer items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-default peer-disabled:opacity-60 hover:bg-accent-wash"
          >
            Foto aufnehmen
          </label>
        </div>
      </div>
      {message && (
        <p role="alert" data-camera-message className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}
