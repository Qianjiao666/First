# MKJ Community Release Runbook

Release: 2026-08-11 community forum and task publishing
Target site: https://dsxnb.com/MKJ/
Static target: /var/www/MKJ
Supabase project ref: hzxvmrbztbyapqnwttjq

## Release artifacts

- `deployment/MKJ-community-forum-tasks-20260811-static-r7.zip`: static browser files only.
- `deployment/MKJ-community-forum-tasks-20260811-backend-r7.zip`: `supabase/schema.sql` and all Edge Functions.
- Each ZIP has a neighboring `.zip.sha256` file, and each package has an internal `RELEASE-MANIFEST.txt` for source-file hashes.

Never copy the backend package or `supabase/schema.sql` into `/var/www/MKJ`.

## Preconditions

1. Confirm the target Supabase project and the static site backup location.
2. Use the Supabase SQL Editor or an authenticated Supabase CLI session. Do not put a database password, service role key, SMTP credential, or SSH private key in this repository or in shell history.
3. Make sure the operator has a disposable USER account and an approved ADMIN account for the post-migration checks.
4. Run `supabase --help` and `supabase functions deploy --help` on the deployment machine before using the CLI. CLI flags vary by version.

## 1. Apply the database schema

Before extracting or applying either release artifact, validate both the
neighboring checksum file and every source hash in the package manifest:

```bash
artifact_dir=/path/to/deployment
cd "$artifact_dir"

sha256sum -c MKJ-community-forum-tasks-20260811-static-r7.zip.sha256
sha256sum -c MKJ-community-forum-tasks-20260811-backend-r7.zip.sha256

verify_manifest() {
  archive="$1"
  manifest_name="RELEASE-MANIFEST.txt"
  verify_dir=$(mktemp -d)
  unzip -q "$archive" -d "$verify_dir"
  manifest="$verify_dir/$manifest_name"
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

verify_manifest MKJ-community-forum-tasks-20260811-static-r7.zip
verify_manifest MKJ-community-forum-tasks-20260811-backend-r7.zip
```

Do not continue if any checksum or manifest validation fails.

Before migration, inspect the default category state:

```sql
select slug, is_active
from public.task_categories
where slug = 'career-actions';
```

If the slug already exists but is inactive, decide explicitly whether it should be reactivated before the task module is enabled. The schema intentionally does not override a previous administrator's disabled state on rerun:

```sql
update public.task_categories
set is_active = true, updated_at = now()
where slug = 'career-actions' and is_active = false;
```

Then execute the complete `supabase/schema.sql` from the backend package in the target project's SQL Editor. The script is designed to be rerunnable for this release.

After it completes, run these read-only checks:

```sql
select slug, is_active
from public.task_categories
where slug = 'career-actions';

select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'task_categories', 'task_subcategories', 'task_listings',
    'task_applications', 'task_reviews', 'task_post_links'
  )
order by relname;

select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_task', 'update_task', 'publish_task', 'close_task',
    'archive_task', 'delete_task', 'apply_task', 'assign_applicant',
    'reject_applicant', 'submit_task', 'cancel_application',
    'complete_task', 'upsert_task_category'
  )
order by p.proname;
```

The category query must return the active `career-actions` row. The RLS query must report `true` for every task table. The RPC query must report `false` for both browser roles and `true` for `service_role` on every task write function.

For the first administrator only, promote the approved account through the SQL Editor using its UUID. Do not use an email address in a shared script:

```sql
update public.user_public_profiles
set role = 'ADMIN', updated_at = now()
where user_id = '<approved-admin-user-uuid>';
```

Later role changes must use the admin UI or the protected admin function.

## 2. Deploy Edge Functions

Deploy the functions from the backend package with a Supabase CLI session. The shared `_shared` directory is bundled into each function and is not deployed as a function itself.

