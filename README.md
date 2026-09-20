# Promptbook · 提示词手记

把喜欢的提示词，和它真正生成的结果，放在一起。

正式网页：https://junyiyan.com/projects/promptbook/

Astro 静态页面 + TypeScript 筛选 + React 编辑器；Cloudflare Worker 处理管理授权与发布，GitHub JSON 是记录事实源，R2 保存媒体。没有用户系统、数据库或在线模型生成。

## 当前状态

正式公开页面已部署，现有博客通过一个限定路径的 Pages Function 转发到独立 Worker。首页为空库，没有把原型素材包装为真实模型结果。管理接口在 Access 配置缺失时拒绝访问。Access、媒体自定义域名、最小权限写入凭据及自动部署仍待配置和真实联调；不能将当前状态视为完整发布链路验收完成。详情见 `docs/PROGRESS.md`。

视觉采用纸白、墨绿、书页标记和轻衬线标题；结果优先，保留原比例，桌面与手机分别布局。编辑器支持粘贴 Prompt、拖入/粘贴文件、本地图片预览、视频首帧、本地草稿恢复、封面选择、公开参考图、原始模型信息、确认发布、SHA 冲突提示和上线状态检查。

## 本地开发

Node 22.22.3，依赖版本锁定于 package-lock.json。

```sh
npm ci
npm run dev
# 本地开发入口 /projects/promptbook/
npm run build
npm run check
npm test
npx wrangler deploy --dry-run
```

Astro 开发服务器只用于本机，管理页可以查看，但不会提供模拟登录或生产写入权限。`npm run preview` 使用真正的 Worker 验证拒绝访问行为。生产管理 HTML 被移出公开静态目录，嵌入 Worker 并在授权后返回。

```sh
npm run fixtures
cd .test-build
npx astro dev --host 127.0.0.1 --port 4322
```

这会创建隔离的视觉验收副本；所有样例明确标记“非模型实测”，不写入正式 content，也不会随生产构建发布。

## 内容与部署

- `content/entries/*.json`：唯一正式记录来源，运行时、CI 和构建使用同一合同生成的校验器。
- `content/site.json` / `content/taxonomy.json`：站点与分类配置。
- `contracts/`：序列化合同与额外业务约束；修改合同后运行 `npm run generate`。
- `prototype/`、`templates/`：设计参考和模板，不是正式记录。
- `src/`、`worker/`：正式网页和管理服务。
- `docs/PROGRESS.md`：实际测试、部署和未联调项。
- `docs/DEPLOYMENT.md`：本项目实际接入、最小权限凭据和回滚步骤。

复制 `.env.example` 到本机忽略的 `.dev.vars` 填写服务器配置。不得提交密钥或使用 GitHub CLI 的全局账号凭据作为生产 Worker Token。配置完整后使用 `node scripts/set-secrets.mjs` 写入 Worker Secrets。

部署工作流在 `CLOUDFLARE_DEPLOY_ENABLED=true` 后自动运行，需要 GitHub Secret `CLOUDFLARE_API_TOKEN`。在媒体域名、Access 和部署工作流全部验证前保持 `PUBLISH_ENABLED=false`。本地人工部署用 `npm run deploy`。

公众只读，唯一维护者编辑；外部贡献通过 GitHub。公开媒体和 Git 历史可能保留旧版本，归档不等于删除。代码与内容许可边界见 `CONTENT_POLICY.md`。
