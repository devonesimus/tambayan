(() => {
  const tbody = document.querySelector("#reg-table tbody");
  const search = document.getElementById("reg-search");
  const eventFilter = document.getElementById("event-filter");
  const pageInfo = document.getElementById("page-info");
  const pageSizeEl = document.getElementById("page-size");
  const prev = document.getElementById("prev-page");
  const next = document.getElementById("next-page");
  const exportXlsx = document.getElementById("export-xlsx");
  const exportPdf = document.getElementById("export-pdf");
  const adminForm = document.getElementById("admin-reg-form");
  const adminStatus = document.getElementById("admin-reg-status");
  const modal = document.getElementById("guest-modal");
  const editModal = document.getElementById("guest-edit-modal");
  const editForm = document.getElementById("guest-edit-form");
  const editTitle = document.getElementById("guest-edit-title");
  const editContext = document.getElementById("guest-edit-context");
  const editStatus = document.getElementById("guest-edit-status");
  const attendStatus = document.getElementById("guest-attend-status");
  const attendPanel = document.getElementById("panel-attendance");
  const tabAttendance = document.getElementById("tab-attendance");
  const tabDetails = document.getElementById("tab-details");
  const openBtn = document.getElementById("add-guest-open");
  const board = document.querySelector(".reg-board");
  const searchClear = document.getElementById("reg-search-clear");
  const exportToggle = document.getElementById("export-toggle");
  const exportWrap = exportToggle?.closest(".reg-export");

  let page = 1;
  let pageSize = 20;
  let total = 0;
  let rows = [];
  let sortCol = "created_at";
  let sortDir = "desc";
  let editingId = "";

  function sortParam() {
    return `${sortCol}:${sortDir}`;
  }

  function paintSort() {
    document.querySelectorAll(".th-sort").forEach((btn) => {
      const col = btn.getAttribute("data-sort");
      const active = col === sortCol;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("data-dir", sortDir);
      else btn.removeAttribute("data-dir");
      const th = btn.closest("th");
      if (th) {
        th.setAttribute(
          "aria-sort",
          active ? (sortDir === "asc" ? "ascending" : "descending") : "none",
        );
      }
    });
  }

  async function load() {
    if (!tbody) return;
    paintSort();
    hideTip();
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      sort: sortParam(),
      q: search?.value || "",
    });
    if (eventFilter?.value) params.set("event_id", eventFilter.value);
    const res = await fetch(`/api/admin/registrations?${params}`);
    const data = await res.json();
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="5">${escape(data.error || "Failed to load")}</td></tr>`;
      return;
    }
    total = data.total;
    rows = data.rows || [];
    const start = (page - 1) * pageSize;
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (r, i) => `<tr class="reg-row${r.conflicts?.length ? " is-conflict" : ""}" data-id="${escape(r.id)}" tabindex="0" role="button" aria-label="Open ${escape(r.name)}">
          <td class="reg-num">${start + i + 1}</td>
          <td class="reg-guest">
            <span class="reg-name">${escape(r.name)}</span>
            ${(r.source || "public") === "admin" ? `<span class="reg-walkin">Walk-in</span>` : ""}
            ${r.attended ? `<span class="reg-here">Here</span>` : ""}
            ${r.birthday ? giftButton(r.birth_date) : ""}
            ${r.conflicts?.length ? dupeButton(r.conflicts) : ""}
            <span class="reg-event-cell">${escape(r.event_title || "")}</span>
          </td>
          <td class="reg-mobile${r.mobile ? "" : " is-empty"}">${escape(r.mobile || "—")}</td>
          <td class="reg-attended">${r.attended ? `<span class="reg-attended-pill">Here</span>` : "—"}</td>
          <td class="reg-when">${escape(formatWhen(r.created_at))}</td>
        </tr>`,
          )
          .join("")
      : `<tr class="reg-empty"><td colspan="5">${search?.value ? "No guests match that search." : "No registrations yet."}</td></tr>`;
    board?.classList.toggle("is-single-event", Boolean(eventFilter?.value));
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    if (pageInfo) pageInfo.textContent = `${total} guest${total === 1 ? "" : "s"} · page ${page} of ${pages}`;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
  }

  function sourceLabel(source) {
    if (!source || source === "public") return "Online";
    if (source === "admin") return "Walk-in";
    return source;
  }

  const GIFT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5M12 8.5v12M12 8.5C10.5 4.5 6.5 4.5 7 6.8c.3 1.4 5 1.7 5 1.7zm0 0c1.5-4 5.5-4 5-1.7-.3 1.4-5 1.7-5 1.7z"/></svg>';

  function birthLabel(value) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!value || Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-SG", { timeZone: "UTC", day: "numeric", month: "long" }).format(d);
  }

  function giftButton(birthDate) {
    const label = birthLabel(birthDate);
    const text = label ? `Birthday: ${label}` : "Birthday this month";
    return `<button type="button" class="reg-gift" data-tip-title="Birth month" data-tip-text="${escape(label || "Birthday this month")}" aria-label="${escape(text)}">${GIFT_ICON}</button>`;
  }

  // A caution triangle: amber with a dark "!" so the mark stays legible without shouting in red.
  const DUPE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4 21.6 20H2.4z" fill="#eaa12f" stroke="#eaa12f" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.6v5" fill="none" stroke="#1a1f2e" stroke-width="2.6" stroke-linecap="round"/><path d="M12 17.7v.01" fill="none" stroke="#1a1f2e" stroke-width="2.8" stroke-linecap="round"/></svg>';

  function duplicateNames(conflicts) {
    const names = conflicts.map((c) => c.name);
    return names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(" and ");
  }

  function dupeButton(conflicts) {
    const names = duplicateNames(conflicts);
    return `<button type="button" class="reg-dupe" data-tip-title="Possible duplicate" data-tip-text="May be the same person as ${escape(names)}" aria-label="Possible duplicate of ${escape(names)}">${DUPE_ICON}</button>`;
  }

  // One shared tooltip: hover for a mouse, focus for a keyboard, tap to toggle on touch.
  const tip = document.createElement("div");
  tip.className = "reg-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let tipOwner = null;

  function showTip(btn) {
    tipOwner = btn;
    tip.innerHTML = `<strong>${escape(btn.dataset.tipTitle || "")}</strong><span>${escape(btn.dataset.tipText || "")}</span>`;
    tip.hidden = false;
    const anchor = btn.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - box.width / 2), window.innerWidth - box.width - 8);
    const above = anchor.top - box.height - 8 >= 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${above ? anchor.top - box.height - 8 : anchor.bottom + 8}px`;
  }

  function hideTip() {
    tip.hidden = true;
    tipOwner = null;
  }

  function formatWhen(value) {
    if (!value) return "";
    const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }

  function escape(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  async function fetchAllForExport() {
    const params = new URLSearchParams({
      page: "1",
      page_size: "50",
      sort: sortParam(),
      q: search?.value || "",
    });
    if (eventFilter?.value) params.set("event_id", eventFilter.value);
    const all = [];
    let p = 1;
    let pages = 1;
    while (p <= pages) {
      params.set("page", String(p));
      const res = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      all.push(...(data.rows || []));
      pages = Math.max(1, Math.ceil((data.total || 0) / 50));
      p += 1;
      if (p > 40) break;
    }
    return all;
  }

  function openModal() {
    if (!modal) return;
    const eventField = adminForm?.querySelector('[name="event_id"]');
    if (eventField && eventFilter?.value) eventField.value = eventFilter.value;
    resetGuestForm();
    if (guestRecentList) guestRecentList.replaceChildren();
    if (guestRecent) guestRecent.hidden = true;
    if (eventSelectWrap) eventSelectWrap.hidden = true;
    if (eventChange) eventChange.hidden = false;
    syncEvent();
    modal.hidden = false;
    document.body.classList.add("reg-modal-open");
    adminForm?.querySelector('[name="name"]')?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("reg-modal-open");
    openBtn?.focus();
  }

  function setExportMenu(open) {
    if (!exportWrap || !exportToggle) return;
    exportWrap.classList.toggle("is-open", open);
    exportToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  exportToggle?.addEventListener("click", () => setExportMenu(!exportWrap?.classList.contains("is-open")));
  document.addEventListener("click", (e) => {
    if (exportWrap && e.target instanceof Node && !exportWrap.contains(e.target)) setExportMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !exportWrap?.classList.contains("is-open")) return;
    setExportMenu(false);
    exportToggle?.focus();
  });

  exportXlsx?.addEventListener("click", async () => {
    setExportMenu(false);
    const all = await fetchAllForExport();
    const sheet = (window.XLSX || {}).utils?.json_to_sheet(
      all.map((r) => ({
        Name: r.name,
        Email: r.email || "",
        Mobile: r.mobile,
        Event: r.event_title,
        Source: r.source || "public",
        Attended: r.attended ? "Yes" : "No",
        Registered: r.created_at,
      })),
    );
    const book = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(book, sheet, "Registrations");
    window.XLSX.writeFile(book, "ofw-tambayan-registrations.xlsx");
  });

  exportPdf?.addEventListener("click", async () => {
    setExportMenu(false);
    const all = await fetchAllForExport();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("OFW Tambayan — Registrations", 14, 16);
    doc.autoTable({
      startY: 22,
      head: [["Name", "Email", "Mobile", "Event", "Source", "Attended", "Registered"]],
      body: all.map((r) => [
        r.name,
        r.email || "",
        r.mobile,
        r.event_title,
        r.source || "public",
        r.attended ? "Yes" : "No",
        r.created_at,
      ]),
    });
    doc.save("ofw-tambayan-registrations.pdf");
  });

  // Add guest overlay: name first, existing people suggested, walk-ins default to "Here now".
  const nameInput = adminForm?.querySelector('[name="name"]');
  const personInput = adminForm?.querySelector('[name="person_id"]');
  const mobileInput = adminForm?.querySelector('[name="mobile"]');
  const emailInput = adminForm?.querySelector('[name="email"]');
  const eventSelect = adminForm?.querySelector('[name="event_id"]');
  const hereInput = adminForm?.querySelector('[name="attended"]');
  const hereHint = document.getElementById("guest-here-hint");
  const eventLabel = document.getElementById("guest-event-label");
  const eventChange = document.getElementById("guest-event-change");
  const eventSelectWrap = document.getElementById("guest-event-select");
  const nameWrap = adminForm?.querySelector(".gm-name");
  const newFields = document.getElementById("guest-new-fields");
  const moreDetails = document.getElementById("guest-more");
  const suggestBox = document.getElementById("guest-suggest");
  const suggestClear = document.getElementById("guest-suggest-clear");
  const chip = document.getElementById("guest-chip");
  const chipAvatar = document.getElementById("guest-chip-avatar");
  const chipName = document.getElementById("guest-chip-name");
  const chipSub = document.getElementById("guest-chip-sub");
  const notice = document.getElementById("guest-notice");
  const noticeText = document.getElementById("guest-notice-text");
  const noticeAction = document.getElementById("guest-notice-action");
  const guestRecent = document.getElementById("guest-recent");
  const guestRecentList = document.getElementById("guest-recent-list");
  const sgDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" });
  let suggestTimer;
  let searchSeq = 0;
  let results = [];
  let active = -1;

  function sgDay(value) {
    const d = value ? new Date(value) : new Date();
    return Number.isNaN(d.getTime()) ? "" : sgDayFormat.format(d);
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const last = parts.length > 1 ? [...parts[parts.length - 1]][0] : "";
    return (([...(parts[0] || "")][0] || "") + last).toUpperCase() || "?";
  }

  function syncHere() {
    if (hereHint) {
      hereHint.textContent = hereInput?.checked
        ? "Marked as attended when saved"
        : "Registered only. Mark attendance on the day.";
    }
  }

  function syncEvent() {
    const option = eventSelect?.selectedOptions[0];
    if (eventLabel) eventLabel.textContent = option ? option.textContent : "";
    // A walk-in is at the door, so default to attended unless the event is still ahead.
    if (hereInput) hereInput.checked = !option?.dataset.held || sgDay(option.dataset.held) <= sgDay();
    syncHere();
  }

  function hideNotice() {
    if (notice) notice.hidden = true;
  }

  function showNotice(text, action) {
    if (!notice || !noticeText || !noticeAction) return;
    noticeText.textContent = text;
    noticeAction.hidden = !action;
    noticeAction.onclick = action ? action.run : null;
    if (action) noticeAction.textContent = action.label;
    notice.hidden = false;
  }

  function addRecent(name, attended) {
    if (!guestRecent || !guestRecentList) return;
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;
    const pill = document.createElement("span");
    pill.className = `pp-pill${attended ? " is-yes" : ""}`;
    pill.textContent = attended ? "Here" : "Registered";
    item.append(label, pill);
    guestRecentList.prepend(item);
    while (guestRecentList.children.length > 5) guestRecentList.lastElementChild.remove();
    guestRecent.hidden = false;
  }

  function hideSuggest() {
    results = [];
    active = -1;
    if (suggestBox) {
      suggestBox.hidden = true;
      suggestBox.replaceChildren();
    }
    nameInput?.setAttribute("aria-expanded", "false");
    nameInput?.removeAttribute("aria-activedescendant");
  }

  function paintActive() {
    suggestBox?.querySelectorAll(".gm-opt").forEach((el, i) => {
      el.classList.toggle("is-active", i === active);
      el.setAttribute("aria-selected", String(i === active));
    });
    if (active >= 0) {
      nameInput?.setAttribute("aria-activedescendant", `guest-opt-${active}`);
      suggestBox?.children[active]?.scrollIntoView({ block: "nearest" });
    } else {
      nameInput?.removeAttribute("aria-activedescendant");
    }
  }

  function renderSuggest() {
    if (!suggestBox || !results.length) {
      hideSuggest();
      return;
    }
    suggestBox.innerHTML = results
      .map((person, i) => {
        const sub = [person.mobile, person.visits ? `${person.visits} attended` : ""].filter(Boolean).join(" · ");
        const tag = person.registration
          ? `<span class="gm-tag${person.registration.attended ? " is-yes" : ""}">${person.registration.attended ? "Here" : "Registered"}</span>`
          : "";
        return `<button type="button" role="option" tabindex="-1" class="gm-opt" id="guest-opt-${i}" data-i="${i}" aria-selected="false">
          <span class="pp-avatar" aria-hidden="true">${escape(initials(person.name))}</span>
          <span class="pp-main"><span class="pp-name">${escape(person.name)}</span>${sub ? `<span class="pp-sub">${escape(sub)}</span>` : ""}</span>
          ${tag}
        </button>`;
      })
      .join("");
    suggestBox.hidden = false;
    active = -1;
    nameInput?.setAttribute("aria-expanded", "true");
  }

  async function runSearch() {
    const q = nameInput?.value.trim() || "";
    if (q.length < 2 || personInput?.value) {
      searchSeq += 1;
      hideSuggest();
      return;
    }
    const mine = ++searchSeq;
    try {
      const params = new URLSearchParams({ q, event_id: eventSelect?.value || "" });
      const res = await fetch(`/api/admin/people?${params}`);
      const data = await res.json();
      if (mine !== searchSeq) return;
      results = data.people || [];
      renderSuggest();
    } catch {
      if (mine === searchSeq) hideSuggest();
    }
  }

  function clearPersonPick() {
    if (personInput) personInput.value = "";
    if (chip) chip.hidden = true;
    if (nameWrap) nameWrap.hidden = false;
    if (newFields) newFields.hidden = false;
  }

  function pickPerson(person) {
    if (!personInput || !nameInput) return;
    personInput.value = person.id;
    nameInput.value = person.name;
    if (chipAvatar) chipAvatar.textContent = initials(person.name);
    if (chipName) chipName.textContent = person.name;
    if (chipSub) {
      chipSub.textContent =
        [person.mobile, person.visits ? `${person.visits} attended` : ""].filter(Boolean).join(" · ") || "Returning guest";
    }
    if (chip) chip.hidden = false;
    if (nameWrap) nameWrap.hidden = true;
    if (newFields) newFields.hidden = true;
    hideSuggest();
    hideNotice();
  }

  function resetGuestForm() {
    if (nameInput) nameInput.value = "";
    if (mobileInput) mobileInput.value = "";
    if (emailInput) emailInput.value = "";
    if (moreDetails) moreDetails.open = false;
    clearPersonPick();
    hideSuggest();
    hideNotice();
    if (adminStatus) {
      adminStatus.textContent = "";
      adminStatus.classList.remove("is-error");
    }
  }

  async function markAttended(id, name) {
    if (noticeAction) noticeAction.disabled = true;
    try {
      const res = await fetch("/api/admin/registrations/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, attended: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update attendance");
      addRecent(name, true);
      resetGuestForm();
      load();
      nameInput?.focus();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : "Error");
    } finally {
      if (noticeAction) noticeAction.disabled = false;
    }
  }

  function chooseSuggestion(i) {
    const person = results[i];
    if (!person) return;
    if (person.registration) {
      // Already on this event's list. Offer the useful next step instead of a second row.
      hideSuggest();
      showNotice(
        `${person.name} is already on this list${person.registration.attended ? " and marked as here" : ""}.`,
        person.registration.attended
          ? null
          : { label: "Mark as attended", run: () => markAttended(person.registration.id, person.name) },
      );
      return;
    }
    pickPerson(person);
  }

  adminForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adminStatus) return;
    hideNotice();
    adminStatus.classList.remove("is-error");
    adminStatus.textContent = "Saving…";
    const fd = new FormData(adminForm);
    try {
      const res = await fetch("/api/admin/registrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: fd.get("event_id"),
          person_id: fd.get("person_id"),
          name: fd.get("name"),
          email: fd.get("email"),
          mobile: fd.get("mobile"),
          attended: fd.has("attended"),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.existing) {
        adminStatus.textContent = "";
        const existing = data.existing;
        showNotice(
          existing.attended ? `${existing.name} is already on this list and marked as here.` : data.error,
          existing.attended ? null : { label: "Mark as attended", run: () => markAttended(existing.id, existing.name) },
        );
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not add registration");
      addRecent(data.name || String(fd.get("name") || ""), Boolean(data.attended));
      resetGuestForm();
      if (eventFilter && fd.get("event_id")) eventFilter.value = String(fd.get("event_id"));
      page = 1;
      load();
      nameInput?.focus();
    } catch (err) {
      adminStatus.classList.add("is-error");
      adminStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  nameInput?.addEventListener("input", () => {
    hideNotice();
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(runSearch, 180);
  });
  nameInput?.addEventListener("keydown", (e) => {
    const open = suggestBox && !suggestBox.hidden && results.length > 0;
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      hideSuggest();
    } else if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      active = (active + step + results.length) % results.length;
      paintActive();
    } else if (open && e.key === "Enter" && active >= 0) {
      e.preventDefault();
      chooseSuggestion(active);
    }
  });
  suggestBox?.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest("[data-i]") : null;
    if (btn) chooseSuggestion(Number(btn.getAttribute("data-i")));
  });
  document.addEventListener("click", (e) => {
    if (!(e.target instanceof Node) || !suggestBox || suggestBox.hidden) return;
    if (!suggestBox.contains(e.target) && e.target !== nameInput) hideSuggest();
  });
  suggestClear?.addEventListener("click", () => {
    clearPersonPick();
    nameInput?.focus();
  });
  hereInput?.addEventListener("change", syncHere);
  eventChange?.addEventListener("click", () => {
    if (eventSelectWrap) eventSelectWrap.hidden = false;
    eventChange.hidden = true;
    eventSelect?.focus();
  });
  eventSelect?.addEventListener("change", () => {
    syncEvent();
    if (!personInput?.value) runSearch();
  });

  // Keep Tab inside the overlay while it is open.
  modal?.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll("button, input, select, summary")].filter(
      (el) => !el.disabled && !el.closest("[hidden]") && el.tabIndex >= 0 && el.offsetParent !== null,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  openBtn?.addEventListener("click", openModal);
  modal?.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  function guestById(id) {
    return rows.find((row) => row.id === id) || null;
  }

  function setEditTab(name) {
    const attendance = name === "attendance";
    if (attendPanel) attendPanel.hidden = !attendance;
    if (editForm) editForm.hidden = attendance;
    tabAttendance?.classList.toggle("is-active", attendance);
    tabDetails?.classList.toggle("is-active", !attendance);
    tabAttendance?.setAttribute("aria-selected", attendance ? "true" : "false");
    tabDetails?.setAttribute("aria-selected", attendance ? "false" : "true");
    tabAttendance?.setAttribute("tabindex", attendance ? "0" : "-1");
    tabDetails?.setAttribute("tabindex", attendance ? "-1" : "0");
  }

  function paintAttendance(attended) {
    editModal?.querySelectorAll("[data-attended]").forEach((btn) => {
      const on = Number(btn.getAttribute("data-attended")) === (attended ? 1 : 0);
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function fillEditForm(guest) {
    if (!editForm) return;
    const eventField = editForm.querySelector('[name="event_id"]');
    const nameField = editForm.querySelector('[name="name"]');
    const emailField = editForm.querySelector('[name="email"]');
    const mobileField = editForm.querySelector('[name="mobile"]');
    const birthField = editForm.querySelector('[name="birth_date"]');
    const joinedField = editForm.querySelector('[name="joined_on"]');
    const carerField = editForm.querySelector('[name="carer_name"]');
    if (eventField) eventField.value = guest.event_id || "";
    if (nameField) nameField.value = guest.name || "";
    if (emailField) emailField.value = guest.email || "";
    if (mobileField) mobileField.value = guest.mobile || "";
    if (birthField) birthField.value = (guest.birth_date || "").slice(0, 10);
    if (joinedField) joinedField.value = (guest.joined_on || "").slice(0, 10);
    if (carerField) carerField.value = guest.carer_name || "";
  }

  function openEdit(id) {
    const guest = guestById(id);
    if (!guest || !editModal) return;
    editingId = guest.id;
    if (editTitle) editTitle.textContent = guest.name;
    if (editContext) {
      editContext.textContent = `${guest.event_title || "Event"} · ${sourceLabel(guest.source)}`;
    }
    if (attendStatus) {
      attendStatus.textContent = "";
      attendStatus.classList.remove("is-error");
    }
    if (editStatus) {
      editStatus.textContent = "";
      editStatus.classList.remove("is-error");
    }
    const dupes = guest.conflicts || [];
    const dupeBanner = document.getElementById("guest-dupe");
    if (dupeBanner) {
      dupeBanner.hidden = !dupes.length;
      if (dupes.length) {
        document.getElementById("guest-dupe-text").textContent = `May be the same person as ${duplicateNames(dupes)}.`;
        document.getElementById("guest-dupe-link").href = `/admin/people?person=${encodeURIComponent(guest.person_id)}`;
      }
    }
    paintAttendance(guest.attended);
    fillEditForm(guest);
    setEditTab("attendance");
    editModal.hidden = false;
    document.body.classList.add("reg-modal-open");
    tabAttendance?.focus();
  }

  // A small, friendly confirmation that fades on its own. Hovering or focusing it pauses the timer.
  let toast = null;
  let toastTimer;
  function hideToast() {
    clearTimeout(toastTimer);
    toast?.remove();
    toast = null;
  }
  function showToast({ message, href, linkLabel }) {
    hideToast();
    toast = document.createElement("div");
    toast.className = "reg-toast";
    toast.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = message;
    toast.append(text);
    if (href) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = linkLabel || "View";
      toast.append(link);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "reg-toast-x";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    close.addEventListener("click", hideToast);
    toast.append(close);
    const arm = () => {
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 8000);
    };
    toast.addEventListener("pointerenter", () => clearTimeout(toastTimer));
    toast.addEventListener("pointerleave", arm);
    toast.addEventListener("focusin", () => clearTimeout(toastTimer));
    toast.addEventListener("focusout", arm);
    document.body.append(toast);
    arm();
  }

  // Removing or moving a registration asks first. Escape is caught before the overlays underneath can close.
  const confirmBox = document.getElementById("guest-confirm");
  function askConfirm({ title, body, confirmLabel = "Remove", danger = true }) {
    return new Promise((resolve) => {
      if (!confirmBox) return resolve(false);
      const ok = document.getElementById("guest-confirm-ok");
      ok.textContent = confirmLabel;
      ok.classList.toggle("btn-danger-solid", danger);
      const cancel = document.getElementById("guest-confirm-cancel");
      document.getElementById("guest-confirm-title").textContent = title;
      document.getElementById("guest-confirm-body").textContent = body;
      const opener = document.activeElement;
      function done(result) {
        confirmBox.hidden = true;
        document.removeEventListener("keydown", onKey, true);
        if (opener instanceof HTMLElement) opener.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          done(false);
        } else if (e.key === "Tab") {
          e.preventDefault();
          (document.activeElement === cancel ? ok : cancel).focus();
        }
      }
      document.addEventListener("keydown", onKey, true);
      confirmBox.querySelectorAll("[data-confirm-cancel]").forEach((btn) => {
        btn.onclick = () => done(false);
      });
      ok.onclick = () => done(true);
      confirmBox.hidden = false;
      // Focus starts on Cancel, so a stray Enter never removes anyone.
      cancel.focus();
    });
  }

  document.getElementById("guest-remove")?.addEventListener("click", async () => {
    const guest = guestById(editingId);
    if (!guest || !attendStatus) return;
    const where = guest.event_title || "this event";
    const ok = await askConfirm({
      title: `Remove ${guest.name} from ${where}?`,
      body: `This deletes the registration${guest.attended ? " and its attendance record" : ""}. ${guest.name} stays in People, and their other registrations aren't affected.`,
    });
    if (!ok) return;
    attendStatus.classList.remove("is-error");
    attendStatus.textContent = "Removing…";
    try {
      const res = await fetch("/api/admin/registrations/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: guest.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove this registration");
      // Removing the last row on a page would leave an empty page behind.
      if (rows.length === 1 && page > 1) page -= 1;
      closeEdit();
      load();
      showToast({
        message: `All set! Only ${guest.name}'s ${where} registration was removed. They're still safe in People.`,
        href: guest.person_id ? `/admin/people?person=${encodeURIComponent(guest.person_id)}` : "",
        linkLabel: "View profile",
      });
    } catch (err) {
      attendStatus.classList.add("is-error");
      attendStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  function closeEdit() {
    if (!editModal) return;
    editModal.hidden = true;
    editingId = "";
    if (modal?.hidden !== false) document.body.classList.remove("reg-modal-open");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (editModal && !editModal.hidden) {
      closeEdit();
      return;
    }
    if (modal && !modal.hidden) closeModal();
  });

  tbody?.addEventListener("click", (e) => {
    const gift = e.target instanceof Element ? e.target.closest("[data-tip-title]") : null;
    if (gift) {
      const touch = e.pointerType === "touch" || e.pointerType === "pen";
      if (touch && tipOwner === gift) hideTip();
      else showTip(gift);
      return;
    }
    const tr = e.target instanceof Element ? e.target.closest("tr[data-id]") : null;
    if (!tr || !tbody.contains(tr)) return;
    openEdit(tr.getAttribute("data-id"));
  });
  tbody?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const tr = e.target instanceof Element ? e.target.closest("tr[data-id]") : null;
    if (!tr || e.target !== tr) return;
    e.preventDefault();
    openEdit(tr.getAttribute("data-id"));
  });

  const giftOf = (e) => (e.target instanceof Element ? e.target.closest("[data-tip-title]") : null);
  tbody?.addEventListener("pointerover", (e) => {
    const gift = e.pointerType === "mouse" ? giftOf(e) : null;
    if (gift) showTip(gift);
  });
  tbody?.addEventListener("pointerout", (e) => {
    const gift = e.pointerType === "mouse" ? giftOf(e) : null;
    if (gift && !gift.contains(e.relatedTarget)) hideTip();
  });
  tbody?.addEventListener("focusin", (e) => {
    const gift = giftOf(e);
    if (gift) showTip(gift);
  });
  tbody?.addEventListener("focusout", (e) => {
    if (giftOf(e)) hideTip();
  });
  document.addEventListener("click", (e) => {
    if (!giftOf(e)) hideTip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });
  window.addEventListener("scroll", hideTip, { passive: true, capture: true });

  tabAttendance?.addEventListener("click", () => setEditTab("attendance"));
  tabDetails?.addEventListener("click", () => setEditTab("details"));
  editModal?.querySelectorAll("[data-close-edit]").forEach((el) => {
    el.addEventListener("click", closeEdit);
  });
  editModal?.querySelectorAll("[data-attended]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!editingId || !attendStatus) return;
      const next = Number(btn.getAttribute("data-attended")) === 1 ? 1 : 0;
      const guest = guestById(editingId);
      if (guest && (guest.attended ? 1 : 0) === next) return;
      attendStatus.classList.remove("is-error");
      attendStatus.textContent = "Saving…";
      try {
        const res = await fetch("/api/admin/registrations/attendance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editingId, attended: next }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not save attendance");
        if (guest) guest.attended = next;
        paintAttendance(next);
        attendStatus.textContent = next ? "Marked attended." : "Marked not yet.";
        load();
      } catch (err) {
        attendStatus.classList.add("is-error");
        attendStatus.textContent = err instanceof Error ? err.message : "Error";
      }
    });
  });

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editStatus || !editingId) return;
    const fd = new FormData(editForm);
    const current = guestById(editingId);
    const targetId = String(fd.get("event_id") || "");
    const moving = Boolean(current && targetId && current.event_id !== targetId);
    let moveTarget = "";
    if (moving) {
      const option = editForm.querySelector('[name="event_id"]')?.selectedOptions[0];
      moveTarget = (option?.textContent || "the selected event").split(" · ")[0];
      const name = String(fd.get("name") || current.name);
      const willReset = Boolean(current.attended && option?.dataset.held && sgDay(option.dataset.held) > sgDay());
      const ok = await askConfirm({
        title: `Move ${name} to ${moveTarget}?`,
        body: `This moves the registration from ${current.event_title || "its current event"} to ${moveTarget}. ${name} stays the same person.${
          willReset
            ? " Attendance will be reset to Not yet, since that event hasn't happened."
            : current.attended
              ? " Attendance moves with it."
              : ""
        }`,
        confirmLabel: "Move",
        danger: false,
      });
      if (!ok) return;
    }
    editStatus.classList.remove("is-error");
    editStatus.textContent = "Saving…";
    try {
      const res = await fetch("/api/admin/registrations/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          event_id: fd.get("event_id"),
          name: fd.get("name"),
          email: fd.get("email"),
          mobile: fd.get("mobile"),
          birth_date: fd.get("birth_date"),
          joined_on: fd.get("joined_on"),
          carer_name: fd.get("carer_name"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update registration");
      const guest = guestById(editingId);
      const name = String(fd.get("name") || "");
      if (json.moved) {
        // The registration now belongs to another event, so this overlay no longer applies.
        closeEdit();
        load();
        showToast({
          message: `Done! ${name} is now registered for ${moveTarget}.${json.attendance_reset ? " Attendance was reset to Not yet." : ""}`,
        });
        return;
      }
      if (editTitle) editTitle.textContent = name;
      if (guest) {
        guest.name = name;
        guest.email = String(fd.get("email") || "");
        guest.mobile = String(fd.get("mobile") || "");
        guest.event_id = String(fd.get("event_id") || "");
      }
      editStatus.textContent = "Details saved.";
      load();
    } catch (err) {
      editStatus.classList.add("is-error");
      editStatus.textContent = err instanceof Error ? err.message : "Error";
    }
  });

  document.querySelectorAll(".th-sort").forEach((btn) => {
    btn.addEventListener("click", () => {
      const col = btn.getAttribute("data-sort") || "name";
      if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortCol = col;
        sortDir = col === "created_at" ? "desc" : "asc";
      }
      page = 1;
      load();
    });
  });

  let timer;
  search?.addEventListener("input", () => {
    if (searchClear) searchClear.hidden = !search.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 1;
      load();
    }, 250);
  });
  searchClear?.addEventListener("click", () => {
    if (!search) return;
    search.value = "";
    searchClear.hidden = true;
    search.focus();
    page = 1;
    load();
  });
  eventFilter?.addEventListener("change", () => {
    page = 1;
    load();
  });
  pageSizeEl?.addEventListener("change", () => {
    pageSize = Number(pageSizeEl.value) || 20;
    page = 1;
    load();
  });
  prev?.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      load();
    }
  });
  next?.addEventListener("click", () => {
    if (page * pageSize < total) {
      page += 1;
      load();
    }
  });

  load();

  const url = new URL(location.href);
  if (url.searchParams.get("add") === "1") {
    url.searchParams.delete("add");
    history.replaceState(null, "", url);
    openModal();
  }
})();
