export type Env = Cloudflare.Env & {
  PUBLISH_ENABLED?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  OWNER_EMAIL?: string;
  GITHUB_TOKEN?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  UPLOAD_RECEIPT_SECRET?: string;
  STAGING?: R2Bucket;
  MEDIA?: R2Bucket;
};
