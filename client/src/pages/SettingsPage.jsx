import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  User, Bell, Mail, Shield, Palette, Activity, Target, BookMarked, Timer,
  Calendar, Clock, Phone, Check, AlertTriangle, ChevronDown, Moon, Sun,
  Eye, EyeOff,
} from 'lucide-react';
import { notificationsApi, usersApi } from '../api/client';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth } from '../hooks/useAuth';

// ─── Sidebar nav items ───
const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];
const GOAL_REMINDER_DAY_OPTIONS = [1, 2, 3, 5, 7, 14, 30];
const PHONE_COUNTRY_CODES = [
  { code: '+1', label: 'US / Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+64', label: 'New Zealand (+64)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+52', label: 'Mexico (+52)' },
  { code: '+55', label: 'Brazil (+55)' },
];
const MIN_PHONE_LOCAL_DIGITS = 7;
const MAX_PHONE_LOCAL_DIGITS = 14;

function normalizeGoalReminderDays(days) {
  if (!Array.isArray(days)) return [1, 2, 3];
  const normalized = [...new Set(days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 30))]
    .sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : [1, 2, 3];
}

function splitPhoneForForm(phoneNumber) {
  const raw = String(phoneNumber || '').trim();
  if (!raw) {
    return { phoneCountryCode: '+1', phoneLocalNumber: '' };
  }

  const normalized = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : `+${raw.replace(/\D/g, '')}`;

  const knownCodes = PHONE_COUNTRY_CODES
    .map(({ code }) => code)
    .sort((a, b) => b.length - a.length);
  const matchedCode = knownCodes.find((code) => normalized.startsWith(code));
  if (matchedCode) {
    return {
      phoneCountryCode: matchedCode,
      phoneLocalNumber: normalized.slice(matchedCode.length),
    };
  }

  return {
    phoneCountryCode: '+1',
    phoneLocalNumber: normalized.replace(/^\+\d{1,3}/, ''),
  };
}

function buildPhoneForSave(countryCode, localNumber) {
  const codeDigits = String(countryCode || '').replace(/\D/g, '');
  const localDigits = String(localNumber || '').replace(/\D/g, '');
  if (!localDigits) return '';
  const normalizedCode = codeDigits ? `+${codeDigits}` : '+1';
  return `${normalizedCode}${localDigits}`;
}

function validatePhoneLocalNumber(localNumber) {
  const digits = String(localNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < MIN_PHONE_LOCAL_DIGITS) {
    return `Enter at least ${MIN_PHONE_LOCAL_DIGITS} digits.`;
  }
  if (digits.length > MAX_PHONE_LOCAL_DIGITS) {
    return `Use no more than ${MAX_PHONE_LOCAL_DIGITS} digits.`;
  }
  return '';
}

function toNotificationsForm(prefs) {
  const { phoneCountryCode, phoneLocalNumber } = splitPhoneForForm(prefs?.phoneNumber);
  return {
    ...prefs,
    goalReminderDays: normalizeGoalReminderDays(prefs?.goalReminderDays),
    phoneCountryCode,
    phoneLocalNumber,
  };
}

// ─── Shared components ───
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-gray-900 dark:bg-slate-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-fade-in">
      <Check size={14} className="text-green-400" />
      {message}
    </div>
  );
}

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm card-elevated border dark:border-slate-800/80 p-6 ${className}`}>
      {children}
    </div>
  );
}

function FieldError({ error }) {
  if (!error) return null;
  return <p className="text-xs text-red-500 mt-1">{error}</p>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Collapsible notification card ───
function NotifCard({ icon: Icon, color, label, description, toggleKey, form, onToggle, children }) {
  const [open, setOpen] = useState(false);
  const enabled = form[toggleKey];

  return (
    <div className="border dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={15} />
        </div>
        <button
          type="button"
          className="flex-1 text-left min-w-0"
          onClick={() => children && setOpen(!open)}
        >
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </button>
        {children && (
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform cursor-pointer ${open ? 'rotate-180' : ''}`}
            onClick={() => setOpen(!open)}
          />
        )}
        <Toggle checked={enabled} onChange={(val) => onToggle(toggleKey, val)} />
      </div>
      {open && children && (
        <div className="px-4 pb-4 pt-1 border-t dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Timezone list ───
const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
      'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
      'Australia/Sydney', 'Pacific/Auckland', 'UTC',
    ];
  }
})();

