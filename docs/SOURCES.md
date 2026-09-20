# 一手来源与核实记录

核实日期：2026-09-20。来源用于核对平台能力/约束/价格；本包中的 UI、字段、限额、工作流与选型属于项目设计建议。价格会变化，上线前再核查。

| 编号 | 官方来源 | 本包使用的结论 |
|---|---|---|
| S1 | https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github | 普通 Git 大文件警告/阻止限制，避免媒体仓库膨胀 |
| S2 | https://docs.github.com/en/billing/concepts/product-billing/github-actions | 公共仓库标准 runner 免费；larger runner 和存储另有条件 |
| S3 | https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ | 静态资产请求免费不限次数；调用 Worker 另计 |
| S4 | https://developers.cloudflare.com/workers/platform/pricing/ | Workers Free 请求/CPU，Paid 基础计费 |
| S5 | https://developers.cloudflare.com/r2/pricing/ | Standard 存储与 A/B 单价、免费额度、取整、零 egress |
| S6 | https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/ | Workers Builds 免费构建分钟；作为可替代 CI 路径 |
| S7 | https://developers.cloudflare.com/r2/get-started/ | R2 subscription 开通流程 |
| S8 | https://www.cloudflare.com/plans/zero-trust-services/ | Access/SASE 计划入口仍有免费计划，单维护者按控制台核对 |
| S9 | https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/ | One-time PIN 登录 |
| S9b | https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ | 验证 Access JWT 的签名、issuer、audience |
| S10 | https://developers.cloudflare.com/r2/buckets/public-buckets/ | 生产用自定义域名；r2.dev 面向开发且有限流 |
| S11 | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ | 签名 URL 是短期 bearer token，仅用于 S3 API 域名，不支持自定义域名 |
| S12 | https://developers.cloudflare.com/r2/buckets/cors/ | 浏览器直传 CORS 配置 |
| S13 | https://developers.cloudflare.com/workers/static-assets/routing/worker-script/ | 选择性 run_worker_first 路由；不要让静态流量全进 Worker |
| S14 | https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents | 创建/更新单文件、SHA 冲突控制 |
| S15 | https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/ | 通过 GitHub Actions 部署 Workers |
| S16 | https://github.com/wuyoscar/GPT-Image2-Skill/blob/main/CONTRIBUTING.md | GitHub 贡献、Prompt+结果配对、分类与保留作者来源 |
| S17 | https://docs.astro.build/en/getting-started/ | 正式工程选用 Astro，具体依赖版本交给 M0 锁定 |
| S18 | https://developers.cloudflare.com/r2/api/s3/api/ | 实现 CopyObject 时核查 R2 支持的 S3 操作/请求头 |
| S20 | https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ | R2 流式 GET/PUT、条件写入、Headers 形式的 If-None-Match |
| S19 | https://developers.cloudflare.com/r2/buckets/object-lifecycles/ | staging 清理与不完整 multipart 生命周期 |

S16 本次通过 GitHub 连接读取的 CONTRIBUTING.md blob SHA 为 `08fc8225d051e06856b89e067d15c4a79f470192`。只借鉴贡献方法，不复用该仓库的图片、提示词或 CLI。

未在本次账号里实测：真实费用、账号已有免费额度、Access 的具体权益配置、R2 CORS/复制/缓存、GitHub 写入权限、自动部署。它们在 M3–M5 联调验证，不能用文档核实替代运行证据。
