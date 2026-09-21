# GPT-Image2-Skill 图库收录

上游：<https://github.com/wuyoscar/GPT-Image2-Skill>，固定提交 `05cb1130bba29e0fc028220376280a2e934a8041`。来源为 `README.zh.md` 和 `skills/gpt-image/references/gallery.md` 指向的 31 份分类文件。图库编号 No. 1–163 各收录一条；另外五张明确标注 Sunburst 模型的样张独立记录，README 中的参考图反推结果另记一条，合计 169 条。README 的同图精选不重复收录。

每条保留对应源图片和提示词。README 已给出中文提示词的条目优先采用其中的译写；其他条目保留分类文件中的英文原文，以免把未经验证的翻译误写成出图词。标题与分类为本站中文整理。模型只有上游明确记录的五张 Sunburst 样张标注版本，其余写“未记录模型”。编辑案例的输入图单列为参考图，不当成生成结果。

仓库自身声明 MIT License，许可原文见 [GPT-Image2-Skill-LICENSE.txt](GPT-Image2-Skill-LICENSE.txt)。上游部分条目又标注第三方作者和来源；MIT 声明不等于这些外部作品已逐一取得可再授权证明。本站逐条保留作者及来源 URL，媒体和 Prompt 的实际授权状态均标为 `unspecified`，不把“收录”改写为原创，也不声称其模型或生成参数已独立验证。如原作者要求调整署名或撤下内容，应按来源记录定位该条目处理。

复现清单：下载上述固定提交的 README、索引及分类 Markdown 和 `docs/` 图片后，执行 `python3 scripts/import-gpt-image2.py <markdown-dir> <manifest.json>`，再执行 `node scripts/prepare-gpt-image2.mjs <manifest.json> <images-dir> <derived-dir>`。第二步写入 `content/entries/`，在派生目录生成 WebP 缩略图、预览图及 `upload-manifest.json`。发布前须先将清单列出的每个文件上传到 `promptbook-media` 的对应 R2 key，再运行内容检查和构建。原图的 SHA-256 和实际字节数记录在条目中，仓库不保存大体积图片副本。
