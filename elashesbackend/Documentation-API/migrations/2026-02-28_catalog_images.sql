-- Expand catalog image/description columns to support base64
-- Run in the MySQL database: elashes

ALTER TABLE eye_types
  MODIFY COLUMN description TEXT NULL,
  MODIFY COLUMN image TEXT NULL;

ALTER TABLE effects
  MODIFY COLUMN image TEXT NULL;

ALTER TABLE volumes
  MODIFY COLUMN description TEXT NULL,
  MODIFY COLUMN image TEXT NULL;

CREATE TABLE IF NOT EXISTS lash_designs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  image TEXT NULL
);

ALTER TABLE lash_designs
  MODIFY COLUMN image TEXT NULL;
