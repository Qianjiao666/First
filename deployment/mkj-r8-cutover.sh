#!/usr/bin/env bash
set -Eeuo pipefail

artifact=/root/MKJ-community-forum-tasks-20260811-static-r8.zip
checksum=/root/MKJ-community-forum-tasks-20260811-static-r8.zip.sha256
release_root=/var/www/.mkj-community-releases
current=/var/www/MKJ

if [ -f "$current/shop/index.html" ] &&
   [ -f "$current/announcements/index.html" ] &&
   [ -f "$current/shared/community-widgets.js" ]; then
  echo "MKJ r8 is already installed; no changes made."
  exit 0
fi

sha256sum -c "$checksum"
stamp=$(date -u +%Y%m%d-%H%M%S)
stage="$release_root/${stamp}.stage"
previous="$release_root/${stamp}.previous"

sudo install -d -m 0755 "$release_root" "$stage"
sudo unzip -q "$artifact" -d "$stage"

for required in \
  RELEASE-MANIFEST.txt \
  forum/index.html \
  tasks/index.html \
  shop/index.html \
  announcements/index.html \
  shared/community-widgets.js; do
  test -f "$stage/$required"
done

manifest="$stage/RELEASE-MANIFEST.txt"
count=0
while read -r expected relative; do
  test -f "$stage/$relative"
  actual=$(sha256sum "$stage/$relative" | awk '{print $1}')
  expected=$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')
  test "$actual" = "$expected"
  count=$((count + 1))
done < <(sed -n '/^[[:xdigit:]]\{64\}  /p' "$manifest")
test "$count" -gt 0

sudo find "$stage" -type d -exec chmod 755 {} \;
sudo find "$stage" -type f -exec chmod 644 {} \;

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

echo "MKJ r8 installed successfully."
echo "Rollback directory: $previous"
