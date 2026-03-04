import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  addCommunityComment,
  deleteCommunityComment,
  followUser,
  getCommunityComments,
  getCommunityPost,
  getFollowingUserIds,
  likeCommunityPost,
  unfollowUser,
} from "@/src/lib/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/providers/ThemeProvider";
import { CommunityComment, CommunityPost } from "@/src/types";

export default function CommunityPostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken, user } = useAuth();
  const { colors } = useTheme();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const token = await getAccessToken();
      if (!token || !id) {
        if (active) setLoading(false);
        return;
      }

      try {
        const [postPayload, commentsPayload, followingPayload] = await Promise.all([
          getCommunityPost(token, id),
          getCommunityComments(token, id, 60).catch(() => ({ comments: [] as CommunityComment[] })),
          getFollowingUserIds(token).catch(() => ({ followingUserIds: [] as string[] })),
        ]);

        if (!active) return;

        setPost(postPayload.post);
        setComments(commentsPayload.comments ?? []);
        setFollowing((followingPayload.followingUserIds ?? []).includes(postPayload.post.user_id));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [getAccessToken, id]);

  async function toggleFollow() {
    if (!post || post.user_id === user?.id) return;

    const token = await getAccessToken();
    if (!token) return;

    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(token, post.user_id);
      } else {
        await followUser(token, post.user_id);
      }
      setFollowing((current) => !current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update follow status";
      Alert.alert("Follow failed", message);
    } finally {
      setFollowLoading(false);
    }
  }

  async function likePost() {
    if (!post) return;

    const token = await getAccessToken();
    if (!token) return;

    const previousLikes = post.likes;
    setPost({ ...post, likes: previousLikes + 1 });

    try {
      const payload = await likeCommunityPost(token, post.id);
      setPost((current) => (current ? { ...current, likes: payload.likes } : current));
    } catch {
      setPost((current) => (current ? { ...current, likes: previousLikes } : current));
    }
  }

  async function submitComment() {
    if (!post) return;

    const token = await getAccessToken();
    const text = commentText.trim();
    if (!token || !text) return;

    if (text.length > 500) {
      Alert.alert("Comment too long", "Comments must be 500 characters or fewer.");
      return;
    }

    setSubmittingComment(true);
    try {
      const payload = await addCommunityComment(token, post.id, text);
      setComments((current) => [payload.comment, ...current]);
      setCommentText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not post comment";
      Alert.alert("Comment failed", message);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function removeComment(commentId: string) {
    const token = await getAccessToken();
    if (!token) return;

    setDeletingCommentId(commentId);
    try {
      await deleteCommunityComment(token, commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete comment";
      Alert.alert("Delete failed", message);
    } finally {
      setDeletingCommentId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}> 
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}> 
        <Text style={{ color: colors.muted }}>Post not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Image source={{ uri: post.generated_image_url }} style={styles.heroImage} />
      <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: "rgba(15,23,42,0.65)" }]}> 
        <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
      </Pressable>

      <ScrollView style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>{post.prompt_title}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{post.prompt_description ?? "Community post"}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>by {post.username} | {new Date(post.created_at).toLocaleDateString()}</Text>

        <View style={styles.actions}> 
          <View style={styles.leftActions}> 
            <Pressable onPress={() => void likePost()} style={[styles.likeButton, { borderColor: colors.border }]}> 
              <Text style={[styles.likeText, { color: colors.primary }]}>Like {post.likes}</Text>
            </Pressable>
            {post.user_id !== user?.id ? (
              <Pressable onPress={() => void toggleFollow()} style={[styles.followButton, { borderColor: colors.border }]}> 
                <Text style={[styles.followText, { color: colors.text }]}>{followLoading ? "..." : following ? "Following" : "Follow"}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}18` }]}> 
            <Text style={[styles.categoryText, { color: colors.primary }]}>{post.prompt_category}</Text>
          </View>
        </View>

        <View style={[styles.commentsCard, { borderColor: colors.border }]}> 
          <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={[
              styles.commentInput,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.background,
              },
            ]}
          />
          <View style={styles.commentComposerFooter}> 
            <Text style={[styles.commentCounter, { color: colors.muted }]}>{commentText.length}/500</Text>
            <Pressable
              onPress={() => void submitComment()}
              disabled={submittingComment || !commentText.trim()}
              style={[styles.commentSubmitButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.commentSubmitText}>{submittingComment ? "Posting..." : "Post"}</Text>
            </Pressable>
          </View>

          <View style={styles.commentList}> 
            {comments.length === 0 ? (
              <Text style={[styles.commentEmpty, { color: colors.muted }]}>No comments yet.</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={[styles.commentItem, { borderColor: colors.border }]}> 
                  <View style={styles.commentHeader}> 
                    <Text style={[styles.commentUser, { color: colors.text }]}>{comment.username}</Text>
                    <View style={styles.commentMetaActions}> 
                      <Text style={[styles.commentDate, { color: colors.muted }]}>{new Date(comment.created_at).toLocaleString()}</Text>
                      {comment.is_owner ? (
                        <Pressable onPress={() => void removeComment(comment.id)} disabled={deletingCommentId === comment.id}>
                          <Text style={[styles.commentDelete, { color: colors.primary }]}>{deletingCommentId === comment.id ? "..." : "Delete"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.commentBody, { color: colors.muted }]}>{comment.comment_text}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    width: "100%",
    height: 430,
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  followButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followText: {
    fontSize: 13,
    fontWeight: "700",
  },
  categoryBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentsCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  commentInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  commentComposerFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentCounter: {
    fontSize: 12,
    fontWeight: "600",
  },
  commentSubmitButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  commentSubmitText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  commentList: {
    marginTop: 12,
  },
  commentEmpty: {
    fontSize: 13,
  },
  commentItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  commentMetaActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentUser: {
    fontSize: 13,
    fontWeight: "700",
  },
  commentDate: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 8,
  },
  commentDelete: {
    fontSize: 12,
    fontWeight: "700",
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
