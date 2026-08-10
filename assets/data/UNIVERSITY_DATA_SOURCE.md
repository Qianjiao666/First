# University data source

The university search is designed around the following open-source dataset:

- Repository: https://github.com/xioajiumi/Chinese_Universities
- License: MIT
- Upstream scope observed during project research: 582 Chinese universities
- Local runtime file: `chinese-universities.json`

The local JSON is a slim offline index containing all 582 upstream records and
only the runtime fields `name`, `nameEng`, and `location`. It intentionally
avoids runtime requests to GitHub so the site continues to work on networks
where GitHub is unavailable. Users can still type a school that is not present
in the local suggestions.

The index was generated from the upstream `Chinese_Universities.json` dataset
on 2026-08-10. The upstream file is newline-concatenated JSON rather than a
single JSON array; the generated runtime file is a normal JSON array with 582
unique school names. The frontend loader requires no code changes.
