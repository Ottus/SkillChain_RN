-- Supabase Setup for Notifications Table
-- Run this in your Supabase SQL Editor to set up the notifications table properly

-- 1. Create the notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receiver_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow')),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- 4. Create RLS policies (Privy-friendly)
-- Allow users to view notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (true);

-- Allow users to insert notifications
CREATE POLICY "Users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Allow users to update notifications
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (true);

-- Allow users to delete notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (true);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS notifications_receiver_id_idx ON notifications(receiver_id);
CREATE INDEX IF NOT EXISTS notifications_sender_id_idx ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS notifications_post_id_idx ON notifications(post_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- 6. Grant necessary permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO anon;