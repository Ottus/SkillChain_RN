-- Supabase Setup for Jobs and Image Storage
-- Run this in your Supabase SQL Editor to fix the job posting and image uploading issues.

-- 1. Ensure the jobs table has an image_url column
ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Enable Row Level Security (RLS) on jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies on jobs if they exist
DROP POLICY IF EXISTS "Allow public jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow public jobs selection" ON public.jobs;
DROP POLICY IF EXISTS "Allow all job creation" ON public.jobs;
DROP POLICY IF EXISTS "Allow job updates" ON public.jobs;

-- 4. Create Privy-friendly policies for the jobs table
-- (Since Privy handles authentication client-side, the database session is anon)
CREATE POLICY "Allow public jobs selection" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Allow all job creation" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow job updates" ON public.jobs FOR UPDATE USING (true);

-- 5. Ensure the 'post-images' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 6. Create policies to allow public reads and inserts for the 'post-images' bucket
DROP POLICY IF EXISTS "Allow public select on post-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert on post-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on post-images" ON storage.objects;

CREATE POLICY "Allow public select on post-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "Allow public insert on post-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Allow public update on post-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'post-images');
