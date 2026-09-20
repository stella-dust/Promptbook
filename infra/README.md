# 配置模板使用边界

`.example` 均不自动执行。M0 根据已锁定的 Wrangler / Astro / Actions 版本核验字段，M3–M5 获得明确上线授权后再应用。

- `wrangler.jsonc.example`：正式工程需实现 worker 和 dist；不把 prototype 设为 assets。
- `r2-cors.staging.json.example`：**S3 API / AWS CLI 的 CORSConfiguration 格式**，不是 Wrangler CLI 的 rules 格式。只用于私有 staging 桶。不要直接当成 Cloudflare 控制台 JSON 粘贴；按所用界面转换。Origin 换真实站点，签名头增减必须同步。
- `r2-lifecycle.staging.json.example`：**S3 API LifecycleConfiguration 格式**；仅在 staging 桶使用。上线前核查当前 R2 支持的 Filter / Abort 字段，并用临时桶验证。禁止应用到 media 桶。
- `deploy.yml.example` / `validate.yml.example`：移动到 `.github/workflows/` 前替换 action SHA 占位符、完成正式 npm scripts、真实安装并提交 lockfile。模板默认不存在可用部署工作流。
- 正式 `_headers`：公开静态资源设置 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、合适的 Permissions-Policy；`build-info.json` 用 `Cache-Control: no-cache`。管理 API 由 Worker 显式 `Cache-Control: no-store`；`_headers` 不代替 Worker headers。
- CSP 按最终 Astro 的内联脚本 hash 和真实媒体域名实现；允许必要的 `img-src media-domain blob:`、`media-src media-domain blob:`、编辑器所需的 R2 S3 `connect-src`。不能为省事放开全部 `*` / `unsafe-eval`。本包不提供一个会破坏正式页面的未经构建核验的 CSP。

公开页面的 R2 图片跨域普通显示不依赖 CORS；在浏览器 canvas 重处理已存在的远端图时，另给 public media 配受控的 GET/HEAD CORS。下载原图建议同源链接行为或明确 response Content-Disposition，不能假设 `<a download>` 对任意跨域 URL 生效。
