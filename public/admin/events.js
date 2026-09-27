(() => {
  const form = document.getElementById("event-form");
  const status = document.getElementById("event-status");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function mountCalendar(root) {
    const hidden = root.querySelector("[name='held_date']");
    const button = root.querySelector(".date-pick-btn");
    const pop = root.querySelector(".date-pop");
    const label = root.querySelector("[data-cal='label']");
    const grid = root.querySelector("[data-cal='grid']");
    const selected = hidden.value ? new Date(`${hidden.value}T00:00:00`) : new Date();
    let view = new Date(selected.getFullYear(), selected.getMonth(), 1);

    function pretty(iso) {
      if (!iso) return "Choose a date";
      const [y, m, d] = iso.split("-");
      return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
    }

    function paint() {
      label.textContent = `${months[view.getMonth()]} ${view.getFullYear()}`;
      const year = view.getFullYear();
      const month = view.getMonth();
      const first = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const today = new Date();
      const cells = [];
      for (let i = 0; i < first; i += 1) cells.push("<span></span>");
      for (let day = 1; day <= days; day += 1) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const isOn = hidden.value === iso;
        cells.push(
          `<button type="button" class="date-day${isOn ? " is-on" : ""}${isToday ? " is-today" : ""}" data-date="${iso}">${day}</button>`,
        );
      }
      grid.innerHTML = cells.join("");
      button.textContent = pretty(hidden.value);
    }

    function open() {
      pop.hidden = false;
      button.setAttribute("aria-expanded", "true");
      paint();
    }
    function close() {
      pop.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }

    button.addEventListener("click", () => (pop.hidden ? open() : close()));
    root.querySelector("[data-cal='prev']").addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      paint();
    });
    root.querySelector("[data-cal='next']").addEventListener("click", () => {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      paint();
    });
    grid.addEventListener("click", (e) => {
      const day = e.target.closest("[data-date]");
      if (!day) return;
      hidden.value = day.getAttribute("data-date");
      hidden.dispatchEvent(new Event("change"));
      paint();
      close();
    });
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    paint();
  }

  function eventIdentity() {
    if (!form) return null;
    const fd = new FormData(form);
    const date = String(fd.get("held_date") || "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    let hour = Number(fd.get("held_hour"));
    const minute = String(fd.get("held_minute") || "00");
    const period = String(fd.get("held_period") || "AM");
    if (!hour || hour < 1 || hour > 12) return null;
    if (period === "AM") hour = hour === 12 ? 0 : hour;
    else if (hour !== 12) hour += 12;
    const hh = String(hour).padStart(2, "0");
    const title = `OFW Tambayan - ${monthNames[Number(match[2]) - 1]} ${match[1]}`;
    return {
      title,
      slug: date,
      held_at: `${date}T${hh}:${minute}:00+08:00`,
    };
  }

  const datePick = form?.querySelector(".date-pick");
  if (datePick) mountCalendar(datePick);

  const titlePreview = document.getElementById("event-title-preview");
  form?.querySelector("[name='held_date']")?.addEventListener("change", (e) => {
    const match = /^(\d{4})-(\d{2})/.exec(e.target.value || "");
    if (titlePreview && match) {
      titlePreview.textContent = `Listed as “OFW Tambayan - ${monthNames[Number(match[2]) - 1]} ${match[1]}”`;
    }
  });

  const statusHint = document.getElementById("event-status-hint");
  let statusHints = {};
  try {
    statusHints = JSON.parse(statusHint?.getAttribute("data-hints") || "{}");
  } catch (err) {}
  const paintStatusHint = () => {
    const picked = form?.querySelector("[name='status']:checked");
    if (statusHint) statusHint.textContent = statusHints[picked?.value] || "";
  };
  form?.querySelectorAll("[name='status']").forEach((el) => el.addEventListener("change", paintStatusHint));
  paintStatusHint();

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status) return;
    status.classList.remove("is-error");
    status.textContent = "Saving…";
    const fd = new FormData(form);
    const id = String(fd.get("id") || "").trim();
    const identity = eventIdentity();
    if (!identity) {
      status.classList.add("is-error");
      status.textContent = "Choose a date and time.";
      return;
    }
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: id || undefined,
          title: identity.title,
          slug: identity.slug,
          held_at: identity.held_at,
          address: fd.get("address"),
          announcement_title: fd.get("announcement_title"),
          announcement_body: fd.get("announcement_body"),
          status: fd.get("status"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      status.textContent = "Saved — reloading…";
      location.href = "/admin/events";
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-status");
      const to = btn.getAttribute("data-to");
      if (!id || !to) return;
      const pretty = to.charAt(0).toUpperCase() + to.slice(1);
      const label = to === "open" ? "Open this event for public registration?" : `Set status to ${pretty}?`;
      if (!confirm(label)) return;
      try {
        const res = await fetch("/api/admin/events/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, status: to }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Status update failed");
        location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error");
      }
    });
  });
  // Delete an empty draft.
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = btn.getAttribute("data-delete");
      const title = btn.getAttribute("data-title") || "this event";
      if (!id) return;
      if (!confirm(`Delete the empty draft "${title}"? This cannot be undone.`)) return;
      try {
        const res = await fetch("/api/admin/events/delete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not delete the event");
        const editing = new URLSearchParams(location.search).get("id") === id;
        if (editing) location.href = "/admin/events";
        else location.reload();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error");
      }
    });
  });

  // The events list: filter by status, a few per page, and tap an event to see its guests.
  const list = document.getElementById("event-list");
  const filterBox = document.getElementById("event-filter");
  if (list && filterBox) {
    const PAGE_SIZE = 5;
    const rows = [...list.querySelectorAll("li[data-event]")];
    const heading = document.getElementById("events-heading");
    const empty = document.getElementById("event-empty");
    const pager = document.getElementById("event-pager");
    const range = document.getElementById("event-range");
    const prev = document.getElementById("event-prev");
    const next = document.getElementById("event-next");
    const radios = [...filterBox.querySelectorAll('input[name="ev-status"]')];
    const titles = { all: "All events", open: "Open events", closed: "Closed events", draft: "Draft events" };
    const nothing = { open: "No open events.", closed: "No closed events.", draft: "No draft events." };
    const valid = (value) => (value === "open" || value === "closed" || value === "draft" ? value : "all");

    const params = new URLSearchParams(location.search);
    let filter = valid(params.get("status"));
    let page = Math.max(1, Number(params.get("page")) || 1);
    const editingId = params.get("id");
    const matching = () => rows.filter((row) => filter === "all" || row.dataset.status === filter);

    // Land on the page that holds the event being edited.
    const editingRow = editingId ? rows.find((row) => row.dataset.id === editingId) : null;
    if (editingRow) {
      if (filter !== "all" && editingRow.dataset.status !== filter) filter = "all";
      if (!params.get("page")) page = Math.floor(matching().indexOf(editingRow) / PAGE_SIZE) + 1;
    }

    function paint() {
      const shown = matching();
      const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
      page = Math.min(Math.max(1, page), pages);
      const from = (page - 1) * PAGE_SIZE;
      const onPage = new Set(shown.slice(from, from + PAGE_SIZE));
      rows.forEach((row) => { row.hidden = !onPage.has(row); });
      if (heading) heading.textContent = titles[filter];
      radios.forEach((radio) => { radio.checked = radio.value === filter; });
      if (empty) {
        empty.hidden = shown.length > 0;
        empty.textContent = nothing[filter] || "";
      }
      const paged = shown.length > PAGE_SIZE;
      if (pager) pager.hidden = !paged;
      if (paged && range) range.textContent = `${from + 1}–${Math.min(shown.length, from + PAGE_SIZE)} of ${shown.length}`;
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= pages;

      // Keep the place in the address, so Edit and back returns to the same list.
      const query = new URLSearchParams(location.search);
      filter === "all" ? query.delete("status") : query.set("status", filter);
      page === 1 ? query.delete("page") : query.set("page", String(page));
      const qs = query.toString();
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
      const keep = new URLSearchParams();
      if (filter !== "all") keep.set("status", filter);
      if (page > 1) keep.set("page", String(page));
      list.querySelectorAll("a[data-edit]").forEach((link) => {
        const q = new URLSearchParams(keep);
        q.set("id", link.getAttribute("data-edit"));
        link.setAttribute("href", `/admin/events?${q.toString()}#event-form`);
      });
      document.querySelectorAll(".admin-form-actions a.btn-ghost[href='/admin/events']").forEach((link) => {
        const qs2 = keep.toString();
        link.setAttribute("href", `/admin/events${qs2 ? `?${qs2}` : ""}`);
      });
    }

    filterBox.hidden = false;
    radios.forEach((radio) =>
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        filter = valid(radio.value);
        page = 1;
        paint();
      }),
    );
    prev?.addEventListener("click", () => { page -= 1; paint(); });
    next?.addEventListener("click", () => { page += 1; paint(); });

    // Tapping anywhere on a row (except its buttons) opens that event's guest list.
    list.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest("li[data-event]");
      if (!target || !row || target.closest("a, button")) return;
      const link = row.querySelector(".admin-event-link");
      if (link) location.href = link.getAttribute("href");
    });
    paint();
  }
})();
