-- Super admins manage the platform without being members of any band; sessions and logs
-- may belong to one instead of a member.
-- AlterTable
ALTER TABLE `logs` ADD COLUMN `super_admin_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `super_admin_id` INTEGER NULL,
    MODIFY `member_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `super_admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `super_admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `logs_super_admin_id_idx` ON `logs`(`super_admin_id`);

-- CreateIndex
CREATE INDEX `sessions_super_admin_id_idx` ON `sessions`(`super_admin_id`);

-- AddForeignKey
ALTER TABLE `logs` ADD CONSTRAINT `logs_super_admin_id_fkey` FOREIGN KEY (`super_admin_id`) REFERENCES `super_admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_super_admin_id_fkey` FOREIGN KEY (`super_admin_id`) REFERENCES `super_admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

