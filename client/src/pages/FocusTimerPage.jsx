import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Timer, Play, Pause, Square, RotateCcw, Clock,
  CheckCircle2, TrendingUp, Pencil, Trash2,
} from 'lucide-react';
import { focusApi } from '../api/client';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useChime } from '../hooks/useChime';
import CircularTimer from '../components/CircularTimer';
import FocusSessionModal from '../components/FocusSessionModal';

const PRESETS = [5, 10, 15, 25, 30, 45, 60];

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function FocusTimerPage() {
  const queryClient = useQueryClient();
  const playChime = useChime();
  const timer = useFocusTimer();
  const { setOnComplete } = timer;

  const [selectedDuration, setSelectedDuration] = useState(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  const handleComplete = useCallback((completedDuration = 0) => {
    playChime();
    setPendingSession({
      plannedDuration: completedDuration,
      actualDuration: completedDuration,
      status: 'completed',
    });
    setShowModal(true);
  }, [playChime]);

  useEffect(() => {
    setOnComplete(handleComplete);
    return () => setOnComplete(null);
  }, [handleComplete, setOnComplete]);

  const { data: sessions = [] } = useQuery({
    queryKey: ['focus-sessions'],
    queryFn: () => focusApi.getSessions(),
  });

  const { data: stats = {} } = useQuery({
    queryKey: ['focus-sessions', 'stats'],
    queryFn: focusApi.getStats,
  });

  const createMut = useMutation({
    mutationFn: (data) => focusApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => focusApi.updateSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => focusApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus-sessions'] });
    },
  });

  const selectPreset = (minutes) => {
    const seconds = minutes * 60;
    setSelectedDuration(seconds);
    setCustomMinutes('');
  };

  const applyCustom = () => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0 && mins <= 180) {
      setSelectedDuration(mins * 60);
    }
  };

  const handleStart = () => {
    if (selectedDuration) timer.start(selectedDuration);
  };

  const handleStop = () => {
    const elapsed = timer.stop();
    setPendingSession({
      plannedDuration: timer.totalTime,
      actualDuration: elapsed,
      status: 'stopped',
    });
    setShowModal(true);
  };

  const handleReset = () => {
    timer.reset();
    setSelectedDuration(null);
  };

  const handleModalSave = (data) => {
    if (editingSession) {
      updateMut.mutate({ id: editingSession.id, data });
    } else {
      createMut.mutate(data);
    }
    setShowModal(false);
    setPendingSession(null);
    setEditingSession(null);
    if (!editingSession) {
      timer.reset();
      setSelectedDuration(null);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPendingSession(null);
    setEditingSession(null);
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    setPendingSession(null);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    deleteMut.mutate(id);
  };

  const completionRate = stats.totalSessions > 0
    ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Focus Timer</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Stay focused with timed work sessions
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <Clock size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{stats.totalMinutes || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Minutes</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{stats.totalSessions || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sessions</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
            <TrendingUp size={20} className="text-violet-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{completionRate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Completion Rate</p>
          </div>
        </div>
      </div>

      {/* Timer card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-8 mb-6">
        <div className="flex flex-col items-center">
          <CircularTimer
            timeLeft={timer.timeLeft}
            totalTime={timer.totalTime}
            progress={timer.progress}
            isRunning={timer.isRunning}
            isPaused={timer.isPaused}
          />

          {/* Presets */}
          {!timer.isRunning && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => selectPreset(m)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedDuration === m * 60
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {m}m
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
                  placeholder="Custom"
                  className="w-20 px-2.5 py-1.5 rounded-full text-sm border bg-white dark:bg-slate-800 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-center outline-none focus:ring-2 focus:ring-primary/50"
                />
                {customMinutes && (
                  <button
                    onClick={applyCustom}
                    className="px-2.5 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    Set
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-6 flex items-center gap-3">
            {!timer.isRunning && !timer.isPaused && (
              <button
                onClick={handleStart}
                disabled={!selectedDuration}
                className="flex items-center gap-2 px-6 py-2.5 btn-gradient disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Play size={18} /> Start
              </button>
            )}

            {timer.isRunning && !timer.isPaused && (
              <>
                <button
                  onClick={() => timer.pause()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Pause size={18} /> Pause
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Square size={18} /> Stop
                </button>
              </>
            )}

            {timer.isPaused && (
              <>
                <button
                  onClick={() => timer.resume()}
                  className="flex items-center gap-2 px-5 py-2.5 btn-gradient text-white rounded-lg font-medium transition-colors"
                >
                  <Play size={18} /> Resume
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Square size={18} /> Stop
                </button>
              </>
            )}

            {(selectedDuration || timer.totalTime > 0) && !timer.isRunning && !timer.isPaused && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <RotateCcw size={18} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session history */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Timer size={18} className="text-primary" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Session History</h2>
          <span className="text-xs text-gray-400 ml-auto">{sessions.length} sessions</span>
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No focus sessions yet. Start your first timer above!
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg group"
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                  s.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {s.title || 'Untitled session'}
                    </p>
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
                      s.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDuration(s.actualDuration)} / {formatDuration(s.plannedDuration)}
                    {' \u00b7 '}
                    {new Date(s.createdAt).toLocaleDateString([], {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {s.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{s.notes}</p>
                  )}
                  {(s.goalIds?.length > 0 || s.habitCategories?.length > 0 || s.habitIds?.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.goalIds?.map((gid) => (
                        <span key={`g-${gid}`} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          Goal #{gid}
                        </span>
                      ))}
                      {s.habitCategories?.map((cat) => (
                        <span key={`hc-${cat}`} className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleEdit(s)}
                    className="p-1.5 text-gray-400 hover:text-primary rounded"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FocusSessionModal
        open={showModal}
        onClose={handleModalClose}
        onSave={handleModalSave}
        plannedDuration={pendingSession?.plannedDuration}
        actualDuration={pendingSession?.actualDuration}
        status={pendingSession?.status}
        editingSession={editingSession}
      />
    </div>
  );
}
