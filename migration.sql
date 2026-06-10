-- migration.sql (NUCLEAR VERSION)
-- Use this if all previous versions failed.
-- This script clears ALL dependencies and converts ALL UUIDs to TEXT.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. DROP ALL FOREIGN KEYS in the public schema
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;

    -- 2. DROP ALL POLICIES in the public schema
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    -- 3. CONVERT EVERY UUID COLUMN TO TEXT (The Nuclear Step)
    -- This ensures we don't miss any columns like 'profile_id', 'author_id', etc.
    FOR r IN (
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'uuid' AND table_schema = 'public'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text', r.table_name, r.column_name);
    END LOOP;
END $$;

-- 4. Add Ethereum support
ALTER TABLE IF EXISTS public.profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 5. RESTORE CRITICAL FOREIGN KEYS
-- Note: We only restore the ones we are 100% sure about. 
-- If you have others, they will need to be added manually or you can leave them as TEXT without a formal FK.
ALTER TABLE IF EXISTS public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 6. RECREATE ESSENTIAL RLS POLICIES
-- Profile
CREATE POLICY "Public profiles are viewable by everyone" ON public.profile FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profile FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Users can insert their own profile" ON public.profile FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid()::text = user_id);

-- Messages
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT 
USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT 
WITH CHECK (auth.uid()::text = sender_id);
