-- Supabase Setup for Posts Table
-- Run this in your Supabase SQL Editor to ensure the posts table is properly set up

-- 1. Create the posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- 4. Create RLS policies
-- Allow everyone to view posts
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

-- Allow authenticated users to create posts
CREATE POLICY "Users can create their own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own posts
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to delete their own posts
CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);

-- 6. Grant necessary permissions
GRANT ALL ON posts TO authenticated;
GRANT SELECT ON posts TO anon;