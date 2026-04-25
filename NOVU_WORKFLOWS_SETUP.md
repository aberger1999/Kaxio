# Novu Notification Workflows Setup Guide

Complete guide for configuring all Kaxio notification workflows in the Novu dashboard.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Workflow Overview](#workflow-overview)
4. [Creating Workflows in the Novu Dashboard](#creating-workflows-in-the-novu-dashboard)
5. [Workflow Reference](#workflow-reference)
   - [habit-reminder](#1-habit-reminder)
   - [goal-deadline-approaching](#2-goal-deadline-approaching)
   - [journal-daily-prompt](#3-journal-daily-prompt)
   - [focus-session-complete](#4-focus-session-complete)
   - [weekly-review-ready](#5-weekly-review-ready)
   - [password-reset](#6-password-reset)
   - [calendar-event-reminder](#7-calendar-event-reminder)
   - [calendar-daily-schedule](#8-calendar-daily-schedule)
6. [Testing Workflows](#testing-workflows)
7. [Troubleshooting](#troubleshooting)

---

## Introduction

### What Are Novu Workflows?

Novu workflows define the structure and content of notifications sent to users. Each workflow specifies:

- **When** a notification fires (triggered by the backend via API)
- **What** content the notification contains (templates with dynamic variables)
- **Where** it's delivered (in-app inbox, email, SMS)

### Why Kaxio Needs Workflows

Kaxio uses Novu to deliver eight types of notifications across the productivity suite:

| Area | Purpose |
|------|---------|
| Habits | Remind users to log daily habits |
| Goals | Alert users when goal deadlines approach |
| Journal | Prompt users to write daily journal entries |
| Focus | Confirm when focus sessions complete |
| Weekly Review | Nudge users to review their weekly progress |
| Password Reset | Deliver password reset links securely |
| Calendar Reminders | Notify users before calendar events start |
| Daily Schedule | Send a morning summary of the day's events |

The backend (`server/services/novu_service.py`) triggers these workflows by ID. Each workflow **must** exist in the Novu dashboard with the exact identifier the backend expects, or notifications will silently fail.

### How It Works

```
Backend trigger call ──> Novu API ──> Novu processes workflow
                                           │
                         ┌─────────────────┼─────────────────┐
                         ▼                 ▼                 ▼
                    In-App Inbox       Email             SMS (opt.)
                    (real-time)     (via provider)    (via provider)
```

The frontend renders in-app notifications using the `@novu/react` SDK in the `NotificationInbox` component (`client/src/components/NotificationInbox.jsx`).

---

## Prerequisites

Before creating workflows, ensure the following are in place:

### 1. Novu Account & Application

- Sign up at [novu.co](https://novu.co)
- Your Novu Application Identifier: `ykMRI4nxQVda` (hardcoded in `NotificationInbox.jsx`)

### 2. API Key

- Find your API key in the Novu dashboard under **Settings > API Keys**
- Add it to your `.env` file:

```env
NOVU_API_KEY=your_novu_api_key_here
```

The backend reads this via `server/config.py`. If the key is empty or missing, all notification triggers are silently skipped with a warning log.

### 3. Notification Providers

Configure at least one provider for each channel you want to use:

| Channel | Purpose | Example Providers |
|---------|---------|-------------------|
| In-App | Real-time bell notifications in the UI | Novu (built-in, no config needed) |
| Email | Habit reminders, password resets | SendGrid, Amazon SES, Mailgun, Resend |
| SMS | Optional mobile alerts | Twilio, Vonage, Amazon SNS |

Configure providers in **Integrations** in the Novu dashboard.

### 4. Subscriber Identity

Kaxio identifies subscribers using the user's ID (with email as fallback):

```javascript
// Frontend (NotificationInbox.jsx)
subscriberId={String(user.id || user.email)}
```

```python
# Backend (novu_service.py) — password reset uses email
await trigger_password_reset(user.email, user.name, reset_link)
```

**Important:** The `subscriberId` used in the frontend must match what the backend passes in trigger calls, or the user will not see their notifications.

---

## Workflow Overview

All six workflows with their identifiers and payload fields at a glance:

| # | Workflow Identifier | Payload Fields | Channels |
|---|---------------------|---------------|----------|
| 1 | `habit-reminder` | `habitName` (string) | In-App, Email |
| 2 | `goal-deadline-approaching` | `goalName` (string), `deadline` (string) | In-App, Email |
| 3 | `journal-daily-prompt` | _(none)_ | In-App, Email |
| 4 | `focus-session-complete` | `durationMinutes` (integer), `sessionTitle` (string) | In-App |
| 5 | `weekly-review-ready` | _(none)_ | In-App, Email |
| 6 | `password-reset` | `userName` (string), `resetLink` (string) | Email |
| 7 | `calendar-event-reminder` | `eventTitle` (string), `eventTime` (string), `minutesBefore` (integer), `userName` (string) | In-App, Email |
| 8 | `calendar-daily-schedule` | `eventsToday` (array of objects), `totalEvents` (integer), `userName` (string) | In-App, Email |

---

## Creating Workflows in the Novu Dashboard

Follow these steps for **each** workflow listed in the [Workflow Reference](#workflow-reference) section below.

### Step 1: Navigate to Workflows

1. Log in to the [Novu Dashboard](https://web.novu.co)
2. Select your application from the top-left dropdown
3. Click **Workflows** in the left sidebar

### Step 2: Create a New Workflow

1. Click the **+ Create Workflow** button (top-right)
2. In the creation dialog:
   - **Name**: Enter a human-readable name (e.g., "Habit Reminder")
   - **Identifier**: Enter the exact identifier string from the reference below (e.g., `habit-reminder`). This **must match exactly** — the backend uses this string to trigger the workflow

### Step 3: Add Notification Steps

The workflow editor shows a visual pipeline. Add steps by clicking **+** between the Trigger and the end:

#### Adding an In-App Step

1. Click **+** to add a step
2. Select **In-App** from the channel list
3. Click on the In-App step to open the template editor
4. In the **Body** field, write your notification text using Handlebars syntax for dynamic variables:
   ```handlebars
   Time to log your habit: {{habitName}}
   ```
5. Click **Update** to save the step

#### Adding an Email Step

1. Click **+** to add another step
2. Select **Email** from the channel list
3. Click on the Email step to open the template editor
4. Fill in:
   - **Subject**: Email subject line (supports Handlebars variables)
   - **Body**: Email body content using the visual editor or code editor
5. Use Handlebars syntax for dynamic content:
   ```handlebars
   <p>Hi there,</p>
   <p>Don't forget to log your <strong>{{habitName}}</strong> habit today!</p>
   ```
6. Click **Update** to save the step

#### Adding an SMS Step (Optional)

1. Click **+** to add a step
2. Select **SMS** from the channel list
3. Write a concise message (SMS has character limits):
   ```handlebars
   Kaxio: Time to log your {{habitName}} habit!
   ```

### Step 4: Publish the Workflow

1. Review all steps in the pipeline view
2. Click **Publish** (top-right) — the workflow is now live and ready to receive trigger events from the backend
3. Verify the workflow appears in your Workflows list with a green "Active" status

---

## Workflow Reference

### 1. habit-reminder

Reminds users to log a specific daily habit.

**Workflow Identifier:**
```
habit-reminder
```

**Trigger Context:** Sent at the user's configured reminder time (`notification_preferences.reminder_time`, default 09:00) for each habit the user is tracking.

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `habitName` | string | Name of the habit to log | `"Exercise"` |

**Backend trigger call:**
```python
await trigger_habit_reminder(subscriber_id, habit_name="Exercise")

# Sends to Novu:
{
  "name": "habit-reminder",
  "to": { "subscriberId": "42" },
  "payload": { "habitName": "Exercise" }
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```handlebars
Time to log your habit: {{habitName}}
```

Email subject:
```handlebars
Kaxio — Don't forget: {{habitName}}
```

Email body:
```html
<h2>Habit Reminder</h2>
<p>Hey! It's time to check in on your <strong>{{habitName}}</strong> habit.</p>
<p>Open Kaxio to log your progress and keep your streak going.</p>
```

---

### 2. goal-deadline-approaching

Alerts users when a goal's deadline is coming up.

**Workflow Identifier:**
```
goal-deadline-approaching
```

**Trigger Context:** Sent when a goal's deadline is within a configurable threshold (e.g., 3 days away).

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `goalName` | string | Name of the goal | `"Launch MVP"` |
| `deadline` | string | ISO date of the deadline | `"2026-03-15"` |

**Backend trigger call:**
```python
await trigger_goal_deadline(subscriber_id, goal_name="Launch MVP", deadline="2026-03-15")

# Sends to Novu:
{
  "name": "goal-deadline-approaching",
  "to": { "subscriberId": "42" },
  "payload": { "goalName": "Launch MVP", "deadline": "2026-03-15" }
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```handlebars
Your goal "{{goalName}}" deadline is {{deadline}}
```

Email subject:
```handlebars
Kaxio — Goal deadline approaching: {{goalName}}
```

Email body:
```html
<h2>Goal Deadline Alert</h2>
<p>Your goal <strong>{{goalName}}</strong> has a deadline on <strong>{{deadline}}</strong>.</p>
<p>Open Kaxio to review your milestones and make sure you're on track.</p>
```

---

### 3. journal-daily-prompt

Prompts users to write in their journal each day.

**Workflow Identifier:**
```
journal-daily-prompt
```

**Trigger Context:** Sent daily at the user's configured reminder time.

**Payload:**

_This workflow has no payload fields._ The notification content is static.

**Backend trigger call:**
```python
await trigger_journal_prompt(subscriber_id)

# Sends to Novu:
{
  "name": "journal-daily-prompt",
  "to": { "subscriberId": "42" },
  "payload": {}
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```
Time to write in your journal today!
```

Email subject:
```
Kaxio — Your daily journal prompt
```

Email body:
```html
<h2>Daily Journal</h2>
<p>Take a few minutes to reflect on your day. Writing consistently builds clarity and self-awareness.</p>
<p>Open Kaxio to start your journal entry.</p>
```

---

### 4. focus-session-complete

Notifies users when a focus session finishes.

**Workflow Identifier:**
```
focus-session-complete
```

**Trigger Context:** Sent immediately when a focus session ends (timer completes or user manually stops it).

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `durationMinutes` | integer | Session length in minutes | `25` |
| `sessionTitle` | string | Name/label of the session | `"Deep Work — API refactor"` |

**Backend trigger call:**
```python
await trigger_focus_complete(subscriber_id, duration_minutes=25, session_title="Deep Work — API refactor")

# Sends to Novu:
{
  "name": "focus-session-complete",
  "to": { "subscriberId": "42" },
  "payload": { "durationMinutes": 25, "sessionTitle": "Deep Work — API refactor" }
}
```

**Recommended Channels:** In-App only (this is a real-time confirmation, not something that needs email)

**Sample Templates:**

In-App body:
```handlebars
Focus session "{{sessionTitle}}" complete — {{durationMinutes}} min
```

---

### 5. weekly-review-ready

Reminds users to review their weekly productivity.

**Workflow Identifier:**
```
weekly-review-ready
```

**Trigger Context:** Sent once per week (e.g., Sunday evening or Monday morning) to prompt users to review their habits, goals, and journal entries for the past week.

**Payload:**

_This workflow has no payload fields._ The notification content is static.

**Backend trigger call:**
```python
await trigger_weekly_review(subscriber_id)

# Sends to Novu:
{
  "name": "weekly-review-ready",
  "to": { "subscriberId": "42" },
  "payload": {}
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```
Your weekly review is ready — take a look at your progress!
```

Email subject:
```
Kaxio — Your weekly review is ready
```

Email body:
```html
<h2>Weekly Review</h2>
<p>Another week in the books! Take a few minutes to review your progress:</p>
<ul>
  <li>How did your habits go?</li>
  <li>Are your goals on track?</li>
  <li>What did you learn from your journal entries?</li>
</ul>
<p>Open Kaxio to see your weekly summary.</p>
```

---

### 6. password-reset

Delivers password reset links to users. This is the only workflow currently triggered by the backend (in `server/routes/auth.py`).

**Workflow Identifier:**
```
password-reset
```

**Trigger Context:** Sent when a user submits a forgot-password request via `POST /api/auth/forgot-password`. The reset link expires after 30 minutes.

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `userName` | string | User's display name | `"Alex"` |
| `resetLink` | string | Full URL for password reset | `"https://kaxio.io/reset-password?token=abc123..."` |

**Backend trigger call:**
```python
await trigger_password_reset(user.email, user.name, reset_link)

# Sends to Novu:
{
  "name": "password-reset",
  "to": { "subscriberId": "user@example.com" },
  "payload": { "userName": "Alex", "resetLink": "https://..." }
}
```

**Note:** This workflow uses the user's **email** as the subscriber ID (not the numeric user ID), because the user may not be logged in when requesting a reset.

**Recommended Channels:** Email only (password resets should not appear in the in-app inbox)

**Sample Templates:**

Email subject:
```handlebars
Kaxio — Password reset for {{userName}}
```

Email body:
```html
<h2>Password Reset</h2>
<p>Hi {{userName}},</p>
<p>We received a request to reset your password. Click the link below to set a new password:</p>
<p><a href="{{resetLink}}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
<p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
```

---

### 7. calendar-event-reminder

Reminds users before a calendar event starts. Triggered automatically by the APScheduler background task that runs every minute.

**Workflow Identifier:**
```
calendar-event-reminder
```

**Trigger Context:** The scheduler checks every minute for events where `start - reminder_minutes` falls within the current minute. Only fires if the user has `calendar_reminders_enabled = true` in their notification preferences. Users set `reminder_minutes` per event (15, 30, 60, or 1440 minutes before).

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `eventTitle` | string | Title of the calendar event | `"Team Standup"` |
| `eventTime` | string | ISO datetime when the event starts | `"2026-03-01T10:00:00+00:00"` |
| `minutesBefore` | integer | How many minutes before the event this reminder fires | `15` |
| `userName` | string | User's display name | `"Alex"` |

**Backend trigger call:**
```python
await trigger_event_reminder(
    subscriber_id=str(user.id),
    event_title="Team Standup",
    event_time="2026-03-01T10:00:00+00:00",
    minutes_before=15,
    user_name="Alex",
)

# Sends to Novu:
{
  "name": "calendar-event-reminder",
  "to": { "subscriberId": "42" },
  "payload": {
    "eventTitle": "Team Standup",
    "eventTime": "2026-03-01T10:00:00+00:00",
    "minutesBefore": 15,
    "userName": "Alex"
  }
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```handlebars
Reminder: {{eventTitle}} starts in {{minutesBefore}} minutes
```

Email subject:
```handlebars
Kaxio — {{eventTitle}} starts in {{minutesBefore}} minutes
```

Email body:
```html
<h2>Event Reminder</h2>
<p>Hi {{userName}},</p>
<p>Your event <strong>{{eventTitle}}</strong> starts in <strong>{{minutesBefore}} minutes</strong> (at {{eventTime}}).</p>
<p>Open Kaxio to view the event details.</p>
```

---

### 8. calendar-daily-schedule

Sends a morning summary of all events scheduled for the day. Triggered by the APScheduler daily at each user's configured reminder time.

**Workflow Identifier:**
```
calendar-daily-schedule
```

**Trigger Context:** The scheduler runs every minute and checks if any user's `reminder_time` preference matches the current UTC time. If the user has `calendar_reminders_enabled = true` and has events today, a summary is sent. Users without events for the day do not receive a notification.

**Payload:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `eventsToday` | array of objects | List of events with `title` and `time` | `[{"title": "Team Standup", "time": "10:00 AM"}, {"title": "Lunch", "time": "12:30 PM"}]` |
| `totalEvents` | integer | Total number of events today | `2` |
| `userName` | string | User's display name | `"Alex"` |

Each object in `eventsToday` has:

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Event title |
| `time` | string | Formatted start time (e.g., `"10:00 AM"`) |

**Backend trigger call:**
```python
await trigger_daily_schedule(
    subscriber_id=str(user.id),
    events_today=[
        {"title": "Team Standup", "time": "10:00 AM"},
        {"title": "Lunch", "time": "12:30 PM"},
    ],
    total_events=2,
    user_name="Alex",
)

# Sends to Novu:
{
  "name": "calendar-daily-schedule",
  "to": { "subscriberId": "42" },
  "payload": {
    "eventsToday": [
      { "title": "Team Standup", "time": "10:00 AM" },
      { "title": "Lunch", "time": "12:30 PM" }
    ],
    "totalEvents": 2,
    "userName": "Alex"
  }
}
```

**Recommended Channels:** In-App, Email

**Sample Templates:**

In-App body:
```handlebars
Good morning {{userName}}! You have {{totalEvents}} event{{#if (gt totalEvents 1)}}s{{/if}} today.
```

Email subject:
```handlebars
Kaxio — Your schedule for today ({{totalEvents}} events)
```

Email body:
```html
<h2>Daily Schedule</h2>
<p>Good morning {{userName}}, here's your schedule for today:</p>
<ul>
  {{#each eventsToday}}
  <li><strong>{{this.time}}</strong> — {{this.title}}</li>
  {{/each}}
</ul>
<p>Open Kaxio to view full details or make changes.</p>
```

---

## Testing Workflows

Before relying on backend integration, verify each workflow works by triggering it manually.

### Method 1: Novu Dashboard Test

1. Go to **Workflows** and click on the workflow you want to test
2. Click the **Test** tab (or the lightning bolt icon)
3. Fill in the **Subscriber ID** — use your own user ID or email (must match a subscriber in Novu)
4. Fill in the **Payload** with test values matching the fields above
5. Click **Trigger** and check:
   - In-app: Look for the notification in the Kaxio UI bell icon
   - Email: Check the inbox of the email associated with the subscriber

### Method 2: cURL Commands

Trigger workflows directly via the Novu Events API. Replace `YOUR_NOVU_API_KEY` and `SUBSCRIBER_ID` with actual values.

#### Test habit-reminder

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "habit-reminder",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": { "habitName": "Exercise" }
  }'
```

#### Test goal-deadline-approaching

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "goal-deadline-approaching",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": { "goalName": "Launch MVP", "deadline": "2026-03-15" }
  }'
```

#### Test journal-daily-prompt

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "journal-daily-prompt",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": {}
  }'
```

#### Test focus-session-complete

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "focus-session-complete",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": { "durationMinutes": 25, "sessionTitle": "Deep Work" }
  }'
```

#### Test weekly-review-ready

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "weekly-review-ready",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": {}
  }'
```

#### Test password-reset

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "password-reset",
    "to": { "subscriberId": "user@example.com" },
    "payload": { "userName": "Alex", "resetLink": "https://localhost:5173/reset-password?token=test123" }
  }'
```

#### Test calendar-event-reminder

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calendar-event-reminder",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": {
      "eventTitle": "Team Standup",
      "eventTime": "2026-03-01T10:00:00+00:00",
      "minutesBefore": 15,
      "userName": "Alex"
    }
  }'
```

#### Test calendar-daily-schedule

```bash
curl -X POST https://api.novu.co/v1/events/trigger \
  -H "Authorization: ApiKey YOUR_NOVU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calendar-daily-schedule",
    "to": { "subscriberId": "SUBSCRIBER_ID" },
    "payload": {
      "eventsToday": [
        { "title": "Team Standup", "time": "10:00 AM" },
        { "title": "Lunch with Sarah", "time": "12:30 PM" },
        { "title": "Project Review", "time": "03:00 PM" }
      ],
      "totalEvents": 3,
      "userName": "Alex"
    }
  }'
```

### Verifying In-App Notifications

1. Log in to Kaxio in your browser
2. Trigger a workflow (via dashboard or cURL)
3. The bell icon in the top-right should show an unread badge
4. Click the bell to open the notification inbox and see the message

### Expected API Response

A successful trigger returns:

```json
{
  "data": {
    "acknowledged": true,
    "status": "processed",
    "transactionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

If you see `"acknowledged": false` or an error, check the [Troubleshooting](#troubleshooting) section.

---

## Troubleshooting

### Workflow Identifier Mismatch

**Symptom:** Backend logs show a successful API call but no notification appears.

**Cause:** The workflow identifier in the Novu dashboard doesn't match the string in `novu_service.py`.

**Fix:** Verify the identifier matches exactly (case-sensitive, hyphens included):

| Backend expects | Dashboard must have |
|----------------|---------------------|
| `habit-reminder` | `habit-reminder` |
| `goal-deadline-approaching` | `goal-deadline-approaching` |
| `journal-daily-prompt` | `journal-daily-prompt` |
| `focus-session-complete` | `focus-session-complete` |
| `weekly-review-ready` | `weekly-review-ready` |
| `password-reset` | `password-reset` |
| `calendar-event-reminder` | `calendar-event-reminder` |
| `calendar-daily-schedule` | `calendar-daily-schedule` |

### Missing Payload Variables

**Symptom:** Notification appears but shows blank spaces or literal `{{variableName}}` text.

**Cause:** The payload sent by the backend doesn't include the variable names expected by the template, or the template uses different variable names.

**Fix:** Ensure template variables match the exact camelCase payload field names:
- `{{habitName}}` (not `{{habit_name}}` or `{{name}}`)
- `{{goalName}}` (not `{{goal_name}}`)
- `{{deadline}}` (not `{{dueDate}}`)
- `{{durationMinutes}}` (not `{{duration}}`)
- `{{sessionTitle}}` (not `{{title}}`)
- `{{userName}}` (not `{{user_name}}`)
- `{{resetLink}}` (not `{{reset_link}}`)
- `{{eventTitle}}` (not `{{event_title}}`)
- `{{eventTime}}` (not `{{event_time}}`)
- `{{minutesBefore}}` (not `{{minutes_before}}`)
- `{{eventsToday}}` (not `{{events_today}}`)
- `{{totalEvents}}` (not `{{total_events}}`)

### Subscriber ID Mismatch

**Symptom:** Trigger API call succeeds but the user doesn't see the notification in their inbox.

**Cause:** The subscriber ID used in the backend trigger doesn't match the subscriber ID the frontend connects with.

**How Kaxio identifies subscribers:**
- **Frontend** (`NotificationInbox.jsx`): `String(user.id || user.email)`
- **Backend** (`novu_service.py`): Receives `subscriber_id` as a parameter

**Fix:** Ensure the backend passes the same subscriber ID format. For most workflows, use `str(user.id)`. For `password-reset`, the user's email is used since the user may not be logged in.

### NOVU_API_KEY Not Set

**Symptom:** No notifications are sent. Backend logs show: `"NOVU_API_KEY not set, skipping notification"`.

**Fix:** Add the key to your `.env` file:
```env
NOVU_API_KEY=your_api_key_here
```
Then restart the backend server.

### Workflow Not Published

**Symptom:** API trigger returns success but nothing is delivered.

**Fix:** In the Novu dashboard, open the workflow and ensure it has been **published** (green "Active" status). Draft workflows won't process triggers.

### Email Not Arriving

**Symptom:** In-app notifications work but emails don't arrive.

**Possible causes:**
1. No email provider configured — go to **Integrations** in the Novu dashboard and set up an email provider (SendGrid, SES, etc.)
2. Email step not added to the workflow — edit the workflow and add an Email step
3. Emails landing in spam — check spam/junk folder, especially during testing
4. Subscriber has no email address — ensure the subscriber record in Novu has an email

### SMS Not Arriving

**Symptom:** In-app and email work but SMS doesn't.

**Possible causes:**
1. No SMS provider configured — go to **Integrations** and set up Twilio, Vonage, etc.
2. Subscriber has no phone number — the user must set their phone number in Kaxio Settings (stored in `notification_preferences.phone_number`)
3. SMS step not added to the workflow

### Notification Preferences Not Respected

**Current status:** The `notification_preferences` table stores user toggles (e.g., `habit_reminders_enabled`), and the Settings UI allows toggling them, but the backend **does not yet check these preferences** before triggering notifications. This is a planned enhancement. Until implemented, all users with a valid subscriber ID will receive all triggered notifications.

---

## Quick Reference

### File Locations

| File | Purpose |
|------|---------|
| `server/services/novu_service.py` | All trigger functions and Novu API calls |
| `server/services/scheduler.py` | APScheduler background tasks (event reminders, daily schedule) |
| `server/config.py` | `NOVU_API_KEY` env var definition |
| `server/routes/auth.py` | Password reset trigger (only active trigger) |
| `server/routes/notifications.py` | Notification preferences CRUD |
| `server/models/notification_preference.py` | Preferences database model |
| `client/src/components/NotificationInbox.jsx` | Frontend Novu inbox component |
| `client/src/pages/SettingsPage.jsx` | Notification settings UI |
| `client/src/api/client.js` | `notificationsApi` fetch wrappers |

### Novu Application ID

```
ykMRI4nxQVda
```

### Environment Variable

```env
NOVU_API_KEY=your_api_key_here
```
