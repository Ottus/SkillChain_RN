-- migration.sql (ROBUST VERSION)
-- Run this script in the Supabase SQL Editor.
-- This script automatically finds and drops ALL policies on affected tables 
-- before changing column types, then recreates them.

DO $$
DECLARE
    pol RECORD;
BEGIN
    -- 1. Loop through and drop all policies on the tables we need to modify
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('profile', 'posts', 'comments', 'likes', 'messages', 'jobs', 'notifications')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. Drop existing Foreign Key constraints
ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE IF EXISTS likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE IF EXISTS jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_receiver_id_fkey;

-- 3. Change column types from UUID to TEXT
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

-- 4. Add Ethereum support
ALTER TABLE profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 5. Restore Foreign Key constraints
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 6. Recreate essential RLS Policies (Supporting TEXT IDs)
-- Profile
CREATE POLICY "Public profiles are viewable by everyone" ON profile FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profile FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert their own profile" ON profile FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Posts
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid()::text = user_id);

-- Messages
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT 
USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

CREATE POLICY "Users can send messages" ON messages FOR INSERT 
WITH CHECK (auth.uid()::text = sender_id);
