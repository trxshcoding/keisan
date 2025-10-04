-- CreateTable
CREATE TABLE "Marriage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userOneId" TEXT NOT NULL,
    "userTwoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Marriage_userOneId_fkey" FOREIGN KEY ("userOneId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Marriage_userTwoId_fkey" FOREIGN KEY ("userTwoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_userOneId_key" ON "Marriage"("userOneId");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_userTwoId_key" ON "Marriage"("userTwoId");

-- CreateIndex
CREATE UNIQUE INDEX "Marriage_userOneId_userTwoId_key" ON "Marriage"("userOneId", "userTwoId");
