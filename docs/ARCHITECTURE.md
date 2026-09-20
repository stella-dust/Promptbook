# 架构与发布设计

## 最小组成

```text
                         ┌─ GitHub Issue / PR（公众贡献）
                         │
维护者浏览器 ─ Access ─ 管理 Worker ─ GitHub canonical JSON
      │                     │                  │
      │ 短期签名直传         │ 校验/确认          │ main commit
      ▼                     ▼                  ▼
R2 私有 staging ── 条件流式复制 ── R2 公开 media    GitHub Actions
                                      │          │
                                      │          ▼
访客浏览器 ───── 静态 HTML / 索引 ─ Cloudflare Workers Static Assets
      └──────── 图片/视频 ───── media 自定义域名/CDN
```

GitHub 是记录事实源；R2 是媒体事实源；静态页面和索引可随时由它们重建。没有数据库双写或后台内容缓存表。R2 使用两个桶只是区分暂存/已发布文件，免费额度按账号共享，不是翻倍。

## 正式代码目录（M0 创建）

```text
src/
  pages/index.astro
  pages/p/[id].astro
  pages/contribute.astro
  pages/admin/index.astro
  pages/admin/new.astro
  pages/admin/edit.astro
  pages/404.astro
  components/GalleryCard.astro
  components/MediaViewer.astro
  components/RecordEditor.tsx
  layouts/SiteLayout.astro
  styles/tokens.css
  styles/global.css
  lib/content.ts
  lib/search.ts
  lib/drafts.ts
  lib/media-client.ts
worker/
  index.ts
  auth.ts
  upload.ts
  github.ts
  validation.ts
scripts/
  build-index.ts
  validate-content.ts
public/
  favicon.svg
  _headers
content/entries/*.json
```

只在编辑器使用 React；无需把所有卡片变成客户端组件。`astro.config` 使用静态输出；Worker 单独打包与 `dist/` 一起部署，不上 Astro SSR adapter。保留原生视频，不接播放器 SaaS。

## 公开读取

构建读取 `content/entries`，校验后生成首页、每条详情、小型搜索索引和 `build-info.json`。索引初期可含完整 Prompt 以满足搜索；规模增长后再按文件拆分，不先上搜索服务。

公开 HTML/JS/CSS 通过 Static Assets；R2 媒体走 `media.<自有域名>`，不要让每个图片请求都经过管理 Worker。来源和媒体 URL 统一由受控的 `mediaBaseUrl + asset.key` 生成，禁止记录携带可执行协议或任意生产媒体域名。

每份媒体 URL 唯一且发布后不覆盖；派生缩略图是独立对象。缓存可长效，记录 JSON 和部署确认文件需重新验证。模型名称来自记录，不必维护一个声称覆盖所有新模型的硬编码清单。

## 本人 Web 写入

Access 只允许一个配置邮箱，用邮箱一次性验证码或本人已有的身份源。不建立应用账号表。至少保护 `/admin`、`/admin/*`、`/api/admin/*`，并在 Worker 中独立验证 JWT。路径精确匹配要实测 `/admin` 无尾斜杠、查询参数、重复斜杠和备用域名。

Worker 的管理 API 同时验证 Origin、Content-Type、body 大小。JWT 必须验证签名、算法允许列表、issuer、audience、exp 与唯一邮箱，使用成熟 JOSE 库，不仅解码 payload。维护者身份来自验证后的 token，不能相信前端发送的 authorEmail。

GitHub 凭证采用单仓库 fine-grained PAT（Contents read/write，Metadata read），固定仓库/分支/路径在服务器配置。该凭证并没有“仅某目录”的原生授权，路径限制由 Worker 代码保障，凭证泄漏仍有整仓风险。后续确有需要再改 GitHub App，V1 不先引入。

公开仓库若强制 main 只能 PR 合并，会阻止 Web 的 Contents API 直写。部署时选择允许唯一维护者的受控写入路径，并说明分支规则取舍；不要悄悄取消所有保护，也不要假设 API 自动绕过保护。

## 更新与一致性

GitHub 更新：`GET contents/...` 读取文件及其 SHA；`PUT contents/...` 携带该 SHA。新建不带 SHA；已存在返回冲突。客户端永远不能指定 `.github/workflows` 或其他任意路径。

每次发布生成新的 `revision` UUID 并写入记录。API 成功只返回 `state=committed` 和 commit SHA；前端转为“已写入 GitHub，等待网站更新”。

部署生成 `build-info.json`：

```json
{
  "builtAt": "2026-09-20T00:00:00Z",
  "commitSha": "<CI commit>",
  "entries": {"example-id": {"revision": "<uuid>", "status": "published"}}
}
```

前端每 3–5 秒读取不缓存的 build-info，最长约 3 分钟后停止自动轮询并给出“继续检查 / 查看 GitHub”，不把超时当成数据丢失。比较 entry revision，不仅比较全仓 commit：后面可能还有其他记录的提交。如果出现同条记录的新 revision，应提示“已有更新版本”，不要反复覆盖。

部署成功依赖 GitHub workflow 已配置；未配置时 Worker 不假装可以上线。生产 workflow 在 main push 后执行校验、构建、测试和部署。公开 PR 校验无 Secrets，禁用 `pull_request_target` 的不可信代码执行。

## 失败处理（跨系统不能假设事务原子性）

| 失败点 | 状态 | 恢复 |
|---|---|---|
| 媒体上传中断 | 私有 staging 可能有对象 | 重新签名/重传失败文件，其他文件复用 |
| finalize 失败 | staging 或已复制的公开对象 | 幂等检查对象，避免重复复制 |
| GitHub 409 | 媒体已就绪，JSON 未更新 | 保留表单与媒体引用，显示冲突 |
| GitHub 超时 | commit 可能已成功 | GET 目标文件比较 revision，再决定重试 |
| 构建失败 | GitHub 新版存在，线上仍旧版 | 展示 commit/构建位置，修复后重部署 |
| 浏览器关闭 | 草稿在 IndexedDB | 恢复，先确认远端 revision，不重复发布 |

finalize 是在维护者明确确认公开后执行；公开媒体早于网站索引可见。即使随后 GitHub 写入失败，这些随机 URL 对象也已经公开，不能把它们当作私密草稿。

## 贡献路径

`submissions/` 与 canonical 分开。CI 检查 submission 结构但不下载任意媒体；不带 R2 secret。维护者导入 submission 后人工重新上传结果，在 Web 发布 canonical JSON；完成后用 Issue/PR 评论或一次人工整理提交记录对应 id。

不自动读取每个第三方链接，也不运行 PR 提供的脚本进行媒体处理。现有 canonical 记录的文字修复，合并后正常静态构建即可。

## 备份与回滚

Git clone/拉取覆盖元数据；R2 另做完整导出或对象备份。GitHub 仓库本身不包含媒体备份。发布 URL 不覆盖，git revert 可恢复到仍存在的旧媒体引用。

staging 可以按生命周期清理；公开 media 默认不自动删除。候选孤儿对象仅生成 dry-run 报告，并检查现版本、待发布草稿、近期 Git 历史/保留标签和本地备份后人工确认。不要使用“当前 JSON 没引用就删除”的脚本破坏回滚。
