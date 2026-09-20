# 部署与运维

当前工程已实现并部署公开页面；管理者登录、浏览器直传和真实内容发布仍需最终联调。实际证据见 `PROGRESS.md`。根目录 `wrangler.jsonc` 与 `.github/workflows/` 是生效配置；`infra/*.example` 仅保留作设计参考。

## 本项目当前接入

- 页面：`https://junyiyan.com/projects/promptbook/`，Worker：`promptbook`。
- 仓库：`stella-dust/Promptbook`，固定分支 `main`。
- 现有博客 Pages：`junyiyan-blog`，生产分支 `master`。仅新增 `functions/projects/promptbook/[[path]].js`，production service binding `PROMPTBOOK → promptbook`。域名仍在阿里云注册；权威 DNS 已迁至 Cloudflare 免费 zone，原阿里云解析保留作回退。API 配置字段为 `deployment_configs.production.services`。
- 媒体域名：`https://promptbook-media.junyiyan.com` 已绑定 R2 media 桶；所有权与 SSL 状态均为 active。临时对象 HTTPS GET 200、Range 206、删除后 404 已实测。
- 两个 Standard R2 桶已创建；staging CORS 与 7 天清理已配置；media 不自动删除。
- Access 同一应用覆盖 `junyiyan.com/projects/promptbook/admin`、`junyiyan.com/projects/promptbook/admin/*`、`junyiyan.com/projects/promptbook/api/admin`、`junyiyan.com/projects/promptbook/api/admin/*`。只允许当前 Cloudflare 登录邮箱（只存服务器配置），使用一致的应用 AUD。未登录请求已实测跳转 Access；维护者登录后的写入尚未联调。
- `.dev.vars` 是忽略的本机配置文件。填写后运行 `node scripts/set-secrets.mjs`；脚本拒绝模板占位值。生产 `PUBLISH_ENABLED` 尚保持关闭；维护者登录成功后开启，再完成上传与写入联调，失败时立即关闭并保留草稿。
- GitHub Actions Secret `CLOUDFLARE_API_TOKEN`（仅目标账号中现有 `promptbook` Worker 的编辑/部署权限；部署已有 R2 binding 不需要直接读取 R2 对象的权限）与 Variable `CLOUDFLARE_DEPLOY_ENABLED=true` 已配置。手动 Actions 部署运行 `35522627351` attempt 3 成功。不要把 Wrangler OAuth 或全局 GitHub CLI Token 当持久生产密钥。
- Worker Secrets `GITHUB_TOKEN`（仅目标仓库 Contents 读写）、`R2_ACCESS_KEY_ID` 与 `R2_SECRET_ACCESS_KEY`（仅两只桶对象读写）已配置；两组令牌均于 2027-09-20 到期，届时需轮换。`PUBLISH_ENABLED` 继续作为管理写入的独立开关。

当前博客路径代理会产生 Pages Functions 请求，并非所有公共请求都享受纯静态零 Worker 调用。现阶段未升级付费计划。

回滚 DNS 委派可在阿里云注册商把 NS 改回 `dns3.hichina.com`、`dns4.hichina.com`；原三条解析仍保留。回滚博客接入可 revert 提交 `0b8dd41679e771eef97aee7b74d5e4a60652c3f7`，或回滚 Pages 到 `850c0ae3-459f-42c3-b9a5-3f48bfd726e3`；Promptbook Worker 可独立回滚其版本，不恢复/删除 R2 媒体。

## 1. 一次性资源

准备一个 GitHub 公共仓库、Cloudflare 账号和可用于生产的自有域名。可以复用已有域名的两个子域，例如：`prompts.example.com` 给网页，`media.example.com` 给媒体。先用占位符开发，本人确认后再填写真实值。

开通 R2 subscription，建立 `promptbook-staging`（完全私有）与 `promptbook-media`（只通过媒体自定义域名公开）。都用 Standard。staging 配置过期清理；media 不配自动删除。[S5,S7,S10]

## 2. R2

通过 Cloudflare 控制台绑定媒体自定义域名，不创建指向 r2.dev 的自定义 CNAME。staging 和 media 都关闭公开 r2.dev 备用入口，避免绕过预期的访问/缓存路径。生产不依赖开发用 r2.dev。[S10]

staging CORS 只允许正式管理站点 Origin，方法 PUT/HEAD，请求头按实际签名设置（Content-Type；后续添加校验头时同步）。浏览器上传使用 R2 S3 API 域名的 presigned URL，不能把自定义媒体域名作为 presigned 上传地址。[S11,S12]

创建能操作这两只桶的 R2 S3 凭证，存到 Worker Secrets；不要扩大到整个账户所有桶。Worker 绑定两只 R2 桶用于 HEAD/GET/DELETE，条件流式复制使用 R2 binding；直传签名使用受控 S3 凭证。配置 public media 响应类型、缓存规则；实测视频 Range。

## 3. Access 与管理路径

