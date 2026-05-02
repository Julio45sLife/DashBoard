-- Vilar DS — PostgreSQL initialization
-- Runs once when the container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fast LIKE searches
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- accent-insensitive search

-- Create application user with limited privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vilar_app') THEN
    CREATE ROLE vilar_app LOGIN PASSWORD 'vilar_app_secret';
  END IF;
END $$;

GRANT CONNECT ON DATABASE vilar_ds TO vilar_app;
GRANT USAGE ON SCHEMA public TO vilar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vilar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vilar_app;
