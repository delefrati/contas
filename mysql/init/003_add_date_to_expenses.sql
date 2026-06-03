ALTER TABLE `expenses` ADD COLUMN `date` VARCHAR(10) NOT NULL DEFAULT '';
UPDATE `expenses` SET `date` = LEFT(`created_at`, 10) WHERE `date` = '';
