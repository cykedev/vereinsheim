import { permanentRedirect } from "next/navigation"

// alte Adresse von Profil; Lesezeichen landen dort
export default function AccountPage() {
  permanentRedirect("/profile")
}
