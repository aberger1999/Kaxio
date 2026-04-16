# Render Deployment Guide

This guide wires Quorex deployment to Render using the existing Docker-based setup.

## 0) Important in Render UI

In the "New Web Service" form (the screen you shared), switch from Python defaults to Docker-based deploy:

- **Language/Runtime:** `Docker` (not `Python 3`)
- **Root Directory:** leave empty (repo root)
- **Build/Start command fields:** not needed with Docker runtime
- **Region:** choose closest to your Supabase database region

If Render keeps Python mode for any reason, do **not** use the default `gunicorn your_application.wsgi`.
This app uses FastAPI/Uvicorn.

## 1) Create Render Services

Create two Render web services from this repo:

- `quorex-staging`
- `quorex-production`

Both can use the root `Dockerfile`. Configure:

- **Health check path:** `/health/ready`
- **Auto deploy:** enabled for staging, optional/manual for production

## 2) Required Environment Variables in Render

Staging (`quorex-staging`) baseline:

- `ENVIRONMENT=staging`
- `AUTO_CREATE_TABLES=false`
- `ENABLE_API_DOCS=true`
- `LOG_JSON=true`
- `FORCE_HTTPS=true`
- `CORS_ORIGINS=https://staging-app.example.com` (replace)
- `ALLOWED_HOSTS=quorex-staging.onrender.com` (replace if custom domain)

Production (`quorex-production`) baseline:

- `ENVIRONMENT=production`
- `AUTO_CREATE_TABLES=false`
- `ENABLE_API_DOCS=false`
- `LOG_JSON=true`
- `FORCE_HTTPS=true`
- `CORS_ORIGINS=https://app.example.com` (replace)
- `ALLOWED_HOSTS=api.example.com` (replace)

Secrets in both services:

- `DATABASE_URL=<supabase-postgres-url>`
- `JWT_SECRET_KEY=<strong-secret>`
- `REFRESH_TOKEN_SECRET_KEY=<different-strong-secret>`
- `SENTRY_DSN=<optional-dsn>`

## 3) GitHub Secrets for Deploy Workflow

Add these repo secrets:

- `RENDER_STAGING_DEPLOY_HOOK_URL`
- `RENDER_PRODUCTION_DEPLOY_HOOK_URL`
- `RENDER_STAGING_APP_URL` (optional, enables smoke check)
- `RENDER_PRODUCTION_APP_URL` (optional, enables smoke check)

Deploy hook URLs come from Render service settings:
**Settings -> Deploy Hook**.

## 4) Deploy from GitHub Actions

Use `.github/workflows/deploy.yml` via **Run workflow**:

1. Choose environment (`staging` or `production`)
2. Optionally provide release identifier
3. For production, set `confirm_production` to `DEPLOY`
4. Workflow triggers Render deploy hook
5. If app URL secret is set, workflow hits `/health/ready` as smoke check

## 4.1) Add manual approval for production

In GitHub:

1. Open repo **Settings -> Environments**
2. Create/select `production`
3. Add **Required reviewers** for approval
4. Keep `staging` without required reviewers

This gives a true approval gate before production deploy jobs run.

## 5) Database Migrations

Run migrations as part of your release process:

- `alembic upgrade head`

Recommended pattern:

- Run migration in staging first
- Validate core flows
- Promote to production

## 6) Rollback

If deploy is unhealthy:

1. Roll back to previous Render deploy from dashboard
2. Confirm `/health/ready` returns `200`
3. Validate login + a read + a write endpoint
4. If needed, run forward-fix migration
