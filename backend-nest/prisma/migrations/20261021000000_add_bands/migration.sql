-- CreateTable
CREATE TABLE `bands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(63) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bands_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Existing data belongs to the first band
INSERT INTO `bands` (`id`, `slug`, `name`) VALUES (1, 'maverick', 'Maverick');

-- AlterTable: add band_id, backfilling existing rows with band 1, then drop the default
ALTER TABLE `members` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `members` ALTER COLUMN `band_id` DROP DEFAULT;

ALTER TABLE `expense_types` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `expense_types` ALTER COLUMN `band_id` DROP DEFAULT;

ALTER TABLE `expenses` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `expenses` ALTER COLUMN `band_id` DROP DEFAULT;

ALTER TABLE `logs` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `logs` ALTER COLUMN `band_id` DROP DEFAULT;

ALTER TABLE `songs` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `songs` ALTER COLUMN `band_id` DROP DEFAULT;

ALTER TABLE `repertoires` ADD COLUMN `band_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `repertoires` ALTER COLUMN `band_id` DROP DEFAULT;

-- Member email / OIDC subject are now unique per band instead of globally.
-- The old single-column unique indexes are named `email`/`oidc_sub` (created by
-- ADD COLUMN ... UNIQUE) or `members_email_key`/`members_oidc_sub_key`, so look them up.
SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'members'
    AND column_name = 'email'
    AND non_unique = 0
    AND INDEX_NAME IN ('email', 'members_email_key')
  LIMIT 1
);

SET @ddl := IF(@idx IS NULL, 'SELECT 1', CONCAT('DROP INDEX `', @idx, '` ON `members`'));

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT INDEX_NAME
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'members'
    AND column_name = 'oidc_sub'
    AND non_unique = 0
    AND INDEX_NAME IN ('oidc_sub', 'members_oidc_sub_key')
  LIMIT 1
);

SET @ddl := IF(@idx IS NULL, 'SELECT 1', CONCAT('DROP INDEX `', @idx, '` ON `members`'));

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE UNIQUE INDEX `members_band_id_email_key` ON `members`(`band_id`, `email`);
CREATE UNIQUE INDEX `members_band_id_oidc_sub_key` ON `members`(`band_id`, `oidc_sub`);

-- CreateIndex
CREATE INDEX `expense_types_band_id_idx` ON `expense_types`(`band_id`);
CREATE INDEX `expenses_band_id_idx` ON `expenses`(`band_id`);
CREATE INDEX `logs_band_id_idx` ON `logs`(`band_id`);
CREATE INDEX `songs_band_id_idx` ON `songs`(`band_id`);
CREATE INDEX `repertoires_band_id_idx` ON `repertoires`(`band_id`);

-- AddForeignKey
ALTER TABLE `members` ADD CONSTRAINT `members_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expense_types` ADD CONSTRAINT `expense_types_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `logs` ADD CONSTRAINT `logs_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `songs` ADD CONSTRAINT `songs_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `repertoires` ADD CONSTRAINT `repertoires_band_id_fkey` FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
