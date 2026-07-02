-- Supabase Storage Setup for post-images Bucket
-- Run this in your Supabase SQL Editor to set up the image uploading storage.

-- 1. Ensure the 'post-images' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create policies to allow public reads and inserts for the 'post-images' bucket
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
