import { useEffect, useRef, useState } from "react";
import { validateEntry, type Entry } from "../lib/validation";
import { getDraft, saveDraft, type Draft, type LocalFile } from "../lib/drafts";
import { api, prepareFile, uploadFile, upload } from "../lib/media-client";
import { validateBeforeUpload } from "../lib/prepare-entry";
import site from "../../content/site.json";
import taxonomy from "../../content/taxonomy.json";
function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`${site.base}/icons.svg#${name}`} />
    </svg>
  );
}
function blank(): Entry {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: "note-" + crypto.randomUUID(),
    revision: crypto.randomUUID(),
    status: "published",
    kind: "image",
    title: "",
    category: taxonomy[0].id,
    tags: [],
    createdAt: now,
    updatedAt: now,
    prompt: { text: "", language: "unknown", followups: [] },
    generation: {
      platform: "",
      modelLabel: "",
      modelId: null,
      modelEvidence: "unknown",
      generatedAt: null,
      parameters: {},
    },
    outputs: [],
    coverOutputId: "",
    references: [],
    source: { type: "original", author: "", url: null, contributor: null },
    rights: { prompt: "unspecified", media: "unspecified" },
    notes: "",
    derivedFrom: null,
  };
}
function FilePreview({ file }: { file: LocalFile }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file.thumbnail);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file.thumbnail]);
  return (
    <img
      src={url}
      alt={file.alt || file.name}
      width={file.width}
      height={file.height}
    />
  );
}
export default function RecordEditor({
  mode = "new",
}: {
  mode?: "new" | "edit";
}) {
  const [entry, setEntry] = useState<Entry>(blank);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<LocalFile[]>([]);
  const [sha, setSha] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("正在恢复草稿…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [parameters, setParameters] = useState("{}");
  const [attempt, setAttempt] = useState<Entry>();
  const [pending, setPending] = useState<Draft["pending"]>();
  const [online, setOnline] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);
  const current = useRef<Draft | null>(null);
  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const session = await api<{ canPublish: boolean }>("session");
        if (alive) setCanPublish(session.canPublish);
        if (!session.canPublish)
          setError("发布服务尚未接通。可以先保存本地草稿。");
      } catch (e) {
        setError((e as Error).message);
      }
      try {
        const query = new URLSearchParams(location.search);
        const id = query.get("draft");
        let draft = id ? await getDraft(id) : undefined;
        if (!draft && mode === "edit") {
          const id = query.get("id");
          if (!id) throw new Error("缺少记录编号");
          const data = await api<{ entry: Entry; fileSha: string }>(
            `entries/${encodeURIComponent(id)}`,
          );
          draft = {
            id: data.entry.id,
            entry: data.entry,
            files: [],
            baseFileSha: data.fileSha,
            savedAt: new Date().toISOString(),
          };
        }
        if (alive && draft) {
          setEntry(draft.entry);
          setFiles(draft.files);
          setReferenceFiles(draft.referenceFiles ?? []);
          setSha(draft.baseFileSha);
          setParameters(
            draft.rawParameters ??
              JSON.stringify(draft.entry.generation.parameters, null, 2),
          );
          setPending(draft.pending);
          setAttempt(draft.attempt);
          setStatus("已恢复当前浏览器草稿");
        } else if (alive) {
          try {
            const prefs = JSON.parse(
              localStorage.getItem("promptbook-preferences") ?? "{}",
            );
            setEntry((e) => ({
              ...e,
              category: taxonomy.some((t) => t.id === prefs.category)
                ? prefs.category
                : e.category,
              generation: {
                ...e.generation,
                platform: prefs.platform ?? "",
                modelLabel: prefs.modelLabel ?? "",
              },
            }));
          } catch {}
          setStatus("草稿仅保存在当前浏览器");
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setReady(true);
      }
    };
    void init();
    return () => {
      alive = false;
    };
  }, [mode]);
  useEffect(() => {
    if (!ready) return;
    dirty.current = true;
    const draft = {
      id: entry.id,
      entry,
      files,
      baseFileSha: sha,
      savedAt: new Date().toISOString(),
      pending,
      rawParameters: parameters,
      attempt,
      referenceFiles,
    };
    current.current = draft;
    const timer = setTimeout(() => void persist(draft), 500);
    return () => clearTimeout(timer);
  }, [entry, files, sha, pending, ready, parameters, attempt, referenceFiles]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [busy]);
  async function persist(draft: Draft) {
    draft = { referenceFiles, rawParameters: parameters, ...draft };
    try {
      await saveDraft(draft);
      dirty.current = false;
      if (!busy && !pending && !online) setStatus("已保存到当前浏览器");
      const url = new URL(location.href);
      url.searchParams.set("draft", draft.id);
      history.replaceState(null, "", url);
      return true;
    } catch {
      try {
        await saveDraft({ ...draft, files: [], referenceFiles: [] });
        setError("浏览器空间不足：文字已保存，尚未上传的媒体需要重新选择。");
        setStatus("媒体未保存");
      } catch {
        setError("草稿无法保存。请立即导出 JSON，并保留原始媒体文件。");
      }
      return false;
    }
  }
  const patch = (value: Partial<Entry>) => {
    setOnline(false);
    setAttempt(undefined);
    setPending(undefined);
    setEntry((e) => ({ ...e, ...value }));
  };
  async function addFiles(list: File[]) {
    if (!list.length) return;
    setBusy(true);
    setError("");
    try {
      if (files.length + entry.outputs.length + list.length > 8)
        throw new Error("每条最多 8 个结果");
      const kind = (
        files[0]?.file.type ??
        entry.outputs[0]?.original.mimeType ??
        list[0].type
      ).startsWith("image/")
        ? "image"
        : "video";
      if (
        list.some(
          (f) => (f.type.startsWith("image/") ? "image" : "video") !== kind,
        )
      )
        throw new Error("图片与视频请分成两条记录");
      if (
        [
          ...files.map((f) => f.file.size),
          ...entry.outputs.map((o) => o.original.bytes),
          ...list.map((f) => f.size),
        ].reduce((a, b) => a + b, 0) >
        600 * 1024 ** 2
      )
        throw new Error("原始文件合计不能超过 600 MiB");
      const prepared: LocalFile[] = [];
      for (const file of list) {
        setStatus(`准备 ${file.name}`);
        prepared.push(await prepareFile(file));
      }
      setFiles((old) => [...old, ...prepared]);
      patch({ kind, coverOutputId: entry.coverOutputId || prepared[0].id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const list = [...(e.clipboardData?.files ?? [])];
      if (list.length) {
        e.preventDefault();
        void addFiles(list);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [files, entry]);
  async function addReferences(list: File[]) {
    setBusy(true);
    setError("");
    try {
      if (
        (entry.references?.length ?? 0) + referenceFiles.length + list.length >
        4
      )
        throw new Error("最多 4 张公开参考图");
      if (list.some((f) => !f.type.startsWith("image/")))
        throw new Error("参考输入只支持图片");
      const added: LocalFile[] = [];
      for (const file of list)
        added.push({
          ...(await prepareFile(file)),
          referenceRole: "image-reference",
        });
      setReferenceFiles((old) => [...old, ...added]);
      patch({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportJSON() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              entry,
              parameters,
              mediaToReselect: [...files, ...referenceFiles]
                .filter((f) => !f.uploaded)
                .map((f) => f.name),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.id}-draft.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function preparedEntry() {
    let params;
    try {
      params = JSON.parse(parameters);
    } catch {
      throw new Error("生成参数需填写有效 JSON 对象");
    }
    const result: Entry = {
      ...entry,
      generation: { ...entry.generation, parameters: params },
      tags: [...new Set(entry.tags.map((t) => t.trim()).filter(Boolean))],
      outputs: [
        ...entry.outputs,
        ...files
          .map((f) => f.uploaded)
          .filter((o): o is Entry["outputs"][number] => !!o),
      ],
    };
    if (
      !result.title.trim() ||
      !result.prompt.text.trim() ||
      !result.generation.modelLabel.trim()
    )
      throw new Error("请填写标题、Prompt 和模型显示名");
    if (!entry.outputs.length && !files.length)
      throw new Error("请加入真实结果文件");
    validateBeforeUpload(result, entry.outputs, files, referenceFiles);
    return result;
  }
  async function checkOnline(revision: string) {
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < 36; i++) {
        const r = await fetch(`${site.base}/build-info.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (r.ok) {
          const data = await r.json();
          const live = data.entries?.[entry.id];
          if (live?.revision === revision) {
            setStatus(entry.status === "archived" ? "已归档" : "已上线");
            setOnline(true);
            setPending(undefined);
            setAttempt(undefined);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      setStatus("已提交，网站仍在更新；可以稍后继续检查");
    } catch {
      setStatus("暂时无法检查上线状态，可稍后重试");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    dialog.current?.close();
    setBusy(true);
    setError("");
    try {
      let result = preparedEntry();
      setStatus("检查记录");
      const complete = [...files];
      for (let i = 0; i < complete.length; i++) {
        if (!complete[i].uploaded) {
          const uploaded = await uploadFile(
            entry.id,
            complete[i],
            (s) => setStatus(`${i + 1}/${complete.length} · ${s}`),
            async (partial) => {
              complete[i] = partial;
              setFiles([...complete]);
              await persist({
                id: entry.id,
                entry,
                files: [...complete],
                baseFileSha: sha,
                savedAt: new Date().toISOString(),
                rawParameters: parameters,
              });
            },
          );
          complete[i] = { ...complete[i], uploaded };
          setFiles([...complete]);
          await persist({
            id: entry.id,
            entry,
            files: complete,
            baseFileSha: sha,
            savedAt: new Date().toISOString(),
          });
        }
      }
      const refs = [...referenceFiles];
      for (let i = 0; i < refs.length; i++) {
        if (!refs[i].referenceAsset) {
          refs[i] = {
            ...refs[i],
            referenceAsset: await upload(
              entry.id,
              refs[i].file,
              "reference",
              (p) => setStatus(`参考图 ${i + 1}/${refs.length} · ${p}%`),
            ),
          };
          setReferenceFiles([...refs]);
          await persist({
            id: entry.id,
            entry,
            files: complete,
            referenceFiles: [...refs],
            baseFileSha: sha,
            savedAt: new Date().toISOString(),
          });
        }
      }
      result = attempt ?? {
        ...result,
        outputs: [
          ...entry.outputs,
          ...complete.map((f) => ({ ...f.uploaded!, alt: f.alt || f.name })),
        ],
        references: [
          ...(entry.references ?? []),
          ...refs.map((f) => ({
            role: f.referenceRole ?? "image-reference",
            asset: f.referenceAsset!,
            caption: f.alt,
          })),
        ],
        revision: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      if (!result.coverOutputId) result.coverOutputId = result.outputs[0].id;
      validateEntry(result);
      setEntry(result);
      setAttempt(result);
      setFiles([]);
      setReferenceFiles([]);
      await persist({
        id: result.id,
        entry: result,
        files: [],
        referenceFiles: [],
        baseFileSha: sha,
        savedAt: new Date().toISOString(),
        rawParameters: parameters,
        attempt: result,
      });
      setStatus("写入 GitHub");
      const response = await api<{
        fileSha: string;
        commitSha: string | null;
        revision: string;
      }>("entries/publish", {
        entry: result,
        baseFileSha: sha,
        confirmPublic: true,
      });
      setSha(response.fileSha);
      const p = { revision: result.revision, commitSha: response.commitSha };
      setPending(p);
      await persist({
        id: result.id,
        entry: result,
        files: [],
        referenceFiles: [],
        baseFileSha: response.fileSha,
        savedAt: new Date().toISOString(),
        pending: p,
      });
      localStorage.setItem(
        "promptbook-preferences",
        JSON.stringify({
          category: result.category,
          platform: result.generation.platform,
          modelLabel: result.generation.modelLabel,
        }),
      );
      setStatus("已写入 GitHub，等待网站更新");
      await checkOnline(result.revision);
    } catch (e) {
      setError((e as Error).message);
      setStatus("发布暂停，内容已保留，可重试");
    } finally {
      setBusy(false);
    }
  }
  const field = (
    label: string,
    value: string,
    onChange: (s: string) => void,
    placeholder = "",
    required = false,
  ) => (
    <label className="field">
      <span>
        {label}
        {required && <small>必填</small>}
      </span>
      <input
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
  if (!ready) return <p className="notice">正在读取当前浏览器草稿…</p>;
  return (
    <>
      <header className="editor-heading">
        <div>
          <h1>{mode === "edit" ? "编辑记录" : "新建记录"}</h1>
          <p>写下提示词，放入结果，选好分类。</p>
        </div>
        <span className="status" role="status">
          {status}
        </span>
      </header>
      {error && (
        <div className="error notice" role="alert">
          {error}
          {mode === "edit" && (
            <p>
              <a
                href={`${site.repository}/blob/main/content/entries/${entry.id}.json`}
                target="_blank"
                rel="noopener"
              >
                查看远端版本 <Icon name="arrow-up-right" />
              </a>{" "}
              · <button onClick={exportJSON}>导出本地内容</button>
            </p>
          )}
        </div>
      )}
      <fieldset className="editor-fields" disabled={busy}>
        <div className="editor-grid">
          <div>
            {field(
              "标题",
              entry.title,
              (title) => patch({ title }),
              "给这次结果起一个容易找到的名字",
              true,
            )}
            <label className="field">
              <span>
                提示词 <small>可分段排版</small>
              </span>
              <textarea
                className="prompt-input"
                value={entry.prompt.text}
                disabled={busy}
                onChange={(e) =>
                  patch({ prompt: { ...entry.prompt, text: e.target.value } })
                }
                placeholder="粘贴实际使用的提示词，可用空行分段…"
              />
              <small>整理排版时保留实际使用的画面要求。</small>
            </label>
            <div className="field-row">
              <label className="field">
                <span>分类</span>
                <select
                  disabled={busy}
                  value={entry.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  {taxonomy.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {field(
                "标签",
                entry.tags.join("，"),
                (text) => patch({ tags: text.split(/[,，]/).slice(0, 8) }),
                "如：人像写真，室内摄影",
              )}
            </div>
            {field(
              "使用的模型",
              entry.generation.modelLabel,
              (modelLabel) =>
                patch({ generation: { ...entry.generation, modelLabel } }),
              "版本不确定可填写“未知模型”",
              true,
            )}
            <details>
              <summary>更多信息（平台、参数、备注与参考图）</summary>
              {field(
                "平台",
                entry.generation.platform,
                (platform) =>
                  patch({ generation: { ...entry.generation, platform } }),
                "例如 ChatGPT",
              )}
              {field(
                "明确的模型 ID",
                entry.generation.modelId ?? "",
                (modelId) =>
                  patch({
                    generation: {
                      ...entry.generation,
                      modelId: modelId || null,
                    },
                  }),
              )}
              <label className="field">
                <span>模型证据</span>
                <select
                  value={entry.generation.modelEvidence}
                  onChange={(e) =>
                    patch({
                      generation: {
                        ...entry.generation,
                        modelEvidence: e.target
                          .value as Entry["generation"]["modelEvidence"],
                      },
                    })
                  }
                >
                  {[
                    ["unknown", "未知"],
                    ["user-reported", "本人记录"],
                    ["platform-displayed", "平台明确显示"],
                    ["api-returned", "API 返回"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {field(
                "生成时间（含时区，可留空）",
                entry.generation.generatedAt ?? "",
                (generatedAt) =>
                  patch({
                    generation: {
                      ...entry.generation,
                      generatedAt: generatedAt || null,
                    },
                  }),
                "2026-09-20T12:00:00+08:00",
              )}
              <label className="field">
                <span>参数 JSON</span>
                <textarea
                  value={parameters}
                  onChange={(e) => {
                    setParameters(e.target.value);
                    setAttempt(undefined);
                    setPending(undefined);
                  }}
                />
              </label>
              <label className="field">
                <span>负向提示词</span>
                <textarea
                  value={entry.prompt.negativeText ?? ""}
                  onChange={(e) =>
                    patch({
                      prompt: { ...entry.prompt, negativeText: e.target.value },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>追加提示（每轮以空行分隔）</span>
                <textarea
                  value={entry.prompt.followups?.join("\n\n") ?? ""}
                  onChange={(e) =>
                    patch({
                      prompt: {
                        ...entry.prompt,
                        followups: e.target.value
                          ? e.target.value.split("\n\n")
                          : [],
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                <span>备注</span>
                <textarea
                  value={entry.notes ?? ""}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              <p className="editor-note">
                参考图默认不公开。只有在下方主动选择的参考图才随记录公开，最多 4
                张。
              </p>
              <label className="field">
                <span>选择允许公开的参考图</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    void addReferences([...(e.target.files ?? [])]);
                    e.target.value = "";
                  }}
                />
              </label>
              {entry.references?.map((r, i) => (
                <div key={r.asset.key} className="upload-item">
                  <img
                    src={`${site.mediaBaseUrl}/${r.asset.key}`}
                    alt={r.caption || "参考图"}
                  />
                  <p>{r.caption}</p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      patch({
                        references: entry.references?.filter((_, n) => n !== i),
                      })
                    }
                  >
                    移除参考图
                  </button>
                </div>
              ))}
              {referenceFiles.map((f, i) => (
                <div key={f.id} className="upload-item">
                  <FilePreview file={f} />
                  <label className="field">
                    <span>参考图 {i + 1} 的用途</span>
                    <select
                      disabled={busy}
                      value={f.referenceRole}
                      onChange={(e) => {
                        setReferenceFiles(
                          referenceFiles.map((x) =>
                            x.id === f.id
                              ? {
                                  ...x,
                                  referenceRole: e.target
                                    .value as LocalFile["referenceRole"],
                                }
                              : x,
                          ),
                        );
                        patch({});
                      }}
                    >
                      {[
                        ["image-reference", "参考图"],
                        ["first-frame", "首帧"],
                        ["last-frame", "尾帧"],
                        ["style-reference", "风格参考"],
                        ["other", "其他"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>参考图 {i + 1} 的说明</span>
                    <input
                      disabled={busy}
                      value={f.alt}
                      onChange={(e) => {
                        setReferenceFiles(
                          referenceFiles.map((x) =>
                            x.id === f.id ? { ...x, alt: e.target.value } : x,
                          ),
                        );
                        patch({});
                      }}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setReferenceFiles(
                        referenceFiles.filter((x) => x.id !== f.id),
                      );
                      patch({});
                    }}
                  >
                    移除参考图
                  </button>
                </div>
              ))}
            </details>
            <details>
              <summary>来源、署名与使用许可</summary>
              <label className="field">
                <span>来源类型</span>
                <select
                  value={entry.source.type}
                  onChange={(e) =>
                    patch({
                      source: {
                        ...entry.source,
                        type: e.target.value as Entry["source"]["type"],
                      },
                    })
                  }
                >
                  <option value="original">原创</option>
                  <option value="adapted">改编</option>
                  <option value="collected">收集</option>
                </select>
              </label>
              {field("作者", entry.source.author, (author) =>
                patch({ source: { ...entry.source, author } }),
              )}
              {field(
                "来源链接",
                entry.source.url ?? "",
                (url) =>
                  patch({ source: { ...entry.source, url: url || null } }),
                "https://…",
              )}
              {field("贡献者", entry.source.contributor ?? "", (contributor) =>
                patch({
                  source: { ...entry.source, contributor: contributor || null },
                }),
              )}
              {(["prompt", "media"] as const).map((key) => (
                <label key={key} className="field">
                  <span>{key === "prompt" ? "Prompt" : "媒体"}许可</span>
                  <select
                    value={entry.rights[key]}
                    onChange={(e) =>
                      patch({
                        rights: { ...entry.rights, [key]: e.target.value },
                      })
                    }
                  >
                    {[
                      "unspecified",
                      "CC0-1.0",
                      "CC-BY-4.0",
                      "permission-granted",
                      "all-rights-reserved",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
              {field("许可备注", entry.rights.notes ?? "", (notes) =>
                patch({ rights: { ...entry.rights, notes } }),
              )}
            </details>
          </div>
          <aside>
            <span style={{ fontSize: 13 }}>
              实际生成结果 <small>最多 8 个，同一类型</small>
            </span>
            <input
              ref={input}
              className="sr-only"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
              onChange={(e) => {
                void addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
              aria-label="选择结果文件"
            />
            <button
              className="drop-zone"
              style={{ width: "100%" }}
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) void addFiles([...e.dataTransfer.files]);
              }}
            >
              <div>
                <span aria-hidden="true">
                  <Icon name="upload" />
                </span>
                <p>把结果拖到这里</p>
                <small>
                  也可以点击选择，或直接粘贴图片
                  <br />
                  PNG / JPG / WebP · MP4 / WebM
                </small>
              </div>
            </button>
            <div className="upload-list">
              {entry.outputs.map((o) => (
                <div className="upload-item" key={o.id}>
                  <img
                    src={`${site.mediaBaseUrl}/${o.thumbnail.key}`}
                    alt={o.alt}
                  />
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => patch({ coverOutputId: o.id })}
                    >
                      {entry.coverOutputId === o.id ? "当前封面" : "设为封面"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        patch({
                          outputs: entry.outputs.filter((x) => x.id !== o.id),
                          coverOutputId:
                            entry.coverOutputId === o.id
                              ? (entry.outputs.find((x) => x.id !== o.id)?.id ??
                                files[0]?.id ??
                                "")
                              : entry.coverOutputId,
                        })
                      }
                    >
                      移除
                    </button>
                  </div>
                </div>
              ))}
              {files.map((f, i) => (
                <div className="upload-item" key={f.id}>
                  <FilePreview file={f} />
                  <div className="actions">
                    <span>
                      {f.width} × {f.height} ·{" "}
                      {(f.file.size / 1024 ** 2).toFixed(1)} MiB
                      {f.duration ? ` · ${f.duration.toFixed(1)} 秒` : ""}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => patch({ coverOutputId: f.id })}
                    >
                      {entry.coverOutputId === f.id ? "当前封面" : "设为封面"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setFiles(files.filter((x) => x.id !== f.id));
                        if (entry.coverOutputId === f.id)
                          patch({
                            coverOutputId:
                              entry.outputs[0]?.id ??
                              files.find((x) => x.id !== f.id)?.id ??
                              "",
                          });
                      }}
                    >
                      移除
                    </button>
                  </div>
                  <label>
                    <span className="sr-only">结果 {i + 1} 的描述</span>
                    <input
                      value={f.alt}
                      placeholder="描述图片内容（供读屏使用）"
                      onChange={(e) =>
                        setFiles(
                          files.map((x) =>
                            x.id === f.id ? { ...x, alt: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <p className="editor-note">
              只记录真实跑出来的结果。原文件会被保留，图片预览仅用于浏览。原图可能包含
              EXIF 等隐私信息，请在发布前检查。
            </p>
            <p className="editor-note">
              草稿仅在当前浏览器中保存。清理浏览器数据会删除草稿，请保留原始媒体文件。
            </p>
          </aside>
        </div>
      </fieldset>
      <div className="editor-footer">
        <div className="status" aria-live="polite">
          {status}
          {online && (
            <a href={`${site.base}/p/${entry.id}/`}>
              {" "}
              · 查看记录 <Icon name="arrow-up-right" />
            </a>
          )}
          {pending && (
            <a
              href={`${site.repository}/actions`}
              target="_blank"
              rel="noopener"
            >
              {" "}
              · 查看构建 <Icon name="arrow-up-right" />
            </a>
          )}
        </div>
        <div className="actions">
          <button
            disabled={busy}
            onClick={() => current.current && void persist(current.current)}
          >
            保存草稿
          </button>
          <button onClick={exportJSON}>导出</button>
          <button onClick={() => preview.current?.showModal()}>预览</button>
          {pending ? (
            <button
              disabled={busy}
              className="primary"
              onClick={() => void checkOnline(pending.revision)}
            >
              继续检查
            </button>
          ) : (
            <button
              disabled={busy || !canPublish}
              className="primary"
              onClick={() => {
                try {
                  preparedEntry();
                  dialog.current?.showModal();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {sha ? "发布更新" : "发布记录"}
            </button>
          )}
        </div>
      </div>
      {mode === "edit" && (
        <div className="actions" style={{ marginBottom: 30 }}>
          <button
            disabled={busy}
            onClick={() => {
              patch({
                status: entry.status === "archived" ? "published" : "archived",
              });
              setStatus("状态已修改，点击发布更新后生效");
            }}
          >
            {entry.status === "archived" ? "恢复公开" : "归档记录"}
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              const copy = {
                ...entry,
                id: "note-" + crypto.randomUUID(),
                revision: crypto.randomUUID(),
                outputs: [],
                coverOutputId: "",
                references: [],
                derivedFrom: entry.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await saveDraft({
                id: copy.id,
                entry: copy,
                files: [],
                baseFileSha: null,
                savedAt: new Date().toISOString(),
              });
              location.href = `${site.base}/admin/new/?draft=${copy.id}`;
            }}
          >
            复制为新记录（重新选择媒体）
          </button>
        </div>
      )}
      <dialog ref={dialog}>
        <h2>把这一页公开。</h2>
        <p>
          将公开
          Prompt、全部输出、主动选择的参考图、来源和署名。媒体会先公开，之后写入
          GitHub；Git 历史可能保留旧版本。请确认原文件没有不想公开的信息。
        </p>
        <div className="actions">
          <button onClick={() => dialog.current?.close()}>再检查一下</button>
          <button className="primary" onClick={() => void publish()}>
            确认公开并发布
          </button>
        </div>
      </dialog>
      <dialog ref={preview}>
        <button className="close" onClick={() => preview.current?.close()}>
          关闭 <Icon name="close" />
        </button>
        <h2>{entry.title || "未命名记录"}</h2>
        {files[0] && (
          <FilePreview
            file={files.find((f) => f.id === entry.coverOutputId) ?? files[0]}
          />
        )}
        <p className="prompt-text">{entry.prompt.text || "还没有提示词"}</p>
        <p className="muted">
          {entry.generation.modelLabel || "模型未记录"} · 仅本地预览
        </p>
      </dialog>
    </>
  );
}
