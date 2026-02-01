/*
  Warnings:

  - Changed the type of `action_type` on the `audit_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `entity_type` on the `audit_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'RELATIONSHIP', 'USER');

-- AlterTable
ALTER TABLE "audit_log" DROP COLUMN "action_type",
ADD COLUMN     "action_type" "ActionType" NOT NULL,
DROP COLUMN "entity_type",
ADD COLUMN     "entity_type" "EntityType" NOT NULL;

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");
