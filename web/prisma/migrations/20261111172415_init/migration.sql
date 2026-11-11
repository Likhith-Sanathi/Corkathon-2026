-- CreateEnum
CREATE TYPE "FactorKey" AS ENUM ('power', 'isolation', 'telecom', 'water', 'roads');

-- CreateEnum
CREATE TYPE "RiskKey" AS ENUM ('flood', 'seismic');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "municipality" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSnapshot" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "suitability" DOUBLE PRECISION NOT NULL,
    "risk" DOUBLE PRECISION NOT NULL,
    "weights" JSONB NOT NULL,
    "plot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactorScore" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "key" "FactorKey" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT[],

    CONSTRAINT "FactorScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "key" "RiskKey" NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT[],

    CONSTRAINT "RiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidencePoint" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "factor" "FactorKey" NOT NULL,

    CONSTRAINT "EvidencePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Site_lat_lon_idx" ON "Site"("lat", "lon");

-- CreateIndex
CREATE INDEX "Site_municipality_idx" ON "Site"("municipality");

-- CreateIndex
CREATE INDEX "ScoreSnapshot_siteId_idx" ON "ScoreSnapshot"("siteId");

-- CreateIndex
CREATE INDEX "ScoreSnapshot_createdAt_idx" ON "ScoreSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "FactorScore_snapshotId_idx" ON "FactorScore"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "FactorScore_snapshotId_key_key" ON "FactorScore"("snapshotId", "key");

-- CreateIndex
CREATE INDEX "RiskScore_snapshotId_idx" ON "RiskScore"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskScore_snapshotId_key_key" ON "RiskScore"("snapshotId", "key");

-- CreateIndex
CREATE INDEX "EvidencePoint_snapshotId_idx" ON "EvidencePoint"("snapshotId");

-- AddForeignKey
ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactorScore" ADD CONSTRAINT "FactorScore_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ScoreSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScore" ADD CONSTRAINT "RiskScore_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ScoreSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidencePoint" ADD CONSTRAINT "EvidencePoint_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ScoreSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
