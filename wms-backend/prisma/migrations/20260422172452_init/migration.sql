-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Depot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Shelf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depotId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "drawers" INTEGER NOT NULL,
    "maxKg" DECIMAL NOT NULL,
    CONSTRAINT "Shelf_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kg" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depotId" TEXT NOT NULL,
    "shelfId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "drawer" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "expiryDate" DATETIME,
    "lotCode" TEXT,
    "entryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inventory_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "Product" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FloorPlanObject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "depotId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "color" TEXT,
    CONSTRAINT "FloorPlanObject_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "Depot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovementHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "fromLoc" TEXT,
    "toLoc" TEXT,
    "qty" DECIMAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "MovementHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
