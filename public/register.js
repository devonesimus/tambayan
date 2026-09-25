(() => {
  const form = document.getElementById("register-form");
  const confirm = document.getElementById("register-confirm");
  const kicker = document.getElementById("register-confirm-kicker");
  const status = document.getElementById("register-status");
  const page = form?.closest(".register-page");
  const calLink = document.getElementById("register-confirm-cal");
  if (!(form instanceof HTMLFormElement) || !confirm || !kicker || !status) return;

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
      if (!payload.mobile) return "Please add your mobile number";
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
    confirm.hidden = false;
    confirm.classList.remove("is-success", "is-play");
    confirm.classList.add("is-on", "is-error");
    kicker.textContent = "";
    status.textContent = message;
  }

  /** Letters rise in one by one; screen readers still get the plain words. */
  function setKicker(text) {
    kicker.textContent = "";
    kicker.setAttribute("aria-label", text);
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "reg-letter";
      span.style.setProperty("--i", String(i));
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch === " " ? "\u00a0" : ch;
      kicker.appendChild(span);
    });
  }

  function icsStamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function icsText(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  }

  /** Build an .ics file for the event (two hours long) so guests can save it. */
  function prepareCalendar() {
    if (!(calLink instanceof HTMLAnchorElement) || !page) return;
    const start = new Date(page.getAttribute("data-event-start") || "");
    if (Number.isNaN(start.getTime())) {
      calLink.hidden = true;
      return;
    }
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OFW Tambayan SG//Registration//EN",
      "BEGIN:VEVENT",
      `UID:${icsStamp(start)}@ofwtambayan.sg`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsText(page.getAttribute("data-event-title"))}`,
      `LOCATION:${icsText(page.getAttribute("data-event-venue"))}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    calLink.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    calLink.hidden = false;
  }

  for (const field of Object.keys(hints)) {
    const input = form.elements.namedItem(field);
    if (!(input instanceof HTMLInputElement)) continue;
    input.addEventListener("input", () => setHint(field, ""));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    confirm.classList.remove("is-error", "is-on", "is-success", "is-play");
    confirm.hidden = true;
    kicker.textContent = "";
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
      const first = payload.name.split(/\s+/)[0] || "";
      setKicker(json.already ? "Already registered" : "You’re in!");
      status.textContent = json.already
        ? `You’re already on the list${first ? `, ${first}` : ""}.`
        : `See you sa Tambayan${first ? `, ${first}` : ""}!`;
      prepareCalendar();
      form.hidden = true;
      page?.classList.add("is-done");
      confirm.hidden = false;
      confirm.classList.add("is-on", "is-success");
      void confirm.offsetWidth;
      confirm.classList.add("is-play");
      confirm.scrollIntoView({ block: "center", behavior: "smooth" });
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
