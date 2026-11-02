-- Super admins can disable a band from the admin panel, and log what they do to the
-- platform itself (super admins, admin sign-ins) without a band.
-- AlterTable
ALTER TABLE `bands` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `logs` MODIFY `band_id` INTEGER NULL;
