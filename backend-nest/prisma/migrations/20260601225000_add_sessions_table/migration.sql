-- Add sessions table for JWT token tracking
CREATE TABLE IF NOT EXISTS sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  member_id INT NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  oidc_sub VARCHAR(255),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_member_id (member_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_oidc_sub (oidc_sub)
);
