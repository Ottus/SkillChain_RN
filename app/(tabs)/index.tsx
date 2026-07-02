import { Cache } from '@/constants/Cache';
import { supabase } from '@/constants/Supabase';
import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { usePrivy } from '@privy-io/expo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Buffer } from 'buffer';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profile: {
    full_name: string;
    avatar_url: string;
    solana_address: string;
  } | null;
}

interface Like {
  id: string;
  user_id: string;
  post_id: string;
}

interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  profile: {
    full_name: string;
    avatar_url: string;
  } | null;
}

export default function HomeFeedScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  // Feed states
  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Interaction states
  const [activeSharePostId, setActiveSharePostId] = useState<string | null>(null);
  const [showCommentsPostId, setShowCommentsPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Create Post states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createContent, setCreateContent] = useState('');
  const [createImageUri, setCreateImageUri] = useState<string | null>(null);
  const [submittingPost, setSubmittingPost] = useState(false);

  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await refreshFeed();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load feed data.');
    }
  }, [user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const refreshFeed = async () => {
    try {
      await Cache.fetchWithSWR(
        'home_feed_data',
        async () => {
          // 1. Fetch Posts
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select(`
              id,
              content,
              image_url,
              created_at,
              user_id,
              profile:profile!posts_user_id_fkey(
                full_name,
                avatar_url,
                solana_address
              )
            `)
            .order('created_at', { ascending: false });

          if (postsError) throw postsError;

          // 2. Fetch Likes
          const { data: likesData, error: likesError } = await supabase
            .from('likes')
            .select('id, user_id, post_id');

          if (likesError) throw likesError;

          // 3. Fetch Comments
          const { data: commentsData, error: commentsError } = await supabase
            .from('comments')
            .select(`
              id,
              user_id,
              post_id,
              content,
              created_at,
              profile:profile!comments_user_id_fkey(
                full_name,
                avatar_url
              )
            `)
            .order('created_at', { ascending: true });

          if (commentsError) throw commentsError;

          return {
            posts: postsData || [],
            likes: likesData || [],
            comments: commentsData || []
          };
        },
        (data) => {
          setPosts(data.posts as any);
          setLikes(data.likes || []);
          setComments(data.comments as any);
        },
        () => {
          setLoading(false);
        }
      );
    } catch (e: any) {
      console.error('Error refreshing feed:', e);
      setLoading(false);
    }
  };

  // Like management
  const handleLikeToggle = async (post: Post) => {
    if (!user) {
      console.log('Like failed: No user from Privy');
      Alert.alert('Error', 'You must be logged in to like posts');
      return;
    }

    const existingLike = likes.find(l => l.post_id === post.id && l.user_id === user.id);
    console.log('Like toggle attempt:', { postId: post.id, userId: user.id, existingLike: !!existingLike });

    try {
      if (existingLike) {
        // Optimistic State Update for DELETE
        setLikes(prev => prev.filter(l => l.id !== existingLike.id));
        
        console.log('Deleting like:', existingLike.id);
        const { error } = await supabase.from('likes').delete().eq('id', existingLike.id);
        if (error) {
          console.error('Delete like error:', error);
          throw error;
        }
        console.log('Like deleted successfully');
      } else {
        // Optimistic State Update for INSERT
        const tempLike = {
          id: `temp-${Date.now()}`,
          post_id: post.id,
          user_id: user.id
        };
        setLikes(prev => [...prev, tempLike]);

        const newLike = {
          post_id: post.id,
          user_id: user.id
        };
        
        console.log('Inserting like:', newLike);
        // Insert
        const { data, error } = await supabase
          .from('likes')
          .insert(newLike)
          .select()
          .single();

        if (error) {
          console.error('Insert like error:', error);
          throw error;
        }
        
        console.log('Like inserted successfully:', data);
        
        if (data) {
          // Replace temp like with real like from database
          setLikes(prev => prev.map(l => l.id === tempLike.id ? data : l));
          
          // Send notification to author (optional - don't fail if this doesn't work)
          if (post.user_id !== user.id) {
            console.log('Sending notification to author:', post.user_id);
            try {
              await supabase.from('notifications').insert({
                receiver_id: post.user_id,
                sender_id: user.id,
                type: 'like',
                post_id: post.id,
                content: 'liked your post'
              });
            } catch (notifError) {
              console.warn('Notification failed (non-critical):', notifError);
              // Don't throw - notification failure shouldn't break the like functionality
            }
          }
        }
      }
    } catch (e: any) {
      console.error('Like error:', e);
      Alert.alert('Like Error', e.message || 'Failed to like post. Please try again.');
      refreshFeed(); // Rollback/Resync
    }
  };

  // Comment management
  const handleAddComment = async (post: Post) => {
    if (!newCommentText.trim() || !user) return;
    setSubmittingComment(true);

    try {
      const newComment = {
        post_id: post.id,
        user_id: user.id,
        content: newCommentText.trim()
      };

      const { data, error } = await supabase
        .from('comments')
        .insert(newComment)
        .select(`
          id,
          user_id,
          post_id,
          content,
          created_at,
          profile:profile!comments_user_id_fkey(
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        setComments(prev => [...prev, data as any]);
        setNewCommentText('');
        
        // Notify Author (optional - don't fail if this doesn't work)
        if (post.user_id !== user.id) {
          try {
            await supabase.from('notifications').insert({
              receiver_id: post.user_id,
              sender_id: user.id,
              type: 'comment',
              post_id: post.id,
              content: `commented: "${newCommentText.substring(0, 30)}..."`
            });
          } catch (notifError) {
            console.warn('Notification failed (non-critical):', notifError);
            // Don't throw - notification failure shouldn't break the comment functionality
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Comment Error', e.message || 'Could not post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Image Picker & Upload
  const handleSelectImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      setCreateImageUri(result.assets[0].uri);
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert Blob to ArrayBuffer using FileReader and Buffer (React Native friendly)
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
          } else {
            reject(new Error('Failed to read blob as base64'));
          }
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsDataURL(blob);
      });
      
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('post-images')
        .upload(fileName, arrayBuffer, {
          contentType: blob.type || 'image/jpeg',
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (e: any) {
      console.error('Error during image upload:', e);
      Alert.alert('Upload Error', `Failed to upload image: ${e.message || e}`);
      return null;
    }
  };

  // Post Submission
  const handlePublishPost = async () => {
    if (!user) return;
    if (!createContent.trim() && !createImageUri) {
      Alert.alert('Error', 'Post content cannot be empty.');
      return;
    }
    setSubmittingPost(true);

    try {
      let finalImageUrl = null;
      if (createImageUri) {
        finalImageUrl = await uploadImageToStorage(createImageUri);
        if (!finalImageUrl) {
          setSubmittingPost(false);
          return;
        }
      }

      const newPost = {
        user_id: user.id,
        content: createContent.trim(),
        image_url: finalImageUrl
      };

      const { error } = await supabase.from('posts').insert(newPost);
      if (error) throw error;

      setShowCreateModal(false);
      setCreateContent('');
      setCreateImageUri(null);
      
      // Refresh List
      refreshFeed();
      Alert.alert('Success', 'Post published successfully!');
    } catch (e: any) {
      Alert.alert('Publish Error', e.message || 'Could not publish post.');
    } finally {
      setSubmittingPost(false);
    }
  };

  // Social Sharing intents
  const handleShareOption = (post: Post, platform: 'whatsapp' | 'twitter') => {
    setActiveSharePostId(null);
    const postUrl = `https://skillchain.app/posts/${post.id}`;
    const shareText = `Check out ${post.profile?.full_name || 'User'}'s post on SkillChain:\n\n"${post.content.substring(0, 100)}..."\n\nRead more at ${postUrl}`;
    
    let url = '';
    if (platform === 'whatsapp') {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    } else {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    }

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Share', shareText);
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SkillChain</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching Feed...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={60} color="#9CA3AF" />
              <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
            </View>
          ) : (
            posts.map((post) => {
              const postLikes = likes.filter(l => l.post_id === post.id);
              const isLiked = likes.some(l => l.post_id === post.id && l.user_id === user?.id);
              const postComments = comments.filter(c => c.post_id === post.id);
              return (
                <Animated.View 
                  key={post.id} 
                  entering={FadeIn.duration(500)} 
                  style={styles.postCard}
                >
                  {/* User Info Header */}
                  <View style={styles.postHeader}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatarText}>
                        {(post.profile?.full_name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.username}>{post.profile?.full_name || 'Anonymous User'}</Text>
                      <Text style={styles.postDate}>
                        {new Date(post.created_at).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Post Content */}
                  <Text style={styles.postBody}>{post.content}</Text>

                  {/* Optional Image */}
                  {post.image_url && (
                    <Image 
                      source={{ uri: post.image_url }} 
                      style={styles.postImage} 
                      resizeMode="cover"
                    />
                  )}

                  {/* Divider line before actions */}
                  <View style={styles.divider} />

                  {/* Post Actions */}
                  <View style={styles.postActions}>
                    <TouchableOpacity 
                      style={styles.actionItem}
                      onPress={() => handleLikeToggle(post)}
                    >
                      <Ionicons 
                        name={isLiked ? "thumbs-up" : "thumbs-up-outline"} 
                        size={20} 
                        color={isLiked ? "#2563EB" : "#4B5563"} 
                      />
                      <Text style={isLiked ? styles.actionTextActive : styles.actionText}>
                        {postLikes.length} {postLikes.length === 1 ? 'Like' : 'Likes'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionItem}
                      onPress={() => setShowCommentsPostId(post.id)}
                    >
                      <Ionicons name="chatbubble-outline" size={20} color="#4B5563" />
                      <Text style={styles.actionText}>
                        {postComments.length} {postComments.length === 1 ? 'Comment' : 'Comments'}
                      </Text>
                    </TouchableOpacity>

                    {/* NEW MESSAGE ACTION */}
                    {post.user_id !== user?.id && (
                      <TouchableOpacity 
                        style={styles.actionItem}
                        onPress={() => router.push({
                          pathname: '/chat-detail',
                          params: { userId: post.user_id, name: post.profile?.full_name || 'User' }
                        })}
                      >
                        <Ionicons name="chatbubbles-outline" size={20} color="#4B5563" />
                        <Text style={styles.actionText}>Message</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.shareContainer}>
                      <TouchableOpacity 
                        style={styles.shareItem}
                        onPress={() => setActiveSharePostId(activeSharePostId === post.id ? null : post.id)}
                      >
                        <Ionicons name="share-social" size={20} color="#4B5563" />
                      </TouchableOpacity>

                      {/* Share Popover */}
                      {activeSharePostId === post.id && (
                        <Animated.View entering={FadeIn.duration(200)} style={styles.sharePopover}>
                          <TouchableOpacity 
                            style={styles.popoverItem}
                            onPress={() => handleShareOption(post, 'whatsapp')}
                          >
                            <Text style={styles.popoverText}>WhatsApp</Text>
                          </TouchableOpacity>
                          <View style={styles.popoverDivider} />
                          <TouchableOpacity 
                            style={styles.popoverItem}
                            onPress={() => handleShareOption(post, 'twitter')}
                          >
                            <Text style={styles.popoverText}>Twitter (X)</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* CREATE POST MODAL */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp} style={styles.modalContent}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Post</Text>
                <TouchableOpacity 
                  style={styles.postBtn}
                  onPress={handlePublishPost}
                  disabled={submittingPost}
                >
                  {submittingPost ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.postBtnText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Input fields */}
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <TextInput
                  style={styles.postInput}
                  placeholder="What is on your mind?"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={createContent}
                  onChangeText={setCreateContent}
                />

                {createImageUri && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: createImageUri }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => setCreateImageUri(null)}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Add Attachment triggers */}
                <TouchableOpacity 
                  style={styles.addImageRow}
                  onPress={handleSelectImage}
                >
                  <Ionicons name="image-outline" size={22} color="#4F46E5" />
                  <Text style={styles.addImageText}>
                    {createImageUri ? 'Change Accompanying Image' : 'Add Accompanying Image'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>

      {/* COMMENTS MODAL */}
      <Modal
        visible={showCommentsPostId !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentsPostId(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContent, { height: '80%' }]}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCommentsPostId(null)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Comments</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Comments List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.commentsScroll}>
              {showCommentsPostId && comments.filter(c => c.post_id === showCommentsPostId).length === 0 ? (
                <Text style={styles.noCommentsText}>No comments yet. Start the conversation!</Text>
              ) : (
                showCommentsPostId && comments.filter(c => c.post_id === showCommentsPostId).map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>
                          {(comment.profile?.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.commentInfo}>
                        <Text style={styles.commentUser}>{comment.profile?.full_name || 'User'}</Text>
                        <Text style={styles.commentDate}>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.commentBody}>{comment.content}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Comment Input Footer */}
            <View style={styles.commentInputFooter}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#9CA3AF"
                value={newCommentText}
                onChangeText={setNewCommentText}
              />
              <TouchableOpacity 
                style={styles.sendCommentBtn}
                onPress={() => {
                  const targetPost = posts.find(p => p.id === showCommentsPostId);
                  if (targetPost) handleAddComment(targetPost);
                }}
                disabled={submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={26} color="#1F2937" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 16,
    backgroundColor: Theme.colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  notificationButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 16,
  },
  postCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  userInfo: {
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  postDate: {
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  postBody: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 14,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  actionTextActive: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  shareContainer: {
    position: 'relative',
    zIndex: 10,
  },
  shareItem: {
    padding: 4,
  },
  sharePopover: {
    position: 'absolute',
    right: 0,
    bottom: 32,
    backgroundColor: '#EAEAF2',
    borderRadius: 12,
    paddingVertical: 8,
    width: 140,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    zIndex: 20,
  },
  popoverItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  popoverText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  popoverDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCE4F9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  postBtn: {
    backgroundColor: '#405B8F',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  postBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalScroll: {
    padding: 24,
    gap: 16,
  },
  postInput: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  addImageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  commentsScroll: {
    padding: 24,
    gap: 16,
  },
  noCommentsText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 40,
    fontWeight: '500',
  },
  commentCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCE4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  commentInfo: {
    marginLeft: 10,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  commentDate: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  commentBody: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },
  commentInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#EAEAF2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  sendCommentBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#405B8F',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
