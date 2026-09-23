(() => {
  const form = document.getElementById("video-form");
  const status = document.getElementById("video-status");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status) return;
    status.classList.remove("is-error");
    status.textContent = "Saving…";
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: fd.get("id") || undefined,
          title: fd.get("title"),
          youtube_url: fd.get("youtube_url"),
          sort_order: Number(fd.get("sort_order") || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      status.textContent = "Saved.";
      location.reload();
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll("[data-delete-video]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-video");
      if (!id || !confirm("Delete this video?")) return;
      const res = await fetch("/api/admin/videos", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) location.reload();
    });
  });
})();
