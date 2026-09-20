# T2P 图片测试原始提示词存档

来源：[T2P ChatGPT 项目](https://chatgpt.com/g/g-p-6aac1145ee6c81918a082a7d05daa6fb-t2p/project)中的六组测试，以及用户随后手动提供的 007。七组原始用户消息按 JSON Lines 格式保存在 [t2p-pending-prompts.jsonl](t2p-pending-prompts.jsonl)，供核对排版后的公开 Prompt。文件名保留首次收集时的名称。

首次读取对话时没有可取得的媒体与模型信息。用户后来提供 001–007 的实际结果文件，并说明模型均为 GPT Image 2.5。七条正式记录见 `content/entries/`；生成时间、参数和许可仍未确认。原始提示词存档随公开仓库可见。

| 图片 | 测试 | 来源对话 ID | 正式记录 |
|---|---|---|---|
| 001 | 酒店写真 | `6aafc424-e004-83ea-a73a-a1002de8f9b8` | `t2p-001-hotel-portrait` |
| 002 | 手机照片图库 | `6aad8007-ab48-83ea-85cd-e938d1d9c47e` | `t2p-002-teacher-gallery` |
| 003 | 商务 KTV 夜生活 | `6aad7fc3-f768-83ea-921c-88a26239a2c3` | `t2p-003-ktv-night` |
| 004 | 一天生活九宫格 | `6aad7b73-2cf4-83e9-942a-4d82c5264ff2` | `t2p-004-day-in-nine` |
| 005 | 中系室内人像 | `6aad7a0a-8ae0-83ea-b3e9-a56b3fe560a3` | `t2p-005-indoor-portrait` |
| 006 | 卧室自拍摄影 | `6aac1158-a84c-83ea-8712-b2c02f504496` | `t2p-006-bedroom-selfie` |
| 007 | 街边冰茶摊的人像 | 用户手动提供 | `t2p-007-street-tea-portrait` |

“酒店写真”对话重复提交同一 Prompt 两次，第二次只重复了 `@创建图片` 调用；JSONL 中保存较早的原文，并保留两个消息 ID 供核对。开发资料对话“检索开源项目”不属于作品测试，未收入。
