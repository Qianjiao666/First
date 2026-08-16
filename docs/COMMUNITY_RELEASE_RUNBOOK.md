# MKJ v1.3 Collaborative Task Market Release Runbook

Release: 2026-08-16 v1.3

Target: `https://dsxnb.com/MKJ/`

Static target: `/var/www/MKJ`

Supabase project ref: `hzxvmrbztbyapqnwttjq`

## Release artifacts

- `deployment/MKJ-community-forum-tasks-20260816-static-v1.3.zip`: browser files only.
- `deployment/MKJ-community-forum-tasks-20260816-backend-v1.3.zip`: canonical schema, migrations, Edge Functions and this runbook.

Never copy the backend ZIP, `supabase/schema.sql`, migrations, tests, docs or credentials into `/var/www/MKJ`.

## Preconditions

1. Use approved publisher, student and administrator accounts. Do not record their identifiers, passwords or tokens.
2. Confirm the linked Supabase project and inspect the current migration/function state without printing secrets.
3. Keep the prior Edge Function source and `/var/www/MKJ` release for rollback.
4. Stop on a checksum, manifest, migration, advisor, RLS, authorization or browser-smoke failure.

## 1. Verify packages

```bash
cd /path/to/deployment
sha256sum -c MKJ-community-forum-tasks-20260816-static-v1.3.zip.sha256
sha256sum -c MKJ-community-forum-tasks-20260816-backend-v1.3.zip.sha256
```

Extract each package into a temporary directory. For every `RELEASE-MANIFEST.txt` entry, strip `\r`, normalize the expected hash to lowercase, and compare it with `sha256sum` for the extracted file. The static package must contain no `supabase`, `tests`, `docs` or `output` path.

## 2. Apply the collaboration migration

Preview the complete approved migration before execution:

```text
supabase/migrations/20260815_collaborative_task_market.sql
```

Apply it through the authenticated Supabase SQL Editor or approved CLI. Then run database security/performance advisors. Any new security finding blocks deployment.

Use real browser-role probes, never the service role, to prove:

1. A non-member cannot read a consultation or collaboration conversation.
2. An accepted member can read/write active collaboration; a stale or terminal member cannot write messages, assignments or peer reviews.
3. An applicant consultation is private to the applicant and task creator.
4. A publisher cannot publish without the configured eligibility or an active administrator override.
5. A creator cannot review themself; peer reviews retain all three dimensions.
6. `get_task_collaboration_admin` rejects an empty reason, permits only `tasks:manage`, and creates an audit record for a valid reason.
7. No task, template, form, function payload or UI flow accepts `price`, `payment`, `wallet`, `refund` or `payout` fields.

## 3. Deploy Edge Functions

Deploy from the verified backend package with JWT verification enabled:

```bash
export SUPABASE_PROJECT_REF=hzxvmrbztbyapqnwttjq
for function_name in task-admin task-complete task-collaboration; do
  supabase functions deploy "$function_name" --project-ref "$SUPABASE_PROJECT_REF"
done
```

Probe unauthenticated state-changing actions and require `401`. With authenticated roles, verify sensitive text is filtered, muted users cannot write, consultation membership is enforced, collaboration writes become read-only at terminal state, and exceptional administrator reads require a non-empty audit reason. Function logs must not contain Authorization headers or secret values.

## 4. Static cutover

Only after the database and Edge Function gates pass, upload the static ZIP, adjacent checksum and `deployment/mkj-v1.3-cutover.sh` to `/root/`. On the server run:

```bash
sha256sum -c /root/MKJ-community-forum-tasks-20260816-static-v1.3.zip.sha256
chmod 700 /root/mkj-v1.3-cutover.sh && /bin/bash /root/mkj-v1.3-cutover.sh
```

The script changes only `/var/www/MKJ`, validates every manifest entry, rejects forbidden archive paths, keeps a timestamped tar backup and preserves a `.previous` rollback directory. Do not modify Nginx or the main `/` route.

## 5. Production acceptance

At desktop and mobile widths, inspect `/MKJ/tasks/`, `/MKJ/tasks/create/`, `/MKJ/tasks/detail/`, `/MKJ/tasks/my/` and `/MKJ/admin/tasks/` for overflow, overlap, console errors and expected login gates.

Using the approved accounts, publish a collaborative task, apply, exchange a private consultation, accept members, assign responsibilities, exchange collaboration messages, submit all three peer-review dimensions, and perform creator final review. Confirm closed/archived task collaboration is read-only. Confirm campus group buying is represented only as a collaboration task and presents no price, payment, wallet, refund or payout flow.

Verify `https://dsxnb.com/` remains HTTP 200 and does not load MKJ release assets.

## Rollback

- Static: restore the timestamped `.previous` directory; use its tar backup only if needed.
- Edge: redeploy the prior known-good sources for affected functions.
- Database: do not drop collaborative tables during an incident. First roll back static/Edge layers and investigate with advisors/audit logs; use a separately reviewed additive migration for a database correction.

Do not declare v1.3 deployed until all migration, RLS, Edge Function, static integrity and production acceptance checks pass.
