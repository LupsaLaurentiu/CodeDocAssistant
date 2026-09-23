import { PrismaClient } from "@prisma/client";

import { getEnvironment } from "@/config/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: getEnvironment().DATABASE_URL,
    // Route-level structured errors intentionally omit raw queries and user data.
    log: [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
