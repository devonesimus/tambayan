(() => {
  const form = document.getElementById("announcement-form");
  const eventForm = document.getElementById("event-form");
  const status = document.getElementById("announcement-status");
  const eventStatus = document.getElementById("event-status");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status) return;
    status.classList.remove("is-error");
    status.textContent = "Saving…";
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          announcement_title: fd.get("announcement_title"),
          announcement_body: fd.get("announcement_body"),
          location_override: fd.get("location_override"),
          next_event_id: fd.get("next_event_id"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      status.textContent = "Saved.";
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!eventStatus) return;
    eventStatus.classList.remove("is-error");
    eventStatus.textContent = "Creating…";
    const fd = new FormData(eventForm);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          slug: fd.get("slug"),
          held_at: fd.get("held_at"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      eventStatus.textContent = "Event created — reloading…";
      location.reload();
    } catch (err) {
      eventStatus.classList.add("is-error");
      eventStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });
})();
