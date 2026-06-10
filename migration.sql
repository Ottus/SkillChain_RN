-- migration.sql (ULTIMATE VERSION)
-- This script dynamically finds and fixes all foreign key conflicts
-- caused by changing the 'profile.id' type to 'text'.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop ALL foreign keys that point to the 'profile' table
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'profile'
    ) LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;

    -- 2. Drop ALL policies on tables that reference 'profile' (to allow type changes)
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('profile', 'posts', 'comments', 'likes', 'messages', 'jobs', 'notifications')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 3. Change column types to TEXT for all known tables/columns
-- Profile table
ALTER TABLE profile ALTER COLUMN id TYPE text;

-- Posts
ALTER TABLE IF EXISTS posts ALTER COLUMN user_id TYPE text;

-- Comments
ALTER TABLE IF EXISTS comments ALTER COLUMN user_id TYPE text;

-- Likes
ALTER TABLE IF EXISTS likes ALTER COLUMN user_id TYPE text;

-- Messages
ALTER TABLE IF EXISTS messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE IF EXISTS messages ALTER COLUMN receiver_id TYPE text;

-- Jobs
ALTER TABLE IF EXISTS jobs ALTER COLUMN user_id TYPE text;

-- Notifications
ALTER TABLE IF EXISTS notifications ALTER COLUMN sender_id TYPE text;
ALTER TABLE IF EXISTS notifications ALTER COLUMN receiver_id TYPE text;

-- 4. SEARCH AND FIX ANY REMAINING UUID COLUMNS THAT WERE FKs
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'uuid' 
        AND column_name IN ('user_id', 'profile_id', 'sender_id', 'receiver_id', 'author_id')
        AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public')
    ) LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ALTER COLUMN %I TYPE text', r.table_name, r.column_name);
    END LOOP;
END $$;

-- 5. Add Ethereum support
ALTER TABLE profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 6. RESTORE KNOWN FOREIGN KEYS
ALTER TABLE IF EXISTS posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 7. RECREATE ESSENTIAL RLS POLICIES
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
