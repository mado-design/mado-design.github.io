(() => {
  const video = document.querySelector("#logoIntro");
  const logo = document.querySelector(".logo-anchor");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let finished = false;
  let settled = false;
  let fallback;
  let settleTimer;

  function revealCatalog() {
    if (settled) return;
    settled = true;
    clearTimeout(settleTimer);
    document.body.classList.add("logo-settled");
    logo.classList.add("catalog-logo-anchor");
    logo.removeAttribute("aria-disabled");
    logo.removeAttribute("tabindex");
    window.dispatchEvent(new Event("resize"));
  }

  function finishIntro() {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    video.pause();
    document.body.classList.add("svg-active");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (settled) return;
      document.body.classList.add("intro-finished");
      if (reducedMotion.matches) revealCatalog();
      else settleTimer = window.setTimeout(revealCatalog, 1250);
    }));
  }

  function skipIntro(event) {
    if (settled) return;
    if (event.type === "keydown" && (event.key !== "Enter" || event.isComposing)) return;
    // Consume this input before it can activate the logo or a catalog link.
    event.preventDefault();
    event.stopImmediatePropagation();
    // Skip only the video; keep the normal journey to the upper-left corner.
    finishIntro();
  }

  document.addEventListener("click", skipIntro, true);
  document.addEventListener("keydown", skipIntro, true);

  logo.addEventListener("transitionend", (event) => {
    if (finished && event.target === logo && event.propertyName === "width") revealCatalog();
  });
  video.addEventListener("ended", finishIntro, { once: true });
  video.addEventListener("error", finishIntro, { once: true });
  // A stalled or unavailable video must not block access to the portfolio.
  fallback = window.setTimeout(finishIntro, 15000);
  if (reducedMotion.matches) finishIntro();
  else video.play().catch(finishIntro);
})();
