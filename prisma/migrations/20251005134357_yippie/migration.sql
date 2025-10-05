-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Marriage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userOneId" TEXT NOT NULL,
    "userTwoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Marriage" ("createdAt", "id", "userOneId", "userTwoId") SELECT "createdAt", "id", "userOneId", "userTwoId" FROM "Marriage";
DROP TABLE "Marriage";
ALTER TABLE "new_Marriage" RENAME TO "Marriage";
CREATE UNIQUE INDEX "Marriage_userOneId_key" ON "Marriage"("userOneId");
CREATE UNIQUE INDEX "Marriage_userTwoId_key" ON "Marriage"("userTwoId");
CREATE UNIQUE INDEX "Marriage_userOneId_userTwoId_key" ON "Marriage"("userOneId", "userTwoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
