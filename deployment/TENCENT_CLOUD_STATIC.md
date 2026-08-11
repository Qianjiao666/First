# Tencent Cloud Static Deployment

This project publishes the browser-only release to Tencent Cloud COS and uses
Tencent Cloud CDN for cache invalidation. The Supabase schema and Edge
Functions are deployed separately; never upload them into the COS web root.

## Files

- `build-community-release.ps1` builds a static stage and a backend stage.
- `tencent-cos.env.example` documents non-secret bucket, region, and CDN values.
- `tencent-cos-upload.ps1` recursively uploads a static stage with `coscli`.
- `tencent-cdn-purge.ps1` calls `tccli cdn PurgePathCache` for selected URLs.

## Credentials

Copy `tencent-cos.env.example` to `tencent-cos.env` for local values. The
example intentionally contains no SecretId or SecretKey. Configure `coscli`
and `tccli` with a local credential profile, CI secret store, or short-lived
environment variables (`TENCENTCLOUD_SECRET_ID` and
`TENCENTCLOUD_SECRET_KEY`). The scripts never accept credentials as command
arguments, print them, or write them to the repository.

## Release flow

From the repository root, build the two release artifacts:

```powershell
pwsh -File deployment/build-community-release.ps1 -ReleaseDate 20260811 -Revision r8
```

Set `COS_SOURCE_DIR` in `tencent-cos.env` to the generated static stage, then
upload it:

```powershell
pwsh -File deployment/tencent-cos-upload.ps1 -EnvFile deployment/tencent-cos.env
```

Purge the HTML shell and any changed routes after upload:

```powershell
pwsh -File deployment/tencent-cdn-purge.ps1 -EnvFile deployment/tencent-cos.env
```

Use `-DryRun` on either helper to validate paths and inspect the command or
purge payload without contacting Tencent Cloud.

## Cache and routing assumptions

- COS serves the `/MKJ/` prefix (or the `COS_PREFIX` value) as the static web
  root; the primary domain and Supabase redirect URLs remain unchanged.
- CDN should cache versioned assets for a long TTL and keep HTML short-lived;
  purge at least `/MKJ/` and `/MKJ/index.html` for a release.
- Authenticated Supabase and Edge Function requests must remain uncached and
  continue to use the configured project URL.

## Verification

Before announcing a release, check HTTP 200 for `/MKJ/`, `/MKJ/index.html`,
`/MKJ/shop/`, `/MKJ/announcements/`, and representative assets. Confirm that
the browser console has no module-loading errors and that the Supabase backend
release was applied independently.
