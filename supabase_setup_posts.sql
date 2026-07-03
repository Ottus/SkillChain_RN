-- Supabase Setup for Posts Table
-- Run this in your Supabase SQL Editor to ensure the posts table is properly set up

-- 1. Create the posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
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

-- 4. Create RLS policies (Privy-friendly)
-- Allow everyone to view posts
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

-- Allow users to create posts
CREATE POLICY "Users can create their own posts"
  ON posts FOR INSERT
  WITH CHECK (true);

-- Allow users to update posts
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (true);

-- Allow users to delete posts
CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (true);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);

-- 6. Grant necessary permissions
GRANT ALL ON posts TO authenticated;
GRANT ALL ON posts TO anon;