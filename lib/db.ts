import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

if (process.env.DEBUG_DB === "true") {
  try {
    const url = new URL(connectionString);
    console.log("[db] target:", `${url.hostname}${url.pathname}`);
  } catch {
    console.log("[db] target: <unparseable DATABASE_URL>");
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString })),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;