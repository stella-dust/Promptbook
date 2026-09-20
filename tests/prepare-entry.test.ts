import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateBeforeUpload } from "../src/lib/prepare-entry";
import type { LocalFile } from "../src/lib/drafts";
const entry = () =>
  JSON.parse(fs.readFileSync("templates/image-entry.example.json", "utf8"));
const file: LocalFile = {
  id: "local-output",
  file: new Blob(["fixture"], { type: "image/png" }),
  thumbnail: new Blob(["fixture"], { type: "image/webp" }),
  name: "image.png",
  alt: "测试图片",
  width: 100,
  height: 100,
  duration: null,
};
test("local image and selected reference validate before obtaining public keys", () => {
  const e = entry();
  e.outputs = [];
  e.coverOutputId = file.id;
  validateBeforeUpload(
    e,
    [],
    [file],
    [{ ...file, referenceRole: "first-frame" }],
  );
  assert.equal(e.outputs.length, 0);
});
test("invalid metadata is rejected before uploading otherwise valid media", () => {
  const e = entry();
  e.outputs = [];
  e.coverOutputId = file.id;
  e.generation.parameters = { nested: { bad: true } };
  assert.throws(() => validateBeforeUpload(e, [], [file], []));
});
test("combined local references count toward total file budget", () => {
  const e = entry();
  e.kind = "video";
  e.coverOutputId = "local-video";
  const video = {
    ...file,
    id: "local-video",
    file: { size: 250 * 1024 ** 2, type: "video/mp4" } as Blob,
    duration: 10,
  };
  const refs = Array.from({ length: 3 }, () => ({
    ...file,
    file: { size: 40 * 1024 ** 2, type: "image/png" } as Blob,
  }));
  assert.throws(
    () =>
      validateBeforeUpload(
        e,
        [],
        [video, { ...video, id: "local-video-two" }],
        refs,
      ),
    /600/,
  );
});
