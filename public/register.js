(() => {
  const form = document.getElementById("register-form");
  const status = document.getElementById("register-status");
  if (!(form instanceof HTMLFormElement) || !status) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.classList.remove("is-error");
    status.textContent = "Submitting…";
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      mobile: String(data.get("mobile") || "").trim(),
      privacy: data.get("privacy") === "1" || data.get("privacy") === "on",
    };
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      status.textContent = "You’re registered — see you at OFW Tambayan!";
      form.reset();
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = err instanceof Error ? err.message : "Something went wrong";
    }
  });
})();
