(() => {
  const form = document.getElementById("event-form");
  const status = document.getElementById("event-status");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status) return;
    status.classList.remove("is-error");
    status.textContent = "Saving…";
    const fd = new FormData(form);
    const id = String(fd.get("id") || "").trim();
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: id || undefined,
          title: fd.get("title"),
          slug: fd.get("slug"),
          held_at: fd.get("held_at"),
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
      const label = to === "open" ? "Open / reopen this event for public registration?" : `Set status to ${to}?`;
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
