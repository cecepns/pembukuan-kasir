-- Migration: Remove UNIQUE constraint from modal table to allow history tracking
-- This allows multiple records per modal_type and user_id for deposit history

USE pembukuan_kasir;

-- STEP 1: Check current table structure
-- Run this first to see all indexes and constraints:
SHOW INDEX FROM modal;
-- OR
SHOW CREATE TABLE modal;

-- STEP 2: Find and remove UNIQUE constraint
-- The constraint name might be different. Check the output from STEP 1.
-- Look for a UNIQUE index on columns (modal_type, user_id)

-- If you see a UNIQUE index, note its name and run:
-- ALTER TABLE modal DROP INDEX [constraint_name];

-- Common constraint names to try:
-- ALTER TABLE modal DROP INDEX unique_modal_user;
-- ALTER TABLE modal DROP INDEX modal_type;
-- ALTER TABLE modal DROP INDEX user_id;  -- Only if it's UNIQUE (unlikely)

-- STEP 3: If constraint doesn't exist (error #1091)
-- This means the table already allows multiple records OR the constraint was never created
-- In this case, you can proceed - the history feature should work!

-- STEP 4: Verify (optional - test if you can insert duplicate modal_type + user_id)
-- Try inserting a test record:
-- INSERT INTO modal (modal_type, nominal, user_id) VALUES ('karangsari', 100000, 1);
-- If it works without error, the UNIQUE constraint is already removed!

-- Note: If you get error #1091, it means the constraint doesn't exist.
-- This is actually GOOD - it means the table already supports history tracking!
-- You can skip the DROP INDEX command and proceed to use the application.

