# MKJ v0.3 backup manifest

Created: 2026-08-09

This backup contains the complete static site, local assets, Supabase schema,
README, task progress, and handoff documentation for the personalization and
community release.

## Key SHA-256 hashes

```text
index.html                         7EC58DDF1099E83B45E5F46354F555E674F17A8DBA8013C64440F71DC60864FD
styles.css                        D2318305EC7D5B448429B79AEC1D63A3227239704A5156559A2539D8A7501F68
script.js                         E24975CF8FB442EE9EA65B9585765C2E945DF204ACA4CBE009C8AF7EAADEFC69
supabase-config.js                A214D83CFE32007909BA6B29AF6F2D9E6D38D40B24C8850922F4B24EA71EA457
README.md                         8E6EAFC5AC0872E0D575711516248FF72A54A429DB25383E22F909B1394D876E
HANDOFF.md                        A5A58580617F8AE50594F86CEF1E44CBD05D2FE7965B6611AAD2521C9BEDF347
TASK_PROGRESS.md                  370712BF7346587B70D282C824F91F6B0A51601898BFA86DA2B90A167EF2CF7A
supabase/schema.sql               8B1EB3E94AEB2BE60623AB78043E052A9320F365879FB8529CD734A12EB2212C
assets/data/chinese-universities.json
                                   BEDF7861331F62361E98A3C59F28B29271C53B670604959982DDEF08E5BE7124
```

Production deployment includes only `index.html`, `styles.css`, `script.js`,
`supabase-config.js`, and `assets/`. Do not copy documentation or SQL files into
`/var/www/MKJ`.
