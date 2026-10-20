import Link from "next/link"

// 404: unbekannte Adresse oder ein Eintrag, den es nicht gibt oder der einem anderen Konto gehört
export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Nicht gefunden
      </h1>
      <p className="text-foreground-2">
        Diese Seite gibt es nicht, oder sie gehört zu einem anderen Konto.
      </p>
      <Link
        href="/"
        className="justify-self-start rounded-full border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        Zum Start
      </Link>
    </main>
  )
}
