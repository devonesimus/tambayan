(() => {
  // Keep in sync with GALLERY_* constants in src/helpers.ts
  const DEFAULTS = {
    maxFileBytes: 5 * 1024 * 1024,
    maxBatch: 20,
    maxPerEvent: 120,
    allowedMime: new Set(["image/jpeg", "image/png", "image/webp"]),
    allowedExt: new Set(["jpg", "jpeg", "png", "webp"]),
  };

  const form = document.getElementById("gallery-form");
  const status = document.getElementById("gallery-status");
  const eventSelect = document.getElementById("gallery-event");
  const fileInput = document.getElementById("gallery-files");

  eventSelect?.addEventListener("change", () => {
    const id = eventSelect.value;
    location.href = `/admin/gallery?event_id=${encodeURIComponent(id)}`;
  });

  function limitsFromForm() {
    if (!(form instanceof HTMLFormElement)) return DEFAULTS;
    return {
      maxFileBytes: Number(form.dataset.maxFileBytes) || DEFAULTS.maxFileBytes,
      maxBatch: Number(form.dataset.maxBatch) || DEFAULTS.maxBatch,
      maxPerEvent: Number(form.dataset.maxPerEvent) || DEFAULTS.maxPerEvent,
      photoCount: Number(form.dataset.photoCount) || 0,
      remaining: Number(form.dataset.remaining),
      allowedMime: DEFAULTS.allowedMime,
      allowedExt: DEFAULTS.allowedExt,
    };
  }

  function fileExt(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  }

  function validateFiles(files) {
    const limits = limitsFromForm();
    const list = Array.from(files || []).filter((f) => f && f.size > 0);
    if (list.length === 0) return "Choose at least one photo to upload.";
    if (list.length > limits.maxBatch) {
      return `Too many files. Select at most ${limits.maxBatch} images at a time.`;
    }
    const remaining =
      Number.isFinite(limits.remaining) && limits.remaining >= 0
        ? limits.remaining
        : Math.max(0, limits.maxPerEvent - limits.photoCount);
    if (remaining === 0) {
      return `This event is at the ${limits.maxPerEvent}-photo limit. Delete some photos before uploading more.`;
    }
    if (list.length > remaining) {
      return `Only ${remaining} photo slot${remaining === 1 ? "" : "s"} left for this event (max ${limits.maxPerEvent}). You selected ${list.length}.`;
    }
    for (const file of list) {
      const ext = fileExt(file.name);
      const mimeOk = limits.allowedMime.has(file.type);
      const extOk = limits.allowedExt.has(ext);
      if (!mimeOk && !extOk) {
        return `"${file.name}" is not an allowed type. Use JPEG, PNG, or WebP only.`;
      }
      if (file.size > limits.maxFileBytes) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        return `"${file.name}" is ${mb} MB. Each photo must be 5 MB or smaller.`;
      }
    }
    return null;
  }

  fileInput?.addEventListener("change", () => {
    if (!status || !(fileInput instanceof HTMLInputElement)) return;
    const err = validateFiles(fileInput.files);
    if (err) {
      status.classList.add("is-error");
      status.textContent = err;
    } else {
      status.classList.remove("is-error");
      const n = fileInput.files?.length || 0;
      status.textContent = n ? `${n} file${n === 1 ? "" : "s"} ready.` : "";
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!status || !(form instanceof HTMLFormElement)) return;
    status.classList.remove("is-error");

    const files = fileInput instanceof HTMLInputElement ? fileInput.files : null;
    const err = validateFiles(files);
    if (err) {
      status.classList.add("is-error");
      status.textContent = err;
      return;
    }

    const n = files?.length || 0;
    status.textContent = n === 1 ? "Uploading 1 photo…" : `Uploading ${n} photos…`;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/admin/gallery", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      const count = json.count || n;
      status.textContent =
        count === 1 ? "Uploaded 1 photo." : `Uploaded ${count} photos.`;
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
