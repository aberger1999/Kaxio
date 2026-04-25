import { useState, useCallback, useMemo, useRef, cloneElement, Children } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { X, Plus, Check, Palette, Repeat, Bell } from 'lucide-react';
import { calendarApi, goalsApi } from '../api/client';
import { getHolidaysForRange } from '../utils/holidays';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#22c55e', // green
  '#06b6d4', // cyan
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function parseRecurrence(str) {
  if (!str) return { type: 'none', days: [], endDate: '' };
  try { return { type: 'none', days: [], endDate: '', ...JSON.parse(str) }; }
  catch { return { type: 'none', days: [], endDate: '' }; }
}

function EventModal({ event, onClose, onSave, onDelete, goals, categories }) {
  const colorInputRef = useRef(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const existingRec = parseRecurrence(event?.recurrence);
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start: event?.start
      ? format(new Date(event.start), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end: event?.end
      ? format(new Date(event.end), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(Date.now() + 3600000), "yyyy-MM-dd'T'HH:mm"),
    allDay: event?.allDay || false,
    color: event?.color || '#3b82f6',
    category: event?.category || '',
    goalId: event?.goalId || '',
    reminderMinutes: event?.reminderMinutes ?? '',
    recurrenceType: existingRec.type,
    recurrenceDays: existingRec.days || [],
    recurrenceEndDate: existingRec.endDate || '',
  });

  const isCustomColor = !PRESET_COLORS.includes(form.color);

  const handleCategoryChange = (value) => {
    if (value === '__new__') {
      setShowNewCategory(true);
      setNewCategory('');
    } else {
      setShowNewCategory(false);
      setForm({ ...form, category: value });
    }
  };

  const handleNewCategorySave = () => {
    const trimmed = newCategory.trim();
    if (trimmed) {
      setForm({ ...form, category: trimmed });
      setShowNewCategory(false);
    }
  };

  const handleRecurrenceTypeChange = (newType) => {
    let days = form.recurrenceDays;
    // Auto-select the event's start day when switching to weekly/biweekly
    if (['weekly', 'biweekly'].includes(newType) && days.length === 0) {
      const startDay = new Date(form.start).getDay(); // JS 0=Sun
      days = [startDay];
    }
    setForm({ ...form, recurrenceType: newType, recurrenceDays: days });
  };

  const toggleDay = (dayIndex) => {
    const days = form.recurrenceDays.includes(dayIndex)
      ? form.recurrenceDays.filter((d) => d !== dayIndex)
      : [...form.recurrenceDays, dayIndex].sort((a, b) => a - b);
    setForm({ ...form, recurrenceDays: days });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { recurrenceType, recurrenceDays, recurrenceEndDate, ...rest } = form;

    const recurrence = recurrenceType === 'none'
      ? ''
      : JSON.stringify({
          type: recurrenceType,
          ...(['weekly', 'biweekly'].includes(recurrenceType) && recurrenceDays.length > 0
            ? { days: recurrenceDays }
            : {}),
          ...(recurrenceEndDate ? { endDate: recurrenceEndDate } : {}),
        });

    onSave({
      ...rest,
      recurrence,
      goalId: rest.goalId || null,
      reminderMinutes: rest.reminderMinutes ? Number(rest.reminderMinutes) : null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-modal z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800/80 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {event?.id ? 'Edit Event' : 'New Event'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <input
            required
            placeholder="Event title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">Start</span>
              <input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">End</span>
              <input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>

          {/* All day + Color swatches */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              />
              All day
            </label>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Color</span>
              <div className="flex items-center gap-2 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? '#fff' : 'transparent',
                      boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  >
                    {form.color === c && <Check size={14} className="text-white" />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-gray-400 dark:hover:border-slate-500 transition-colors shrink-0"
                  style={isCustomColor ? {
                    backgroundColor: form.color,
                    borderStyle: 'solid',
                    borderColor: '#fff',
                    boxShadow: `0 0 0 2px ${form.color}`,
                  } : {}}
                >
                  {isCustomColor
                    ? <Check size={14} className="text-white" />
                    : <Palette size={12} className="text-gray-400 dark:text-slate-500" />
                  }
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="sr-only"
                />
              </div>
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Repeat size={12} /> Repeat
              </span>
              <select
                value={form.recurrenceType}
                onChange={(e) => handleRecurrenceTypeChange(e.target.value)}
                className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white mt-1"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>

            {/* Day-of-week picker for weekly / biweekly */}
            {['weekly', 'biweekly'].includes(form.recurrenceType) && (
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">On days</span>
                <div className="flex gap-1.5 mt-1">
                  {DAY_LABELS.map((label, idx) => {
                    const selected = form.recurrenceDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                          selected
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* End date */}
            {form.recurrenceType !== 'none' && (
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Ends on</span>
                <input
                  type="date"
                  value={form.recurrenceEndDate}
                  onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
                  className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white mt-1"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Leave empty to repeat forever</p>
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Bell size={12} /> Reminder
            </span>
            <select
              value={form.reminderMinutes}
              onChange={(e) => setForm({ ...form, reminderMinutes: e.target.value })}
              className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white mt-1"
            >
              <option value="">No reminder</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="120">2 hours before</option>
              <option value="360">6 hours before</option>
              <option value="1440">1 day before</option>
              <option value="2880">2 days before</option>
              <option value="4320">3 days before</option>
              <option value="10080">1 week before</option>
            </select>
          </div>

          {/* Category + Goal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Category</span>
              {showNewCategory ? (
                <div className="flex gap-1 mt-1">
                  <input
                    autoFocus
                    placeholder="Category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleNewCategorySave(); }
                      if (e.key === 'Escape') setShowNewCategory(false);
                    }}
                    className="flex-1 min-w-0 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleNewCategorySave}
                    className="px-2 py-2 btn-gradient text-white rounded-lg"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(false)}
                    className="px-2 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white mt-1"
                >
                  <option value="">No category</option>
                  {categories?.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {form.category && !categories?.includes(form.category) && (
                    <option value={form.category}>{form.category}</option>
                  )}
                  <option value="__new__">+ Create new category</option>
                </select>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Goal</span>
              <select
                value={form.goalId}
                onChange={(e) => setForm({ ...form, goalId: e.target.value })}
                className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white mt-1"
              >
                <option value="">No goal</option>
                {goals?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            {event?.id && (
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                {event?.recurrence ? 'Delete series' : 'Delete'}
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm btn-gradient text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Custom day cell — injects "No events" inside the existing .rbc-day-bg
// without wrapping in an extra div (which breaks the flex layout).
function DateCellWrapper({ children, value, allEvents }) {
  const dayStart = new Date(value);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(value);
  dayEnd.setHours(23, 59, 59, 999);

  const hasEvents = allEvents.some((e) => {
    const eStart = e.start;
    const eEnd = e.end;
    return eStart <= dayEnd && eEnd >= dayStart;
  });

  if (hasEvents) return children;

  // Clone the existing child (.rbc-day-bg) and inject the label inside it
  const child = Children.only(children);
  return cloneElement(child, {
    ...child.props,
    style: { ...child.props.style, position: 'relative' },
  }, (
    <span className="rbc-day-no-events">No events</span>
  ));
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [range, setRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', range],
    queryFn: () => calendarApi.getEvents(range.start, range.end),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.getGoals(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['calendar-categories'],
    queryFn: () => calendarApi.getCategories(),
  });

  const invalidateCalendar = () => {
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['calendar-categories'] });
    setModal(null);
  };

  const createMut = useMutation({
    mutationFn: calendarApi.createEvent,
    onSuccess: invalidateCalendar,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }) => calendarApi.updateEvent(id, data),
    onSuccess: invalidateCalendar,
  });

  const deleteMut = useMutation({
    mutationFn: calendarApi.deleteEvent,
    onSuccess: invalidateCalendar,
  });

  // Merge user events + holidays
  const allEvents = useMemo(() => {
    const userEvents = events.map((e) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
      isHoliday: false,
    }));

    const rangeStart = new Date(range.start);
    const rangeEnd = new Date(range.end);
    const holidays = getHolidaysForRange(
      new Date(rangeStart.getFullYear(), 0, 1),
      new Date(rangeEnd.getFullYear(), 11, 31),
    );

    return [...userEvents, ...holidays];
  }, [events, range]);

  const handleSelectSlot = useCallback(
    ({ start, end }) => setModal({ slot: { start, end } }),
    [],
  );

  const handleSelectEvent = useCallback(
    (event) => {
      if (event.isHoliday) return;
      if (event.isRecurringInstance) {
        // Edit the original recurring event (use original start/end)
        setModal({
          event: {
            ...event,
            id: event.recurringEventId,
            start: event.originalStart,
            end: event.originalEnd,
            isRecurringInstance: undefined,
            recurringEventId: undefined,
            originalStart: undefined,
            originalEnd: undefined,
          },
        });
      } else {
        setModal({ event });
      }
    },
    [],
  );

  const handleNavigate = useCallback((newDate) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView) => {
    setView(newView);
  }, []);

  const handleRangeChange = useCallback((newRange) => {
    if (Array.isArray(newRange)) {
      setRange({
        start: newRange[0].toISOString(),
        end: newRange[newRange.length - 1].toISOString(),
      });
    } else if (newRange.start && newRange.end) {
      setRange({
        start: newRange.start.toISOString(),
        end: newRange.end.toISOString(),
      });
    }
  }, []);

  const handleSave = (data) => {
    const eventId = modal?.event?.recurringEventId || modal?.event?.id;
    if (eventId) {
      updateMut.mutate({ id: eventId, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  const eventStyleGetter = (event) => {
    if (event.isHoliday) {
      const bg = event.holidayType === 'federal' ? '#dc2626' : '#d97706';
      return {
        className: 'holiday-event',
        style: {
          backgroundColor: bg,
          color: '#ffffff',
          borderRadius: '4px',
          border: 'none',
          fontSize: '0.8rem',
          fontWeight: 600,
          fontStyle: 'italic',
        },
      };
    }
    return {
      style: {
        backgroundColor: event.color || '#6366f1',
        color: '#ffffff',
        borderRadius: '4px',
        border: 'none',
        fontSize: '0.8rem',
        fontWeight: 600,
      },
    };
  };

  // Build custom components with allEvents closure for DateCellWrapper
  const components = useMemo(
    () => ({
      dateCellWrapper: (props) => (
        <DateCellWrapper {...props} allEvents={allEvents} />
      ),
    }),
    [allEvents],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Calendar</h1>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-4" style={{ height: 'calc(100vh - 140px)' }}>
        <BigCalendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          date={date}
          view={view}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onRangeChange={handleRangeChange}
          eventPropGetter={eventStyleGetter}
          components={components}
          views={['month', 'week', 'day']}
          style={{ height: '100%' }}
        />
      </div>

      {modal && (
        <EventModal
          event={modal.event || { start: modal.slot?.start, end: modal.slot?.end }}
          goals={goals}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={(id) => deleteMut.mutate(modal.event?.recurringEventId || id)}
        />
      )}
    </div>
  );
}
