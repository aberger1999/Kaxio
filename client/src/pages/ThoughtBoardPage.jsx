import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, MessageSquare, Trash2, ChevronUp, ChevronDown,
  ArrowLeft, X, Clock, TrendingUp, Flame,
} from 'lucide-react';
import { thoughtsApi } from '../api/client';
import TagSelector from '../components/TagSelector';

function relativeTime(iso) {
  const now = new Date();
  const then = new Date(iso);
  const diff = Math.floor((now - then) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

// ── Vote Controls ───────────────────────────────────────

function VoteControls({ targetType, targetId, score, userVote, compact }) {
  const qc = useQueryClient();

  const voteMut = useMutation({
    mutationFn: (value) => thoughtsApi.vote({ targetType, targetId, value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thought-posts'] });
      qc.invalidateQueries({ queryKey: ['thought-post'] });
    },
  });

  const btnClass = compact ? 'p-0.5' : 'p-1';
  const iconSize = compact ? 14 : 18;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); voteMut.mutate(1); }}
        className={`${btnClass} rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
          userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'
        }`}
      >
        <ChevronUp size={iconSize} />
      </button>
      <span className={`text-xs font-bold ${
        score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : 'text-gray-400'
      }`}>
        {score}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); voteMut.mutate(-1); }}
        className={`${btnClass} rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
          userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
        }`}
      >
        <ChevronDown size={iconSize} />
      </button>
    </div>
  );
}

// ── Community Sidebar ───────────────────────────────────

