# 项目约束

## 目标

这是一本安静、好看、随手能用的个人 Prompt 手记。展示真实生成结果是中心。最短常用流程：打开新建 → 粘贴 Prompt → 拖入结果 → 确认类别/模型 → 发布。

## 禁止扩展

不引入公众账号、用户表、多租户、社交、支付、在线模型生成、向量检索、Agent 编排、复杂 CMS、D1/Postgres/KV 双写。分类配置初期通过 Git 文件维护，不单独做后台。不要为未来可能出现的社区设计平台框架。

## 技术约定

- 正式应用目标：Astro `output: static` + TS；主页/详情采用静态 HTML，筛选用少量客户端 TS；编辑器为一个 React island。
- 部署目标只有 Cloudflare。使用 Workers Static Assets；Worker 只做管理授权、签名上传、媒体确认、GitHub 内容提交。
- 根目录就是正式仓库。`prototype/` 是视觉参考，不能混入生产内容或导入生产构建。
- `content/entries/*.json` 是公开记录的事实源；`submissions/` 仅为待整理贡献；`templates/` 不是正式记录。
- `contracts/entry.schema.json` 是序列化合同；运行时、CI 与构建必须执行等价校验。可生成类型/校验器，不能维护互相矛盾的三套规则。
- 根 package.json 目前只是设计包工具。M0 增加正式依赖、命令与 lockfile；核对当时的稳定版本，不使用未经核实的“latest”部署。

## 安全与事实

- 不用 URL 隐藏、前端密码或 localStorage 中的 token 充当鉴权。
- Access JWT 核验签名、issuer、audience、过期时间、唯一允许邮箱；写操作核验 Origin 和 JSON Content-Type。
- 缺少配置时拒绝管理请求；生产永远不能回退到演示鉴权。
- GH / R2 / Access secrets 只在服务器 Secrets 中。前端变量仅允许公开配置。
- 固定可写分支和 `content/entries/{id}.json` 路径；禁止客户端传任意仓库、分支、路径。
- 发布与上传失败必须可重试；GitHub 更新必须携带读取时的文件 SHA，不能静默覆盖。
- 不信任 Prompt、来源 URL、PR 内容、文件名或媒体 MIME；Prompt 以文本呈现，禁止裸 HTML。
- 不下载任意远程 URL 到 Worker，不在含 secrets 的 PR workflow 中运行外部代码。
- 真实输出和视觉 fixture 明确分开。未知模型版本、seed、帧率等不推断、不伪造。
- 无当前用户授权，不创建仓库、不提交远程、不部署，不填写真实邮箱/账号。

## 协作与验收

先执行已有检查。每个 milestone 先本地跑通，再截图和复核；失败先修复再报告。任何没实际调用外部服务的地方明确标记“未联调”。

M1 必须对照 `DESIGN.md` 和原型，不接受默认 shadcn Dashboard 风格。M1 后只做已确认的必要视觉调整，避免每轮重新设计。

进度写入 `docs/PROGRESS.md`；记录测试命令、时间、结果、配置占位符。不要通过写“全部通过”替代测试记录。迁移原型代码时保留无障碍交互并替换所有演示行为。
