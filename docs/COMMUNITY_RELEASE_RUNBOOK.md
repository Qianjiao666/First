# MKJ v1.1 Community Release Runbook

Release: 2026-08-12 v1.1 security, identity, avatars and themes

Target site: https://dsxnb.com/MKJ/

Static target: `/var/www/MKJ`

Supabase project ref: `hzxvmrbztbyapqnwttjq`

## Release artifacts

- `deployment/MKJ-community-forum-tasks-20260812-static-v1.1.zip`: static browser files only.
- `deployment/MKJ-community-forum-tasks-20260812-backend-v1.1.zip`: canonical schema, migrations, Edge Functions and this runbook.
- Each ZIP has a neighboring `.zip.sha256` file and an internal `RELEASE-MANIFEST.txt`.

Never copy the backend ZIP, `supabase/schema.sql`, migrations, tests or credentials into `/var/www/MKJ`.

## Preconditions

1. Confirm the Supabase project ref and record the current database migration/function state without printing credentials.
2. Run `supabase --help`, `supabase functions deploy --help` and the available database advisor command before live changes. CLI flags vary by version.
3. Use an approved USER account and an approved ADMIN account for acceptance. Do not record their email, password, token or UUID in this repository.
4. Keep the previous Edge Function source and `/var/www/MKJ` release available for rollback.
5. Stop if any artifact checksum, manifest entry, database advisor, RLS probe or IMS fail-closed check fails.

## 1. Verify artifacts

```bash
artifact_dir=/path/to/deployment
cd "$artifact_dir"

sha256sum -c MKJ-community-forum-tasks-20260812-static-v1.1.zip.sha256
sha256sum -c MKJ-community-forum-tasks-20260812-backend-v1.1.zip.sha256

verify_manifest() {
  archive="$1"
  verify_dir=$(mktemp -d)
  unzip -q "$archive" -d "$verify_dir"
  manifest="$verify_dir/RELEASE-MANIFEST.txt"
  test -f "$manifest"
  sed -n '/^[[:xdigit:]]\{64\}  /p' "$manifest" | tr -d '\r' |
    while read -r expected relative; do
      expected=$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')
      actual=$(sha256sum "$verify_dir/$relative" | awk '{print $1}')
      test "$actual" = "$expected" || {
        echo "Manifest hash mismatch: $archive/$relative" >&2
        exit 1
      }
    done
  rm -rf "$verify_dir"
}

verify_manifest MKJ-community-forum-tasks-20260812-static-v1.1.zip
verify_manifest MKJ-community-forum-tasks-20260812-backend-v1.1.zip
```

Do not continue if either check reports a mismatch.

## 2. Configure Supabase Secrets

Configure these names through Supabase Secrets tooling or the dashboard:

```text
TENCENTCLOUD_SECRET_ID
TENCENTCLOUD_SECRET_KEY
TENCENT_IMS_BIZ_TYPE
```

`TENCENT_IMS_BIZ_TYPE` is optional when the Tencent default policy is intentionally used. Verify only that required names exist. Never print, paste into a report, or commit their values. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` remain platform-managed Edge Function environment variables.

## 3. Apply the approved avatar migration

The only v1.1 database artifact to execute is:

```text
supabase/migrations/20260812_v1_1_avatar.sql
```

Before execution, display the complete SQL to the operator as the required SQL preview. It may only:

- add `public.user_public_profiles.avatar text`;
- create/update the existing Supabase Storage bucket named `avatars`;
- create the public-read avatar policy;
- create no table and no other business field.

Execute it through the authenticated Supabase SQL Editor or approved CLI only after that preview. Then run these read-only checks:

```sql
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_public_profiles'
  and column_name = 'avatar';

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatars';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (qual ilike '%avatars%' or with_check ilike '%avatars%')
order by policyname;
```

Required result: exactly one avatar column; public bucket; 2MB limit; only JPG/PNG/WebP MIME types; one public SELECT policy. There must be no avatar INSERT, UPDATE or DELETE policy for `anon` or `authenticated`.

Use real browser-role probes after migration. `anon` and `authenticated` avatar insert/update/delete must return false or be rejected by RLS. A public read of a reviewed avatar may succeed. Do not use the service role for the browser-write denial probes.

Run database security/performance advisors after applying the migration. Any new security advisor finding blocks deployment.

## 4. Deploy Edge Functions

Deploy every function from the verified backend package. `_shared` is bundled and is not deployed as a standalone function.

```bash
export SUPABASE_PROJECT_REF=hzxvmrbztbyapqnwttjq

