/* Generated from contracts/entry.schema.json. Do not edit. */

export interface PromptbookProposedContributionV1 {
  schemaVersion: 1;
  title: string;
  promptText: string;
  kind: "image" | "video";
  category: string;
  /**
   * @maxItems 8
   */
  tags?: string[];
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
  mediaSources: {
    url: string;
    description: string;
  }[];
  author: string;
  sourceUrl: string | null;
  rights: {
    prompt: "unspecified" | "CC0-1.0" | "CC-BY-4.0" | "permission-granted" | "all-rights-reserved";
    media: "unspecified" | "CC0-1.0" | "CC-BY-4.0" | "permission-granted" | "all-rights-reserved";
    notes?: string;
  };
  notes?: string;
}
