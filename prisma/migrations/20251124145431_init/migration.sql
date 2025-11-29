-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wbPartnerToken" TEXT,
    "wbPartnerTokenUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nmId" BIGINT NOT NULL,
    "name" TEXT,
    "brand" TEXT,
    "categoryId" INTEGER,
    "vendorCode" TEXT,
    "subjectName" TEXT,
    "description" TEXT,
    "video" TEXT,
    "wbCreatedAt" TIMESTAMP(3),
    "wbUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "length" INTEGER,
    "weightBrutto" DOUBLE PRECISION,
    "dimsIsValid" BOOLEAN,
    "rawCard" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMetric" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "cartCount" INTEGER NOT NULL DEFAULT 0,
    "buyoutCount" INTEGER NOT NULL DEFAULT 0,
    "buyoutSum" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImageHistory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL,
    "previousUrl" TEXT NOT NULL,
    "newUrl" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,

    CONSTRAINT "ProductImageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSku" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL,
    "chrtID" BIGINT NOT NULL,
    "techSize" TEXT,
    "wbSize" TEXT,
    "sku" TEXT,

    CONSTRAINT "ProductSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCharacteristic" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT NOT NULL,
    "charId" INTEGER,
    "name" TEXT,
    "value" JSONB,

    CONSTRAINT "ProductCharacteristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbAdTest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbAdTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbAdVariant" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "abAdTestId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "nmIds" JSONB NOT NULL,
    "wbCampaignId" INTEGER,
    "dailyBudget" INTEGER,
    "bidType" TEXT NOT NULL DEFAULT 'manual',
    "placementTypes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbAdVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbAdStats" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "abAdVariantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbAdStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wb_adverts" (
    "id" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "status" INTEGER NOT NULL,
    "changeTime" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wb_adverts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbTestSession" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "nmId" BIGINT NOT NULL,
    "photoUrls" TEXT[],
    "viewsPerStep" INTEGER NOT NULL DEFAULT 1500,
    "totalViews" BIGINT NOT NULL DEFAULT 0,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "autoTopUp" BOOLEAN NOT NULL DEFAULT false,
    "topUpThreshold" INTEGER NOT NULL DEFAULT 1000,
    "topUpAmount" INTEGER NOT NULL DEFAULT 5000,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbTestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "Product_userId_idx" ON "Product"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_userId_nmId_key" ON "Product"("userId", "nmId");

-- CreateIndex
CREATE INDEX "ProductMetric_productId_date_idx" ON "ProductMetric"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetric_productId_date_key" ON "ProductMetric"("productId", "date");

-- CreateIndex
CREATE INDEX "ProductImageHistory_productId_changedAt_idx" ON "ProductImageHistory"("productId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSku_productId_chrtID_key" ON "ProductSku"("productId", "chrtID");

-- CreateIndex
CREATE INDEX "ProductCharacteristic_productId_idx" ON "ProductCharacteristic"("productId");

-- CreateIndex
CREATE INDEX "AbAdTest_productId_idx" ON "AbAdTest"("productId");

-- CreateIndex
CREATE INDEX "AbAdVariant_abAdTestId_idx" ON "AbAdVariant"("abAdTestId");

-- CreateIndex
CREATE INDEX "AbAdVariant_wbCampaignId_idx" ON "AbAdVariant"("wbCampaignId");

-- CreateIndex
CREATE INDEX "AbAdStats_abAdVariantId_date_idx" ON "AbAdStats"("abAdVariantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AbAdStats_abAdVariantId_date_key" ON "AbAdStats"("abAdVariantId", "date");

-- CreateIndex
CREATE INDEX "wb_adverts_userId_type_status_idx" ON "wb_adverts"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "AbTestSession_campaignId_idx" ON "AbTestSession"("campaignId");

-- CreateIndex
CREATE INDEX "AbTestSession_status_idx" ON "AbTestSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AbTestSession_userId_campaignId_key" ON "AbTestSession"("userId", "campaignId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMetric" ADD CONSTRAINT "ProductMetric_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImageHistory" ADD CONSTRAINT "ProductImageHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSku" ADD CONSTRAINT "ProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCharacteristic" ADD CONSTRAINT "ProductCharacteristic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbAdTest" ADD CONSTRAINT "AbAdTest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbAdVariant" ADD CONSTRAINT "AbAdVariant_abAdTestId_fkey" FOREIGN KEY ("abAdTestId") REFERENCES "AbAdTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbAdStats" ADD CONSTRAINT "AbAdStats_abAdVariantId_fkey" FOREIGN KEY ("abAdVariantId") REFERENCES "AbAdVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wb_adverts" ADD CONSTRAINT "wb_adverts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbTestSession" ADD CONSTRAINT "AbTestSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
