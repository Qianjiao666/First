#!/usr/bin/env bash
set -Eeuo pipefail

artifact=/root/MKJ-community-forum-tasks-20260812-static-v1.1.zip
checksum=/root/MKJ-community-forum-tasks-20260812-static-v1.1.zip.sha256
release_root=/var/www/.mkj-community-releases
current=/var/www/MKJ
expected_revision=v1.1
expected_files=89

if [ -f "$current/RELEASE-MANIFEST.txt" ] &&
   grep -qx "Revision: $expected_revision" "$current/RELEASE-MANIFEST.txt" &&
   [ -f "$current/assets/css/visual-v1.1.css" ]; then
  echo "MKJ $expected_revision is already installed; no changes made."
  exit 0
fi

test -f "$artifact"
test -f "$checksum"
(cd /root && sha256sum -c "$(basename "$checksum")")

if unzip -Z1 "$artifact" | grep -Eq '(^/|(^|/)\.\.(/|$)|^(supabase|tests|docs|output)/)'; then
  echo "Release archive contains a forbidden path." >&2
  exit 1
fi

stamp=$(date -u +%Y%m%d-%H%M%S)
stage="$release_root/${stamp}.stage"
previous="$release_root/${stamp}.previous"
backup="$release_root/${stamp}.before-v1.1.tar.gz"

sudo install -d -m 0755 "$release_root" "$stage"
sudo unzip -q "$artifact" -d "$stage"

for required in \
  RELEASE-MANIFEST.txt \
  index.html \
  forum/index.html \
  tasks/index.html \
  shop/index.html \
  announcements/index.html \
  shared/community-widgets.js \
  assets/css/visual-v1.css \
  assets/css/visual-v1.1.css \
  assets/js/core/app-shell.js; do
  test -f "$stage/$required"
done

manifest="$stage/RELEASE-MANIFEST.txt"
grep -qx 'Release: 20260812' "$manifest"
grep -qx "Revision: $expected_revision" "$manifest"
grep -qx "Files: $expected_files" "$manifest"

count=0
while read -r expected relative; do
  relative=${relative%$'\r'}
  test -f "$stage/$relative"
  actual=$(sha256sum "$stage/$relative" | awk '{print $1}')
  expected=$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')
  test "$actual" = "$expected"
  count=$((count + 1))
done < <(sed -n '/^[[:xdigit:]]\{64\}  /p' "$manifest")
test "$count" -eq "$expected_files"

if grep -Eq 'uploadAvatar|validateAvatarFile|mkj-settings-upload-v11' "$stage/assets/js/core/app-shell.js"; then
  echo "Deferred avatar upload entry is present in the static release." >&2
  exit 1
fi

sudo find "$stage" -type d -exec chmod 755 {} \;
sudo find "$stage" -type f -exec chmod 644 {} \;
sudo tar -C /var/www -czf "$backup" MKJ

rollback_needed=0
rollback() {
  status=$?
  if [ "$rollback_needed" -eq 1 ] &&
     [ ! -e "$current" ] &&
     [ -e "$previous" ]; then
    sudo mv "$previous" "$current"
  fi
  exit "$status"
}
trap rollback ERR

sudo mv "$current" "$previous"
rollback_needed=1
sudo mv "$stage" "$current"
rollback_needed=0
trap - ERR

echo "MKJ $expected_revision installed successfully."
echo "Rollback directory: $previous"
echo "Backup archive: $backup"
