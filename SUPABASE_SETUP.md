# Supabase Database Setup Guide

This guide will help you set up your Supabase database to enable the like button functionality and other features.

## Issue: Like Button Not Working

If the like button is clickable but not persisting to the database, you need to set up the proper table structure and Row Level Security (RLS) policies in Supabase.

## Setup Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to the "SQL Editor" tab
3. Click "New Query" to create a new query

### Step 2: Run the Setup Scripts

Run each of the following SQL scripts in order:

#### 1. Posts Table Setup
Copy and paste the contents of `supabase_setup_posts.sql` and run it. This ensures the posts table is properly configured.

#### 2. Likes Table Setup  
Copy and paste the contents of `supabase_setup_likes.sql` and run it. This creates the likes table with proper RLS policies.

#### 3. Notifications Table Setup
Copy and paste the contents of `supabase_setup_notifications.sql` and run it. This creates the notifications table for like/comment notifications.

#### 4. Storage Bucket Setup
Copy and paste the contents of `supabase_setup_storage.sql` and run it. This creates the `post-images` storage bucket and configures its public read/write RLS policies.

### Step 3: Verify Tables

After running the scripts, verify that the tables exist:

1. Go to the "Table Editor" tab in Supabase
2. You should see: `posts`, `likes`, and `notifications` tables
3. Click on each table to verify the structure

### Step 4: Test the Like Button

1. Run your app
2. Try liking a post
3. Check the browser console for any error messages
4. Verify the like persists in the Supabase likes table

## Common Issues and Solutions

### Issue: "permission denied for table likes"
**Solution:** Make sure you ran the likes table setup script and that RLS is properly configured.

### Issue: "null value in column "user_id" violates not-null constraint"
**Solution:** Ensure the user is authenticated before liking. The app checks for `currentUserId` before allowing likes.

### Issue: "duplicate key value violates unique constraint"
**Solution:** This is normal - the unique constraint prevents duplicate likes. The app should handle this gracefully.

### Issue: Likes appear but disappear after refresh
**Solution:** Check the Supabase logs for any RLS policy violations and ensure the policies match the user's auth.uid().

## Database Schema Reference

### likes table
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `post_id` (UUID, references posts)
- `created_at` (timestamp)

### notifications table
- `id` (UUID, primary key)
- `receiver_id` (UUID, references auth.users)
- `sender_id` (UUID, references auth.users)
- `post_id` (UUID, references posts, nullable)
- `type` (text: 'like', 'comment', 'follow')
- `content` (text)
- `read` (boolean, default false)
- `created_at` (timestamp)

### posts table
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `content` (text)
- `image_url` (text, nullable)
- `created_at` (timestamp)

## Additional Notes

- The app uses optimistic UI updates, so likes appear immediately in the UI
- Database operations happen in the background
- If database operations fail, the UI rolls back and shows an error
- All tables use Row Level Security for proper data protection