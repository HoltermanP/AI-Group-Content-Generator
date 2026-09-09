-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "websiteCaseId" TEXT;

-- CreateTable
CREATE TABLE "WebsiteCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sector" TEXT,
    "tag" TEXT,
    "resultLine" TEXT,
    "teaser" TEXT,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteCase_userId_active_idx" ON "WebsiteCase"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteCase_userId_url_key" ON "WebsiteCase"("userId", "url");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_websiteCaseId_fkey" FOREIGN KEY ("websiteCaseId") REFERENCES "WebsiteCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteCase" ADD CONSTRAINT "WebsiteCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

