(() => {
  const root = document.getElementById("hp");
  if (!root) return;

  // Screenshots follow the device by default, and can be switched to a phone or a computer.
  const narrow = window.matchMedia("(max-width: 720px)");
  const KEY = "tambayan-help-view";
  const figures = [...root.querySelectorAll(".hp-shot")];
  const radios = [...root.querySelectorAll('input[name="hp-view"]')];
  let mode = "auto";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "phone" || saved === "desktop") mode = saved;
  } catch (e) {}

  function paint() {
    const view = mode === "auto" ? (narrow.matches ? "phone" : "desktop") : mode;
    for (const fig of figures) {
      fig.setAttribute("data-view", view);
      const source = fig.querySelector("source");
      if (source) source.media = mode === "auto" ? "(max-width: 720px)" : mode === "phone" ? "all" : "not all";
    }
    for (const radio of radios) radio.checked = radio.value === mode;
  }
  radios.forEach((radio) =>
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      mode = radio.value;
      try {
        if (mode === "auto") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch (e) {}
      paint();
    }),
  );
  narrow.addEventListener("change", paint);
  paint();

  // Search: every word has to appear in the question or its answer.
  const input = document.getElementById("hp-search");
  const empty = document.getElementById("hp-empty");
  const items = [...root.querySelectorAll(".hp-q")];
  const sections = [...root.querySelectorAll(".hp-section")];
  const haystack = new Map(items.map((el) => [el, el.textContent.toLowerCase()]));
  const openedBySearch = new Set();
  function filter() {
    const words = (input.value || "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const el of items) {
      const hit = words.every((word) => haystack.get(el).includes(word));
      el.hidden = !hit;
      if (hit) shown += 1;
    }
    for (const section of sections) section.hidden = !section.querySelector(".hp-q:not([hidden])");
    root.classList.toggle("is-searching", words.length > 0);
    if (empty) empty.hidden = shown > 0 || words.length === 0;
    if (words.length && shown <= 4) {
      for (const el of items) if (!el.hidden && !el.open) { el.open = true; openedBySearch.add(el); }
    } else {
      for (const el of openedBySearch) el.open = false;
      openedBySearch.clear();
    }
  }
  input?.addEventListener("input", filter);

  // Links such as #q-add-guest open that answer.
  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (target.matches("details")) {
      if (input?.value) { input.value = ""; filter(); }
      target.open = true;
    }
    target.scrollIntoView({ block: "start" });
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();

  // Tap a screenshot to see it larger.
  const box = document.getElementById("hp-lightbox");
  const big = box?.querySelector("img");
  root.addEventListener("click", (event) => {
    const zoom = event.target instanceof Element ? event.target.closest(".hp-zoom") : null;
    if (!zoom || !box || !big || typeof box.showModal !== "function") return;
    const img = zoom.querySelector("img");
    if (!img) return;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    box.showModal();
  });
  box?.addEventListener("click", () => box.close());
})();
