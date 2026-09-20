import type { LocalFile } from "./drafts";
import type { Entry } from "./validation";
import { extensions } from "./validation";
import site from "../../content/site.json";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(site.base + "/api/admin/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("登录已过期，请重新打开管理入口；草稿仍保留在当前浏览器");
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "请求失败，请重试");
  return value;
}
const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("无法生成预览，请尝试较小图片")),
      "image/webp",
      0.86,
    ),
  );
async function resize(
  source: CanvasImageSource,
  width: number,
  height: number,
  edge: number,
) {
  const ratio = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器无法处理图片");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas);
}
export async function prepareFile(file: File): Promise<LocalFile> {
  if (!extensions[file.type])
    throw new Error("请选择 PNG、JPEG、WebP、MP4 或 WebM 文件");
  if (file.size > (file.type.startsWith("image/") ? 40 : 250) * 1024 ** 2)
    throw new Error("图片限 40 MiB，视频限 250 MiB");
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 100000000)
        throw new Error("图片像素过大，请先在本地缩小");
      return {
        id: "output-" + crypto.randomUUID(),
        file,
        name: file.name,
        alt: "",
        width: image.naturalWidth,
        height: image.naturalHeight,
        duration: null,
        thumbnail: await resize(
          image,
          image.naturalWidth,
          image.naturalHeight,
          800,
        ),
        preview: await resize(
          image,
          image.naturalWidth,
          image.naturalHeight,
          1800,
        ),
      };
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("视频解码超时，请转为 H.264 MP4")),
        20000,
      );
      video.onloadeddata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("此浏览器不能播放该视频，请转为 H.264 MP4 或 WebM"));
      };
      video.preload = "auto";
      video.load();
    });
    if (!Number.isFinite(video.duration) || !video.videoWidth)
      throw new Error("无法读取视频时长或尺寸");
    const thumbnail = await resize(
      video,
      video.videoWidth,
      video.videoHeight,
      800,
    );
    const result = {
      id: "output-" + crypto.randomUUID(),
      file,
      name: file.name,
      alt: "",
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
      thumbnail,
    };
    video.pause();
    video.removeAttribute("src");
    video.load();
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function upload(
  entryId: string,
  blob: Blob,
  role: string,
  onProgress: (percent: number) => void,
) {
  const signed = await api<{
    uploadUrl: string;
    receipt: string;
    headers: Record<string, string>;
  }>("uploads/presign", {
    entryId,
    requestId: crypto.randomUUID(),
    role,
    mimeType: blob.type,
    bytes: blob.size,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl);
    for (const [k, v] of Object.entries(signed.headers))
      xhr.setRequestHeader(k, v);
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("文件上传失败，点击发布可重试"));
    xhr.onerror = () => reject(new Error("上传网络中断，请重试"));
    xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
    xhr.send(blob);
  });
  return (
    await api<{ asset: Entry["outputs"][number]["original"] }>(
      "uploads/finalize",
      { receipt: signed.receipt },
    )
  ).asset;
}
export async function uploadFile(
  entryId: string,
  file: LocalFile,
  onProgress: (status: string) => void,
  onSaved: (file: LocalFile) => Promise<void>,
) {
  if (file.uploaded) return file.uploaded;
  const stored = { ...file.assets };
  for (const role of ["original", "thumbnail", "preview"] as const) {
    const blob = role === "original" ? file.file : file[role];
    if (blob && !stored[role]) {
      stored[role] = await upload(entryId, blob, role, (p) =>
        onProgress(
          `${role === "original" ? "原文件" : role === "thumbnail" ? "缩略图" : "预览"} ${p}%`,
        ),
      );
      await onSaved({ ...file, assets: { ...stored } });
    }
  }
  return {
    id: file.id,
    mediaType: file.file.type.startsWith("image/") ? "image" : "video",
    alt: file.alt || file.name,
    original: stored.original!,
    thumbnail: stored.thumbnail!,
    ...(stored.preview ? { preview: stored.preview } : {}),
    width: file.width,
    height: file.height,
    durationSeconds: file.duration,
    postProcessing: "unknown",
  } as Entry["outputs"][number];
}
