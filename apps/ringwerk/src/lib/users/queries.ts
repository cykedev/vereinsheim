import { db } from "@/lib/db"
import type { UserListItem, UserSummary } from "./types"

export async function getUsers(): Promise<UserListItem[]> {
  return db.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
  })
}

export async function getUserById(id: string): Promise<UserSummary | null> {
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
}