function CommunitySidebar({ communities, selected, onSelect, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const createMut = useMutation({
    mutationFn: thoughtsApi.createCommunity,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['communities'] });
      setName('');
      setCreating(false);
      if (onCreated) onCreated(data);
    },
  });

  const deleteMut = useMutation({
    mutationFn: thoughtsApi.deleteCommunity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['thought-posts'] });
      if (selected) onSelect(null);
    },
  });

  return (
    <div className="w-56 shrink-0 bg-slate-100 dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b dark:border-slate-800">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Communities
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
            !selected
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'
          }`}
        >
          All
        </button>
        {communities.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center px-4 py-2 text-sm cursor-pointer transition-colors ${
              selected === c.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'
            }`}
            onClick={() => onSelect(c.id)}
          >
            <span className="flex-1 truncate">r/{c.name}</span>
            <span className="text-xs text-gray-400 mr-1">{c.postCount}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete r/${c.name} and all its posts?`)) {
                  deleteMut.mutate(c.id);
                }
              }}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t dark:border-slate-800">
        {creating ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) createMut.mutate(name.trim());
                if (e.key === 'Escape') { setCreating(false); setName(''); }
              }}
              placeholder="Community name..."
              className="flex-1 text-xs px-2 py-1.5 border dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white outline-none"
            />
            <button
              onClick={() => { setCreating(false); setName(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-dark py-1.5"
          >
            <Plus size={14} /> Create Community
          </button>
        )}
      </div>
    </div>
  );
}

// ── Post Card ───────────────────────────────────────────

function PostCard({ post, onClick }) {
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => thoughtsApi.deletePost(post.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['thought-posts'] }),
  });

  const tags = post.tags ? post.tags.split(',').filter(Boolean) : [];

  return (
    <div
      onClick={onClick}
      className="card-elevated flex gap-3 p-4 bg-white dark:bg-slate-900 border dark:border-slate-800/80 rounded-xl cursor-pointer hover:border-primary/30 dark:hover:border-primary/30 transition-colors"
    >
      <VoteControls
        targetType="post"
        targetId={post.id}
        score={post.voteScore}
        userVote={0}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-primary font-medium">r/{post.communityName}</span>
          <span className="text-xs text-gray-400">{relativeTime(post.createdAt)}</span>
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
          {post.title}
        </h3>
        {post.body && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
            {post.body}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <MessageSquare size={12} /> {post.commentCount} comments
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Delete this post?')) deleteMut.mutate();
            }}
            className="hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Post Modal ──────────────────────────────────────

function NewPostModal({ communities, onClose }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [communityId, setCommunityId] = useState(communities[0]?.id || '');
  const [tags, setTags] = useState([]);

  const createMut = useMutation({
    mutationFn: thoughtsApi.createPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thought-posts'] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !communityId) return;
    createMut.mutate({
      title: title.trim(),
      body,
      communityId,
      tags: tags.join(','),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-modal" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800/80 w-full max-w-lg mx-4 p-6"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Post</h2>

        <div className="space-y-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full text-sm border dark:border-slate-600 rounded-lg px-3 py-2 dark:bg-slate-800 dark:text-white outline-none focus:border-primary"
          />

          <select
            value={communityId}
            onChange={(e) => setCommunityId(Number(e.target.value))}
            className="w-full text-sm border dark:border-slate-600 rounded-lg px-3 py-2 dark:bg-slate-800 dark:text-white outline-none"
          >
            <option value="">Select community...</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>r/{c.name}</option>
            ))}
          </select>

          <TagSelector selectedTags={tags} onChange={setTags} />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind? (optional)"
            rows={6}
            className="w-full text-sm border dark:border-slate-600 rounded-lg px-3 py-2 dark:bg-slate-800 dark:text-white outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !communityId}
            className="text-sm px-4 py-2 rounded-lg btn-gradient text-white disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reply Box ───────────────────────────────────────────

function ReplyBox({ postId, parentId, onDone }) {
  const [body, setBody] = useState('');
  const qc = useQueryClient();
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const createMut = useMutation({
    mutationFn: (data) => thoughtsApi.createComment(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['thought-post', postId] });
      setBody('');
      if (onDone) onDone();
    },
  });

  const handleSubmit = () => {
    if (!body.trim()) return;
    createMut.mutate({ body: body.trim(), parentId: parentId || null });
  };

  return (
    <div className="flex gap-2 mt-2">
      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
        }}
        placeholder="Write a reply..."
        rows={2}
        className="flex-1 text-sm border dark:border-slate-600 rounded-lg px-3 py-2 dark:bg-slate-800 dark:text-white outline-none focus:border-primary resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!body.trim()}
        className="self-end text-xs px-3 py-2 rounded-lg btn-gradient text-white disabled:opacity-40"
      >
        Reply
      </button>
    </div>
  );
}

// ── Comment Item ────────────────────────────────────────

function CommentItem({ comment, postId, commentVotes, depth }) {
  const [replying, setReplying] = useState(false);
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => thoughtsApi.deleteComment(comment.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['thought-post', postId] }),
  });

  return (
    <div className={depth > 0 ? 'ml-6 pl-3 border-l-2 border-gray-200 dark:border-slate-700' : ''}>
      <div className="flex gap-2 py-2">
        <VoteControls
          targetType="comment"
          targetId={comment.id}
          score={comment.voteScore}
          userVote={commentVotes[comment.id] || 0}
          compact
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{comment.body}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{relativeTime(comment.createdAt)}</span>
            <button
              onClick={() => setReplying(!replying)}
              className="hover:text-primary transition-colors"
            >
              Reply
            </button>
            <button
              onClick={() => { if (window.confirm('Delete this comment?')) deleteMut.mutate(); }}
              className="hover:text-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
          {replying && (
            <ReplyBox postId={postId} parentId={comment.id} onDone={() => setReplying(false)} />
          )}
        </div>
      </div>
      {comment.children?.map((child) => (
        <CommentItem
          key={child.id}
          comment={child}
          postId={postId}
          commentVotes={commentVotes}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Post Detail ─────────────────────────────────────────

function PostDetail({ postId, onBack }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ['thought-post', postId],
    queryFn: () => thoughtsApi.getPost(postId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!post) return null;

  // Build comment tree from flat list
  const commentMap = {};
  const roots = [];
  for (const c of post.comments || []) {
    commentMap[c.id] = { ...c, children: [] };
  }
  for (const c of Object.values(commentMap)) {
    if (c.parentId && commentMap[c.parentId]) {
      commentMap[c.parentId].children.push(c);
    } else {
      roots.push(c);
    }
  }

  const tags = post.tags ? post.tags.split(',').filter(Boolean) : [];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary mb-4"
      >
        <ArrowLeft size={16} /> Back to feed
      </button>

      <div className="card-elevated bg-white dark:bg-slate-900 border dark:border-slate-800/80 rounded-xl p-5">
        <div className="flex gap-4">
          <VoteControls
            targetType="post"
            targetId={post.id}
            score={post.voteScore}
            userVote={post.userVote || 0}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-primary font-medium">r/{post.communityName}</span>
              <span className="text-xs text-gray-400">{relativeTime(post.createdAt)}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{post.title}</h1>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {post.body && (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-4">{post.body}</p>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="border-t dark:border-slate-800 mt-4 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Comments ({post.comments?.length || 0})
          </h3>
          <ReplyBox postId={post.id} parentId={null} />
          <div className="mt-4 space-y-1">
            {roots.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                postId={post.id}
                commentVotes={post.commentVotes || {}}
                depth={0}
              />
            ))}
            {roots.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No comments yet. Be the first!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post Feed ───────────────────────────────────────────

function PostFeed({ selectedCommunity, communities, initialPostId }) {
  const [sort, setSort] = useState('new');
  const [showNewPost, setShowNewPost] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(initialPostId);

  useEffect(() => {
    setSelectedPostId(initialPostId);
  }, [initialPostId]);

  const params = {};
  if (selectedCommunity) params.community = selectedCommunity;
  params.sort = sort;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['thought-posts', selectedCommunity, sort],
    queryFn: () => thoughtsApi.getPosts(params),
  });

  if (selectedPostId) {
    return (
      <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />
    );
  }

  const sortOptions = [
    { key: 'new', icon: Clock, label: 'New' },
    { key: 'top', icon: TrendingUp, label: 'Top' },
    { key: 'hot', icon: Flame, label: 'Hot' },
  ];

  return (
    <div>
      {/* Sort bar + New Post */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg p-1">
          {sortOptions.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md transition-colors ${
                sort === key
                  ? 'bg-primary text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          disabled={communities.length === 0}
          className="flex items-center gap-1 text-sm px-4 py-2 btn-gradient text-white rounded-lg disabled:opacity-40"
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {communities.length === 0
              ? 'Create a community to get started'
              : 'No posts yet. Be the first to share a thought!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
          ))}
        </div>
      )}

      {showNewPost && (
        <NewPostModal communities={communities} onClose={() => setShowNewPost(false)} />
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────

export default function ThoughtBoardPage() {
  const [searchParams] = useSearchParams();
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const initialPostId = searchParams.get('postId');

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: thoughtsApi.getCommunities,
  });

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <CommunitySidebar
        communities={communities}
        selected={selectedCommunity}
        onSelect={setSelectedCommunity}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Thought Board</h1>
          <PostFeed
            selectedCommunity={selectedCommunity}
            communities={communities}
            initialPostId={initialPostId}
          />
        </div>
      </div>
    </div>
  );
}
