-- AlterTable: publiceren namens de LinkedIn-bedrijfspagina
ALTER TABLE "IntegrationAccount" ADD COLUMN     "organizationUrn" TEXT,
ADD COLUMN     "organizationName" TEXT;
