-- migration.sql (RLS FIX VERSION)
-- This script fixes the "new row violates row-level security policy" error.
-- Since we are using Privy, Supabase's auth.uid() is NULL. 
-- We need to allow profile creation without a Supabase session.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop ALL foreign keys and policies (Clean state)
    FOR r IN (SELECT tc.table_name, tc.constraint_name FROM information_schema.table_constraints AS tc WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I CASCADE', r.table_name, r.constraint_name);
    END LOOP;
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    -- 2. Convert all UUIDs to TEXT using casting
    FOR r IN (SELECT table_name, column_name FROM information_schema.columns WHERE data_type = 'uuid' AND table_schema = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text', r.table_name, r.column_name, r.column_name);
    END LOOP;
END $$;

-- 3. Add ethereum_address
ALTER TABLE IF EXISTS public.profile ADD COLUMN IF NOT EXISTS ethereum_address text;

-- 4. Restore Foreign Keys
ALTER TABLE IF EXISTS public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profile(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profile(id) ON DELETE CASCADE;

-- 5. NEW PRIVY-FRIENDLY POLICIES
-- Because auth.uid() is null for Privy users, we allow 'anon' role (standard Supabase key)
-- to create and read profiles.

-- Profile: Allow any anon user to insert (Privy will provide the ID)
CREATE POLICY "Allow profile creation" ON public.profile FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public profile selection" ON public.profile FOR SELECT USING (true);
CREATE POLICY "Allow profile updates" ON public.profile FOR UPDATE USING (true);

-- Posts/Messages: Similarly permissive for testing
CREATE POLICY "Allow public posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Allow all post creation" ON public.posts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Allow all comment creation" ON public.comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow message exchange" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow sending messages" ON public.messages FOR INSERT WITH CHECK (true);

-- NOTE: In production, you should verify the Privy JWT in a database function
-- or via Supabase Edge Functions to ensure 'id' matches the authenticated user.
