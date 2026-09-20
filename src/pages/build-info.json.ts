import { entries } from "../lib/content";
export const GET = () =>
  Response.json({
    builtAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA ?? "local",
    entries: Object.fromEntries(
      entries.map((e) => [e.id, { revision: e.revision, status: e.status }]),
    ),
  });
