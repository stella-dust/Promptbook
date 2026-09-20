import { AwsClient } from "aws4fetch";
import { SignJWT, jwtVerify } from "jose";
import { fail, exact } from "./errors";
import type { Env } from "./env";
import { extensions } from "../src/lib/validation";
type Receipt = {
  entryId: string;
  requestId: string;
  stagingKey: string;
  finalKey: string;
  bytes: number;
  mimeType: string;
  role: string;
};
const secret = (env: Env) => {
  if (!env.UPLOAD_RECEIPT_SECRET || env.UPLOAD_RECEIPT_SECRET.length < 32)
    fail(503, "上传签名尚未配置");
  return new TextEncoder().encode(env.UPLOAD_RECEIPT_SECRET);
};
function buckets(env: Env) {
  if (!env.STAGING || !env.MEDIA) fail(503, "媒体存储尚未配置");
  return { staging: env.STAGING, media: env.MEDIA };
}
export async function presign(env: Env, body: unknown) {
  exact(body, ["entryId", "requestId", "role", "mimeType", "bytes"]);
  const { entryId, requestId, role, mimeType, bytes } = body;
  if (
    typeof entryId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{2,79}$/.test(entryId) ||
    typeof requestId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(requestId) ||
    typeof mimeType !== "string" ||
    !extensions[mimeType] ||
    typeof role !== "string" ||
    !["original", "preview", "thumbnail", "reference"].includes(role)
  )
    fail(400, "上传声明无效");
  if (
    typeof bytes !== "number" ||
    !Number.isInteger(bytes) ||
    bytes <= 0 ||
    bytes > (mimeType.startsWith("image/") ? 40 : 250) * 1024 ** 2
  )
    fail(413, "文件大小超出限制");
  if (role !== "original" && !mimeType.startsWith("image/"))
    fail(400, "预览和参考文件必须是图片");
  buckets(env);
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID)
    fail(503, "R2 直传尚未配置");
  const assetId = crypto.randomUUID().replaceAll("-", "");
  const payload: Receipt = {
    entryId,
    requestId,
    role,
    mimeType,
    bytes,
    stagingKey: `staging/${entryId}/${assetId}.${extensions[mimeType]}`,
    finalKey: `published/${entryId}/${assetId}.${extensions[mimeType]}`,
  };
  const receipt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret(env));
  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.STAGING_BUCKET_NAME}/${payload.stagingKey}`,
  );
  url.searchParams.set("X-Amz-Expires", "900");
  const signed = await aws.sign(url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    aws: { signQuery: true, allHeaders: true },
  });
  return {
    uploadUrl: signed.url,
    receipt,
    expiresAt: new Date(Date.now() + 900000).toISOString(),
    headers: { "Content-Type": mimeType },
  };
}
export function matchesMagic(b: Uint8Array, mime: string) {
  const str = (start: number, end: number) =>
    String.fromCharCode(...b.slice(start, end));
  switch (mime) {
    case "image/png":
      return (
        b.length >= 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => b[i] === x)
      );
    case "image/jpeg":
      return b[0] === 255 && b[1] === 216 && b[2] === 255;
    case "image/webp":
      return str(0, 4) === "RIFF" && str(8, 12) === "WEBP";
    case "video/mp4":
      return (
        str(4, 8) === "ftyp" &&
        ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "qt  "].some((s) =>
          str(8, 64).includes(s),
        ) &&
        !str(8, 64).includes("avif")
      );
    case "video/webm":
      return (
        b[0] === 26 &&
        b[1] === 69 &&
        b[2] === 223 &&
        b[3] === 163 &&
        str(0, b.length).includes("webm")
      );
    default:
      return false;
  }
}
function same(object: R2Object, r: Receipt) {
  return (
    object.size === r.bytes &&
    object.httpMetadata?.contentType === r.mimeType &&
    object.customMetadata?.requestId === r.requestId &&
    object.customMetadata?.entryId === r.entryId &&
    !!object.customMetadata?.sourceEtag
  );
}
export async function finalize(env: Env, body: unknown) {
  exact(body, ["receipt"]);
  if (typeof body.receipt !== "string" || body.receipt.length > 4000)
    fail(400, "上传凭据无效");
  let r: Receipt;
  try {
    const { payload } = await jwtVerify(body.receipt, secret(env), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    r = payload as unknown as Receipt;
  } catch {
    fail(400, "上传凭据过期，请重新上传此文件");
  }
  const { staging, media } = buckets(env);
  const asset = {
    key: r.finalKey,
    mimeType: r.mimeType,
    bytes: r.bytes,
    sha256: null,
  };
  const existing = await media.head(r.finalKey);
  if (existing) {
    if (!same(existing, r)) fail(409, "媒体对象冲突");
    return { asset };
  }
  const head = await staging.head(r.stagingKey);
  if (!head) fail(400, "未找到上传文件，请重试");
  if (head.size !== r.bytes || head.httpMetadata?.contentType !== r.mimeType) {
    await staging.delete(r.stagingKey);
    fail(400, "实际文件大小或格式与声明不符");
  }
  const prefix = await staging.get(r.stagingKey, {
    range: { offset: 0, length: Math.min(512, head.size) },
    onlyIf: { etagMatches: head.etag },
  });
  if (!prefix || !("body" in prefix)) fail(409, "上传期间文件已改变，请重试");
  if (!matchesMagic(new Uint8Array(await prefix.arrayBuffer()), r.mimeType)) {
    await staging.delete(r.stagingKey);
    fail(400, "文件签名不匹配，不支持 SVG / HTML 或伪装文件");
  }
  const source = await staging.get(r.stagingKey, {
    onlyIf: { etagMatches: head.etag },
  });
  if (!source || !("body" in source)) fail(409, "上传期间文件已改变，请重试");
  try {
    const saved = await media.put(r.finalKey, source.body, {
      onlyIf: { etagDoesNotMatch: "*" },
      httpMetadata: {
        contentType: r.mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        requestId: r.requestId,
        entryId: r.entryId,
        sourceEtag: head.etag,
      },
    });
    if (!saved) {
      if (!source.body.locked) await source.body.cancel();
      const concurrent = await media.head(r.finalKey);
      if (
        !concurrent ||
        !same(concurrent, r) ||
        concurrent.customMetadata?.sourceEtag !== head.etag
      )
        fail(409, "媒体对象并发冲突");
    }
  } catch (error) {
    if (!source.body.locked) await source.body.cancel().catch(() => {});
    throw error;
  }
  await staging.delete(r.stagingKey);
  return { asset };
}
