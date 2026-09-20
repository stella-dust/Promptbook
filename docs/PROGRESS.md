# 实施记录

所有时间为 2026-09-20，Asia/Shanghai。外部状态以最近一次实际验证为准。

## 初始核查

- 用户授权正式开发、所需仓库创建、Cloudflare 免费计划部署和指定路径上线，并要求保留个人博客。
- 初始根目录无 Git、package.json 或 tools。执行 `npm run check:handoff` 返回 ENOENT；旧 README 的设计包检查命令没有实际交付，已替换为正式工程命令。
- 阅读 START_CODEX、设计、产品、架构、合同、媒体、验收文档及原型截图。原型 file URL 被浏览器策略拒绝；没有绕过，改用已有图片和源码审阅。
- 更正早期 DNS 判断：直接 NS/SOA 查询确认 DNS 为阿里云 dns3/dns4.hichina.com；CNAME 指向 junyiyan-blog.pages.dev。没有迁移域名或修改现有 DNS。
- npm registry 核实并锁定 Astro 7.3.3、React 19.3.0、Wrangler 4.135.0；TS 采用 Astro 兼容的 6.0.3。运行 Node 22.22.3。

## 本地实现与验证

- 正式静态站点、原比例卡片、联合筛选、详情/原文复制/图片查看、编辑器、本地 IndexedDB Blob 草稿、上传预处理、参考输入、确认公开、SHA 更新与失败保留已实现。
- 单一 JSON Schema 生成 Ajv 校验器和 TS 类型；语义约束由共用 validation.ts 执行。生产正式记录 0 条，模板和视觉素材排除在生产构建外。
- 21:52 `npm run build`：通过，6 个静态页面，管理 HTML 另行嵌入授权 Worker，不在 dist 静态公开目录中。
- 21:52 `npm run check`：通过，0 errors / 0 warnings / 1 hint（beforeunload.returnValue 浏览器兼容性写法弃用提示）。
- 21:52 `npm test`：33 pass / 0 fail。覆盖 JWT 签名/issuer/audience/过期/邮箱、缺配置拒绝、SHA 冲突、超时提交恢复、媒体 ETag 条件流式复制和重试、合同/字节上限/MIME、博客路径与主机限制。
- 首次 Worker `deploy --dry-run`：通过。R2 流式复制使用绑定与条件 ETag，不将大文件整体读入内存。
- 浏览器实测：正式首页和编辑器桌面/手机截图复核；本地标题、含中文/emoji/HTML 字样/换行/空格的 Prompt 与图片草稿刷新后恢复。鉴权未接入的本地发布不可用。
- 隔离视觉副本 1440 / 1280 / 768 / 390 / 360 宽度检查：scrollWidth 等于视口，网格列数 4 / 4 / 2 / 1 / 1；分类筛选从 4 条得到 2 条。测试素材为明确标记的界面截图，非模型结果。
- 21:55 `npm uninstall --save-dev @playwright/test`：清理未实际运行的浏览器测试入口，依赖审计 0 vulnerabilities。浏览器验收通过 CUA，不能声称存在未执行的 Playwright E2E 套件。

## 已实际调用的云服务

- 当前 Wrangler 登录有效；用户确认使用该账号邮箱作为唯一编辑者（不在公开仓库记录真实邮箱）。用户本人启用 R2。
- 创建 Standard R2 桶 promptbook-staging 和 promptbook-media；暂存桶设置仅 https://junyiyan.com 的 PUT/HEAD CORS、暂存对象 7 天过期与未完成分段上传 1 天清理。公开媒体桶不设自动删除，未启用 r2.dev。
- 创建公共 GitHub 仓库 stella-dust/Promptbook。
- 首次 Worker 部署版本 a6924612-274e-4964-a260-98c328a959ba；关闭 workers.dev 和预览 URL，通过博客 Service binding 访问。
- Pages 项目 junyiyan-blog 的 production.services.PROMPTBOOK 指向 promptbook/production，API 回读确认。只添加 functions/projects/promptbook/[[path]].js，现有博客内容与根 middleware 不变。Pages Functions 编译通过。
- 博客提交 0b8dd41679e771eef97aee7b74d5e4a60652c3f7 已推送 master；生产部署 7f4a57d4-2d9b-4363-9f31-aef489730a46 状态 success。改动前回滚点为 850c0ae3-459f-42c3-b9a5-3f48bfd726e3 / 79193f91e36d9f5fce8b6dfcb16124e8f7d341ff。
- 21:53–21:54 curl 实测：博客首页 200，Promptbook 200，管理页 503（管理登录尚未配置），build-info 返回空 entries。Python urllib 在当前网络返回403，curl独立请求成功；不把该网络差异写成产品错误。

## 尚未完成的真实联调

- Cloudflare Access 应用/唯一邮箱策略，以及 ACCESS_TEAM_DOMAIN、ACCESS_AUD；现有 Wrangler OAuth 无 Access 管理权限。
- 单仓库 GitHub Contents 读写 Token、两桶 R2 S3 凭据；不能复用广权限 gh CLI Token。
- 媒体自定义域名 promptbook-media.junyiyan.com，当前 Cloudflare 账号中无该 zone；DNS 迁移方式等待用户决定，必须完整保留现有 DNS。
- GitHub 自动部署需要最小权限 CLOUDFLARE_API_TOKEN 和启用变量。未配置时 deploy job 跳过；不能声称提交记录后必定自动上线。
- PUBLISH_ENABLED 默认关闭，配置完成后才可启用。
- 真实 Access 登录、浏览器直传 R2、一次真实图片/视频发布、媒体域名 Range 206、GitHub 提交到网站 revision 一致性、两端并发修改、外网手机访问：未联调。没有伪造真实记录填充空库。

博客路径转发会产生 Pages Function 调用；这是保留阿里云 DNS 下当前博客路径的接入代价。之后如迁移 DNS，可采用仅该路径 Worker route，避免这层代理。没有升级 Workers 付费计划。

## 21:58 最后本地复核

- 上传前校验补充本地媒体占位引用和参考图总量测试：`npm test` 36 pass / 0 fail；占位引用绝不写入正式记录。
- 21:58 `npm run build && npm run check` 再次通过（24 个检查文件，0 errors / 0 warnings / 1 hint）。
- 提交前审计：91 个暂存文件，无凭据特征与真实管理员邮箱；.dev.vars、.test-build、dist、node_modules、.wrangler 均未暂存。
- 后续浏览器连接连续超时，不能声称新增参考图与长 Prompt 交互已完成浏览器回归；此前本地草稿/布局截图与 HTTP 部署检查仍分别有效。
