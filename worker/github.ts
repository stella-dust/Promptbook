import type { Env } from "./env";
import { fail } from "./errors";
import { validateEntry, type Entry } from "../src/lib/validation";
const idPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
function url(env: Env, id: string) {
  if (!idPattern.test(id)) fail(400, "记录编号无效");
  if (
    !env.GITHUB_TOKEN ||
    !/^[-\w]+\/[-.\w]+$/.test(env.GITHUB_REPOSITORY) ||
    env.GITHUB_BRANCH !== "main"
  )
    fail(503, "GitHub 发布尚未配置");
  return `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/content/entries/${id}.json`;
}
function headers(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Promptbook",
    "Content-Type": "application/json",
  };
}
export async function readEntry(
  env: Env,
  id: string,
): Promise<{ entry: Entry; fileSha: string } | null> {
  const response = await fetch(url(env, id) + `?ref=${env.GITHUB_BRANCH}`, {
    headers: headers(env),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) return null;
  if (!response.ok) fail(503, "GitHub 暂时不可用，请稍后重试");
  const data = (await response.json()) as { content: string; sha: string };
  const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
  const entry = JSON.parse(new TextDecoder().decode(bytes));
  validateEntry(entry);
  return { entry, fileSha: data.sha };
}
export async function publishEntry(
  env: Env,
  entry: Entry,
  baseFileSha: string | null,
) {
  const current = await readEntry(env, entry.id);
  if (current?.entry.revision === entry.revision) {
    if (JSON.stringify(current.entry) !== JSON.stringify(entry))
      fail(409, "版本编号已用于不同内容");
    return { fileSha: current.fileSha, commitSha: null };
  }
  if ((current?.fileSha ?? null) !== baseFileSha)
    fail(
      409,
      "远端记录已改变。请查看远端版本或导出本地内容后再处理，未覆盖远端。",
    );
  if (current && current.entry.createdAt !== entry.createdAt)
    fail(400, "已有记录的创建时间不可修改");
  const bytes = new TextEncoder().encode(JSON.stringify(entry, null, 2) + "\n");
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  try {
    const response = await fetch(url(env, entry.id), {
      method: "PUT",
      headers: headers(env),
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        message: `content: ${entry.status} ${entry.id}`,
        content: btoa(binary),
        branch: env.GITHUB_BRANCH,
        ...(baseFileSha ? { sha: baseFileSha } : {}),
      }),
    });
    if (response.status === 409 || response.status === 422)
      fail(409, "远端文件有更新，请先查看远端版本");
    if (!response.ok) fail(503, "GitHub 提交失败，请重试");
    const data = (await response.json()) as {
      commit: { sha: string };
      content: { sha: string };
    };
    return { commitSha: data.commit.sha, fileSha: data.content.sha };
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 409)
      throw error;
    const recovered = await readEntry(env, entry.id);
    if (recovered?.entry.revision === entry.revision)
      return { commitSha: null, fileSha: recovered.fileSha };
    fail(503, "提交结果尚未确认，草稿已保留；重试时会先核对远端版本");
  }
}
