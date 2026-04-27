import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { habitsApi } from '../api/client';
import { formatDate, getMonday, calcHours, isCustomCompleted, DAY_LABELS, PRESET_CATEGORIES } from '../utils/habits';
import HabitEntryCard from '../components/HabitEntryCard';
import TrackHabitModal from '../components/TrackHabitModal';

export default function HabitsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const monday = getMonday(selectedDate);
  const weekDateStr = formatDate(monday);
  const selectedDateStr = formatDate(selectedDate);

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return formatDate(d);
    }), [weekDateStr]
  );

  const { data: weekData, isLoading } = useQuery({
    queryKey: ['habits', 'week', weekDateStr],
    queryFn: () => habitsApi.getWeek(weekDateStr),
  });

  // Mutations
  const logPresetMutation = useMutation({
    mutationFn: ({ date, category, data }) => habitsApi.logPreset(date, category, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: ({ date, category }) => habitsApi.deletePresetLog(date, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const logCustomMutation = useMutation({
    mutationFn: ({ date, habitId, value }) => habitsApi.logCustom(date, habitId, { value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const createHabitMutation = useMutation({
    mutationFn: (data) => habitsApi.createCustomHabit(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const deleteHabitMutation = useMutation({
    mutationFn: (id) => habitsApi.deleteCustomHabit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  // Build entries for selected day
  const dayEntries = useMemo(() => {
    if (!weekData) return [];
    const entries = [];
    const dayLogs = weekData.logs[selectedDateStr] || {};
    const dayCustom = weekData.customLogs[selectedDateStr] || {};

    PRESET_CATEGORIES.forEach(({ key }) => {
      const log = dayLogs[key];
      if (log?.isCompleted) {
        entries.push({
          type: 'preset',
          category: key,
          data: log.data,
          streak: weekData.streaks?.[key] || 0,
        });
      }
    });

    (weekData.customHabits || []).forEach((habit) => {
      const cl = dayCustom[String(habit.id)];
      if (cl && isCustomCompleted(habit.trackingType, cl.value)) {
        entries.push({
          type: 'custom',
          habit,
          value: cl.value,
          streak: weekData.streaks?.[`custom_${habit.id}`] || 0,
        });
      }
    });

    return entries;
  }, [weekData, selectedDateStr]);

  // Weekly consistency (3 preset categories + custom)
  const totalCategories = PRESET_CATEGORIES.length + (weekData?.customHabits?.length || 0);
  const dailyCompletions = useMemo(() =>
    weekDates.map((dateStr) => {
      const dayLogs = weekData?.logs[dateStr] || {};
      const dayCustom = weekData?.customLogs[dateStr] || {};
      let completed = 0;
      PRESET_CATEGORIES.forEach(({ key }) => {
        if (dayLogs[key]?.isCompleted) completed++;
      });
      (weekData?.customHabits || []).forEach((h) => {
        const cl = dayCustom[String(h.id)];
        if (cl && isCustomCompleted(h.trackingType, cl.value)) completed++;
      });
      return completed;
    }), [weekData, weekDates]
  );

  const weekTotal = dailyCompletions.reduce((a, b) => a + b, 0);
  const weekMax = totalCategories * 7;
  const weekPercent = weekMax > 0 ? Math.round((weekTotal / weekMax) * 100) : 0;

  const navigateWeek = (offset) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7 * offset);
      return next;
    });
  };

  const isCurrentWeek = formatDate(getMonday(new Date())) === weekDateStr;
  const todayStr = formatDate(new Date());

  const selectedDayLabel = new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const handleSave = (result) => {
    if (result.type === 'preset') {
      const data = { ...result.data };
      if (result.category === 'sleep') {
        data.hours = calcHours(data.bedtime, data.wakeTime);
      }
      logPresetMutation.mutate({ date: selectedDateStr, category: result.category, data });
    } else if (result.type === 'custom') {
      logCustomMutation.mutate({ date: selectedDateStr, habitId: result.habitId, value: result.value });
    } else if (result.type === 'newCustom') {
      createHabitMutation.mutate({
        name: result.name,
        icon: result.icon,
        trackingType: result.trackingType,
        targetValue: result.targetValue,
        unit: result.unit,
        frequency: 'daily',
      });
    }
    setModalOpen(false);
    setEditingEntry(null);
  };

  const handleDelete = (entry) => {
    if (entry.type === 'preset') {
      deletePresetMutation.mutate({ date: selectedDateStr, category: entry.category });
    } else if (entry.type === 'custom') {
      if (window.confirm(`Delete all data for "${entry.habit.name}"?`)) {
        deleteHabitMutation.mutate(entry.habit.id);
      }
    }
    setModalOpen(false);
    setEditingEntry(null);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditingEntry(null);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Habits</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 btn-gradient text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Track Habit
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {new Date(weekDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' \u2013 '}
          {new Date(weekDates[6] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
        {!isCurrentWeek && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-2 text-sm rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            This Week
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-3" />
              <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Weekly Consistency Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Weekly Consistency</h2>
              <span className="text-lg font-bold text-primary">{weekPercent}%</span>
            </div>
            <div className="flex items-end gap-2 h-20">
              {weekDates.map((dateStr, i) => {
                const pct = totalCategories > 0 ? (dailyCompletions[i] / totalCategories) * 100 : 0;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(new Date(dateStr + 'T00:00:00'))}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
                      <div
                        className={`w-full max-w-8 rounded-t transition-all group-hover:opacity-80 ${
                          isSelected ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-slate-900' : ''
                        }`}
                        style={{
                          height: `${Math.max(pct * 0.48, 2)}px`,
                          backgroundColor: pct > 75 ? '#22c55e' : pct > 50 ? '#84cc16' : pct > 25 ? '#eab308' : pct > 0 ? '#f97316' : '#e5e7eb',
                        }}
                      />
                    </div>
                    <span className={`text-xs ${isToday ? 'font-bold text-primary' : isSelected ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-400'}`}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className={`text-xs ${isToday ? 'font-bold text-primary' : isSelected ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-400'}`}>
                      {new Date(dateStr + 'T00:00:00').getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Pills */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {weekDates.map((dateStr, i) => {
              const isSelected = dateStr === selectedDateStr;
              const dayNum = new Date(dateStr + 'T00:00:00').getDate();
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(new Date(dateStr + 'T00:00:00'))}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl text-sm font-medium transition-all min-w-[52px] ${
                    isSelected
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xs">{DAY_LABELS[i]}</span>
                  <span className="text-lg font-bold">{dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Day entries */}
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">{selectedDayLabel}</h2>
            {dayEntries.length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800">
                <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">
                  No habits tracked for {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}.
                </p>
                <button
                  onClick={openNew}
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  Tap + to start!
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((entry, idx) => (
                  <HabitEntryCard
                    key={entry.type === 'preset' ? entry.category : `custom-${entry.habit.id}`}
                    entry={entry}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => handleDelete(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Track Habit Modal */}
      <TrackHabitModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEntry(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        editingEntry={editingEntry}
        customHabits={weekData?.customHabits || []}
      />
    </div>
  );
}