for function_name in \
  admin-redeem-codes \
  admin-sensitive-words \
  admin-transfer-account \
  admin-users \
  announcements \
  avatar-upload \
  forum-comment \
  forum-moderation \
  forum-post \
  forum-vote \
  notifications \
  redeem \
  shop \
  task-admin \
  task-attachments \
  task-complete \
  task-review
do
  supabase functions deploy "$function_name" --project-ref "$SUPABASE_PROJECT_REF"
done
```

Keep JWT verification enabled. After deployment:

1. Send an unauthenticated write probe to every state-changing function and require `401`.
2. Send malformed avatar data with a valid test token and require `400` without a Storage object.
3. Verify function logs contain no Authorization header, file content or secret value.

## 5. Verify real Tencent IMS

Use a dedicated authenticated test user and record only timestamps, result classes and redacted request IDs.

1. Upload a benign JPG, PNG or WebP under 2MB. Require Tencent `Suggestion: Pass`, profile URL update and one object at `{JWT userId}/avatar.{ext}`.
2. Upload a controlled policy-violating test image approved for security testing. Tencent `Suggestion: Review` or `Suggestion: Block` must be rejected, and the user path must contain no object created by that request.
3. Exercise missing/invalid IMS configuration in a non-production preview or otherwise controlled invocation. It must fail closed, preserve the prior good avatar and create no object from the rejected request.
4. Attempt an extension/MIME mismatch, corrupt image and payload over 2MB. Each must fail before IMS/Storage as appropriate.

Mock results do not satisfy this gate. Production deployment cannot proceed until both real Pass and real Review/Block behavior are observed and rejected images are proven absent from Storage.

## 6. Deploy the static site

Only `/var/www/MKJ` may change. Do not modify Nginx or the main `/` route.

```bash
timestamp=$(date -u +%Y%m%d-%H%M%S)
sudo tar -C /var/www -czf "/var/www/.mkj-community-releases/${timestamp}.before-v1.1.tar.gz" MKJ
release_root=/var/www/.mkj-community-releases
stage_dir="$release_root/${timestamp}.stage"
previous_dir="$release_root/${timestamp}.previous"
sudo install -d -m 0755 "$release_root"
sudo rm -rf "$stage_dir"
sudo install -d -m 0755 "$stage_dir"
sudo unzip -q "$artifact_dir/MKJ-community-forum-tasks-20260812-static-v1.1.zip" -d "$stage_dir"

sudo bash -c '
  set -eu
  manifest="$1/RELEASE-MANIFEST.txt"
  test -f "$manifest"
  sed -n "/^[[:xdigit:]]\{64\}  /p" "$manifest" | tr -d "\r" |
    while read -r expected relative; do
      expected=$(printf "%s" "$expected" | tr "[:upper:]" "[:lower:]")
      actual=$(sha256sum "$1/$relative" | awk "{print \$1}")
      test "$actual" = "$expected" || exit 1
    done
' bash "$stage_dir"

if sudo test -e /var/www/MKJ; then
  sudo mv /var/www/MKJ "$previous_dir"
fi
sudo mv "$stage_dir" /var/www/MKJ
```

Do not delete older `.previous` or tar backups during this deployment.

## 7. Production acceptance

Run the authenticated and anonymous smoke suite before declaring v1.1 complete:

1. Login updates the navbar without reload across home, forum and tasks; logout, expired token and remote sign-out show the re-login prompt.
2. Guests opening forum/new or protected task actions remain on a visible page and receive the login dialog.
3. Publish a benign post/comment and complete cleanup through existing business actions.
4. Apply to and submit a task, then clean up test data through existing workflow actions.
5. XSS is rejected in the browser and by direct backend invocation. WARN text is persisted with `*`; BLOCK content persists nothing.
6. A benign avatar appears in navigation, posts and comments. A real IMS Review/Block avatar is rejected and creates no object.
7. Complete all 10 assessment questions and verify unchanged score/report behavior.
8. Verify all three themes, localStorage persistence, 20 pages at 375/768/1280/1920, mobile navigation, task table reflow, modal backdrop and one disclaimer per page.
9. Verify `https://dsxnb.com/` remains HTTP 200 and does not load MKJ v1.1 assets.

## Rollback

- Static: move the current `/var/www/MKJ` aside and restore the timestamped `.previous`; use the tar backup only if needed.
- Edge: redeploy the previous known-good source for affected functions.
- Database: do not drop tables or remove the avatar column during an incident. Roll back static/Edge layers first and investigate with advisors/logs before a separately reviewed additive migration.
- IMS: if real moderation cannot be verified, keep `avatar-upload` unavailable. Never bypass or disable moderation.

Do not declare production complete until SQL/RLS checks, real IMS Pass and Review/Block, function auth probes, static integrity and all production smoke cases pass.
