/*
  Warnings:

  - The primary key for the `Shitpost` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `id` to the `Shitpost` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shitpost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "content" BLOB NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Shitpost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Shitpost" ("content", "name", "userId") SELECT "content", "name", "userId" FROM "Shitpost";
DROP TABLE "Shitpost";
ALTER TABLE "new_Shitpost" RENAME TO "Shitpost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
