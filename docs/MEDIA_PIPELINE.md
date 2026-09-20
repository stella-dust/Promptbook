# 图片 / 视频处理与上传

## 文件分层

| 角色 | 用途 | V1 处理 |
|---|---|---|
| original | 原始下载结果 | 保留字节；不压缩后冒充原图 |
| preview | 详情阅读用图 | 浏览器生成最长边约 1600–2000px WebP，非生成式变换 |
| thumbnail | 卡片 / 视频封面 | 图片约 720–960px WebP；视频提取 poster |
| reference | 明确授权公开的参考输入 | 可选，不默认上传个人照片/上下文 |

每个图片输出原图 + 缩略图必需，preview 可选；小图不重复生成没有意义的大预览。视频输出原文件就是可播放文件时共用，thumbnail 必需；V1 不自动产生第二份转码视频。

任何派生图均保留对原始输出的关联。图片质量以实际视觉为准，优先从 quality≈0.86、最长边 800/1800px 起调，不能承诺某个值保证固定体积。预览转换仅发生在浏览器或本地脚本，不把媒体处理塞进 10ms CPU 的免费 Worker。

## 格式和自设限额

图片：PNG、JPEG、WebP；视频：浏览器可实际播放的 MP4 或 WebM。MP4 封装不保证编码可播，需要加载元数据和实际播放检测。V1 不直接支持 HEIC、MOV、SVG、HTML、动画 GIF；保留后续扩展空间。

产品建议初值：图片每文件 <=40 MiB，视频 <=250 MiB，每条最多 8 个结果、4 个公开参考输入，整条所选原文件总量 <=600 MiB。这些是应用自己的限制，不是 Cloudflare/GitHub 的官方限额。移动端内存不足允许降预览尺寸，禁止一次性解码所有大图。

前端先检查，服务端签名前再次检查声明值，finalize 再检查实际对象。签名 PUT 不等于硬性 Content-Length 限制：真正的大小检查发生在上传后，异常对象应删除并拒绝发布。因为只有维护者可签名，V1 不建设公众滥用配额系统。

## 上传路径

1. 浏览器读取文件、真实宽高/时长和 MIME，显示即将公开的内容，按需生成 thumbnail/preview。
2. `POST /api/admin/uploads/presign`，提交 entryId、文件角色、声明 bytes/MIME、客户端 requestId。
3. Worker 验证 Access 与 Origin，为私有 staging 的唯一 key 签发短期 PUT URL，并返回经服务器签名的 uploadReceipt。建议有效期 15 分钟；签名权限仅 PUT 精确对象键。
4. 浏览器直接 PUT 到 `<account>.r2.cloudflarestorage.com`，不走本站 Worker 请求体；上传并发为 2，使用可显示进度的 XHR/等效实现。CORS 仅允许管理站点 Origin 和所需请求头。
5. `POST /api/admin/uploads/finalize` 带 receipt。Worker 验证 receipt 和对象 HEAD，再读取很小的前缀检查文件签名；校验 bytes/MIME，拒绝可执行格式。不要把几百 MB 文件读入 ArrayBuffer。
6. 通过 R2 S3 条件流式复制 从 staging 复制到公开 media 的固定 final key。final key 是唯一且不可覆盖的 `published/{entryId}/{assetId}.{ext}`；客户端从未获得针对 final key 的写 URL，避免签名在有效期内被重放覆盖已发布对象。
7. 条件写入成功后验证目标元数据，删除 staging 副本。返回 canonical asset 引用；浏览器保留这个引用，后续失败可复用。
8. 所有媒体确认后，提交 canonical entry。Worker 对 final key 做允许前缀及存在性校验，再写 GitHub。

R2 私有 staging 不绑定公开域名、不启用 r2.dev；公开 media 只通过自己的媒体域名读取。两桶属于同一账户，存储/操作用量合并计费。

## 幂等性

签名 receipt 内包含 entryId、stagingKey、finalKey、期望 bytes/MIME、requestId、exp，HMAC 密钥仅在 Worker。重复 finalize 先检查 finalKey 的状态；如果已经成功，直接返回同一结果。最终对象只由 Worker 创建，不签名覆盖。目标已存在时先核对 requestId、entryId、MIME、bytes 和源 ETag 元数据；任一冲突拒绝复用。并发条件 PUT 只有一次创建成功，失败方读取并核对已存在对象。

校验前缀与完整源 GET 均绑定同一 ETag，源发生变化则终止并重新检查。将 `R2ObjectBody.body` 直接传给目标 PUT，不调用完整 `arrayBuffer()`，不使用会缓冲整片视频的 `tee()`。M3 必须实测并发、流关闭、250 MiB 文件和 CPU 预算。[S20]

本版不采用普通 S3 CopyObject 作为默认 finalize：仅源端 If-Match 不等同于目标端原子“只创建”。将来优化服务器内复制时，仍要保留并发不可覆盖保证。[S18,S20]

并发两次 finalize 不能错误地删掉其他上传；final key 的生成与 receipt 一一对应。文件本身的哈希不是必须前端整块计算：图片可计算，视频先不为了哈希把大文件复制进内存；不能把 multipart ETag 误当成 MD5。

## 视频

首页只展示 poster。详情采用 `<video controls playsinline preload="none" poster="...">`；切换输出和关闭查看器时暂停，离开页面停止下载。原始视频不自动播放，也不为所有列表项预载 metadata。

浏览器能解码时本地提取封面；无法提取时允许单独上传封面。正式上线必须测 Safari/iOS 与 Chrome，不仅检查文件扩展名。MP4 建议 H.264 + AAC、faststart；WebM 作为另一可选格式。

需要预先转码时提供本地命令，保留原文件作为个人源文件；是否同时公开上传原文件由维护者决定，不强制让存储翻倍。命令示意需在真实样本上验证：

```bash
ffmpeg -i input.mov -c:v libx264 -crf 23 -preset medium \
  -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart output.mp4
```

这只是手动准备步骤，V1 不接 Cloudflare Stream、不建自动转码服务。以后确实需要自适应码率时再独立评估。

## 隐私、清理与缓存

原图可能含 EXIF、地理信息或其他嵌入信息；提交前提示检查。衍生缩略图不意味着原文件隐私信息已被清理。含个人参考图的场景必须明确决定是否公开；可仅记录“使用了未公开参考图”，并说明无法完整复现。

私有 staging 设置 7 天对象过期；不完整 multipart 可设 1 天终止（V1 单 PUT 也可预先配置）。公开媒体不得使用同样的生命周期。public URL 被他人获知后可访问，归档条目不使对象变私有。

公开媒体设置正确 Content-Type 和 `Cache-Control: public, max-age=31536000, immutable`，并配置自定义域名缓存规则。视频必须实测 Range 206、拖动、Content-Length；不承诺每个大文件必然被 CDN 命中。替换文件生成新 key；下架时按需要清理源对象与缓存。