```bash
export SUPABASE_PROJECT_REF=hzxvmrbztbyapqnwttjq

for function_name in \
  admin-redeem-codes \
  admin-sensitive-words \
  admin-transfer-account \
  admin-users \
  forum-comment \
  forum-moderation \
  forum-post \
  forum-vote \
  redeem \
  task-admin \
  task-complete
do
  supabase functions deploy "$function_name" --project-ref "$SUPABASE_PROJECT_REF"
done
```

Keep the default JWT verification enabled. The functions perform a second user lookup and permission check, and the browser must send the current user's access token. Check the function logs after deployment without copying sensitive request headers or environment values into tickets or chat.

## 3. Deploy the static site

Create a server backup before changing the static directory. The release is
staged on the same filesystem, then switched into place as a whole directory;
this prevents files removed from the release from surviving in the live root.

```bash
timestamp=$(date -u +%Y%m%d-%H%M%S)
sudo tar -C /var/www -czf "/root/MKJ-site-before-community-${timestamp}.tar.gz" MKJ
release_root=/var/www/.mkj-community-releases
stage_dir="$release_root/${timestamp}.stage"
previous_dir="$release_root/${timestamp}.previous"
sudo install -d -m 0755 "$release_root"
sudo rm -rf "$stage_dir"
sudo install -d -m 0755 "$stage_dir"
sudo unzip -q "$artifact_dir/MKJ-community-forum-tasks-20260811-static-r7.zip" -d "$stage_dir"

# Re-check the extracted manifest immediately before the cutover.
sudo bash -c '
  set -eu
  manifest="$1/RELEASE-MANIFEST.txt"
  test -f "$manifest"
  sed -n "/^[[:xdigit:]]\\{64\\}  /p" "$manifest" | tr -d "\r" |
    while read -r expected relative; do
      expected=$(printf "%s" "$expected" | tr "[:upper:]" "[:lower:]")
      actual=$(sha256sum "$1/$relative" | awk "{print \$1}")
      test "$actual" = "$expected" || exit 1
    done
' bash "$stage_dir"

if sudo test -e /var/www/MKJ; then
  sudo rm -rf "$previous_dir"
  sudo mv /var/www/MKJ "$previous_dir"
fi
sudo mv "$stage_dir" /var/www/MKJ

# Do not change the main site's Nginx configuration or the `/` route.
```

## 4. Production acceptance

Run the following checks in order:

1. Anonymous user: `/MKJ/`, `/MKJ/community/`, `/MKJ/forum/`, and `/MKJ/tasks/` load; published forum and task reads work; task writes return `401`.
2. USER: forum post/comment/vote works; published task application and submission work; a muted account cannot write.
3. MODERATOR: forum moderation works; `/MKJ/admin/` is available; task admin write controls remain unavailable without `tasks:manage`.
4. ADMIN: task create/save draft/publish/close/archive, category management, application assignment/rejection, completion review, user management, redeem codes, sensitive words, and account transfer work.
5. Sensitive words: draft WARN is replaced and reported, publish is blocked, application WARN is replaced, application MUTE sets a 24-hour mute and rejects the write.
6. Completion retry: repeat the same completion request and verify the application cannot be completed twice and the global reputation event count does not increase.
7. Confirm the forum author's reputation badge reflects the updated global reputation.
8. Check the original assessment, account, progress, redemption, and feedback flows for regressions at desktop and mobile widths.

## Rollback

- Static rollback: move the current `/var/www/MKJ` directory aside, move the timestamped `previous_dir` back to `/var/www/MKJ`, then re-run the URL and browser smoke checks. Use the tarball only if the previous directory is unavailable.
- Edge rollback: redeploy the previous known-good function source for the affected function using the same CLI command.
- Database rollback: do not drop community tables during an incident. Preserve user data, roll back the static/Edge layers first, and investigate with the database advisors and logs before planning a separate additive migration.

Do not declare the release production-complete until the database checks, Edge deployment, role matrix, sensitive-word cases, idempotent completion, and static/browser checks all pass in the target environment.
