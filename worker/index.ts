import adminIndex from "./generated/admin-index.html";
import adminNew from "./generated/admin-new.html";
import adminEdit from "./generated/admin-edit.html";
import { authenticate } from "./auth";
import type { Env } from "./env";
import { HttpError, fail, readJSON, exact } from "./errors";
import { readEntry, publishEntry } from "./github";
import { presign, finalize } from "./upload";
import { validateEntry } from "../src/lib/validation";
import { verifyPublishedAssets } from "./media";
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      let path: string;
      try {
        path = decodeURIComponent(url.pathname).replace(/\/+/g, "/");
      } catch {
        return json({ error: "路径无效" }, 400);
      }
      const local = path.startsWith(env.BASE_PATH + "/")
        ? path.slice(env.BASE_PATH.length)
        : path === env.BASE_PATH
          ? "/"
          : "";
      if (!local) return new Response("Not found", { status: 404 });
      const admin = /^\/(admin|api)(\/|$)/.test(local);
      if (!admin) return env.ASSETS.fetch(request);
      await authenticate(request, env);
      if (url.origin !== env.SITE_ORIGIN) fail(403, "请使用正式站点管理入口");
      if (local.startsWith("/admin")) {
        if (!["GET", "HEAD"].includes(request.method))
          fail(405, "不支持此方法");
        const pages: Record<string, string> = {
          "/admin": adminIndex,
          "/admin/": adminIndex,
          "/admin/new": adminNew,
          "/admin/new/": adminNew,
          "/admin/edit": adminEdit,
          "/admin/edit/": adminEdit,
        };
        const html = pages[local];
        if (!html) return new Response("Not found", { status: 404 });
        return new Response(request.method === "HEAD" ? null : html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        });
      }
      if (local === "/api/admin/session" && request.method === "GET")
        return json({
          authenticated: true,
          canPublish: !!(
            env.PUBLISH_ENABLED === "true" &&
            env.GITHUB_TOKEN &&
            env.MEDIA &&
            env.STAGING &&
            env.R2_ACCESS_KEY_ID &&
            env.R2_SECRET_ACCESS_KEY &&
            env.UPLOAD_RECEIPT_SECRET
          ),
        });
      const match = local.match(
        /^\/api\/admin\/entries\/([a-z0-9][a-z0-9-]{2,79})$/,
      );
      if (match && request.method === "GET") {
        const data = await readEntry(env, match[1]);
        return data ? json(data) : json({ error: "未找到记录" }, 404);
      }
      if (request.method !== "POST") fail(405, "不支持此方法");
      if (request.headers.get("Origin") !== env.SITE_ORIGIN)
        fail(403, "请求来源不正确");
      if (env.PUBLISH_ENABLED !== "true") fail(503, "发布服务尚未完成配置");
      const body = await readJSON(request);
      if (local === "/api/admin/uploads/presign")
        return json(await presign(env, body));
      if (local === "/api/admin/uploads/finalize")
        return json(await finalize(env, body));
      if (local === "/api/admin/entries/publish") {
        exact(body, ["entry", "baseFileSha", "confirmPublic"]);
        if (body.confirmPublic !== true) fail(400, "请确认公开内容");
        if (
          body.baseFileSha !== null &&
          (typeof body.baseFileSha !== "string" ||
            !/^[a-f0-9]{40}$/.test(body.baseFileSha))
        )
          fail(400, "文件版本无效");
        try {
          validateEntry(body.entry);
        } catch (error) {
          fail(400, (error as Error).message);
        }
        if (!env.MEDIA) fail(503, "媒体存储尚未配置");
        await verifyPublishedAssets(env.MEDIA, body.entry);
        const result = await publishEntry(
          env,
          body.entry,
          body.baseFileSha as string | null,
        );
        return json(
          {
            state: "committed",
            id: body.entry.id,
            revision: body.entry.revision,
            ...result,
            publicPath: `${env.BASE_PATH}/p/${body.entry.id}/`,
          },
          202,
        );
      }
      return json({ error: "接口不存在" }, 404);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      return json({ error: "服务暂时不可用，草稿已保留，请稍后重试" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
