/* Generated from contracts/entry.schema.json. Do not edit. */

/**
 * Canonical public record. Drafts and demo fixtures are forbidden. Additional semantic invariants are documented in INVARIANTS.md.
 */
export type PromptbookPublishedEntryV1 = {
  schemaVersion: 1;
  id: string;
  revision: string;
  status: "published" | "archived";
  kind: "image" | "video";
  title: string;
  summary?: string;
  category: string;
  /**
   * @maxItems 8
   */
  tags: string[];
  createdAt: string;
  updatedAt: string;
  prompt: {
    text: string;
    language?: "zh" | "en" | "mixed" | "other" | "unknown";
    negativeText?: string;
    /**
     * @maxItems 20
     */
    followups?: string[];
  };
  generation: {
    platform: string;
    modelLabel: string;
    modelId: string | null;
    modelEvidence: "unknown" | "user-reported" | "platform-displayed" | "api-returned";
    generatedAt: string | null;
    parameters: {
      [k: string]: string | number | boolean | null;
    };
  };
  /**
   * @minItems 1
   * @maxItems 8
   */
  outputs: Output[];
  coverOutputId: string;
  /**
   * @maxItems 4
   */
  references?: {
    role: "image-reference" | "first-frame" | "last-frame" | "style-reference" | "other";
    asset: Asset;
    caption?: string;
  }[];
  source: {
    type: "original" | "adapted" | "collected";
    author: string;
    url: string | null;
    contributor: string | null;
  };
  rights: {
    prompt: "unspecified" | "CC0-1.0" | "CC-BY-4.0" | "permission-granted" | "all-rights-reserved";
    media: "unspecified" | "CC0-1.0" | "CC-BY-4.0" | "permission-granted" | "all-rights-reserved";
    notes?: string;
  };
  notes?: string;
  derivedFrom?: string | null;
};
export type Output = {
  thumbnail?: {
    mimeType?: "image/png" | "image/jpeg" | "image/webp";
    [k: string]: unknown;
  };
  preview?: {
    mimeType?: "image/png" | "image/jpeg" | "image/webp";
    [k: string]: unknown;
  };
  [k: string]: unknown;
} & {
  id: string;
  mediaType: "image" | "video";
  alt: string;
  original: Asset;
  preview?: Asset;
  thumbnail: Asset;
  width: number;
  height: number;
  durationSeconds: number | null;
  postProcessing: "none" | "non-generative" | "generative" | "unknown";
  notes?: string;
};

export interface Asset {
  key: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm";
  bytes: number;
  sha256?: string | null;
}
