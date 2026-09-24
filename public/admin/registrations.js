(() => {
  const tbody = document.querySelector("#reg-table tbody");
  const search = document.getElementById("reg-search");
  const sort = document.getElementById("reg-sort");
  const eventFilter = document.getElementById("event-filter");
  const pageInfo = document.getElementById("page-info");
  const prev = document.getElementById("prev-page");
  const next = document.getElementById("next-page");
  const exportXlsx = document.getElementById("export-xlsx");
  const exportPdf = document.getElementById("export-pdf");
  const adminForm = document.getElementById("admin-reg-form");
  const adminStatus = document.getElementById("admin-reg-status");

  let page = 1;
  const pageSize = 25;
  let total = 0;
  let rows = [];

  async function load() {
    if (!tbody) return;
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort: sort?.value || "created_at:desc",
      q: search?.value || "",
    });
    if (eventFilter?.value) params.set("event_id", eventFilter.value);
    const res = await fetch(`/api/admin/registrations?${params}`);
    const data = await res.json();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6">${data.error || "Failed to load"}</td></tr>`;
      return;
    }
    total = data.total;
    rows = data.rows || [];
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r) => `<tr>
          <td>${escape(r.name || "")}</td>
          <td>${escape(r.email || "")}</td>
          <td>${escape(r.mobile || "")}</td>
          <td>${escape(r.event_title || "")}</td>
          <td>${escape(r.source || "public")}</td>
          <td>${escape(r.created_at || "")}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="6">No registrations found.</td></tr>`;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pageInfo) pageInfo.textContent = `Page ${page} of ${pages} · ${total} total`;
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
      page_size: "100",
      sort: sort?.value || "created_at:desc",
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
      pages = Math.max(1, Math.ceil((data.total || 0) / 100));
      p += 1;
      if (p > 50) break;
    }
    return all;
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
      adminForm.reset();
      if (eventFilter && fd.get("event_id")) eventFilter.value = String(fd.get("event_id"));
      page = 1;
      load();
    } catch (err) {
      adminStatus.classList.add("is-error");
      adminStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  let timer;
  search?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 250);
  });
  sort?.addEventListener("change", () => {
    page = 1;
    load();
  });
  eventFilter?.addEventListener("change", () => {
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
