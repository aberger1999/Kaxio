import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Calendar, StickyNote, Target, Plus, BookMarked, Clock,
  CheckCircle2, Pencil, BookOpen, Flame, MessageSquare, Activity, Timer,
} from 'lucide-react';
import { calendarApi, notesApi, goalsApi, activityApi, focusApi } from '../api/client';
import NotificationInbox from '../components/NotificationInbox';

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function relativeTime(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

const FEED_ICONS = {
  note: StickyNote,
  goal: Target,
  event: Calendar,
  journal: BookOpen,
  habit: Flame,
  thought: MessageSquare,
  focus: Timer,
};

const FEED_COLORS = {
  note: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
  goal: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
  event: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10',
  journal: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  habit: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10',
  thought: 'text-pink-500 bg-pink-50 dark:bg-pink-500/10',
  focus: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10',
};

export default function Dashboard() {
  const today = new Date();

  // Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  // Sunday end of week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const { data: weekEvents = [] } = useQuery({
    queryKey: ['events', 'week', monday.toISOString()],
    queryFn: () => calendarApi.getEvents(monday.toISOString(), sunday.toISOString()),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', 'recent'],
    queryFn: () => notesApi.getNotes(),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.getGoals(),
  });

  const { data: activityFeed = [] } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => activityApi.getFeed(),
  });

  const { data: focusStats = {} } = useQuery({
    queryKey: ['focus-sessions', 'stats'],
    queryFn: focusApi.getStats,
  });

  // Today's events (for the top card)
  const todayEvents = weekEvents.filter((e) => {
    const start = new Date(e.start);
    return start.toDateString() === today.toDateString();
  });

  // Split week events into upcoming (future) and happened (past)
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const past = [];
    for (const e of weekEvents) {
      const end = new Date(e.end || e.start);
      if (end < now) {
        past.push(e);
      } else {
        upcoming.push(e);
      }
    }
    // Upcoming sorted by start ascending
    upcoming.sort((a, b) => new Date(a.start) - new Date(b.start));
    // Past sorted by start descending (most recent first)
    past.sort((a, b) => new Date(b.start) - new Date(a.start));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [weekEvents]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const recentNotes = notes.slice(0, 4);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {today.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/notes?new=1"
            className="flex items-center gap-1 btn-gradient text-white text-sm px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Note
          </Link>
          <Link
            to="/journal"
            className="flex items-center gap-1 btn-gradient text-white text-sm px-3 py-2 rounded-lg"
          >
            <BookMarked size={16} /> Journal
          </Link>
          <Link
            to="/calendar?new=1"
            className="flex items-center gap-1 btn-gradient text-white text-sm px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Event
          </Link>
          <NotificationInbox />
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Events */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-primary" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Today&apos;s Events</h2>
          </div>
          {todayEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events today</p>
          ) : (
            <ul className="space-y-2">
              {todayEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: e.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{e.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/calendar" className="text-xs text-primary hover:underline mt-3 block">
            View calendar
          </Link>
        </div>

        {/* Active Goals */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-primary" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Active Goals</h2>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-sm text-gray-400">No active goals</p>
          ) : (
            <ul className="space-y-3">
              {activeGoals.slice(0, 5).map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{g.title}</span>
                    <span className="text-gray-400">{g.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${g.progress}%`, backgroundColor: g.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/goals" className="text-xs text-primary hover:underline mt-3 block">
            View all goals
          </Link>
        </div>

        {/* Recent Notes */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <StickyNote size={18} className="text-primary" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Recent Notes</h2>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-gray-400">No notes yet</p>
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/notes/${n.id}`}
                    className="block text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-primary"
                  >
                    {n.title}
                  </Link>
                  <p className="text-xs text-gray-400 truncate">
                    {stripHtml(n.content)?.slice(0, 80)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notes" className="text-xs text-primary hover:underline mt-3 block">
            View all notes
          </Link>
        </div>

        {/* Focus Timer Stats */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Timer size={18} className="text-cyan-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Focus Timer</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Minutes</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{focusStats.totalMinutes || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Sessions</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{focusStats.completedSessions || 0}</span>
            </div>
          </div>
          <Link to="/focus" className="text-xs text-primary hover:underline mt-3 block">
            Start a session
          </Link>
        </div>
      </div>

      {/* Upcoming This Week */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-primary" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Upcoming This Week</h2>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nothing else on the calendar this week — enjoy the free time!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingEvents.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="w-1 h-10 rounded-full shrink-0 bg-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{e.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.start).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Happened This Week */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} className="text-gray-400" />
          <h2 className="font-semibold text-gray-500 dark:text-gray-400">Happened This Week</h2>
        </div>
        {pastEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No past events this week yet — the week is just getting started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pastEvents.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg">
                <div className="w-1 h-10 rounded-full shrink-0 bg-gray-300 dark:bg-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{e.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(e.start).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-primary" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Activity Feed</h2>
          <span className="text-xs text-gray-400 ml-auto">This week</span>
        </div>
        {activityFeed.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No activity this week yet</p>
        ) : (
          <ul className="space-y-1">
            {activityFeed.slice(0, 20).map((item, idx) => {
              const Icon = FEED_ICONS[item.type] || Activity;
              const colorClass = FEED_COLORS[item.type] || 'text-gray-500 bg-gray-50 dark:bg-slate-800';
              const itemKey = `${item.type}-${item.action}-${item.targetId || idx}-${item.timestamp}`;
              const content = (
                <>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon size={14} />
                  </div>
                  <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 min-w-0 truncate">
                    {item.description}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {relativeTime(item.timestamp)}
                  </span>
                </>
              );

              return (
                <li key={itemKey} className="border-b dark:border-slate-800 last:border-0">
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/70"
                      title={`Open ${item.description}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
