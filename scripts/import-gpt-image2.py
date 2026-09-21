"""One-time, deterministic manifest for the pinned GPT-Image2-Skill gallery.

Usage: python3 scripts/import-gpt-image2.py /path/to/upstream-markdown /tmp/gallery-manifest.json
The checked-in records are the production source of truth. This script does not
download or publish media; it keeps the source/translation pairing auditable.
"""

import json
import re
import sys
from pathlib import Path

COMMIT = "05cb1130bba29e0fc028220376280a2e934a8041"
ROOT_URL = f"https://github.com/wuyoscar/GPT-Image2-Skill/blob/{COMMIT}/"

CATEGORIES = {
    "anime-and-manga": ("character", "动漫漫画"),
    "gaming": ("story", "游戏美术"),
    "retro-and-cyberpunk": ("story", "复古赛博"),
    "cinematic-and-animation": ("story", "电影动画"),
    "character-design": ("character", "角色设计"),
    "typography-and-posters": ("design", "海报排版"),
    "illustration": ("design", "插画"),
    "watercolor": ("design", "水彩"),
    "ink-and-chinese": ("design", "水墨"),
    "pixel-art": ("design", "像素画"),
    "isometric": ("space", "等距场景"),
    "product-and-food": ("product", "产品美食"),
    "brand-systems-and-identity": ("design", "品牌视觉"),
    "photography": ("story", "写实摄影"),
    "infographics-and-field-guides": ("design", "信息图"),
    "research-paper-figures": ("design", "论文插图"),
    "official-openai-cookbook-examples": ("other", "官方示例"),
    "edit-endpoint-showcase": ("design", "图像编辑"),
    "ui-ux-mockups": ("design", "界面设计"),
    "data-visualization": ("design", "数据可视化"),
    "technical-illustration": ("design", "技术图解"),
    "architecture-and-interior": ("space", "建筑室内"),
    "scientific-and-educational": ("design", "科学教育"),
    "fashion-editorial": ("character", "时尚大片"),
    "fine-art-painting": ("design", "绘画艺术"),
    "more-illustration-styles": ("design", "插画风格"),
    "cinematic-film-references": ("story", "电影风格"),
    "beauty-and-lifestyle": ("product", "美妆生活"),
    "events-and-experience": ("design", "活动体验"),
    "tattoo-design": ("design", "纹身设计"),
    "screen-photography": ("story", "屏幕摄影"),
}

# These entries do not appear in the Chinese README showcase. Keep the actual
# gallery prompt verbatim; only the display title is localized.
TITLES = {
    1: "蓝色能量的对决", 2: "忍者空中交锋", 3: "篮球扣篮漫画双页",
    4: "双城记人物关系图", 8: "春日咖啡馆群像", 12: "雨天站牌镜中人像",
    21: "低多边形武士村落", 33: "中式茶饮上市海报", 34: "八十年代宣传海报",
    35: "悬疑电影剪影海报", 38: "波士顿春季城市海报", 39: "史诗世界观剪影海报",
    40: "双重曝光叙事海报", 41: "西游记剪影史诗海报", 42: "日式弹珠机彩虹传单",
    43: "西语奇幻电影手机海报", 45: "运动员成长海报", 48: "睡莲池畔的水彩少女",
    50: "水墨山川", 54: "等距咖啡街区", 58: "沙拉飞溅美食摄影",
    71: "首尔周末旅行指南", 75: "中国濒危动物信息图", 81: "检索增强生成流程图",
    79: "治疗响应统计图", 80: "Transformer 架构图", 82: "多智能体系统架构",
    83: "扩散模型去噪过程", 84: "模型缩放规律图", 85: "基准测试热图",
    86: "消融实验柱状图", 87: "预训练数据流向图", 88: "多头注意力热图",
    89: "前沿语言模型家族树", 90: "ReAct 推理轨迹",
    91: "多模态智能体记忆路由", 93: "ICLR 风格方法图", 94: "语言模型角色图谱", 95: "多模态实验流程图",
    96: "间接提示词注入攻击流程", 99: "烘焙品牌极简标志", 101: "棋盘的冬日晚景", 102: "茶饮海报地铁灯箱",
    103: "手机记账应用界面", 110: "能源流向弦图", 114: "运载火箭剖面图",
    122: "哥特式大教堂室内", 131: "先锋高级定制秀场", 133: "马术庄园复古时尚",
    140: "深红与赭色抽象色域", 142: "现代健康主题扁平插画",
    144: "阿尔卑斯山低多边形日落", 146: "墨西哥主题可爱贴纸",
    147: "城市阴影孔版印刷",
}


def blocks(markdown):
    return re.findall(r"```text\n(.*?)\n```", markdown, re.S)


