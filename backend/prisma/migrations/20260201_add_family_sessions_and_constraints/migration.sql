-- AlterTable: Add VarChar constraints to Person fields
ALTER TABLE "persons" ALTER COLUMN "first_name" TYPE VARCHAR(100);
ALTER TABLE "persons" ALTER COLUMN "last_name" TYPE VARCHAR(100);

-- CreateTable: FamilySession for persistent session storage
CREATE TABLE "family_sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_sessions_session_token_key" ON "family_sessions"("session_token");

-- CreateIndex
CREATE INDEX "family_sessions_session_token_idx" ON "family_sessions"("session_token");

-- CreateIndex
CREATE INDEX "family_sessions_expires_at_idx" ON "family_sessions"("expires_at");
