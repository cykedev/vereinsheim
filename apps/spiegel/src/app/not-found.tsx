import Link from "next/link"

// 404 in Design 2: unbekannte Adresse oder eine Scheibe, die es nicht gibt oder die einem anderen gehört
export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-2xl gap-3 px-4 py-12">
      <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
        Nicht gefunden
      </h1>
      <p className="text-foreground-2">
        Diese Seite oder Scheibe gibt es nicht, oder sie gehört nicht zu deinem Konto.
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
