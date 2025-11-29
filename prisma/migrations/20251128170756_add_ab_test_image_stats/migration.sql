/*
  Warnings:

  - You are about to drop the `AbTestSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AbTestSession" DROP CONSTRAINT "AbTestSession_userId_fkey";

-- DropTable
DROP TABLE "AbTestSession";

-- CreateTable
CREATE TABLE "ab_test_sessions" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "nmId" BIGINT NOT NULL,
    "photoUrls" TEXT[],
    "viewsPerStep" INTEGER NOT NULL DEFAULT 1000,
    "totalViews" BIGINT NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "autoTopUp" BOOLEAN NOT NULL DEFAULT false,
    "topUpThreshold" INTEGER NOT NULL DEFAULT 1000,
    "topUpAmount" INTEGER NOT NULL DEFAULT 5000,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),

    CONSTRAINT "ab_test_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_image_stats" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageIndex" INTEGER NOT NULL,
    "targetViews" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "viewsAtStart" BIGINT NOT NULL,
    "viewsAtEnd" BIGINT,
    "checkHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_test_image_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ab_test_sessions_campaignId_idx" ON "ab_test_sessions"("campaignId");

-- CreateIndex
CREATE INDEX "ab_test_sessions_status_idx" ON "ab_test_sessions"("status");

-- CreateIndex
CREATE INDEX "ab_test_sessions_status_nextCheckAt_idx" ON "ab_test_sessions"("status", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "ab_test_sessions_userId_campaignId_key" ON "ab_test_sessions"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "ab_test_image_stats_sessionId_idx" ON "ab_test_image_stats"("sessionId");

-- CreateIndex
CREATE INDEX "ab_test_image_stats_sessionId_imageIndex_idx" ON "ab_test_image_stats"("sessionId", "imageIndex");

-- AddForeignKey
ALTER TABLE "ab_test_sessions" ADD CONSTRAINT "ab_test_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_image_stats" ADD CONSTRAINT "ab_test_image_stats_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ab_test_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
