import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save, Check, Calendar, Target, Activity, CheckCircle } from 'lucide-react';
import { journalApi, calendarApi, goalsApi, habitsApi } from '../api/client';
import RichTextEditor from '../components/RichTextEditor';

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  });
  const dateStr = formatDate(selectedDate);
  const editorRef = useRef(null);
  const [morningIntentions, setMorningIntentions] = useState('');
  const [eveningReflection, setEveningReflection] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal', dateStr],
    queryFn: () => journalApi.getEntry(dateStr),
  });

  // Calendar events for selected date
  const dayStart = new Date(selectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: events = [] } = useQuery({
    queryKey: ['events', 'journal', dateStr],
    queryFn: () => calendarApi.getEvents(dayStart.toISOString(), dayEnd.toISOString()),
  });

  // Active goals
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.getGoals(),
  });
  const activeGoals = goals.filter((g) => g.status === 'active');

  // Habits for selected date
  const journalMonday = (() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return formatDate(d);
  })();
  const { data: habitWeek } = useQuery({
    queryKey: ['habits', 'week', journalMonday],
    queryFn: () => habitsApi.getWeek(journalMonday),
  });

  // Sync fetched entry into local state
  useEffect(() => {
    if (entry) {
      setMorningIntentions(entry.morningIntentions || '');
      setEveningReflection(entry.eveningReflection || '');
      setIsDirty(false);
      setJustSaved(false);
    }
  }, [entry]);

  // Warn on browser close if dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const saveMutation = useMutation({
    mutationFn: (data) => journalApi.updateEntry(dateStr, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', dateStr] });
      setIsDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    },
  });

  const handleSave = () => {
    const content = editorRef.current?.getHTML() || '';
    saveMutation.mutate({
      morningIntentions,
      content,
      eveningReflection,
    });
  };

  const navigateDate = useCallback(
    (offset) => {
      if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + offset);
        return next;
      });
    },
    [isDirty]
  );

  const goToToday = useCallback(() => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    setSelectedDate(new Date());
  }, [isDirty]);

  const handleDateInput = (e) => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    const val = e.target.value;
    if (val) {
      setSelectedDate(new Date(val + 'T00:00:00'));
    }
  };

  const isToday = formatDate(new Date()) === dateStr;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Journal</h1>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            justSaved
              ? 'bg-green-500 text-white'
              : isDirty
              ? 'btn-gradient text-white'
              : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {justSaved ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : (
            <>
              <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save'}
            </>
          )}
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        <input
          type="date"
          value={dateStr}
          onChange={handleDateInput}
          className="px-3 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
        />
        <button
          onClick={() => navigateDate(1)}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        {!isToday && (
          <button
            onClick={goToToday}
            className="px-3 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Today
          </button>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-2">
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Journal sections */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Morning Intentions */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Morning Intentions
                </label>
                <textarea
                  value={morningIntentions}
                  onChange={(e) => {
                    setMorningIntentions(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="What do you intend to accomplish today?"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Notes & Thoughts */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Notes & Thoughts
                </label>
                <RichTextEditor
                  key={dateStr}
                  content={entry?.content || ''}
                  placeholder="Write your thoughts, ideas, and notes for the day..."
                  editorRef={editorRef}
                  onChange={() => setIsDirty(true)}
                />
              </div>

              {/* End of Day Reflection */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  End of Day Reflection
                </label>
                <textarea
                  value={eveningReflection}
                  onChange={(e) => {
                    setEveningReflection(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="How did the day go? What did you learn?"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </>
          )}
        </div>

        {/* Right column — Context panel */}
        <div className="space-y-6">
          {/* Day's Events */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Events
              </h3>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-gray-400">No events this day</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: e.color }}
                    />
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{e.title}</p>
                      {!e.allDay && (
                        <p className="text-xs text-gray-400">
                          {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Goals */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Active Goals
              </h3>
            </div>
            {activeGoals.length === 0 ? (
              <p className="text-xs text-gray-400">No active goals</p>
            ) : (
              <ul className="space-y-3">
                {activeGoals.map((g) => (
                  <li key={g.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-800 dark:text-gray-200">{g.title}</span>
                      <span className="text-xs text-gray-400">{g.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${g.progress}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Habits Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Habits
              </h3>
            </div>
            {(() => {
              const dayLogs = habitWeek?.logs[dateStr] || {};
              const dayCustom = habitWeek?.customLogs[dateStr] || {};
              const presetCategories = [
                { key: 'sleep', label: 'Sleep' },
                { key: 'fitness', label: 'Fitness' },
                { key: 'finance', label: 'Finance' },
                { key: 'diet_health', label: 'Diet & Health' },
              ];
              const completedPresets = presetCategories.filter(
                (c) => dayLogs[c.key]?.isCompleted
              );
              const customHabits = habitWeek?.customHabits || [];
              const completedCustom = customHabits.filter((h) => {
                const cl = dayCustom[String(h.id)];
                if (!cl?.value) return false;
                if (h.trackingType === 'checkbox') return cl.value === 'true';
                try { return parseFloat(cl.value) > 0; } catch { return false; }
              });
              const totalDone = completedPresets.length + completedCustom.length;
              const totalAll = presetCategories.length + customHabits.length;

              if (totalAll === 0) {
                return <p className="text-xs text-gray-400">No habits tracked</p>;
              }

              return (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {totalDone} of {totalAll} completed
                  </p>
                  <ul className="space-y-1.5">
                    {presetCategories.map((c) => {
                      const done = dayLogs[c.key]?.isCompleted;
                      return (
                        <li key={c.key} className="flex items-center gap-2 text-sm">
                          {done ? (
                            <CheckCircle size={14} className="text-green-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600 shrink-0" />
                          )}
                          <span className={done ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                            {c.label}
                          </span>
                        </li>
                      );
                    })}
                    {customHabits.map((h) => {
                      const cl = dayCustom[String(h.id)];
                      let done = false;
                      if (cl?.value) {
                        if (h.trackingType === 'checkbox') done = cl.value === 'true';
                        else {
                          try {
                            done = parseFloat(cl.value) > 0;
                          } catch {
                            done = false;
                          }
                        }
                      }
                      return (
                        <li key={h.id} className="flex items-center gap-2 text-sm">
                          {done ? (
                            <CheckCircle size={14} className="text-green-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600 shrink-0" />
                          )}
                          <span className={done ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                            {h.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
