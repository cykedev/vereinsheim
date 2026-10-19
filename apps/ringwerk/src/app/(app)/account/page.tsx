import { permanentRedirect } from "next/navigation"

// „Konto“ heißt jetzt „Profil“; alte Lesezeichen landen dort
export default function AccountPage() {
  permanentRedirect("/profile")
}
