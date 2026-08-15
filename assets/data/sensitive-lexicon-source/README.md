# Sensitive lexicon source

- Upstream: https://github.com/mimikin/AI-Sensitive-Word-Bank
- Pinned revision: `b3d98147a08a4af4600622c5ec110b53dee48093`
- Upstream commit date: `2021-02-19T16:00:06Z`
- Retrieved: `2026-08-12`
- License: MIT, preserved in `LICENSE`
- Original file: `sensitive-words.txt`
- Original SHA-256: `106E3B11F2F60DAFDAE61E13F72DEA9B1AE1DEFF681BE6756A6533C1405D47A8`
- Normalized file: `words.txt`
- Normalized terms: `11788`
- Normalized SHA-256: `196E6251FBFDB92BEE24BBB3D9E5059D07C29B472FA995C36FAA86AFC9431DC0`

The snapshot is used as the default `WARN` lexicon. High-risk `BLOCK` terms and
small project-specific additions are code-only constants; no browser management
screen or database table controls this lexicon.

Normalization command:

```powershell
node -e "const fs=require('fs');const p=process.argv[1];const o=process.argv[2];const words=[...new Set(fs.readFileSync(p,'utf8').split(/\r?\n/u).map(x=>x.normalize('NFKC').replace(/^\uFEFF/u,'').trim()).filter(Boolean))].sort();fs.writeFileSync(o,words.join('\n')+'\n',{encoding:'utf8'});" sensitive-words.txt words.txt
```

Generated browser and Edge constants are rebuilt with:

```powershell
node tools/build-sensitive-lexicon.mjs
```
