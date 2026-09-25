(() => {
  const tbody = document.querySelector("#reg-table tbody");
  const search = document.getElementById("reg-search");
  const eventFilter = document.getElementById("event-filter");
  const pageInfo = document.getElementById("page-info");
  const pageSizeEl = document.getElementById("page-size");
  const prev = document.getElementById("prev-page");
  const next = document.getElementById("next-page");
  const exportXlsx = document.getElementById("export-xlsx");
  const exportPdf = document.getElementById("export-pdf");
  const adminForm = document.getElementById("admin-reg-form");
  const adminStatus = document.getElementById("admin-reg-status");
  const modal = document.getElementById("guest-modal");
  const editModal = document.getElementById("guest-edit-modal");
  const editForm = document.getElementById("guest-edit-form");
  const editTitle = document.getElementById("guest-edit-title");
  const editContext = document.getElementById("guest-edit-context");
  const editStatus = document.getElementById("guest-edit-status");
  const attendStatus = document.getElementById("guest-attend-status");
  const attendPanel = document.getElementById("panel-attendance");
  const tabAttendance = document.getElementById("tab-attendance");
  const tabDetails = document.getElementById("tab-details");
  const openBtn = document.getElementById("add-guest-open");
  const board = document.querySelector(".reg-board");
  const searchClear = document.getElementById("reg-search-clear");
  const exportToggle = document.getElementById("export-toggle");
  const exportWrap = exportToggle?.closest(".reg-export");

  let page = 1;
  let pageSize = 20;
  let total = 0;
  let rows = [];
  let sortCol = "created_at";
  let sortDir = "desc";
  let editingId = "";

  function sortParam() {
    return `${sortCol}:${sortDir}`;
  }

  function paintSort() {
    document.querySelectorAll(".th-sort").forEach((btn) => {
      const col = btn.getAttribute("data-sort");
      const active = col === sortCol;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("data-dir", sortDir);
      else btn.removeAttribute("data-dir");
      const th = btn.closest("th");
      if (th) {
        th.setAttribute(
          "aria-sort",
          active ? (sortDir === "asc" ? "ascending" : "descending") : "none",
        );
      }
    });
  }

  async function load() {
    if (!tbody) return;
    paintSort();
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort: sortParam(),
      q: search?.value || "",
    });
    if (eventFilter?.value) params.set("event_id", eventFilter.value);
    const res = await fetch(`/api/admin/registrations?${params}`);
    const data = await res.json();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5">${escape(data.error || "Failed to load")}</td></tr>`;
      return;
    }
    total = data.total;
    rows = data.rows || [];
    const start = (page - 1) * pageSize;
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r, i) => `<tr class="reg-row" data-id="${escape(r.id)}" tabindex="0" role="button" aria-label="Open ${escape(r.name)}">
          <td class="reg-num">${start + i + 1}</td>
          <td class="reg-guest">
            <span class="reg-name">${escape(r.name)}</span>
            ${(r.source || "public") === "admin" ? `<span class="reg-walkin">Walk-in</span>` : ""}
            ${r.attended ? `<span class="reg-here">Here</span>` : ""}
            <span class="reg-event-cell">${escape(r.event_title || "")}</span>
          </td>
          <td class="reg-mobile${r.mobile ? "" : " is-empty"}">${escape(r.mobile || "—")}</td>
          <td class="reg-attended${r.attended ? " is-yes" : ""}">${r.attended ? "Here" : "—"}</td>
          <td class="reg-when">${escape(formatWhen(r.created_at))}</td>
        </tr>`,
          )
          .join("")
      : `<tr class="reg-empty"><td colspan="5">${search?.value ? "No guests match that search." : "No registrations yet."}</td></tr>`;
    board?.classList.toggle("is-single-event", Boolean(eventFilter?.value));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    if (pageInfo) pageInfo.textContent = `${total} guest${total === 1 ? "" : "s"} · page ${page} of ${pages}`;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
  }

  function sourceLabel(source) {
    if (!source || source === "public") return "Online";
    if (source === "admin") return "Walk-in";
    return source;
  }

  function formatWhen(value) {
    if (!value) return "";
    const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }

  function escape(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function fetchAllForExport() {
    const params = new URLSearchParams({
      page: "1",
      page_size: "50",
      sort: sortParam(),
      q: search?.value || "",
    });
    if (eventFilter?.value) params.set("event_id", eventFilter.value);
    const all = [];
    let p = 1;
    let pages = 1;
    while (p <= pages) {
      params.set("page", String(p));
      const res = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      all.push(...(data.rows || []));
      pages = Math.max(1, Math.ceil((data.total || 0) / 50));
      p += 1;
      if (p > 40) break;
    }
    return all;
  }

  function openModal() {
    if (!modal) return;
    const eventField = adminForm?.querySelector('[name="event_id"]');
    if (eventField && eventFilter?.value) eventField.value = eventFilter.value;
    if (adminStatus) {
      adminStatus.textContent = "";
      adminStatus.classList.remove("is-error");
    }
    modal.hidden = false;
    document.body.classList.add("reg-modal-open");
    adminForm?.querySelector('[name="name"]')?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("reg-modal-open");
    openBtn?.focus();
  }

  function setExportMenu(open) {
    if (!exportWrap || !exportToggle) return;
    exportWrap.classList.toggle("is-open", open);
    exportToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  exportToggle?.addEventListener("click", () => setExportMenu(!exportWrap?.classList.contains("is-open")));
  document.addEventListener("click", (e) => {
    if (exportWrap && e.target instanceof Node && !exportWrap.contains(e.target)) setExportMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !exportWrap?.classList.contains("is-open")) return;
    setExportMenu(false);
    exportToggle?.focus();
  });

  exportXlsx?.addEventListener("click", async () => {
    setExportMenu(false);
    const all = await fetchAllForExport();
    const sheet = (window.XLSX || {}).utils?.json_to_sheet(
      all.map((r) => ({
        Name: r.name,
        Email: r.email || "",
        Mobile: r.mobile,
        Event: r.event_title,
        Source: r.source || "public",
        Attended: r.attended ? "Yes" : "No",
        Registered: r.created_at,
      })),
    );
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "Registrations");
    window.XLSX.writeFile(book, "ofw-tambayan-registrations.xlsx");
  });

  exportPdf?.addEventListener("click", async () => {
    setExportMenu(false);
    const all = await fetchAllForExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("OFW Tambayan — Registrations", 14, 16);
    doc.autoTable({
      startY: 22,
      head: [["Name", "Email", "Mobile", "Event", "Source", "Attended", "Registered"]],
      body: all.map((r) => [
        r.name,
        r.email || "",
        r.mobile,
        r.event_title,
        r.source || "public",
        r.attended ? "Yes" : "No",
        r.created_at,
      ]),
    });
    doc.save("ofw-tambayan-registrations.pdf");
  });

  adminForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adminStatus) return;
    adminStatus.classList.remove("is-error");
    adminStatus.textContent = "Saving…";
    const fd = new FormData(adminForm);
    try {
      const res = await fetch("/api/admin/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: fd.get("event_id"),
          name: fd.get("name"),
          email: fd.get("email"),
          mobile: fd.get("mobile"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add registration");
      adminStatus.textContent = "Guest added.";
      adminForm.querySelector('[name="name"]').value = "";
      adminForm.querySelector('[name="email"]').value = "";
      adminForm.querySelector('[name="mobile"]').value = "";
      if (eventFilter && fd.get("event_id")) eventFilter.value = String(fd.get("event_id"));
      page = 1;
      load();
      adminForm.querySelector('[name="name"]')?.focus();
    } catch (err) {
      adminStatus.classList.add("is-error");
      adminStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  openBtn?.addEventListener("click", openModal);
  modal?.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  function guestById(id) {
    return rows.find((row) => row.id === id) || null;
  }

  function setEditTab(name) {
    const attendance = name === "attendance";
    if (attendPanel) attendPanel.hidden = !attendance;
    if (editForm) editForm.hidden = attendance;
    tabAttendance?.classList.toggle("is-active", attendance);
    tabDetails?.classList.toggle("is-active", !attendance);
    tabAttendance?.setAttribute("aria-selected", attendance ? "true" : "false");
    tabDetails?.setAttribute("aria-selected", attendance ? "false" : "true");
    tabAttendance?.setAttribute("tabindex", attendance ? "0" : "-1");
    tabDetails?.setAttribute("tabindex", attendance ? "-1" : "0");
  }

  function paintAttendance(attended) {
    editModal?.querySelectorAll("[data-attended]").forEach((btn) => {
      const on = Number(btn.getAttribute("data-attended")) === (attended ? 1 : 0);
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function fillEditForm(guest) {
    if (!editForm) return;
    const eventField = editForm.querySelector('[name="event_id"]');
    const nameField = editForm.querySelector('[name="name"]');
    const emailField = editForm.querySelector('[name="email"]');
    const mobileField = editForm.querySelector('[name="mobile"]');
    if (eventField) eventField.value = guest.event_id || "";
    if (nameField) nameField.value = guest.name || "";
    if (emailField) emailField.value = guest.email || "";
    if (mobileField) mobileField.value = guest.mobile || "";
  }

  function openEdit(id) {
    const guest = guestById(id);
    if (!guest || !editModal) return;
    editingId = guest.id;
    if (editTitle) editTitle.textContent = guest.name;
    if (editContext) {
      editContext.textContent = `${guest.event_title || "Event"} · ${sourceLabel(guest.source)}`;
    }
    if (attendStatus) {
      attendStatus.textContent = "";
      attendStatus.classList.remove("is-error");
    }
    if (editStatus) {
      editStatus.textContent = "";
      editStatus.classList.remove("is-error");
    }
    paintAttendance(guest.attended);
    fillEditForm(guest);
    setEditTab("attendance");
    editModal.hidden = false;
    document.body.classList.add("reg-modal-open");
    tabAttendance?.focus();
  }

  function closeEdit() {
    if (!editModal) return;
    editModal.hidden = true;
    editingId = "";
    if (modal?.hidden !== false) document.body.classList.remove("reg-modal-open");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (editModal && !editModal.hidden) {
      closeEdit();
      return;
    }
    if (modal && !modal.hidden) closeModal();
  });

  tbody?.addEventListener("click", (e) => {
    const tr = e.target instanceof Element ? e.target.closest("tr[data-id]") : null;
    if (!tr || !tbody.contains(tr)) return;
    openEdit(tr.getAttribute("data-id"));
  });
  tbody?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target instanceof Element ? e.target.closest("tr[data-id]") : null;
    if (!tr || e.target !== tr) return;
    e.preventDefault();
    openEdit(tr.getAttribute("data-id"));
  });

  tabAttendance?.addEventListener("click", () => setEditTab("attendance"));
  tabDetails?.addEventListener("click", () => setEditTab("details"));
  editModal?.querySelectorAll("[data-close-edit]").forEach((el) => {
    el.addEventListener("click", closeEdit);
  });
  editModal?.querySelectorAll("[data-attended]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!editingId || !attendStatus) return;
      const next = Number(btn.getAttribute("data-attended")) === 1 ? 1 : 0;
      const guest = guestById(editingId);
      if (guest && (guest.attended ? 1 : 0) === next) return;
      attendStatus.classList.remove("is-error");
      attendStatus.textContent = "Saving…";
      try {
        const res = await fetch("/api/admin/registrations/attendance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editingId, attended: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not save attendance");
        if (guest) guest.attended = next;
        paintAttendance(next);
        attendStatus.textContent = next ? "Marked attended." : "Marked not yet.";
        load();
      } catch (err) {
        attendStatus.classList.add("is-error");
        attendStatus.textContent = err instanceof Error ? err.message : "Error";
      }
    });
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editStatus || !editingId) return;
    editStatus.classList.remove("is-error");
    editStatus.textContent = "Saving…";
    const fd = new FormData(editForm);
    try {
      const res = await fetch("/api/admin/registrations/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          event_id: fd.get("event_id"),
          name: fd.get("name"),
          email: fd.get("email"),
          mobile: fd.get("mobile"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update registration");
      const guest = guestById(editingId);
      const name = String(fd.get("name") || "");
      if (editTitle) editTitle.textContent = name;
      if (guest) {
        guest.name = name;
        guest.email = String(fd.get("email") || "");
        guest.mobile = String(fd.get("mobile") || "");
        guest.event_id = String(fd.get("event_id") || "");
      }
      editStatus.textContent = "Details saved.";
      load();
    } catch (err) {
      editStatus.classList.add("is-error");
      editStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll(".th-sort").forEach((btn) => {
    btn.addEventListener("click", () => {
      const col = btn.getAttribute("data-sort") || "name";
      if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortCol = col;
        sortDir = col === "created_at" ? "desc" : "asc";
      }
      page = 1;
      load();
    });
  });

  let timer;
  search?.addEventListener("input", () => {
    if (searchClear) searchClear.hidden = !search.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 250);
  });
  searchClear?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    searchClear.hidden = true;
    search.focus();
    page = 1;
    load();
  });
  eventFilter?.addEventListener("change", () => {
    page = 1;
    load();
  });
  pageSizeEl?.addEventListener("change", () => {
    pageSize = Number(pageSizeEl.value) || 20;
    page = 1;
    load();
  });
  prev?.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      load();
    }
  });
  next?.addEventListener("click", () => {
    if (page * pageSize < total) {
      page += 1;
      load();
    }
  });

  load();

  const url = new URL(location.href);
  if (url.searchParams.get("add") === "1") {
    url.searchParams.delete("add");
    history.replaceState(null, "", url);
    openModal();
  }
})();
