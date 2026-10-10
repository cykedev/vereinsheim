import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

// Prisma 7 verbindet über einen Datenbank-Adapter statt der URL im Schema.
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  const pool = new Pool({ connectionString })
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

// Ein Client je Prozess: Hot-Reload in der Entwicklung baute sonst bei jedem Neuladen einen neuen Pool auf.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}

export type Db = PrismaClient
