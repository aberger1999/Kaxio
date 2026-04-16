# Production Readiness Checklist

Use this checklist before each production launch.

## Security

- [ ] `ENVIRONMENT=production`
- [ ] `AUTO_CREATE_TABLES=false`
- [ ] `ENABLE_API_DOCS=false`
- [ ] `FORCE_HTTPS=true` (or verified at ingress/proxy)
- [ ] `CORS_ORIGINS` set only to production app domain(s)
- [ ] `ALLOWED_HOSTS` set only to API host(s)
- [ ] Strong, rotated secrets:
  - [ ] `JWT_SECRET_KEY`
  - [ ] `REFRESH_TOKEN_SECRET_KEY`
- [ ] Sentry DSN set and receiving test event
- [ ] Rate limit settings reviewed for expected traffic

## Reliability

- [ ] `/health/live` and `/health/ready` monitored
- [ ] `/healthz` and `/readyz` integrated with load balancer checks
- [ ] Alerts configured:
  - [ ] 5xx error threshold
  - [ ] latency p95 threshold
  - [ ] auth failure spike
  - [ ] DB connectivity failures
- [ ] Backups enabled and restore test performed in last 30 days

## Deployment & CI

- [ ] CI workflow passes:
  - [ ] backend checks
  - [ ] frontend lint/build
  - [ ] dependency vulnerability scans
  - [ ] container build
- [ ] Deploy workflow image build succeeded
- [ ] Render deploy hook secrets configured in GitHub
- [ ] Render health check path set to `/health/ready`
- [ ] GitHub `production` environment has required reviewers
- [ ] Production deploy run uses `confirm_production=DEPLOY`
- [ ] Rollback command documented and tested

## Data & Migrations

- [ ] Alembic migration reviewed
- [ ] Migration tested in staging with production-like data
- [ ] `alembic upgrade head` run during release
- [ ] No destructive migration without backup/rollback plan

## Verification (Post-Deploy Smoke)

- [ ] Register/login works
- [ ] Token refresh flow works
- [ ] Logout revokes session
- [ ] Read endpoint works (e.g., notes or goals)
- [ ] Write endpoint works (e.g., create note)
- [ ] No unexpected Sentry spikes after deploy
