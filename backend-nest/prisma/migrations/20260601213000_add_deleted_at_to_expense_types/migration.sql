SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'expense_types'
    AND column_name = 'deleted_at'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE expense_types ADD COLUMN deleted_at DATETIME NULL',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
