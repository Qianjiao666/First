import test from "node:test";
import assert from "node:assert/strict";

import { validateAvatarBytes } from "../../supabase/functions/_shared/image-validation.ts";

const ascii = (value) => Uint8Array.from([...value].map((char) => char.charCodeAt(0)));

function png(width = 1, height = 1) {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff,
    (height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff,
    0x08, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function jpeg(width = 1, height = 1) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >>> 8) & 0xff, height & 0xff, (width >>> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x00, 0xff, 0xd9,
  ]);
}

function webp(width = 1, height = 1) {
  const bytes = new Uint8Array(38);
  bytes.set(ascii("RIFF"), 0);
  new DataView(bytes.buffer).setUint32(4, 30, true);
  bytes.set(ascii("WEBPVP8X"), 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  const view = new DataView(bytes.buffer);
  view.setUint8(24, (width - 1) & 0xff);
  view.setUint8(25, ((width - 1) >>> 8) & 0xff);
  view.setUint8(26, ((width - 1) >>> 16) & 0xff);
  view.setUint8(27, (height - 1) & 0xff);
  view.setUint8(28, ((height - 1) >>> 8) & 0xff);
  view.setUint8(29, ((height - 1) >>> 16) & 0xff);
  bytes.set(ascii("VP8 "), 30);
  return bytes;
}

test("accepts only matching JPEG, PNG and WebP avatar bytes", () => {
  assert.deepEqual(validateAvatarBytes({ bytes: jpeg(320, 240), contentType: "image/jpeg", fileName: "avatar.jpg" }), {
    extension: "jpg", mimeType: "image/jpeg", width: 320, height: 240,
  });
  assert.deepEqual(validateAvatarBytes({ bytes: png(64, 48), contentType: "image/png", fileName: "avatar.png" }), {
    extension: "png", mimeType: "image/png", width: 64, height: 48,
  });
  assert.deepEqual(validateAvatarBytes({ bytes: webp(12, 10), contentType: "image/webp", fileName: "avatar.webp" }), {
    extension: "webp", mimeType: "image/webp", width: 12, height: 10,
  });
});

test("rejects spoofed, unsupported and mismatched avatar formats", () => {
  const invalid = [
    { bytes: ascii("<html><script>alert(1)</script></html>"), contentType: "image/jpeg", fileName: "avatar.jpg" },
    { bytes: png(), contentType: "image/jpeg", fileName: "avatar.jpg" },
    { bytes: png(), contentType: "image/png", fileName: "avatar.webp" },
    { bytes: ascii("GIF89a"), contentType: "image/gif", fileName: "avatar.gif" },
    { bytes: ascii("<svg xmlns='http://www.w3.org/2000/svg'/>") , contentType: "image/svg+xml", fileName: "avatar.svg" },
  ];
  for (const input of invalid) {
    assert.throws(
      () => validateAvatarBytes(input),
      (error) => error?.code === "INVALID_AVATAR" && error?.status === 400,
    );
  }
});

test("rejects oversized bytes, corrupt dimensions and pixel bombs", () => {
  assert.throws(
    () => validateAvatarBytes({ bytes: new Uint8Array(2 * 1024 * 1024 + 1), contentType: "image/png", fileName: "a.png" }),
    (error) => error?.code === "INVALID_AVATAR" && /2MB/.test(error.message),
  );
  assert.throws(
    () => validateAvatarBytes({ bytes: png(0, 10), contentType: "image/png", fileName: "a.png" }),
    (error) => error?.code === "INVALID_AVATAR",
  );
  assert.throws(
    () => validateAvatarBytes({ bytes: png(4096, 4096), contentType: "image/png", fileName: "a.png" }),
    (error) => error?.code === "INVALID_AVATAR" && /像素/.test(error.message),
  );
  assert.throws(
    () => validateAvatarBytes({ bytes: jpeg(5000, 100), contentType: "image/jpeg", fileName: "a.jpeg" }),
    (error) => error?.code === "INVALID_AVATAR" && /尺寸/.test(error.message),
  );
});
