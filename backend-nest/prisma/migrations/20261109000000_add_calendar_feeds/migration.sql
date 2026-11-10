-- Members can subscribe to the band's agenda from their own calendar app.
-- AlterTable
ALTER TABLE `bands` ADD COLUMN `time_zone` VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    ADD COLUMN `default_event_minutes` INTEGER NOT NULL DEFAULT 120;

-- AlterTable
ALTER TABLE `members` ADD COLUMN `calendar_token` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `events` ADD COLUMN `end_time` VARCHAR(5) NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX `members_calendar_token_key` ON `members`(`calendar_token`);
