(() => {
  const form = document.getElementById("register-form");
  const status = document.getElementById("register-status");
  if (!(form instanceof HTMLFormElement) || !status) return;

  const hints = {
    name: form.querySelector('[data-for="name"]'),
    email: form.querySelector('[data-for="email"]'),
    mobile: form.querySelector('[data-for="mobile"]'),
    privacy: form.querySelector('[data-for="privacy"]'),
  };

  function setHint(field, message) {
    const hint = hints[field];
    if (hint) hint.textContent = message || "";
    const input = form.elements.namedItem(field);
    if (input instanceof HTMLInputElement && input.type !== "checkbox") {
      input.classList.toggle("is-invalid", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
  }

  function clearHints() {
    for (const field of Object.keys(hints)) setHint(field, "");
  }

  function fieldMessage(field, payload) {
    if (field === "name" && !payload.name) return "Please add your name";
    if (field === "email" && payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return "Check this address";
    }
    if (field === "mobile") {
      const digits = payload.mobile.replace(/[^\d+]/g, "");
      if (!/^\+?[0-9]{8,15}$/.test(digits)) return "Use a valid mobile number";
    }
    if (field === "privacy" && !payload.privacy) return "Please agree";
    return "";
  }

  function showErrors(payload) {
    let first = "";
    for (const field of ["name", "email", "mobile", "privacy"]) {
      const message = fieldMessage(field, payload);
      setHint(field, message);
      if (message && !first) first = field;
    }
    if (first) {
      const input = form.elements.namedItem(first);
      if (input instanceof HTMLElement) input.focus();
    }
    return !first;
  }

  function placeServerError(message) {
    const text = message.toLowerCase();
    if (text.includes("name")) return setHint("name", "Please add your name");
    if (text.includes("email")) return setHint("email", "Check this address");
    if (text.includes("mobile")) return setHint("mobile", "Use a valid mobile number");
    if (text.includes("privacy")) return setHint("privacy", "Please agree");
    status.classList.add("is-error");
    status.textContent = message;
  }

  for (const field of Object.keys(hints)) {
    const input = form.elements.namedItem(field);
    if (!(input instanceof HTMLInputElement)) continue;
    input.addEventListener("input", () => setHint(field, ""));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.classList.remove("is-error");
    status.textContent = "";
    clearHints();
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      mobile: String(data.get("mobile") || "").trim(),
      privacy: data.get("privacy") === "1" || data.get("privacy") === "on",
    };
    if (!showErrors(payload)) return;

    const button = form.querySelector('[type="submit"]');
    if (button instanceof HTMLButtonElement) {
      button.disabled = true;
      button.textContent = "Registering…";
    }
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
      placeServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.textContent = "Register";
      }
    }
  });
})();
