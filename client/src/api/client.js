const BASE = '/api';
const TOKEN_KEY = 'productivity_hub_token';
const SESSION_KEY = 'productivity_hub_session';
let refreshInFlight = null;

/**
 * Returns auth headers with Bearer token from localStorage.
 * Use this for any fetch call outside the standard request() pipeline (e.g. streaming).
 */
export function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthAndRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  // Only redirect if not already on login/register page
  if (
    !window.location.pathname.startsWith('/login')
    && !window.location.pathname.startsWith('/register')
    && !window.location.pathname.startsWith('/forgot-password')
    && !window.location.pathname.startsWith('/reset-password')
    && !window.location.pathname.startsWith('/verify-email')
  ) {
    window.location.href = '/login';
  }
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;

      const data = await res.json().catch(() => null);
      if (data?.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }
      if (data?.user) {
        const session = { ...data.user, isAuthenticated: true };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request(path, options = {}, allowRetry = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Refresh access token once on 401 for non-auth API requests.
  if (res.status === 401) {
    if (allowRetry && !path.startsWith('/auth/')) {
      const refreshed = await refreshAccessToken();
      if (refreshed?.token) {
        return request(path, options, false);
      }
    }
    clearAuthAndRedirect();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// Calendar
export const calendarApi = {
  getEvents: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return request(`/calendar?${params}`);
  },
  getEvent: (id) => request(`/calendar/${id}`),
  createEvent: (data) => request('/calendar', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id, data) => request(`/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEvent: (id) => request(`/calendar/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/calendar/categories'),
};

// Notes
export const notesApi = {
  getNotes: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/notes?${q}`);
  },
  getNote: (id) => request(`/notes/${id}`),
  createNote: (data) => request('/notes', { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
};

// Goals
export const goalsApi = {
  getGoals: () => request('/goals'),
  getGoal: (id) => request(`/goals/${id}`),
  createGoal: (data) => request('/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal: (id, data) => request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),
};

// Thoughts
export const thoughtsApi = {
  getCommunities: () => request('/thoughts/communities'),
  createCommunity: (name) => request('/thoughts/communities', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCommunity: (id) => request(`/thoughts/communities/${id}`, { method: 'DELETE' }),
  getPosts: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/thoughts/posts?${q}`);
  },
  getPost: (id) => request(`/thoughts/posts/${id}`),
  createPost: (data) => request('/thoughts/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost: (id, data) => request(`/thoughts/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost: (id) => request(`/thoughts/posts/${id}`, { method: 'DELETE' }),
  createComment: (postId, data) => request(`/thoughts/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteComment: (id) => request(`/thoughts/comments/${id}`, { method: 'DELETE' }),
  vote: (data) => request('/thoughts/vote', { method: 'POST', body: JSON.stringify(data) }),
};

// Tags
export const tagsApi = {
  getTags: () => request('/tags'),
  createTag: (name) => request('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  updateTag: (id, name) => request(`/tags/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),
};

// Milestones
export const milestonesApi = {
  getMilestones: (goalId) => request(`/goals/${goalId}/milestones`),
  createMilestone: (goalId, data) => request(`/goals/${goalId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id, data) => request(`/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMilestone: (id) => request(`/milestones/${id}`, { method: 'DELETE' }),
  createSubMilestone: (milestoneId, data) => request(`/milestones/${milestoneId}/sub`, { method: 'POST', body: JSON.stringify(data) }),
  updateSubMilestone: (id, data) => request(`/sub-milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubMilestone: (id) => request(`/sub-milestones/${id}`, { method: 'DELETE' }),
};

// Journal
export const journalApi = {
  getEntry: (date) => request(`/journal/${date}`),
  getRecent: (limit = 10) => request(`/journal/recent?limit=${limit}`),
  updateEntry: (date, data) => request(`/journal/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Habits
export const habitsApi = {
  getWeek: (date) => request(`/habits/week?date=${date}`),
  logPreset: (date, category, data) =>
    request(`/habits/log/${date}/${category}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePresetLog: (date, category) =>
    request(`/habits/log/${date}/${category}`, { method: 'DELETE' }),
  getCustomHabits: () => request('/habits/custom'),
  createCustomHabit: (data) =>
    request('/habits/custom', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomHabit: (id, data) =>
    request(`/habits/custom/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomHabit: (id) =>
    request(`/habits/custom/${id}`, { method: 'DELETE' }),
  logCustom: (date, habitId, data) =>
    request(`/habits/custom-log/${date}/${habitId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Focus Sessions
export const focusApi = {
  getSessions: (limit) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    return request(`/focus-sessions?${params}`);
  },
  getSession: (id) => request(`/focus-sessions/${id}`),
  createSession: (data) => request('/focus-sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id, data) => request(`/focus-sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSession: (id) => request(`/focus-sessions/${id}`, { method: 'DELETE' }),
  getStats: () => request('/focus-sessions/stats'),
};

// Canvas Boards
export const canvasApi = {
  getBoards: () => request('/canvas/boards'),
  getBoard: (id) => request(`/canvas/boards/${id}`),
  createBoard: (data) => request('/canvas/boards', { method: 'POST', body: JSON.stringify(data) }),
  updateBoard: (id, data) => request(`/canvas/boards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBoard: (id) => request(`/canvas/boards/${id}`, { method: 'DELETE' }),
};

// Todos
export const todosApi = {
  getLists: () => request('/todos/lists'),
  createList: (name) => request('/todos/lists', { method: 'POST', body: JSON.stringify({ name }) }),
  updateList: (id, data) => request(`/todos/lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteList: (id) => request(`/todos/lists/${id}`, { method: 'DELETE' }),
  getItems: (listId) => request(`/todos/lists/${listId}/items`),
  createItem: (listId, text) => request(`/todos/lists/${listId}/items`, { method: 'POST', body: JSON.stringify({ text }) }),
  updateItem: (id, data) => request(`/todos/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) => request(`/todos/items/${id}`, { method: 'DELETE' }),
};

// Activity Feed
export const activityApi = {
  getFeed: () => request('/activity-feed'),
};

// Users / Profile
export const usersApi = {
  getProfile: () => request('/users/profile'),
  updateProfile: (data) =>
    request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) =>
    request('/users/change-password', { method: 'POST', body: JSON.stringify(data) }),
};

// Notifications
export const notificationsApi = {
  getPreferences: () => request('/notifications/preferences'),
  updatePreferences: (data) =>
    request('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
};

// Auth (public — no Bearer token needed)
export const authApi = {
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  verifyEmail: (token) =>
    request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email) =>
    request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
};

// Chat
export const chatApi = {
  send: (message, sessionId = null) =>
    request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    }),
  getHistory: (sessionId) => request(`/chat/history?sessionId=${sessionId}`),
  getSessions: () => request('/chat/sessions'),
  createSession: () => request('/chat/sessions', { method: 'POST' }),
};
