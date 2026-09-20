# 贡献指南

欢迎贡献真实的 Prompt + 实际生成结果。网站没有公众账号，贡献入口在 GitHub。

## 已有记录的修正

直接修改 `content/entries/{id}.json` 提交 PR。保留 id、原始来源，更新 revision 与 updatedAt。只修改文字/标签时不需要重新上传媒体。不得把示例图或想象的效果写成实际输出。CI 通过且维护者合并后，站点自动重建。

## 新案例

默认路径：复制 `templates/submission.example.json` 到 `submissions/{简短英文名}.json`，填入 Prompt、分类、模型说明、作者和真实媒体暂存链接，再提交 PR。也可用 GitHub Issue 模板提供相同信息。

媒体先作为 Issue 附件或可供维护者下载的短期链接提供。**不要把原始 PNG / MP4 提交进仓库。** 这些外部链接只用于接收素材，不能当成永久图库地址。

维护者审核 → 下载/检查原文件 → 在 Web 导入 submission → 重新上传自己的 R2 → 发布为 `content/entries` canonical 记录 → 在原 Issue / PR 标注上线地址。新 submission 合并不会直接进入首页；这一步隔离用于防止任意媒体和未核实链接直接上线。

## 最小内容要求

提供准确 Prompt、真实结果、平台与所知模型、分类、作者/来源、许可情况。无法确认的 seed、模型 ID、生成日期填写未知，不推断。使用参考图、多轮编辑或后期处理需要说明；没有公开参考图时明确无法完全复现。

不要把 GitHub/R2 密钥写进文件。不要增加脚本或要求 CI 自动下载/执行外部内容。复用已有类目；新增类目单独说明理由。

## 维护者检查

```bash
npm run check:handoff
npm test
python3 tools/validate_content.py
```

正式工程建立后还需运行构建和等价 schema 校验。Prompt 保留原文，作者与来源可见，图片/视频不冒领到别的模型。代码 PR 与内容 PR 尽量分开。
