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
  const openBtn = document.getElementById("add-guest-open");

  let page = 1;
  let pageSize = 20;
  let total = 0;
  let rows = [];
  let sortCol = "created_at";
  let sortDir = "desc";

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
      tbody.innerHTML = `<tr><td colspan="7">${escape(data.error || "Failed to load")}</td></tr>`;
      return;
    }
    total = data.total;
    rows = data.rows || [];
    const start = (page - 1) * pageSize;
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r, i) => `<tr>
          <td class="reg-num">${start + i + 1}</td>
          <td>${escape(r.name)}</td>
          <td>${escape(r.email || "—")}</td>
          <td>${escape(r.mobile || "—")}</td>
          <td>${escape(r.event_title || "")}</td>
          <td>${escape(r.source || "public")}</td>
          <td>${escape(formatWhen(r.created_at))}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="7">No registrations found.</td></tr>`;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    if (pageInfo) pageInfo.textContent = `${total} guest${total === 1 ? "" : "s"} · page ${page} of ${pages}`;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
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

  exportXlsx?.addEventListener("click", async () => {
    const all = await fetchAllForExport();
    const sheet = (window.XLSX || {}).utils?.json_to_sheet(
      all.map((r) => ({
        Name: r.name,
        Email: r.email || "",
        Mobile: r.mobile,
        Event: r.event_title,
        Source: r.source || "public",
        Registered: r.created_at,
      })),
    );
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "Registrations");
    window.XLSX.writeFile(book, "ofw-tambayan-registrations.xlsx");
  });

  exportPdf?.addEventListener("click", async () => {
    const all = await fetchAllForExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("OFW Tambayan — Registrations", 14, 16);
    doc.autoTable({
      startY: 22,
      head: [["Name", "Email", "Mobile", "Event", "Source", "Registered"]],
      body: all.map((r) => [
        r.name,
        r.email || "",
        r.mobile,
        r.event_title,
        r.source || "public",
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
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
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 250);
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
})();
