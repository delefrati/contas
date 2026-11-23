-- CreateTable: the one Spotify account the platform makes playlists in
CREATE TABLE `spotify_connection` (
    `id` INTEGER NOT NULL,
    `spotify_user_id` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `refresh_token` TEXT NOT NULL,
    `broken` BOOLEAN NOT NULL DEFAULT false,
    `connected_by_id` INTEGER NULL,
    `connected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `spotify_connection_connected_by_id_fkey`(`connected_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `spotify_connection` ADD CONSTRAINT `spotify_connection_connected_by_id_fkey` FOREIGN KEY (`connected_by_id`) REFERENCES `super_admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