def main(source, destination):
    index = (source / "gallery.md").read_text()
    names = re.findall(r"\[`(gallery-[^`]+\.md)`\]", index)
    assert len(names) == len(CATEGORIES) == 31

    # README contains Chinese translations for most (not all) examples. In a
    # Pair by A/B/C labels: visual grid order may differ from prompt order.
    readme = (source / "README.zh.md").read_text()
    showcase = {}
    for section in re.split(r"(?=^#### )", readme, flags=re.M)[1:]:
        images = re.findall(r'<a href="(docs/[^" ]+\.(?:png|jpg|webp))"', section)
        prompts = blocks(section)
        if not images or len(images) != len(prompts):
            continue
        image_labels = re.findall(r"<strong>([A-P]) · ([^<]+)</strong>", section)
        prompt_labels = re.findall(r"\*\*提示词 ([A-P]):[^*]*\*\*\s*```text\n", section)
        title = re.match(r"#### (.*)", section).group(1)
        if len(images) > 1:
            assert len(image_labels) == len(images), title
            assert len(prompt_labels) == len(prompts), title
            by_label = dict(zip(prompt_labels, prompts))
            assert len(by_label) == len(prompts), title
            for image, (label, heading) in zip(images, image_labels):
                assert label in by_label, (title, label)
                showcase[image] = (by_label[label], heading)
        else:
            showcase[images[0]] = (prompts[0], image_labels[0][1] if image_labels else title)

    entries = []
    for name in names:
        key = name.removeprefix("gallery-").removesuffix(".md")
        category, tag = CATEGORIES[key]
        document = (source / name).read_text()
        for section in re.split(r"(?=^### No\. \d+ · )", document, flags=re.M)[1:]:
            match = re.search(r"^### No\. (\d+) · (.+)$", section, re.M)
            number = int(match.group(1))
            images = re.findall(r"^- Image: `(docs/[^`]+\.(?:png|jpg|webp))`", section, re.M)
            if number == 101:
                images = ["docs/edit-endpoint-showcase/edit-chess-winter.png"]
            assert len(images) == 1, (number, images)
            image = images[0]
            prompt = blocks(section)[0]
            title = TITLES.get(number)
            if image in showcase:
                candidate, candidate_title = showcase[image]
                if re.search(r"[\u3400-\u9fff]", candidate):
                    prompt = candidate
                if not title and re.search(r"[\u3400-\u9fff]", candidate_title):
                    title = candidate_title
            if not title:
                raise ValueError(f"Missing Chinese title for No. {number}: {match.group(2)}")
            metadata = re.search(r"^- Metadata: (.*)$", section, re.M).group(1)
            author_match = re.search(r"Author: ([^·]+)", metadata)
            source_match = re.search(r"Source: \[[^]]+\]\((https?://[^)]+)\)", metadata)
            author = author_match.group(1).strip() if author_match else "Wuyoscar（整理）"
            origin = source_match.group(1) if source_match else ROOT_URL + "skills/gpt-image/references/" + name
            data = {
                "id": f"gpt-image2-{number:03d}", "number": number,
                "title": title, "category": category, "tags": [tag, "外部收藏"],
                "prompt": prompt, "image": image, "author": author,
                "origin": origin, "gallery": ROOT_URL + "skills/gpt-image/references/" + name,
                "model": None, "modelEvidence": "unknown", "generatedAt": None,
                "parameters": {}, "references": [],
            }
            if number in (101, 102):
                data["references"] = ["docs/photography/chess-midgame.png" if number == 101 else "docs/typography-posters/tea-poster.png"]
            entries.append(data)

            variant = re.search(r"^- (?:Sunburst (?:cutaway adaptation|output using the same prompt|edit of the original chess image using the same prompt)): `(docs/[^`]+\.png)`", section, re.M)
            if variant:
                detail = re.search(r"^- Output metadata: `([^`]+)` · `([^`]+)` · `([^`]+)` · `([^`]+)`", section, re.M)
                assert detail, number
                variant_prompt = blocks(section)[1] if number == 54 else prompt
                entries.append({**data, "id": f"gpt-image2-{number:03d}-sunburst", "title": title + " · Sunburst",
                                "image": variant.group(1), "prompt": variant_prompt,
                                "model": detail.group(1), "modelEvidence": "platform-displayed",
                                "generatedAt": detail.group(4) + "T00:00:00Z",
                                "parameters": {"quality": detail.group(2), "size": detail.group(3)},
                                "references": [image] if number == 54 else data["references"]})

    # README has one separate image-to-prompt experiment absent from the
    # numbered catalog. The supplied contributor photo is an input reference.
    extra = re.search(r"\*\*正向 Prompt\*\*\s+~~~text\n(.*?)\n~~~\s+\*\*Negative Prompt\*\*\s+~~~text\n(.*?)\n~~~", readme, re.S)
    assert extra
    entries.append({"id": "gpt-image2-image-to-prompt", "number": 164,
                    "title": "冬季小巷与狼犬", "category": "design", "tags": ["插画", "参考图", "外部收藏"],
                    "prompt": extra.group(1), "negativePrompt": extra.group(2),
                    "image": "docs/illustration/get-prompt-from-image-result.png",
                    "author": "@LunarXuan", "origin": ROOT_URL + "README.zh.md",
                    "gallery": ROOT_URL + "README.zh.md",
                    "model": None, "modelEvidence": "unknown", "generatedAt": None,
                    "parameters": {}, "references": ["docs/illustration/get-prompt-from-image-reference.jpg"]})

    numbers = [item["number"] for item in entries if not item["id"].endswith("-sunburst") and item["number"] != 164]
    assert sorted(numbers) == list(range(1, 164)), numbers
    assert len(entries) == 169, len(entries)
    destination.write_text(json.dumps({"upstreamCommit": COMMIT, "entries": entries}, ensure_ascii=False, indent=2) + "\n")
    chinese_count = sum(any("\u3400" <= char <= "\u9fff" for char in item["prompt"]) for item in entries)
    print(f"Prepared {len(entries)} records; {chinese_count} Chinese prompts")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
