(() => {
  const logo = document.querySelector(".project-logo-shell");
  if (!logo) return;

  const nav = document.createElement("nav");
  nav.className = "project-hidden-nav";
  nav.setAttribute("aria-label", "页面导航");
  nav.innerHTML = `
    <a class="project-hidden-nav-link" href="index.html">
      <span class="project-hidden-nav-label project-hidden-nav-label-base">主页</span>
      <span class="project-hidden-nav-label project-hidden-nav-label-invert">主页</span>
      <span class="project-hidden-nav-label project-hidden-nav-label-window">主页</span>
    </a>
    <a class="project-hidden-nav-link" href="catalog.html">
      <span class="project-hidden-nav-label project-hidden-nav-label-base">实践</span>
      <span class="project-hidden-nav-label project-hidden-nav-label-invert">实践</span>
      <span class="project-hidden-nav-label project-hidden-nav-label-window">实践</span>
    </a>
    <span class="project-hidden-nav-link is-disabled" hidden>自述</span>
    <span class="project-hidden-nav-link is-disabled" hidden>聊天</span>
  `;
  document.body.append(nav);

  const links = [...nav.querySelectorAll(".project-hidden-nav-link")];
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  const descriptionCopy = document.querySelector(".project-description-copy");
  const revealThreshold = 8;

  function setLinkInteractive(link, interactive) {
    if (!(link instanceof HTMLAnchorElement)) return;

    link.tabIndex = interactive ? 0 : -1;
    link.setAttribute("aria-hidden", interactive ? "false" : "true");
    link.setAttribute("aria-disabled", interactive ? "false" : "true");
  }

  function resetLink(link) {
    link.classList.remove("is-logo-hit");
    setLinkInteractive(link, false);
    link.style.removeProperty("--project-nav-mask-left");
    link.style.removeProperty("--project-nav-mask-top");
    link.style.removeProperty("--project-nav-mask-width");
    link.style.removeProperty("--project-nav-mask-height");
  }

  function getLogoVisualBox() {
    const shellBox = logo.getBoundingClientRect();

    // These values match the solid logo placed inside .project-logo-shell.
    return {
      left: shellBox.left + (shellBox.width * 0.19394),
      top: shellBox.top + (shellBox.height * 0.21778),
      width: shellBox.width * 0.61212,
      height: shellBox.height * 0.56443,
    };
  }

  function anchorNavToInitialLogo() {
    if (!mobileQuery.matches || nav.dataset.isAnchored) return;

    const logoBox = getLogoVisualBox();
    nav.style.left = `${logoBox.left + (logoBox.width / 2)}px`;
    nav.style.top = `${logoBox.top + logoBox.height}px`;
    nav.dataset.isAnchored = "true";
  }

  function updateReveal() {
    if (!mobileQuery.matches) {
      links.forEach(resetLink);
      return;
    }

    const logoBox = getLogoVisualBox();
    logoBox.right = logoBox.left + logoBox.width;
    logoBox.bottom = logoBox.top + logoBox.height;

    const candidates = links.map((link) => {
      const linkBox = link.getBoundingClientRect();
      const left = Math.max(logoBox.left, linkBox.left);
      const top = Math.max(logoBox.top, linkBox.top);
      const right = Math.min(logoBox.right, linkBox.right);
      const bottom = Math.min(logoBox.bottom, linkBox.bottom);
      return {
        link,
        linkBox,
        overlapWidth: Math.max(0, right - left),
        overlapHeight: Math.max(0, bottom - top),
      };
    });

    candidates.forEach(({ link, linkBox, overlapWidth, overlapHeight }) => {
      // A hairline intersection is not enough to make a hidden label actionable.
      if (overlapWidth < revealThreshold || overlapHeight < revealThreshold) {
        resetLink(link);
        return;
      }

      link.classList.add("is-logo-hit");
      setLinkInteractive(link, true);

      // The SVG is the filled logo silhouette, so the reveal follows the
      // actual visible logo shape instead of the square used to drag it.
      link.style.setProperty("--project-nav-mask-left", `${logoBox.left - linkBox.left}px`);
      link.style.setProperty("--project-nav-mask-top", `${logoBox.top - linkBox.top}px`);
      link.style.setProperty("--project-nav-mask-width", `${logoBox.width}px`);
      link.style.setProperty("--project-nav-mask-height", `${logoBox.height}px`);
    });
  }

  // A hidden link must never navigate before the logo has revealed it.
  links.forEach((link) => {
    setLinkInteractive(link, false);
    link.addEventListener("click", (event) => {
      if (!link.classList.contains("is-logo-hit")) event.preventDefault();
    });
  });

  function updateDescriptionClearance() {
    if (!descriptionCopy) return;

    if (!mobileQuery.matches) {
      descriptionCopy.style.removeProperty("--project-copy-width");
      return;
    }

    // Measure from the normal full-width state before deciding whether the
    // logo is actually occupying the text's vertical lane.
    descriptionCopy.style.removeProperty("--project-copy-width");
    const copyBox = descriptionCopy.getBoundingClientRect();
    const logoBox = getLogoVisualBox();
    const fullWidth = Math.max(0, window.innerWidth - (copyBox.left * 2));
    const logoBottom = logoBox.top + logoBox.height;
    const overlapsCopyHeight = logoBox.top < copyBox.bottom && logoBottom > copyBox.top;

    if (!overlapsCopyHeight || logoBox.left <= copyBox.left + 48) {
      descriptionCopy.style.setProperty("--project-copy-width", `${fullWidth}px`);
      return;
    }

    // Keep a small clear channel between the copy and the logo's visible edge.
    const clearWidth = Math.max(0, logoBox.left - copyBox.left - 12);
    descriptionCopy.style.setProperty(
      "--project-copy-width",
      `${Math.min(fullWidth, clearWidth)}px`,
    );
  }

  const scheduleUpdate = () => requestAnimationFrame(() => {
    updateReveal();
    updateDescriptionClearance();
  });
  ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((eventName) => {
    logo.addEventListener(eventName, scheduleUpdate);
  });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", scheduleUpdate);
  } else {
    mobileQuery.addListener(scheduleUpdate);
  }

  // The logo enters from the left. Anchor the fixed navigation only after it
  // reaches its final position on the right, not during that entrance motion.
  const finishNavAnchor = () => {
    anchorNavToInitialLogo();
    updateReveal();
    updateDescriptionClearance();
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    requestAnimationFrame(finishNavAnchor);
  } else {
    logo.addEventListener("animationend", finishNavAnchor, { once: true });
    window.setTimeout(finishNavAnchor, 1250);
  }
})();
