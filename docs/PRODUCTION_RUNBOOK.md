# Production Runbook

This runbook covers deployment, rollback, and incident response for Quorex.

## 1) Preconditions

- Production secrets are configured (never from committed files):
  - `DATABASE_URL`
  - `JWT_SECRET_KEY`
  - `REFRESH_TOKEN_SECRET_KEY`
  - `SENTRY_DSN`
- Required production toggles:
  - `ENVIRONMENT=production`
  - `AUTO_CREATE_TABLES=false`
  - `ENABLE_API_DOCS=false`
  - `LOG_JSON=true`
- Alembic migrations are up to date and tested in staging.
- CI checks are green on the release commit.

## 2) Deploy Procedure

1. **Create release tag**
   - `git tag vYYYY.MM.DD-N`
   - `git push origin --tags`
2. **Build image**
   - Use `.github/workflows/deploy.yml` (`workflow_dispatch`) to build and push a tagged image.
3. **Apply database migration**
   - `alembic upgrade head`
4. **Deploy application**
   - Pull and run the new image on the target platform.
5. **Run smoke tests**
   - `GET /health/live` -> `200`
   - `GET /health/ready` -> `200`
   - Login + refresh flow
   - One read endpoint and one write endpoint
6. **Observe for 15 minutes**
   - Monitor error rate, latency, DB health, and logs.

### Render-specific path

- Trigger deployment with `.github/workflows/deploy.yml`.
- Ensure GitHub secrets are set:
  - `RENDER_STAGING_DEPLOY_HOOK_URL`
  - `RENDER_PRODUCTION_DEPLOY_HOOK_URL`
  - Optional smoke URLs:
    - `RENDER_STAGING_APP_URL`
    - `RENDER_PRODUCTION_APP_URL`
- Keep Render health check path set to `/health/ready`.

## 3) Rollback Procedure

Use rollback when error rates spike, authentication fails, or critical user paths break.

1. Identify last known good image tag.
2. Redeploy previous image.
3. If current migration is backward-incompatible:
   - Prefer forward-fix migration.
   - Use `alembic downgrade -1` only if tested and safe.
4. Validate rollback:
   - `GET /health/ready` returns `200`
   - Core auth and CRUD smoke tests pass.
5. Keep incident notes (timeline + root cause candidates).

## 4) Incident Response

### Severity definitions

- **SEV-1**: Full outage, data corruption risk, security incident.
- **SEV-2**: Major feature unavailable for many users.
- **SEV-3**: Partial degradation with workaround.

### Response steps

1. **Detect**
   - Alert from uptime, 5xx surge, or latency threshold.
2. **Triage**
   - Check `/health/ready`, DB reachability, and recent deploys.
3. **Contain**
   - Rollback if user impact is high and cause unknown.
4. **Mitigate**
   - Hotfix or config adjustment.
5. **Communicate**
   - Post current status, impact, ETA, and workaround.
6. **Recover**
   - Confirm normal metrics and error rates.
7. **Postmortem**
   - Document root cause, remediation, and prevention tasks.

## 5) Security Event Handling

If token misuse, credential leak, or suspicious auth activity is detected:

1. Rotate `JWT_SECRET_KEY` and `REFRESH_TOKEN_SECRET_KEY`.
2. Revoke active refresh tokens (delete/mark revoked in `refresh_tokens`).
3. Invalidate active sessions by forcing re-login.
4. Review logs and Sentry events for affected users/actions.
5. Add a permanent detection/alerting rule for recurrence.

## 6) Routine Ops Cadence

- Daily: health checks, error-rate scan.
- Weekly: dependency updates and vulnerability triage.
- Monthly: backup restore drill and token/session controls review.
