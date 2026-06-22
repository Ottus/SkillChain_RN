-- Supabase Setup for Likes Table
-- Run this in your Supabase SQL Editor to set up the likes table properly

-- 1. Create the likes table if it doesn't exist
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, post_id) -- Prevent duplicate likes
);

-- 2. Enable Row Level Security
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;

-- 4. Create RLS policies
-- Allow users to see all likes (needed for counting)
CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  USING (true);

-- Allow users to insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes(post_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON likes(user_id);
CREATE INDEX IF NOT EXISTS likes_user_post_idx ON likes(user_id, post_id);

-- 6. Grant necessary permissions
GRANT ALL ON likes TO authenticated;
GRANT ALL ON likes TO anon;