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
})();
