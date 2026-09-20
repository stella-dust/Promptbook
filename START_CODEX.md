# 给 Codex 的启动指令

将整个开发包解压到准备使用的项目目录，打开该目录，再粘贴以下内容：

```text
请以当前目录为项目根，开始开发 Promptbook（工作名，可配置）。

这是个人图片 / 视频 Prompt 记录本。请先读取 README.md、AGENTS.md、DESIGN.md、docs/PRD.md、docs/ARCHITECTURE.md、docs/IMPLEMENTATION_PLAN.md，运行已有检查，并查看 prototype/index.html 的桌面端、详情和编辑页。不要只从文档重新想象一个通用 SaaS 界面。

产品只保留：图/视频与 Prompt 展示、分类和轻量搜索、详情复制、本人新建/编辑、原始生成信息、GitHub 贡献入口。不做公众账号、AI 生成、点赞评论、积分、聊天、团队系统或数据看板。

技术按包内方案推进：Astro 静态页面 + TypeScript，管理编辑器用一个 React island；GitHub JSON 为记录事实源，R2 为媒体事实源，Cloudflare Workers Static Assets 部署；管理路径使用 Cloudflare Access 与 Worker JWT 二次校验。不增加数据库，不把生产媒体提交进 Git，不把草稿写入公开仓库。

先完成 M0 和 M1：建立可运行工程，迁移视觉原型，使用明确标识的测试数据。运行构建与浏览器测试，给出 1440px 桌面首页、390px 手机首页、详情页、新建页截图。我确认视觉之后，再进入真实媒体上传和发布链路。除当前阶段的必要澄清，不要用长清单反复提问。

每阶段更新 docs/PROGRESS.md，列出修改文件、执行命令、实际测试结果和剩余事项。不要把待实现接口、mock 成功、未执行的测试写成已完成。每阶段产出可运行代码，保持改动聚焦。

模型名称接受人工输入；ChatGPT 产品界面没有明确给出的模型版本、seed 等信息必须留空/未知。实际 Prompt 原文和原始文件不能被 AI 自动改写或重新生成替代。

最终上线前，根据 docs/ACCEPTANCE.md 验证上传、Access 越权、GitHub 冲突、部署延迟、视频播放、手机端、费用路径和回滚。需要外部凭证时仅说明名称及配置位置，不要求把密钥粘贴进对话或仓库。
```