在 Cloudflare Access 建 self-hosted 应用，只允许一个维护者邮箱。身份源可用 One-time PIN。配置路径至少覆盖 `/admin`、`/admin/*`、`/api/admin/*`，并检查多路径应用设置对应的 audience；必要时用明确允许的 audience 列表。[S8,S9]

把 team domain / AUD / owner email 配进 Worker。Worker 使用 JWT 库验证实际 token，不能因为设置了 Access 就跳过源端检查。写操作核验同源 Origin，session/GET 不泄露其他数据。

Wrangler 生产配置禁用 workers.dev 和 preview URLs，或用同等级 Access 保护它们；别留下绕过域名。管理页面静态 HTML 也要进入 Worker 先行路径，避免静态资源优先导致页面直接返回。[S3,S13]

## 4. GitHub 写入凭证与分支

创建仅目标仓库的 fine-grained PAT，允许 Contents read/write、Metadata read。只存 Worker Secret `GITHUB_TOKEN`，其到期时间由本人记录。Worker 固定 `GITHUB_REPOSITORY`、`GITHUB_BRANCH=main` 和可写目录，不能让表单传入。

Contents API 更新必须传读取时的文件 SHA；前端收到 409 保留本地表单。Worker 只写一条 entry 文件，多个媒体引用一起进入该文件，减少多文件事务。[S14]

分支规则要与“本人 Web 直写 main”一致：如强制所有提交必须经过 PR，需明确为指定维护者选择受控例外或改用 PR 发布流程。本版默认直写受限路径，不含自动 PR 合并机器人。

## 5. Secrets / Vars

| 名称 | 位置 | 说明 |
|---|---|---|
| GITHUB_TOKEN | Worker Secret | 仅单仓库的 fine-grained PAT |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY | Worker Secrets | 仅指定两桶的 S3 凭证 |
| UPLOAD_RECEIPT_SECRET | Worker Secret | 足够随机，用于上传 receipt HMAC |
| ACCESS_TEAM_DOMAIN / ACCESS_AUD / OWNER_EMAIL | Worker Secrets 或受控 Vars | 不发送到公开客户端 bundle；邮箱按个人信息处理 |
| GITHUB_REPOSITORY / GITHUB_BRANCH | Worker Vars | 固定目标，不接受客户端覆盖 |
| R2_ACCOUNT_ID / STAGING_BUCKET_NAME | Worker Vars | 非授权凭证；R2 bucket binding 在 `wrangler.jsonc` 中固定 |
| SITE_ORIGIN / MEDIA_BASE_URL | Worker Vars、必要的公开站点配置 | 实际部署域名 |
| CLOUDFLARE_API_TOKEN | GitHub Actions Secret | 仅用于部署；账号 ID 已固定在 `wrangler.jsonc`，勿混用 R2 S3 token |

在正式工程具备 Wrangler 后使用 `npx wrangler secret put NAME` 逐个配置，输入值不写在文档/命令历史里。原型不需要这些配置。

## 6. 构建与部署

正式工程生成 `dist/`，只含网站代码、公开文案、索引、少量站点图标和 build-info；不含 R2 原始媒体、草稿、template/demo。

使用 GitHub Actions 标准 Linux runner。部署 workflow 只监听已审查 main push / 手动 dispatch；pull_request workflow 只做无秘密的校验。部署并发用固定组顺序执行，避免旧版最后覆盖新版。[S2,S15]

`.github/workflows/deploy.yml` 是正式工作流，先验证 `npm ci`、构建、类型/合同测试，再开启。Actions 第三方 action 应锁定审查过的 release commit SHA，模板内占位符不能直接使用。不要同时打开 Cloudflare Workers Builds 自动构建和该 Actions 部署。

## 7. 验证

先部署非正式预览环境（无生产 Secrets 或只允许维护者），确认视觉与真实流程。正式发布必须得到本人明确授权。

用未登录浏览器请求管理路由，应该进入 Access 或返回拒绝；直接伪造 JWT 失败。公开首页不应触发管理鉴权。网页新增真实记录后观察 GitHub entry commit、构建结果、build-info revision、公开详情和 R2 对象一致。

确认 `Cache-Control` 不缓存管理 API；build-info 必须重新验证。检查生产 R2 URL、视频206、原图和缩略图实际字节数。执行 ACCEPTANCE 的全部上线阻塞项。

## 8. 运维

每月：拉取 Git 备份；将 R2 媒体备份到独立本地目录/可靠备份位置；记录备份范围；检查免费额度消耗与 token 到期。

异常上线：先保留原站，查看对应 commit 和构建日志；必要时回滚 Worker 部署或 git revert。回滚前检查旧媒体仍在。不要自动清理 public 桶“无当前引用”的文件。

停用网站：关闭管理写入/撤销 PAT 与 R2 凭证、停 workflow、导出记录和媒体，再移除部署与公开域名。删除 public 对象时同时考虑缓存；复制到他处的数据无法从本平台撤回。

所有外部事实与文档入口见 SOURCES.md，具体控制台菜单可能调整。
