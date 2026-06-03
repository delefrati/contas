-- Add email column to members table
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'members'
    AND column_name = 'email'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE members ADD COLUMN email VARCHAR(255) UNIQUE NULL',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add oidcSub column to members table for OIDC integration
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'members'
    AND column_name = 'oidc_sub'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE members ADD COLUMN oidc_sub VARCHAR(255) UNIQUE NULL',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id INT,
  details JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INT,
  INDEX idx_action (action),
  INDEX idx_resource (resource),
  INDEX idx_created_at (created_at)
);
