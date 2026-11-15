(() => {
  /** Shared elegant photo lightbox for public + admin galleries. */
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SWIPE_MIN = 48;

  /** @type {HTMLDialogElement | null} */
  let dialog = null;
  /** @type {HTMLImageElement | null} */
  let stageImg = null;
  /** @type {HTMLElement | null} */
  let counterEl = null;
  /** @type {HTMLButtonElement | null} */
  let prevBtn = null;
  /** @type {HTMLButtonElement | null} */
  let nextBtn = null;
  /** @type {HTMLButtonElement | null} */
  let closeBtn = null;

  /** @type {string[]} */
  let urls = [];
  /** @type {HTMLElement[]} */
  let triggers = [];
  let index = 0;
  /** @type {HTMLElement | null} */
  let lastFocus = null;
  let touchX = null;

  function ensureDialog() {
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.className = "gal-lightbox";
    dialog.setAttribute("aria-label", "Photo viewer");
    dialog.innerHTML = `
      <div class="gal-lightbox-chrome">
        <p class="gal-lightbox-count" aria-live="polite"></p>
        <button type="button" class="gal-lightbox-close" aria-label="Close photo viewer">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="gal-lightbox-stage">
        <button type="button" class="gal-lightbox-nav gal-lightbox-prev" aria-label="Previous photo">
          <span aria-hidden="true">‹</span>
        </button>
        <img alt="" decoding="async" />
        <button type="button" class="gal-lightbox-nav gal-lightbox-next" aria-label="Next photo">
          <span aria-hidden="true">›</span>
        </button>
      </div>
    `;
    document.body.appendChild(dialog);

    stageImg = dialog.querySelector("img");
    counterEl = dialog.querySelector(".gal-lightbox-count");
    prevBtn = dialog.querySelector(".gal-lightbox-prev");
    nextBtn = dialog.querySelector(".gal-lightbox-next");
    closeBtn = dialog.querySelector(".gal-lightbox-close");

    closeBtn?.addEventListener("click", () => close());
    prevBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      go(-1);
    });
    nextBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      go(1);
    });

    dialog.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
      if (e.target === dialog || e.target.classList.contains("gal-lightbox-stage")) close();
    });

    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });

    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    });

    const stage = dialog.querySelector(".gal-lightbox-stage");
    stage?.addEventListener(
      "touchstart",
      (e) => {
        if (!(e instanceof TouchEvent) || e.touches.length !== 1) return;
        touchX = e.touches[0].clientX;
      },
      { passive: true },
    );
    stage?.addEventListener(
      "touchend",
      (e) => {
        if (touchX == null || !(e instanceof TouchEvent) || !e.changedTouches.length) {
          touchX = null;
          return;
        }
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) < SWIPE_MIN) return;
        go(dx < 0 ? 1 : -1);
      },
      { passive: true },
    );

    return dialog;
  }

  function prefetch(i) {
    if (i < 0 || i >= urls.length) return;
    const img = new Image();
    img.decoding = "async";
    img.src = urls[i];
  }

  function show(i) {
    if (!urls.length || !stageImg || !counterEl) return;
    index = ((i % urls.length) + urls.length) % urls.length;
    const url = urls[index];
    const reduce = REDUCE || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reduce && stageImg.src) {
      stageImg.classList.remove("is-shown");
      stageImg.classList.add("is-swap");
      requestAnimationFrame(() => {
        if (!stageImg) return;
        stageImg.src = url;
        stageImg.alt = `Photo ${index + 1} of ${urls.length}`;
        stageImg.classList.remove("is-swap");
        stageImg.classList.add("is-shown");
      });
    } else {
      stageImg.src = url;
      stageImg.alt = `Photo ${index + 1} of ${urls.length}`;
      stageImg.classList.add("is-shown");
    }

    counterEl.textContent = `${index + 1} / ${urls.length}`;
    const multi = urls.length > 1;
    if (prevBtn) prevBtn.hidden = !multi;
    if (nextBtn) nextBtn.hidden = !multi;

    prefetch(index - 1);
    prefetch(index + 1);
  }

  function go(delta) {
    if (urls.length < 2) return;
    show(index + delta);
  }

  function open(list, startIndex, focusEl) {
    ensureDialog();
    if (!dialog || typeof dialog.showModal !== "function") return;

    urls = list;
    index = startIndex;
    lastFocus = focusEl || null;
    document.body.classList.add("gal-lightbox-open");
    show(index);
    if (!dialog.open) dialog.showModal();
    closeBtn?.focus();
  }

  function close() {
    if (!dialog?.open) return;
    dialog.close();
    document.body.classList.remove("gal-lightbox-open");
    if (stageImg) {
      stageImg.removeAttribute("src");
      stageImg.classList.remove("is-shown", "is-swap");
    }
    urls = [];
    const restore = lastFocus;
    lastFocus = null;
    if (restore && typeof restore.focus === "function") {
      restore.focus({ preventScroll: true });
    }
  }

  /**
   * @param {ParentNode} root
   */
  function bindRoot(root) {
    const items = Array.from(root.querySelectorAll("[data-gallery-src]"));
    if (items.length === 0) return;

    const list = items
      .map((el) => el.getAttribute("data-gallery-src") || "")
      .filter(Boolean);
    if (list.length === 0) return;

    items.forEach((el, i) => {
      if (!(el instanceof HTMLElement)) return;
      el.addEventListener("click", (e) => {
        // Let delete / nested controls keep their own handlers.
        if (e.target instanceof Element && e.target.closest("[data-delete-image]")) return;
        e.preventDefault();
        open(list, i, el);
      });
    });

    triggers = triggers.concat(items.filter((el) => el instanceof HTMLElement));
  }

  document.querySelectorAll("[data-gallery]").forEach((root) => bindRoot(root));
})();
