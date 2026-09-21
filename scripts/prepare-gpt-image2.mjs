// One-time import preparation. Requires a local snapshot of upstream images.
// No remote write takes place here; upload the generated object manifest first,
// then publish the canonical JSON records through the normal deployment path.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const [manifestPath, originals, derived] = process.argv.slice(2);
if (!manifestPath || !originals || !derived) {
  throw new Error("Usage: node scripts/prepare-gpt-image2.mjs manifest.json images-dir derived-dir");
}
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const uploadObjects = new Map();
const outputDirectory = path.resolve("content/entries");
await fs.mkdir(derived, { recursive: true });

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const idFor = (entryId, bytes, extension) => `published/${entryId}/${sha256(bytes).slice(0, 32)}.${extension}`;
const mime = (extension) => ({ png: "image/png", jpg: "image/jpeg", webp: "image/webp" })[extension];
const asset = (entryId, data, extension, localPath) => {
  const key = idFor(entryId, data, extension);
  uploadObjects.set(key, { key, path: localPath, mimeType: mime(extension), sha256: sha256(data), bytes: data.length });
  return { key, mimeType: mime(extension), bytes: data.length, sha256: sha256(data) };
};
const sourcePath = (name) => {
  if (!/^docs\/[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg|webp)$/.test(name)) throw new Error(`Unexpected source path ${name}`);
  return path.join(originals, name);
};
const importedAt = Date.now();
const uploaded = [];
for (const [index, item] of manifest.entries.entries()) {
  const file = sourcePath(item.image);
  const bytes = await fs.readFile(file);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.pages > 1) throw new Error(`Unexpected image ${file}`);
  const ext = path.extname(file).slice(1);
  const original = asset(item.id, bytes, ext, file);
  const thumbnailBytes = await sharp(bytes).rotate().resize({ width: 680, height: 680, fit: "inside", withoutEnlargement: true }).webp({ quality: 76, effort: 4 }).toBuffer();
  const previewBytes = await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
  const thumbPath = path.join(derived, item.id + "-thumb.webp");
  const previewPath = path.join(derived, item.id + "-preview.webp");
  await Promise.all([fs.writeFile(thumbPath, thumbnailBytes), fs.writeFile(previewPath, previewBytes)]);
  const thumbnail = asset(item.id, thumbnailBytes, "webp", thumbPath);
  const preview = asset(item.id, previewBytes, "webp", previewPath);
  const references = [];
  for (const reference of item.references) {
    const referencePath = sourcePath(reference);
    const referenceBytes = await fs.readFile(referencePath);
    const refExt = path.extname(reference).slice(1);
    references.push({
      role: "image-reference",
      asset: asset(item.id, referenceBytes, refExt, referencePath),
      caption: "源图库标记的输入参考图",
    });
  }
  const explicitModel = Boolean(item.model);
  const promptLanguage = [42, 43].includes(item.number) ? "other" : /[\u3400-\u9fff]/u.test(item.prompt) ? "mixed" : "en";
  const record = {
    schemaVersion: 1,
    id: item.id,
    revision: crypto.randomUUID(),
    status: "published",
    kind: "image",
    title: item.title,
    category: item.category,
    tags: item.tags,
    createdAt: new Date(importedAt - index * 1000).toISOString(),
    updatedAt: new Date(importedAt - index * 1000).toISOString(),
    prompt: { text: item.prompt, language: promptLanguage, ...(item.negativePrompt ? { negativeText: item.negativePrompt } : {}) },
    generation: {
      platform: "",
      modelLabel: item.model || "未记录模型",
      modelId: item.model || null,
      modelEvidence: explicitModel ? item.modelEvidence : "unknown",
      generatedAt: item.generatedAt,
      parameters: item.parameters,
    },
    outputs: [{ id: "result-1", mediaType: "image", alt: `${item.title}，源图库所展示的生成结果`, original, thumbnail, preview, width: metadata.width, height: metadata.height, durationSeconds: null, postProcessing: "unknown" }],
    coverOutputId: "result-1",
    ...(references.length ? { references } : {}),
    source: { type: "collected", author: item.author, url: item.origin, contributor: "wuyoscar/GPT-Image2-Skill" },
    rights: {
      prompt: "unspecified", media: "unspecified",
      notes: `收录自 GPT-Image2-Skill（上游提交 ${manifest.upstreamCommit}，案例 No. ${item.number}）。上游仓库声明 MIT License，并要求保留图库作者和来源标注；部分案例另有第三方作者/来源，原始素材的单独授权未核实。仓库许可全文见本站项目 docs/third-party/GPT-Image2-Skill-LICENSE.txt。源图库：${item.gallery}`,
    },
  };
  const recordPath = path.join(outputDirectory, `${item.id}.json`);
  await fs.writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
  uploaded.push(record.id);
  if ((index + 1) % 25 === 0) console.log(`Prepared ${index + 1}/${manifest.entries.length}`);
}
await fs.writeFile(path.join(derived, "upload-manifest.json"), JSON.stringify([...uploadObjects.values()], null, 2) + "\n");
console.log(`Prepared ${uploaded.length} records and ${uploadObjects.size} media objects`);
