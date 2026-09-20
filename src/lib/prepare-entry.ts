import { extensions, validateEntry, type Entry } from "./validation";
import type { LocalFile } from "./drafts";
// Validate all metadata and limits before making any local media public.
// Placeholder keys are discarded after validation; only finalized R2 assets publish.
export function validateBeforeUpload(
  entry: Entry,
  existing: Entry["outputs"],
  files: LocalFile[],
  references: LocalFile[],
) {
  const asset = (blob: Blob) => ({
    key: `published/${entry.id}/${"0".repeat(32)}.${extensions[blob.type]}`,
    mimeType: blob.type,
    bytes: blob.size,
  });
  validateEntry({
    ...entry,
    outputs: [
      ...existing,
      ...files.map((f) => ({
        ...f.uploaded,
        ...(f.uploaded
          ? {}
          : {
              id: f.id,
              mediaType: entry.kind,
              original: asset(f.file),
              thumbnail: asset(f.thumbnail),
              width: f.width,
              height: f.height,
              durationSeconds: f.duration,
              postProcessing: "unknown",
            }),
        alt: f.alt || f.name,
      })),
    ],
    references: [
      ...(entry.references ?? []),
      ...references.map((f) => ({
        role: f.referenceRole ?? "image-reference",
        asset: f.referenceAsset ?? asset(f.file),
        caption: f.alt,
      })),
    ],
  });
}
