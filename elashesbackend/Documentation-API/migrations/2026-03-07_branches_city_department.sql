-- Add city and department columns to existing branches table.
-- For fresh databases, SQLAlchemy model create_all will include these columns automatically.

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL;
