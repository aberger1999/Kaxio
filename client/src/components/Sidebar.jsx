import { NavLink } from 'react-router-dom';
import {
  Calendar,
  StickyNote,
  Target,
  MessageSquare,
  BookMarked,
  Activity,
  Timer,
  PenTool,
  ListTodo,
  Moon,
  Sun,
  LogOut,
  Settings,
  LayoutDashboard,
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth } from '../hooks/useAuth';
import { useFocusTimer } from '../hooks/useFocusTimer';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/journal', icon: BookMarked, label: 'Journal' },
  { to: '/habits', icon: Activity, label: 'Habits' },
  { to: '/focus', icon: Timer, label: 'Focus Timer' },
  { to: '/todos', icon: ListTodo, label: 'To-Do' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/canvas', icon: PenTool, label: 'Canvas' },
  { to: '/thoughts', icon: MessageSquare, label: 'Thoughts' },
];

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Sidebar() {
  const [dark, setDark] = useDarkMode();
  const { user, logout } = useAuth();
  const focusTimer = useFocusTimer();
  const hasActiveFocusTimer = focusTimer.totalTime > 0 && (focusTimer.isRunning || focusTimer.isPaused);

  return (
    <aside className="w-56 bg-sidebar text-white flex flex-col shrink-0 h-screen sticky top-0 border-r border-white/5">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            Q
          </div>
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            Kaxio
          </span>
        </div>
      </div>
      <nav className="flex-1 py-2 flex flex-col">
        <div>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-hover text-white font-medium border-l-2 border-primary-light'
                    : 'text-gray-400 hover:bg-sidebar-hover hover:text-white border-l-2 border-transparent'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
        {hasActiveFocusTimer && (
          <NavLink
            to="/focus"
            className="mx-3 mt-auto mb-2 rounded-lg border border-primary/35 bg-primary/10 hover:bg-primary/20 transition-colors"
            title="Return to active focus timer"
          >
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 text-primary-light">
                <Timer size={14} />
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {focusTimer.isPaused ? 'Focus paused' : 'Focus active'}
                </span>
              </div>
              <p className="mt-1 text-sm font-mono text-white tabular-nums">
                {formatCountdown(focusTimer.timeLeft)} left
              </p>
            </div>
          </NavLink>
        )}
      </nav>
      <div className="p-4 border-t border-white/10">
        {user && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 truncate">{user.name || user.email}</span>
            <div className="flex items-center gap-2">
              <NavLink
                to="/settings"
                className="text-gray-500 hover:text-white transition-colors"
                title="Settings"
              >
                <Settings size={14} />
              </NavLink>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-white transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setDark(!dark)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors w-full"
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <p className="text-xs text-gray-500 mt-2">Ctrl+K chat &middot; Ctrl+M note</p>
      </div>
    </aside>
  );
}
