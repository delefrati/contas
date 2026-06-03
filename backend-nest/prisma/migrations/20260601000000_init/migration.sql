-- CreateTable
CREATE TABLE IF NOT EXISTS `members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE IF NOT EXISTS `expense_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `fk_type` INT NULL,
  `fk_member` INT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `deleted_at` DATETIME NULL,
  FOREIGN KEY (`fk_type`) REFERENCES `expense_types`(`id`)
);

-- CreateTable
CREATE TABLE IF NOT EXISTS `expense_members` (
  `expense_id` INT NOT NULL,
  `member_id` INT NOT NULL,
  PRIMARY KEY (`expense_id`, `member_id`),
  FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE
);
