DROP TRIGGER IF EXISTS items_updated_at ON items;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
