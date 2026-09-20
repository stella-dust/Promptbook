import generatedValidate from "../generated/entry-validator.js";
import type { ValidateFunction } from "ajv";
const schemaValidate = generatedValidate as ValidateFunction;
import taxonomy from "../../content/taxonomy.json";
import type { PromptbookPublishedEntryV1 as Entry } from "../generated/entry";
export type { Entry };
export const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
export function assets(entry: Entry) {
  return [
    ...entry.outputs.flatMap((o) => [
      o.original,
      o.thumbnail,
      ...(o.preview ? [o.preview] : []),
    ]),
    ...(entry.references ?? []).map((r) => r.asset),
  ];
}
export function validateEntry(value: unknown): asserts value is Entry {
  if (!schemaValidate(value))
    throw new Error(
      "记录格式不正确：" +
        (schemaValidate.errors ?? [])
          .map(
            (e: { instancePath: string; message?: string }) =>
              `${e.instancePath} ${e.message}`,
          )
          .slice(0, 5)
          .join("；"),
    );
  const e = value as Entry;
  const fail = (text: string) => {
    throw new Error(text);
  };
  if (!taxonomy.some((t) => t.id === e.category)) fail("请选择有效分类");
  if (
    !e.title.trim() ||
    !e.prompt.text.trim() ||
    !e.generation.modelLabel.trim()
  )
    fail("标题、Prompt 和模型不能为空");
  if (
    e.tags.some((t) => !t.trim() || t !== t.trim()) ||
    new Set(e.tags).size !== e.tags.length
  )
    fail("标签不能空白或重复");
  if (Date.parse(e.updatedAt) < Date.parse(e.createdAt))
    fail("更新时间不能早于创建时间");
  if (
    !e.outputs.some((o) => o.id === e.coverOutputId) ||
    new Set(e.outputs.map((o) => o.id)).size !== e.outputs.length
  )
    fail("封面或结果编号不正确");
  if (e.generation.modelEvidence === "unknown" && e.generation.modelId !== null)
    fail("未知模型证据时请留空模型 ID");
  if (
    e.source.type !== "original" &&
    (!e.source.author.trim() || !e.source.url)
  )
    fail("转载或改编需要作者及 HTTPS 来源");
  if (e.source.url) {
    const url = new URL(e.source.url);
    if (url.protocol !== "https:" || url.username || url.password)
      fail("来源需要有效的 HTTPS 链接");
  }
  for (const a of assets(e)) {
    if (
      !a.key.startsWith(`published/${e.id}/`) ||
      a.key.split(".").pop() !== extensions[a.mimeType]
    )
      fail("媒体路径或格式不正确");
    if (a.mimeType.startsWith("image/") && a.bytes > 40 * 1024 ** 2)
      fail("图片超过 40 MiB");
  }
  if ((e.references ?? []).some((r) => !r.asset.mimeType.startsWith("image/")))
    fail("参考输入只支持图片");
  if (
    e.outputs.reduce((s, o) => s + o.original.bytes, 0) +
      (e.references ?? []).reduce((s, r) => s + r.asset.bytes, 0) >
    600 * 1024 ** 2
  )
    fail("原始文件合计超过 600 MiB");
}
