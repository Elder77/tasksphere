/*
  Warnings:

  - You are about to drop the `ChatMessage` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `identifierId` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Added the required column `module` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "identifierId" INTEGER NOT NULL,
ADD COLUMN     "module" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."ChatMessage";

-- CreateTable
CREATE TABLE "tickets_chat" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "message" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identifier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT NOT NULL,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "allowLettersOnly" BOOLEAN NOT NULL DEFAULT false,
    "allowAlphaNumeric" BOOLEAN NOT NULL DEFAULT true,
    "regex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_files" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "historyId" INTEGER,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets_history" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identifier_name_key" ON "Identifier"("name");
