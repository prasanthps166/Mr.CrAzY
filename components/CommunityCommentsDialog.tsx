"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { CommunityCommentView } from "@/types";

type CommunityCommentsDialogProps = {
  postId: string;
};

export function CommunityCommentsDialog({ postId }: CommunityCommentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommunityCommentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const getToken = useCallback(async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, [supabase]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const response = await fetch(`/api/community/comments?postId=${encodeURIComponent(postId)}&limit=60`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not load comments");
      return;
    }

    setComments((payload.comments as CommunityCommentView[]) ?? []);
  }, [getToken, postId]);

  async function addComment() {
    const text = commentText.trim();
    if (!text) return;
    if (text.length > 500) {
      toast.error("Comment must be 500 characters or fewer");
      return;
    }

    const token = await getToken();
    if (!token) {
      toast.error("Login to comment");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/community/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        postId,
        commentText: text,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      toast.error(payload.message || "Could not post comment");
      return;
    }

    const nextComment = payload.comment as CommunityCommentView | undefined;
    if (nextComment) {
      setComments((current) => [nextComment, ...current]);
    }
    setCommentText("");
  }

  async function deleteComment(commentId: string) {
    const token = await getToken();
    if (!token) {
      toast.error("Login required");
      return;
    }

    setDeletingCommentId(commentId);
    const response = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    setDeletingCommentId(null);

    if (!response.ok) {
      toast.error(payload.message || "Could not delete comment");
      return;
    }

    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void loadComments();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <MessageCircle className="h-4 w-4" />
          Comment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>Join the conversation on this transformation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Write a comment..."
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{commentText.length}/500</p>
            <Button onClick={() => void addComment()} disabled={submitting || !commentText.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Comment"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-border/60 bg-card/60 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{comment.username}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </p>
                    {comment.is_owner ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => void deleteComment(comment.id)}
                        disabled={deletingCommentId === comment.id}
                      >
                        {deletingCommentId === comment.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{comment.comment_text}</p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