// ═════════════════════════════════════════════════════════
// Main Settings Page
// ═════════════════════════════════════════════════════════
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'notifications');
  const [toast, setToast] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function navigateSection(id) {
    setActiveSection(id);
    setSearchParams({ section: id });
    setMobileNavOpen(false);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Manage your profile, notifications, and preferences
        </p>
      </div>

      <div className="flex gap-6 min-h-[500px]">
        {/* Sidebar — desktop */}
        <nav className="hidden md:block w-48 shrink-0">
          <div className="sticky top-6 space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigateSection(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Mobile section picker */}
        <div className="md:hidden w-full mb-4">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-sm font-medium text-gray-800 dark:text-gray-200"
          >
            <span className="flex items-center gap-2">
              {(() => { const s = SECTIONS.find((s) => s.id === activeSection); return s ? <><s.icon size={16} /> {s.label}</> : null; })()}
            </span>
            <ChevronDown size={14} className={`transition-transform ${mobileNavOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileNavOpen && (
            <div className="mt-1 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg shadow-lg overflow-hidden">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigateSection(id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm ${
                    activeSection === id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {activeSection === 'profile' && <ProfileSection showToast={showToast} />}
          {activeSection === 'notifications' && <NotificationsSection showToast={showToast} />}
          {activeSection === 'account' && <AccountSection showToast={showToast} />}
          {activeSection === 'appearance' && <AppearanceSection showToast={showToast} />}
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Profile Section
// ═════════════════════════════════════════════════════════
function ProfileSection({ showToast }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: usersApi.getProfile,
  });

  const [form, setForm] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (profile && !form) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        timezone: profile.timezone || '',
      });
    }
  }, [profile]);

  const updateMut = useMutation({
    mutationFn: (data) => usersApi.updateProfile(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['user-profile'], updated);
      setForm({
        firstName: updated.firstName || '',
        lastName: updated.lastName || '',
        email: updated.email,
        timezone: updated.timezone || '',
      });
      setConfirmEmail('');
      setErrors({});
      showToast('Profile updated');
    },
    onError: (err) => {
      const msg = err.message || 'Failed to update profile';
      if (msg.toLowerCase().includes('email')) setErrors({ email: msg });
      else setErrors({ general: msg });
    },
  });

  function handleSave() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (form.email !== profile.email && form.email !== confirmEmail) {
      errs.confirmEmail = 'Emails do not match';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const updates = {};
    if (form.firstName !== (profile.firstName || '')) updates.firstName = form.firstName;
    if (form.lastName !== (profile.lastName || '')) updates.lastName = form.lastName;
    if (form.email !== profile.email) updates.email = form.email;
    if (form.timezone !== (profile.timezone || '')) updates.timezone = form.timezone;
    if (Object.keys(updates).length === 0) { showToast('No changes to save'); return; }
    updateMut.mutate(updates);
  }

  if (isLoading || !form) return <Spinner />;

  const emailChanged = form.email !== profile.email;

  return (
    <div className="space-y-6">
      <SectionCard>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Profile Information</h2>

        <div className="space-y-4">
          {/* First and last name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              />
              <FieldError error={errors.firstName} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              />
              <FieldError error={errors.lastName} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
            />
            <FieldError error={errors.email} />
          </div>

          {/* Confirm Email — only shown when email changed */}
          {emailChanged && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Email</label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder="Re-enter your new email"
                className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              />
              <FieldError error={errors.confirmEmail} />
            </div>
          )}

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 dark:bg-slate-900"
            >
              <option value="">Auto-detect</option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <FieldError error={errors.general} />

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={updateMut.isPending}
              className="px-5 py-2 text-sm btn-gradient text-white rounded-lg font-medium disabled:opacity-40"
            >
              {updateMut.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Notifications Section
// ═════════════════════════════════════════════════════════
function NotificationsSection({ showToast }) {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.getPreferences,
  });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (prefs && !form) {
      setForm(toNotificationsForm(prefs));
    }
  }, [prefs]);

  const updateMut = useMutation({
    mutationFn: (data) => notificationsApi.updatePreferences(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated);
      setForm(toNotificationsForm(updated));
      showToast('Preferences saved');
    },
  });

  function handleToggle(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    updateMut.mutate({ [key]: value });
  }

  function handleFieldSave(key) {
    updateMut.mutate({ [key]: form[key] });
  }

  function toggleGoalReminderDay(day) {
    const current = normalizeGoalReminderDays(form.goalReminderDays);
    const isSelected = current.includes(day);
    let next;
    if (isSelected) {
      next = current.filter((d) => d !== day);
    } else {
      next = [...current, day];
    }
    if (next.length === 0) {
      next = current;
    }
    next = normalizeGoalReminderDays(next);
    setForm((f) => ({ ...f, goalReminderDays: next }));
    updateMut.mutate({ goalReminderDays: next });
  }

  function handlePhoneSave() {
    const validationError = validatePhoneLocalNumber(form.phoneLocalNumber);
    if (validationError) {
      return;
    }
    const combinedPhone = buildPhoneForSave(form.phoneCountryCode, form.phoneLocalNumber);
    setForm((f) => ({ ...f, phoneNumber: combinedPhone }));
    updateMut.mutate({ phoneNumber: combinedPhone });
  }

  if (isLoading || !form) return <Spinner />;
  const phoneValidationError = validatePhoneLocalNumber(form.phoneLocalNumber);
  const phoneSavePreview = buildPhoneForSave(form.phoneCountryCode, form.phoneLocalNumber);

  return (
    <div className="space-y-4">
      {/* Delivery Channels */}
      <SectionCard>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Delivery Channels</h3>
        <div className="space-y-3">
          <NotifCard
            icon={Bell}
            color="text-violet-500 bg-violet-50 dark:bg-violet-500/10"
            label="In-App Notifications"
            description="Show notifications in the Kaxio bell inbox"
            toggleKey="inAppNotificationsEnabled"
            form={form}
            onToggle={handleToggle}
          />
          <NotifCard
            icon={Mail}
            color="text-blue-500 bg-blue-50 dark:bg-blue-500/10"
            label="Email Notifications"
            description="Allow notification emails for reminder workflows"
            toggleKey="emailNotificationsEnabled"
            form={form}
            onToggle={handleToggle}
          />
        </div>
      </SectionCard>

      {/* Habit Reminders */}
      <NotifCard
        icon={Activity}
        color="text-orange-500 bg-orange-50 dark:bg-orange-500/10"
        label="Habit Reminders"
        description="Get reminded to log your daily habits"
        toggleKey="habitRemindersEnabled"
        form={form}
        onToggle={handleToggle}
      >
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Reminder Time</label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={form.reminderTime || '09:00'}
            onChange={(e) => setForm((f) => ({ ...f, reminderTime: e.target.value }))}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => handleFieldSave('reminderTime')}
            disabled={updateMut.isPending}
            className="px-3 py-1.5 text-xs btn-gradient text-white rounded-lg disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </NotifCard>

      {/* Goal Reminders */}
      <NotifCard
        icon={Target}
        color="text-blue-500 bg-blue-50 dark:bg-blue-500/10"
        label="Goal Deadlines"
        description="Notifications when goal deadlines are approaching"
        toggleKey="goalRemindersEnabled"
        form={form}
        onToggle={handleToggle}
      >
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Remind me this many days before deadline
        </label>
        <div className="flex flex-wrap gap-2">
          {GOAL_REMINDER_DAY_OPTIONS.map((day) => {
            const selected = normalizeGoalReminderDays(form.goalReminderDays).includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleGoalReminderDay(day)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selected
                    ? 'bg-primary/15 text-primary border-primary/40 dark:bg-primary/30 dark:border-primary/50'
                    : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-primary/40'
                }`}
              >
                {day} day{day === 1 ? '' : 's'}
              </button>
            );
          })}
        </div>
      </NotifCard>

      {/* Journal Prompts */}
      <NotifCard
        icon={BookMarked}
        color="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
        label="Journal Prompts"
        description="Daily reminders to write in your journal"
        toggleKey="journalRemindersEnabled"
        form={form}
        onToggle={handleToggle}
      >
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Prompt Time</label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={form.reminderTime || '09:00'}
            onChange={(e) => setForm((f) => ({ ...f, reminderTime: e.target.value }))}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => handleFieldSave('reminderTime')}
            disabled={updateMut.isPending}
            className="px-3 py-1.5 text-xs btn-gradient text-white rounded-lg disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </NotifCard>

      {/* Focus Sessions */}
      <NotifCard
        icon={Timer}
        color="text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10"
        label="Focus Session Complete"
        description="Notification when a focus session finishes"
        toggleKey="focusNotificationsEnabled"
        form={form}
        onToggle={handleToggle}
      />

      {/* Weekly Review */}
      <NotifCard
        icon={Calendar}
        color="text-violet-500 bg-violet-50 dark:bg-violet-500/10"
        label="Weekly Review"
        description="Weekly summary of your productivity and progress"
        toggleKey="weeklyReviewEnabled"
        form={form}
        onToggle={handleToggle}
      />

      {/* Calendar Reminders */}
      <NotifCard
        icon={Clock}
        color="text-rose-500 bg-rose-50 dark:bg-rose-500/10"
        label="Calendar Reminders"
        description="Event reminders and daily schedule summaries"
        toggleKey="calendarRemindersEnabled"
        form={form}
        onToggle={handleToggle}
      />

      {/* Delivery Settings */}
      <SectionCard className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Delivery Settings</h3>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-primary bg-primary/10">
            <Phone size={15} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
            <p className="text-xs text-gray-400 mb-2">Optional — for SMS notifications</p>
            <div className="flex items-center gap-2">
              <select
                value={form.phoneCountryCode || '+1'}
                onChange={(e) => setForm((f) => ({ ...f, phoneCountryCode: e.target.value }))}
                className="px-2.5 py-1.5 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              >
                {form.phoneCountryCode && !PHONE_COUNTRY_CODES.some(({ code }) => code === form.phoneCountryCode) && (
                  <option value={form.phoneCountryCode}>{form.phoneCountryCode}</option>
                )}
                {PHONE_COUNTRY_CODES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              <input
                type="tel"
                value={form.phoneLocalNumber || ''}
                onChange={(e) => setForm((f) => ({ ...f, phoneLocalNumber: e.target.value }))}
                placeholder="555 000 0000"
                className={`px-3 py-1.5 text-sm border rounded-lg bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50 w-44 ${
                  phoneValidationError
                    ? 'border-red-400 dark:border-red-400'
                    : 'dark:border-slate-700'
                }`}
              />
              <button
                onClick={handlePhoneSave}
                disabled={updateMut.isPending || Boolean(phoneValidationError)}
                className="px-3 py-1.5 text-xs btn-gradient text-white rounded-lg disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <FieldError error={phoneValidationError} />
            {!phoneValidationError && phoneSavePreview && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Will save as{' '}
                <span className="font-mono text-gray-700 dark:text-gray-200">{phoneSavePreview}</span>
              </p>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Account Section
// ═════════════════════════════════════════════════════════
function AccountSection({ showToast }) {
  const { user: authUser, logout } = useAuth();

  // Password form
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const changePwMut = useMutation({
    mutationFn: (data) => usersApi.changePassword(data),
    onSuccess: () => {
      setPw({ current: '', newPw: '', confirm: '' });
      setPwErrors({});
      showToast('Password changed');
    },
    onError: (err) => {
      setPwErrors({ general: err.message || 'Failed to change password' });
    },
  });

  function handleChangePassword() {
    const errs = {};
    if (!pw.current) errs.current = 'Required';
    if (!pw.newPw) errs.newPw = 'Required';
    else if (pw.newPw.length < 6) errs.newPw = 'At least 6 characters';
    if (pw.newPw !== pw.confirm) errs.confirm = 'Passwords do not match';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;

    changePwMut.mutate({ currentPassword: pw.current, newPassword: pw.newPw });
  }

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const userEmail = authUser?.email || '';

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <SectionCard>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Change Password</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError error={pwErrors.current} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={pw.newPw}
                onChange={(e) => setPw({ ...pw, newPw: e.target.value })}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <FieldError error={pwErrors.newPw} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-transparent dark:border-slate-700 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary/50"
            />
            <FieldError error={pwErrors.confirm} />
          </div>

          <FieldError error={pwErrors.general} />

          <button
            onClick={handleChangePassword}
            disabled={changePwMut.isPending}
            className="px-5 py-2 text-sm btn-gradient text-white rounded-lg font-medium disabled:opacity-40"
          >
            {changePwMut.isPending ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard className="border-red-200 dark:border-red-500/20">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Once you delete your account, all of your data will be permanently removed.
          This action cannot be undone.
        </p>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type <span className="font-mono text-red-500">{userEmail}</span> to confirm
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-3 py-2 text-sm border border-red-200 dark:border-red-500/30 rounded-lg bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-500/50 mb-3"
          />
          <button
            disabled={deleteConfirm !== userEmail}
            className="px-5 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Appearance Section
// ═════════════════════════════════════════════════════════
function AppearanceSection({ showToast }) {
  const [dark, setDark] = useDarkMode();

  function handleToggleDark(val) {
    setDark(val);
    showToast(val ? 'Dark mode enabled' : 'Light mode enabled');
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Theme</h2>

        <div className="flex items-center gap-4 py-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
            {dark ? <Moon size={18} /> : <Sun size={18} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Dark Mode</p>
            <p className="text-xs text-gray-400">
              {dark ? 'Using dark theme' : 'Using light theme'}
            </p>
          </div>
          <Toggle checked={dark} onChange={handleToggleDark} />
        </div>
      </SectionCard>
    </div>
  );
}
