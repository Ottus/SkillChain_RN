-- migration.sql (FIXED)
-- Run this script in the Supabase SQL Editor to support Privy DIDs (strings)
-- This version handles the "cannot alter type of a column used in a policy" error.

-- 1. DROP ALL EXISTING POLICIES (to allow column type changes)
-- Profile policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profile;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profile;
DROP POLICY IF EXISTS "Users can update own profile" ON profile;

-- Posts policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can create posts" ON posts;
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON posts;

-- Comments policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;

-- Likes policies
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
DROP POLICY IF EXISTS "Users can toggle likes" ON likes;

-- Messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Jobs policies
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON jobs;
DROP POLICY IF EXISTS "Users can post jobs" ON jobs;

-- 2. DROP FOREIGN KEY CONSTRAINTS
ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE IF EXISTS likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE IF EXISTS messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE IF EXISTS jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_sender_id_fkey;
ALTER TABLE IF EXISTS notifications DROP CONSTRAINT IF EXISTS notifications_receiver_id_fkey;

-- 3. CHANGE COLUMN TYPES FROM UUID TO TEXT
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

-- 4. ADD ETHEREUM SUPPORT
ALTER TABLE profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 5. RESTORE FOREIGN KEY CONSTRAINTS
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 6. RECREATE RLS POLICIES (updated for TEXT IDs)
-- These use a simple equality check. Note: auth.uid() in Supabase returns a UUID, 
-- so we cast it to TEXT to compare with Privy DIDs.

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
