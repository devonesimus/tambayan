// Adds a "Read more" toggle to the hero announcement, but only when it's actually clamped —
// so a short announcement never gets a button that does nothing.
(() => {
  const p = document.querySelector(".hero-announcement");
  if (!p) return;
  if (p.scrollHeight <= p.clientHeight + 1) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hero-readmore";
  btn.textContent = "Read more";
  btn.setAttribute("aria-expanded", "false");
  p.insertAdjacentElement("afterend", btn);

  btn.addEventListener("click", () => {
    const expanded = p.classList.toggle("is-expanded");
    btn.setAttribute("aria-expanded", String(expanded));
    btn.textContent = expanded ? "Read less" : "Read more";
  });
})();
