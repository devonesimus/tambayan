(() => {
  const player = document.getElementById("shorts-player");
  const titleEl = document.getElementById("shorts-title");
  const list = document.getElementById("video-list");
  if (!player || !list) return;

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button.video-item");
    if (!btn) return;
    const embed = btn.getAttribute("data-embed");
    const title = btn.getAttribute("data-title") || "";
    if (!embed) return;
    player.setAttribute("src", embed);
    if (titleEl) titleEl.textContent = title;
    list.querySelectorAll(".video-item").forEach((el) => el.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
})();
