const toast = (message: string) => {
  const el = document.querySelector("#toast");
  if (el) {
    el.textContent = message;
    setTimeout(() => (el.textContent = ""), 1800);
  }
};
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      toast("Prompt 已完整复制");
      const label = button.querySelector<HTMLElement>("[data-copy-label]");
      const old = label?.textContent;
      if (label) label.textContent = "已复制";
      setTimeout(() => {
        if (label) label.textContent = old ?? "复制";
      }, 1600);
    } catch {
      toast("复制失败，请选择 Prompt 原文后手动复制");
    }
  }),
);
const gallery = document.querySelector<HTMLElement>(".gallery");
if (gallery) {
  const cards = [...gallery.querySelectorAll<HTMLElement>(".entry-card")];
  const search = document.querySelector<HTMLInputElement>("#search")!;
  const model = document.querySelector<HTMLSelectElement>("#model")!;
  const sort = document.querySelector<HTMLSelectElement>("#sort")!;
  const layout = () => {
    cards
      .filter((c) => !c.hidden)
      .forEach((c) => {
        c.style.gridRowEnd =
          "span " + Math.ceil(c.getBoundingClientRect().height);
      });
  };
  const params = new URLSearchParams(location.search);
  let kind = params.get("kind") ?? "",
    category = params.get("category") ?? "";
  search.value = params.get("q") ?? "";
  model.value = params.get("model") ?? "";
  sort.value = params.get("sort") === "oldest" ? "oldest" : "latest";
  function filter() {
    const q = search.value.toLowerCase().trim();
    let count = 0;
    cards
      .sort(
        (a, b) =>
          (sort.value === "oldest" ? 1 : -1) *
          (a.dataset.date ?? "").localeCompare(b.dataset.date ?? ""),
      )
      .forEach((c) => {
        c.hidden = !(
          (!kind || c.dataset.kind === kind) &&
          (!category || c.dataset.category === category) &&
          (!model.value || c.dataset.model === model.value) &&
          (!q || c.dataset.search?.includes(q))
        );
        if (!c.hidden) count++;
        gallery!.append(c);
      });
    document.querySelector("#result-count")!.textContent = `${count} 条记录`;
    document.querySelector<HTMLElement>("#no-results")!.hidden = count > 0;
    document
      .querySelectorAll<HTMLButtonElement>("[data-kind-filter]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.kindFilter === kind)),
      );
    document
      .querySelectorAll<HTMLButtonElement>("[data-category-filter]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.categoryFilter === category),
        ),
      );
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q: search.value,
      kind,
      category,
      model: model.value,
      sort: sort.value === "oldest" ? "oldest" : "",
    }))
      if (v) p.set(k, v);
    history.replaceState(null, "", location.pathname + (p.size ? "?" + p : ""));
    layout();
  }
  document.querySelectorAll<HTMLButtonElement>("[data-kind-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        kind = b.dataset.kindFilter!;
        filter();
      }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-category-filter]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          category = b.dataset.categoryFilter!;
          filter();
        }),
    );
  let timer: ReturnType<typeof setTimeout>;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(filter, 150);
  };
  model.onchange = filter;
  sort.onchange = filter;
  document.querySelector<HTMLButtonElement>("#clear-filters")!.onclick = () => {
    kind = "";
    category = "";
    search.value = "";
    model.value = "";
    sort.value = "latest";
    filter();
  };
  const observer = new ResizeObserver(layout);
  cards.forEach((c) => observer.observe(c));
  window.addEventListener("pageshow", layout);
  filter();
}
const viewer = document.querySelector<HTMLElement>("[data-viewer]");
if (viewer) {
  const buttons = viewer.querySelectorAll<HTMLButtonElement>("[data-output]");
  buttons.forEach(
    (b) =>
      (b.onclick = () => {
        viewer.querySelectorAll("video").forEach((v) => v.pause());
        viewer
          .querySelectorAll<HTMLElement>("[data-panel]")
          .forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.output));
        buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }),
  );
  viewer.querySelectorAll<HTMLButtonElement>("[data-original]").forEach(
    (b) =>
      (b.onclick = () => {
        const dialog = document.querySelector<HTMLDialogElement>("#lightbox")!;
        const img = dialog.querySelector("img")!;
        img.src = b.dataset.original!;
        img.alt = b.dataset.alt ?? "";
        dialog.showModal();
      }),
  );
  document
    .querySelector<HTMLButtonElement>("#lightbox-close")
    ?.addEventListener("click", () =>
      document.querySelector<HTMLDialogElement>("#lightbox")!.close(),
    );
}

const promptText = document.querySelector<HTMLElement>("#prompt-original");
const promptToggle =
  document.querySelector<HTMLButtonElement>("#prompt-toggle");
if (promptText && promptToggle) {
  promptToggle.hidden = promptText.scrollHeight <= promptText.clientHeight + 1;
  promptToggle.onclick = () => {
    const expanded = promptToggle.getAttribute("aria-expanded") !== "true";
    promptToggle.setAttribute("aria-expanded", String(expanded));
    promptToggle.textContent = expanded ? "收起全文" : "展开全文";
    promptText.classList.toggle("expanded", expanded);
  };
}
