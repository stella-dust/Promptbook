import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyPublishedAssets } from "../worker/media";

const data = new TextEncoder().encode("verified image bytes");
const sha256 = createHash("sha256").update(data).digest("hex");
const key = "published/t2p-test-entry/" + "a".repeat(32) + ".png";
const entry = (digest: string | null) =>
  ({
    id: "t2p-test-entry",
    outputs: [
      {
        original: { key, bytes: data.length, mimeType: "image/png", sha256: digest },
        thumbnail: { key, bytes: data.length, mimeType: "image/png", sha256: digest },
      },
    ],
    references: [],
  }) as any;

test("direct imports require a matching SHA-256 before publication", async () => {
  const media = {
    head: async () => ({
      size: data.length,
      etag: "original-etag",
      httpMetadata: { contentType: "image/png" },
      customMetadata: {},
    }),
    get: async (_key: string, options: any) => {
      assert.equal(options.onlyIf.etagMatches, "original-etag");
      return {
        body: new ReadableStream(),
        size: data.length,
        httpMetadata: { contentType: "image/png" },
        arrayBuffer: async () => data.buffer,
      };
    },
  } as any;
  await verifyPublishedAssets(media, entry(sha256));
  await assert.rejects(verifyPublishedAssets(media, entry("0".repeat(64))), /校验值/);
  await assert.rejects(verifyPublishedAssets(media, entry(null)), /缺少可核验/);
});
