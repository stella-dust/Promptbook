# 合同补充：业务不变量

JSON Schema 负责单文件类型/必填/长度。以下跨字段、跨文件、跨系统规则也必须在 CI 与发布端校验：

1. 文件名等于 `{id}.json`；id 不重复且建立后不可更改。revision 每次发布改变，createdAt 不因编辑重置；updatedAt >= createdAt。
2. category 必须存在于 taxonomy；tags 去除空白后不为空、不重复。不直接 trim/规范化 prompt.text 的原始内容。
3. coverOutputId 必须指向 outputs 之一；output id 不重复；所有输出 mediaType 与 kind 一致。
4. original 的 MIME 和扩展名一致，image 原始文件 <=40MiB，video <=250MiB；thumbnail/preview 必须为允许图片类型。尺寸和时长以实际文件读取为准。
5. 每个 media key 限制在 `published/{当前entryId}/...`；不能指向 staging、任意 URL、别的记录目录或路径遍历。复制为新记录时，媒体需显式重新关联/复制到新 id 目录；不能只改 id 留下旧 key。
6. 本期 reference 只允许图片，不超过 4 项；是否公开须主动确认。每条原文件总量 <=600MiB；原图 + 预览 + 缩略图/视频封面合计也应在 UI 显示。
7. 模型证据 unknown 时 modelId 应为 null；允许原样保存 modelLabel，不检查是否在硬编码“已发布模型”表里。
8. source.type=adapted/collected 时应提供作者和公开来源链接；链接只 https，前端不渲染可执行 HTML，不从服务器抓任意地址。
9. canonical status 只允许 published/archived。draft/demo/临时 blob URL/内嵌 data URL/模板示例不得进入正式目录或 dist 索引。
10. 原图/视频存在性与实际 bytes 在 finalize/发布时验证；无密钥 PR CI 只校验结构，不假装完成了 R2 存在性检查。
11. API 数据体按 UTF-8 字节限制 512KiB（覆盖多字节 Prompt）；所有客户端/服务端错误友好显示。JSON Schema maxLength 按字符，不等于 HTTP 字节数。
12. 外部贡献 submission 媒体 URL 仅为待接收材料；未由维护者确认转入 R2 的内容不发布。

未知 MIME 或参数不是依靠“信任维护者”跳过安全验证。生产运行时可选用 Zod/预编译 Ajv 等成熟库实现；JSON Schema 仍为对外交付模板的序列化合同。使用 Ajv 时需考虑 Worker 对动态代码生成的限制，在构建期生成 standalone validator，不能运行时 new Function 编译 schema。
