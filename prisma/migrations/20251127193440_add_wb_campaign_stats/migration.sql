-- CreateTable
CREATE TABLE "wb_campaign_stats" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wb_campaign_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wb_campaign_stats_userId_campaignId_date_idx" ON "wb_campaign_stats"("userId", "campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "wb_campaign_stats_userId_campaignId_date_key" ON "wb_campaign_stats"("userId", "campaignId", "date");
