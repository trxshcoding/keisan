-- CreateTable
CREATE TABLE "Shitpost" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "content" BLOB NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Shitpost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "musicUsername" TEXT,
    "musicUsesListenbrainz" BOOLEAN
);
