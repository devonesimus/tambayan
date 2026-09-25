(() => {
  const status = document.getElementById("people-status");

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not save");
    return json;
  }

  // Dialogs reuse the registrations sheet styles. Escape and the backdrop cancel, Tab stays inside,
  // and focus returns to whatever opened the dialog.
  function openDialog(el, { focus, onCancel } = {}) {
    const opener = document.activeElement;
    el.hidden = false;
    document.body.classList.add("reg-modal-open");
    function close() {
      el.hidden = true;
      document.body.classList.remove("reg-modal-open");
      document.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    }
    function cancel() {
      close();
      onCancel?.();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...el.querySelectorAll("button, input, select")].filter(
        (x) => !x.disabled && x.tabIndex >= 0 && x.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    el.querySelectorAll("[data-dialog-cancel]").forEach((btn) => {
      btn.onclick = cancel;
    });
    (focus || el.querySelector("button, input"))?.focus();
    return close;
  }

  const confirmDialog = document.getElementById("pp-confirm");
  function confirmAction({ title, body, confirmLabel }) {
    return new Promise((resolve) => {
      if (!confirmDialog) return resolve(false);
      const ok = document.getElementById("pp-confirm-ok");
      document.getElementById("pp-confirm-title").textContent = title;
      document.getElementById("pp-confirm-body").textContent = body;
      ok.textContent = confirmLabel;
      // Focus starts on Cancel, so a stray Enter never confirms.
      const close = openDialog(confirmDialog, {
        focus: document.getElementById("pp-confirm-cancel"),
        onCancel: () => resolve(false),
      });
      ok.onclick = () => {
        close();
        resolve(true);
      };
    });
  }

  function fail(err) {
    if (status) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Error";
    }
  }

  const editModal = document.getElementById("pp-edit-modal");
  const editForm = document.getElementById("person-edit-form");
  const editStatus = document.getElementById("person-edit-status");
  document.getElementById("pp-edit-open")?.addEventListener("click", () => {
    if (!editModal || !editForm) return;
    if (editStatus) {
      editStatus.textContent = "";
      editStatus.classList.remove("is-error");
    }
    openDialog(editModal, { focus: editForm.querySelector('[name="name"]') });
  });
  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editStatus) return;
    editStatus.classList.remove("is-error");
    editStatus.textContent = "Saving…";
    const data = new FormData(editForm);
    try {
      await post("/api/admin/people/update", Object.fromEntries(data.entries()));
      location.reload();
    } catch (err) {
      editStatus.classList.add("is-error");
      editStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll("[data-merge-keeper]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const keeperName = btn.getAttribute("data-keeper-name") || "this profile";
      const otherName = btn.getAttribute("data-other-name") || "the duplicate";
      const moved = Number(btn.getAttribute("data-moved")) || 0;
      const moves = moved ? `Their ${moved} registration${moved === 1 ? "" : "s"} will move to ${keeperName}, and ` : "";
      const ok = await confirmAction({
        title: `Merge into ${keeperName}?`,
        body: `${moves}${moved ? "the" : "The"} ${otherName} profile will be removed. This can't be undone.`,
        confirmLabel: "Merge",
      });
      if (!ok) return;
      if (status) {
        status.classList.remove("is-error");
        status.textContent = "Merging…";
      }
      try {
        const keeper = btn.getAttribute("data-merge-keeper");
        await post("/api/admin/people/merge", {
          keeper_id: keeper,
          other_id: btn.getAttribute("data-merge-other"),
        });
        location.href = `/admin/people?person=${encodeURIComponent(keeper || "")}`;
      } catch (err) {
        fail(err);
      }
    });
  });

  document.querySelectorAll("[data-distinct-a]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const a = btn.getAttribute("data-a-name") || "They";
      const b = btn.getAttribute("data-b-name") || "the other profile";
      const ok = await confirmAction({
        title: "Mark as different people?",
        body: `${a} and ${b} will stop being suggested as duplicates.`,
        confirmLabel: "Yes, different people",
      });
      if (!ok) return;
      if (status) {
        status.classList.remove("is-error");
        status.textContent = "Saving…";
      }
      try {
        await post("/api/admin/people/distinct", {
          person_a: btn.getAttribute("data-distinct-a"),
          person_b: btn.getAttribute("data-distinct-b"),
        });
        location.reload();
      } catch (err) {
        fail(err);
      }
    });
  });

  const list = document.getElementById("pp-list");
  if (list) {
    const PAGE_SIZE = 25;
    const rows = Array.from(list.children);
    const tools = document.querySelector(".pp-tools");
    const search = document.getElementById("pp-search");
    const clear = document.getElementById("pp-search-clear");
    const monthSelect = document.getElementById("pp-month");
    const count = document.getElementById("pp-count");
    const empty = document.getElementById("pp-empty");
    const pager = document.getElementById("pp-pager");
    const range = document.getElementById("pp-range");
    // The pager appears above and below the list. Every copy is drawn from the same state.
    const navs = document.querySelectorAll("[data-pp-nav]");
    const sortButtons = document.querySelectorAll("[data-pp-sort]");
    let sort = "name";
    let page = 1;

    // Remember the view for this tab, so "All people" returns to the same page.
    const VIEW_KEY = "pp-view";
    function saveView() {
      try {
        sessionStorage.setItem(VIEW_KEY, JSON.stringify({ q: search.value, month: monthSelect.value, sort, page }));
      } catch {}
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}");
      if (typeof saved.q === "string") search.value = saved.q;
      if (typeof saved.month === "string" && [...monthSelect.options].some((o) => o.value === saved.month)) {
        monthSelect.value = saved.month;
      }
      if (["name", "attended", "recent"].includes(saved.sort)) sort = saved.sort;
      if (Number.isInteger(saved.page) && saved.page > 0) page = saved.page;
    } catch {}
    sortButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.getAttribute("data-pp-sort") === sort)));

    const byName = (a, b) => a.dataset.name.localeCompare(b.dataset.name);
    const sorters = {
      name: byName,
      attended: (a, b) => Number(b.dataset.attended) - Number(a.dataset.attended) || byName(a, b),
      recent: (a, b) => Number(b.dataset.last) - Number(a.dataset.last) || byName(a, b),
    };

    // 1 … 4 5 6 … 12, without leaving a gap that hides only one page.
    function pageItems(current, total) {
      const wanted = new Set([1, total, current - 1, current, current + 1]);
      const nums = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
      const items = [];
      nums.forEach((n, i) => {
        const before = nums[i - 1];
        if (i && n - before === 2) items.push(before + 1);
        else if (i && n - before > 2) items.push("…");
        items.push(n);
      });
      return items;
    }

    function renderPager(pages) {
      navs.forEach((nav) => {
        nav.hidden = pages === 1;
        if (pages === 1) return;
        nav.querySelector("[data-pp-pages]").replaceChildren(
          ...pageItems(page, pages).map((item) => {
            if (item === "…") {
              const gap = document.createElement("span");
              gap.className = "pp-page-gap";
              gap.textContent = "…";
              return gap;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pp-page-btn";
            btn.textContent = String(item);
            btn.setAttribute("aria-label", `Page ${item}`);
            if (item === page) btn.setAttribute("aria-current", "page");
            btn.addEventListener("click", () => goTo(item));
            return btn;
          }),
        );
        nav.querySelector("[data-pp-page-of]").textContent = `${page} of ${pages}`;
        nav.querySelector("[data-pp-prev]").disabled = page <= 1;
        nav.querySelector("[data-pp-next]").disabled = page >= pages;
      });
    }

    function apply() {
      const q = search.value.trim().toLowerCase().replace(/\s+/g, " ");
      const digits = q.replace(/\D/g, "");
      const month = monthSelect.value;
      const sorted = rows.slice().sort(sorters[sort]);
      const matches = sorted.filter(
        (row) =>
          (!q || row.dataset.name.includes(q) || (digits.length >= 3 && row.dataset.digits.includes(digits))) &&
          (!month || row.dataset.month === month),
      );
      const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
      page = Math.min(Math.max(1, page), pages);
      const start = (page - 1) * PAGE_SIZE;
      const visible = new Set(matches.slice(start, start + PAGE_SIZE));
      sorted.forEach((row) => {
        list.appendChild(row);
        row.hidden = !visible.has(row);
      });
      // Birthdays only show once a month is picked, so the list stays calm otherwise.
      list.classList.toggle("is-month-filtered", month !== "" && month !== "0");
      const filtered = Boolean(q || month);
      const shownRange = `${start + 1}–${start + visible.size}`;
      count.textContent =
        pages > 1
          ? `${shownRange} of ${matches.length} ${matches.length === 1 ? "person" : "people"}${filtered ? ` · ${rows.length} in total` : ""}`
          : filtered
            ? `${matches.length} of ${rows.length} people`
            : `${rows.length} people`;
      empty.hidden = matches.length !== 0;
      clear.hidden = !search.value;
      pager.hidden = pages === 1;
      range.textContent = pages > 1 ? `${shownRange} of ${matches.length}` : "";
      renderPager(pages);
      saveView();
    }

    function goTo(target) {
      page = target;
      apply();
      // Bring the top of the list back into view when the bottom pager was used.
      if (tools.getBoundingClientRect().top < 0) tools.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    document.querySelectorAll("[data-pp-prev]").forEach((btn) => btn.addEventListener("click", () => goTo(page - 1)));
    document.querySelectorAll("[data-pp-next]").forEach((btn) => btn.addEventListener("click", () => goTo(page + 1)));
    search.addEventListener("input", () => {
      page = 1;
      apply();
    });
    clear.addEventListener("click", () => {
      search.value = "";
      search.focus();
      page = 1;
      apply();
    });
    monthSelect.addEventListener("change", () => {
      page = 1;
      apply();
    });
    sortButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        sort = btn.getAttribute("data-pp-sort");
        sortButtons.forEach((other) => other.setAttribute("aria-pressed", String(other === btn)));
        page = 1;
        apply();
      });
    });
    apply();
  }
})();
