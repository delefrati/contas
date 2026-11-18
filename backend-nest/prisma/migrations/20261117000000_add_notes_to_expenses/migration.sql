-- AlterTable: keep the Observação a member writes on an expense
ALTER TABLE `expenses`
    ADD COLUMN `notes` TEXT NULL;
