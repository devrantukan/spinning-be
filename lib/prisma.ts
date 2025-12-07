import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please check your .env file."
  );
}

// Configure Prisma with connection pool settings for better reliability
// This helps prevent "Can't reach database server" errors
const prismaConfig: any = {
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  // Disable prepared statements when using PgBouncer (Supabase pooler)
  // This prevents "prepared statement does not exist" errors
  ...(process.env.DATABASE_URL?.includes("pooler.supabase.com") ||
  process.env.DATABASE_URL?.includes("pgbouncer=true")
    ? {
        // Use direct queries instead of prepared statements for pooler
        // This is handled via pgbouncer=true in the connection string
      }
    : {}),
};

// Add connection pool parameters to DATABASE_URL if not already present
// This helps with Supabase connection pooling
let databaseUrl = process.env.DATABASE_URL;

// Fix common Supabase connection issues:
// The pooler (PgBouncer) doesn't support prepared statements, which Prisma uses by default.
// Solution: Add pgbouncer=true and ensure proper port configuration
if (databaseUrl) {
  const isPooler = databaseUrl.includes("pooler.supabase.com");

  if (isPooler) {
    // For pooler connections, ensure we use port 6543 and add pgbouncer=true
    if (databaseUrl.includes(":5432")) {
      console.warn(
        "⚠️  DATABASE_URL: Using pooler hostname with direct port (5432). Fixing to use pooler port (6543)..."
      );
      databaseUrl = databaseUrl.replace(":5432/", ":6543/");
    }

    // Add pgbouncer=true to disable prepared statements (required for PgBouncer)
    if (!databaseUrl.includes("pgbouncer=true")) {
      const separator = databaseUrl.includes("?") ? "&" : "?";
      databaseUrl = `${databaseUrl}${separator}pgbouncer=true`;
      console.log(
        "✅ Added pgbouncer=true to connection string to disable prepared statements"
      );
    }
  }

  // Add connection pool parameters if not already present
  if (
    !databaseUrl.includes("connection_limit") &&
    !databaseUrl.includes("pool_timeout")
  ) {
    const separator = databaseUrl.includes("?") ? "&" : "?";
    databaseUrl = `${databaseUrl}${separator}connection_limit=10&pool_timeout=10`;
  }

  // Log the final connection string (without password) for debugging
  if (process.env.NODE_ENV === "development") {
    const safeUrl = databaseUrl.replace(/:([^:@]+)@/, ":****@");
    if (databaseUrl !== process.env.DATABASE_URL) {
      console.log(`🔧 Using modified DATABASE_URL: ${safeUrl}`);
    } else {
      console.log(`✅ Using DATABASE_URL: ${safeUrl}`);
    }

    // Verify pgbouncer=true is present for pooler connections
    if (
      databaseUrl.includes("pooler.supabase.com") &&
      !databaseUrl.includes("pgbouncer=true")
    ) {
      console.error(
        "❌ ERROR: Pooler connection detected but pgbouncer=true is missing!"
      );
    } else if (
      databaseUrl.includes("pooler.supabase.com") &&
      databaseUrl.includes("pgbouncer=true")
    ) {
      console.log(
        "✅ Verified: pgbouncer=true is present in connection string"
      );
    }
  }
}

// Always set the datasources config to ensure our modified URL is used
prismaConfig.datasources = {
  db: {
    url: databaseUrl,
  },
};

// If we modified the connection string and a Prisma client already exists,
// clear it so it can be recreated with the new connection string
if (databaseUrl !== process.env.DATABASE_URL && globalForPrisma.prisma) {
  console.log(
    "🔄 Clearing existing Prisma client to apply new connection string..."
  );
  // Disconnect asynchronously (don't await to avoid blocking)
  globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

// Create Prisma client with the modified connection string
export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaConfig);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
