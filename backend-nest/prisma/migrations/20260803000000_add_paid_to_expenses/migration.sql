-- AlterTable: track whether an expense has been paid
ALTER TABLE `expenses`
    ADD COLUMN `paid` BOOLEAN NOT NULL DEFAULT false;
