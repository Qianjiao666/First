# University data source

The university search is designed around the following open-source dataset:

- Repository: https://github.com/xioajiumi/Chinese_Universities
- License: MIT
- Upstream scope observed during project research: 582 Chinese universities
- Local runtime file: `chinese-universities.json`

The local JSON is a slim offline index containing only `name`, `nameEng`, and
`location`. It intentionally avoids runtime requests to GitHub so the site
continues to work on networks where GitHub is unavailable. Users can still type
a school that is not present in the local suggestions.

The full upstream CSV download was blocked by the local command approval service
on 2026-08-09. Replace the local index with a generated copy of the upstream CSV
after download approval; the frontend loader requires no code changes.
