(() => {
  const form = document.getElementById("gallery-form");
  const status = document.getElementById("gallery-status");
  const eventSelect = document.getElementById("gallery-event");

  eventSelect?.addEventListener("change", () => {
    const id = eventSelect.value;
    location.href = `/admin/gallery?event_id=${encodeURIComponent(id)}`;
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status) return;
    status.classList.remove("is-error");
    status.textContent = "Uploading…";
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/admin/gallery", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      status.textContent = "Uploaded.";
      location.reload();
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll("[data-delete-image]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-image");
      if (!id || !confirm("Delete this photo?")) return;
      const res = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) location.reload();
    });
  });
})();
