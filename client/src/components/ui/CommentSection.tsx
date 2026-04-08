"use client";
import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarUrl?: string };
}

interface CommentSectionProps {
  entityType: "TRAINING" | "SCRIM" | "STRAT" | "MATCH" | "LINEUP" | "REPLAY";
  entityId: string;
}

export function CommentSection({ entityType, entityId }: CommentSectionProps) {
  const { user } = useAuthStore();
  const { success, error } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Comment[]>(`/api/comments?entityType=${entityType}&entityId=${entityId}`);
      if (res.data) setComments(res.data);
    } catch { /* ignore */ }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/api/comments", { content: text.trim(), entityType, entityId });
      setText("");
      load();
    } catch { error("Fehler beim Senden"); }
    finally { setSending(false); }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/comments/${id}`);
      load();
    } catch { error("Fehler beim Löschen"); }
  };

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="text-sm font-medium text-[var(--foreground)]">Kommentare ({comments.length})</span>
      </div>

      {comments.length > 0 && (
        <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 rounded-lg bg-[var(--secondary)] p-2.5">
              {c.user.avatarUrl ? (
                <img src={c.user.avatarUrl} alt="" className="h-6 w-6 rounded-full shrink-0 mt-0.5" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-xs font-bold text-[var(--primary)] shrink-0 mt-0.5">
                  {c.user.displayName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--foreground)]">{c.user.displayName}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{c.content}</p>
              </div>
              {(c.user.id === user?.id || user?.isAdmin) && (
                <button onClick={() => remove(c.id)} className="shrink-0 rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Kommentar schreiben..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-white disabled:opacity-50 hover:bg-orange-600 transition-colors">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
