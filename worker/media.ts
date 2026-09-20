import { assets, type Entry } from "../src/lib/validation";
import { fail } from "./errors";

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export async function verifyPublishedAssets(media: R2Bucket, entry: Entry) {
  for (const asset of assets(entry)) {
    const head = await media.head(asset.key);
    if (
      !head ||
      head.size !== asset.bytes ||
      head.httpMetadata?.contentType !== asset.mimeType
    )
      fail(400, "媒体未确认或已改变，请重新上传");
    if (head.customMetadata?.entryId === entry.id) continue;

    // Directly imported media has no upload receipt metadata. Verify its
    // recorded digest against the actual object before accepting an update.
    if (!asset.sha256) fail(400, "媒体缺少可核验的上传信息");
    const object = await media.get(asset.key, {
      onlyIf: { etagMatches: head.etag },
    });
    if (
      !object ||
      !("body" in object) ||
      object.size !== asset.bytes ||
      object.httpMetadata?.contentType !== asset.mimeType
    )
      fail(409, "媒体在验证期间已改变，请重试");
    const digest = hex(await crypto.subtle.digest("SHA-256", await object.arrayBuffer()));
    if (digest !== asset.sha256) fail(400, "媒体内容与记录的校验值不一致");
  }
}
