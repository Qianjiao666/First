import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (name) => fs.readFile(new URL(name, root), "utf8");

test("homepage wires the v1.4 image journey and all eight approved assets", async () => {
  const html = await read("index.html");
  const assets = [
    "alpine-lake", "misty-ridges", "future-city", "road-arch",
    "campfire-coast", "city-overlook", "pale-coast", "warm-beach",
  ];
  assert.match(html, /visual-v1\.4\.css\?v=20260816-v1\.4/);
  assert.match(html, /image-journey\.js\?v=20260816-v1\.4/);
  assert.match(html, /id="image-journey"/);
  assets.forEach((name) => assert.match(html, new RegExp(`visual-v1\\.4/route/${name}\\.jpg`)));
  assert.doesNotMatch(html, /cda96bcb15b9d52b29013a2d0f7270bc|9f5478ca98a824d561eaec8957b267b4/);
});

test("image journey motion is observer-driven and reduced-motion aware", async () => {
  const script = await read("assets/js/ui/image-journey.js");
  const css = await read("assets/css/visual-v1.4.css");
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /pointermove/);
  assert.doesNotMatch(script, /addEventListener\("scroll"/);
  assert.match(css, /transform:\s*perspective\(900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /aspect-ratio:/);
});
