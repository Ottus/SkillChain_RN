-- migration.sql
-- Run this script in the Supabase SQL Editor to support Privy DIDs (strings)
-- and add multi-chain support for Ethereum.

-- 1. Drop existing Foreign Key constraints (to allow column type changes)
ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE IF EXISTS likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE IF EXISTS jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_receiver_id_fkey;

-- 2. Change column types from UUID to TEXT
-- Profile table
ALTER TABLE profile ALTER COLUMN id TYPE text;

-- Other tables
ALTER TABLE posts ALTER COLUMN user_id TYPE text;
ALTER TABLE comments ALTER COLUMN user_id TYPE text;
ALTER TABLE likes ALTER COLUMN user_id TYPE text;
ALTER TABLE messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE messages ALTER COLUMN receiver_id TYPE text;
ALTER TABLE jobs ALTER COLUMN user_id TYPE text;
ALTER TABLE notifications ALTER COLUMN sender_id TYPE text;
ALTER TABLE notifications ALTER COLUMN receiver_id TYPE text;

-- 3. Add Ethereum support to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 4. Re-apply Foreign Key constraints
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 5. Enable RLS and verify policies
-- Ensure policies allow users to read/write based on their new TEXT id
-- Example (adjust to your specific policy names):
-- DROP POLICY IF EXISTS "Users can update own profile" ON profile;
-- CREATE POLICY "Users can update own profile" ON profile FOR UPDATE USING (auth.uid()::text = id);
