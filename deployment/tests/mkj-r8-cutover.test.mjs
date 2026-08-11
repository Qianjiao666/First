import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cutoverUrl = new URL('../mkj-r8-cutover.sh', import.meta.url);
const builderUrl = new URL('../build-community-release.ps1', import.meta.url);

test('cutover strips CR from manifest paths before checking files', async () => {
  const script = await readFile(cutoverUrl, 'utf8');
  const normalizePath = "relative=${relative%$'\\r'}";
  const fileCheck = 'test -f "$stage/$relative"';

  assert.ok(script.includes(normalizePath));
  assert.ok(script.indexOf(normalizePath) < script.indexOf(fileCheck));
});

test('release builder writes manifests with explicit LF line endings', async () => {
  const script = await readFile(builderUrl, 'utf8');

  assert.match(script, /\$manifestContent = \(\$manifestLines -join "`n"\) \+ "`n"/);
  assert.match(script, /\[Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(script, /\[IO\.File\]::WriteAllBytes\(\$manifest, \$manifestEncoding\.GetBytes\(\$manifestContent\)\)/);
});
