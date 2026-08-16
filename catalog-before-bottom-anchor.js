const catalogRows = Array.from(document.querySelectorAll(".catalog-row"));
const catalogList = document.querySelector(".catalog-list");
const logoAnchor = document.querySelector(".logo-anchor");
const mainNav = document.querySelector(".main-nav");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const previewImages = Array.from(document.querySelectorAll(".catalog-inline-image"));
const firstCatalogItemLink = document.querySelector('.catalog-item[href="project-01.html"]');
const firstCatalogPreviewLink = document.querySelector('.catalog-preview-link[href="project-01.html"]');
const navRevealHits = new Set();

const navColorClasses = ["variant-0", "variant-1", "variant-2", "variant-3"];
const logoWindowMetrics = {
  left: 0.19394,
  top: 0.21778,
  width: 0.61212,
  height: 0.56443,
};

let logoDragging = false;
let suppressLogoClick = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastPointerClientX = null;
let lastPointerClientY = null;
let rowStepArmed = false;
let hoverPrimed = false;
let hoverReadyAfterPrime = false;
let listPointerClientX = null;
let listPointerClientY = null;

function applyRandomNavVariant(item) {
  const currentIndex = navColorClasses.findIndex((className) => item.classList.contains(className));
  let nextIndex = Math.floor(Math.random() * navColorClasses.length);

  if (navColorClasses.length > 1 && nextIndex === currentIndex) {
    nextIndex = (nextIndex + 1) % navColorClasses.length;
  }

  item.classList.remove(...navColorClasses);
  item.classList.add(navColorClasses[nextIndex]);
}

function getActiveRow() {
  return catalogRows.find((row) => row.classList.contains("is-active")) || null;
}

function getRowPointerBounds(row, toleranceY = 0) {
  const rowRect = row.getBoundingClientRect();
  const rowIndex = catalogRows.indexOf(row);

  if (rowIndex !== 0) {
    return {
      top: rowRect.top - toleranceY,
      bottom: rowRect.bottom + toleranceY,
    };
  }

  const title = row.querySelector(".catalog-item");
  const titleRect = title?.getBoundingClientRect();
  const titleHeight = titleRect?.height || 0;
  const reducedTop = (titleRect?.top ?? rowRect.top) - Math.min(toleranceY * 0.35, titleHeight * 0.12);

  return {
    top: reducedTop,
    bottom: rowRect.bottom + toleranceY,
  };
}

function isPointerNearActiveRow(clientX, clientY) {
  const activeRow = getActiveRow();

  if (!activeRow) {
    return false;
  }

  const rect = activeRow.getBoundingClientRect();
  const toleranceX = 24;
  const toleranceY = 24;
  const bounds = getRowPointerBounds(activeRow, toleranceY);

  return (
    clientX >= rect.left - toleranceX &&
    clientX <= rect.right + toleranceX &&
    clientY >= bounds.top &&
    clientY <= bounds.bottom
  );
}

function getContentBounds(image) {
  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;
  const sampleMax = 1200;
  const scale = Math.min(1, sampleMax / Math.max(naturalWidth, naturalHeight));
  const sampleWidth = Math.max(1, Math.round(naturalWidth * scale));
  const sampleHeight = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  }

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / 3;
      const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const isVisible = alpha > 16;
      const isNearWhite = brightness > 236 && colorSpread < 28;

      if (!isVisible || isNearWhite) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
  }

  const padding = 0.01;
  const padX = Math.round((maxX - minX + 1) * padding);
  const padY = Math.round((maxY - minY + 1) * padding);
  const boundedMinX = Math.max(0, minX - padX);
  const boundedMinY = Math.max(0, minY - padY);
  const boundedMaxX = Math.min(sampleWidth - 1, maxX + padX);
  const boundedMaxY = Math.min(sampleHeight - 1, maxY + padY);

  return {
    x: (boundedMinX / sampleWidth) * naturalWidth,
    y: (boundedMinY / sampleHeight) * naturalHeight,
    width: ((boundedMaxX - boundedMinX + 1) / sampleWidth) * naturalWidth,
    height: ((boundedMaxY - boundedMinY + 1) / sampleHeight) * naturalHeight,
  };
}

function trimPreviewSource(image) {
  if (image.dataset.trimmed === "true") {
    return;
  }

  const naturalWidth = image.naturalWidth || 1;
  const naturalHeight = image.naturalHeight || 1;
  const bounds = getContentBounds(image);
  const sampleMax = 1400;
  const scale = Math.min(1, sampleMax / Math.max(naturalWidth, naturalHeight));
  const drawWidth = Math.max(1, Math.round(naturalWidth * scale));
  const drawHeight = Math.max(1, Math.round(naturalHeight * scale));
  const cropWidth = Math.max(1, Math.round(bounds.width * scale));
  const cropHeight = Math.max(1, Math.round(bounds.height * scale));
  const offsetX = Math.max(0, Math.round(bounds.x * scale));
  const offsetY = Math.max(0, Math.round(bounds.y * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    image.dataset.trimmed = "true";
    return;
  }

  canvas.width = drawWidth;
  canvas.height = drawHeight;
  context.drawImage(image, 0, 0, drawWidth, drawHeight);

  const cropped = document.createElement("canvas");
  const croppedContext = cropped.getContext("2d");

  if (!croppedContext) {
    image.dataset.trimmed = "true";
    return;
  }

  cropped.width = cropWidth;
  cropped.height = cropHeight;
  croppedContext.drawImage(
    canvas,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  image.dataset.trimmed = "true";
  image.dataset.originalSrc = image.currentSrc || image.src;
  image.src = cropped.toDataURL("image/png");
}

function preparePreviewImages() {
  previewImages.forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      syncPreviewMetrics();
      return;
    }

    image.addEventListener(
      "load",
      () => {
        syncPreviewMetrics();
      },
      { once: true }
    );
  });
}

function syncPreviewMetrics() {
  catalogRows.forEach((row) => {
    const previewFrame = row.querySelector(".catalog-preview-frame");
    const previewImage = row.querySelector(".catalog-inline-image");

    if (!previewFrame || !previewImage) {
      return;
    }

    const frameStyle = getComputedStyle(previewFrame);
    const gapTop = parseFloat(frameStyle.paddingTop) || 0;
    const frameRect = previewFrame.getBoundingClientRect();
    const naturalWidth = previewImage.naturalWidth || previewImage.width || 1;
    const naturalHeight = previewImage.naturalHeight || previewImage.height || 1;
    const aspectRatio = naturalWidth / naturalHeight;
    const maxWidth = Math.min(frameRect.width || Infinity, window.innerWidth * 0.46, 720);
    const maxHeight = 399;
    const widthLimitedHeight = maxWidth / aspectRatio;
    const imageHeight = Math.min(maxHeight, widthLimitedHeight);
    const openSpace = imageHeight + gapTop;

    if (openSpace > 0) {
      row.style.setProperty("--row-open-space", `${openSpace.toFixed(1)}px`);
    }
  });
}

function setActiveRow(activeRow) {
  const activeIndex = catalogRows.indexOf(activeRow);
  const activeOpenSpace =
    getComputedStyle(activeRow).getPropertyValue("--row-open-space").trim() ||
    getComputedStyle(document.documentElement).getPropertyValue("--catalog-open-space").trim();

  if (catalogList) {
    catalogList.style.setProperty("--active-row-open-space", activeOpenSpace);
  }

  catalogRows.forEach((row, index) => {
    row.classList.toggle("is-active", row === activeRow);
    row.classList.toggle("is-before-active", activeIndex > -1 && index < activeIndex);
  });
}

function clearActiveRows() {
  if (catalogList) {
    catalogList.style.removeProperty("--active-row-open-space");
  }

  rowStepArmed = false;
  hoverReadyAfterPrime = false;

  catalogRows.forEach((row) => {
    row.classList.remove("is-active");
    row.classList.remove("is-before-active");
  });
}

function getRowFromPointer(clientY) {
  const activeRow = getActiveRow();
  const tolerance = 14;

  if (activeRow) {
    const activeBounds = getRowPointerBounds(activeRow, tolerance);

    if (clientY >= activeBounds.top && clientY <= activeBounds.bottom) {
      return activeRow;
    }
  }

  return (
    catalogRows.find((row) => {
      const rect = row.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    }) || null
  );
}

function syncActiveRowFromPointer() {
  if (!catalogList || lastPointerClientX === null || lastPointerClientY === null) {
    return;
  }

  const listRect = catalogList.getBoundingClientRect();
  const withinListBounds =
    lastPointerClientX >= listRect.left &&
    lastPointerClientX <= listRect.right &&
    lastPointerClientY >= listRect.top &&
    lastPointerClientY <= listRect.bottom;

  if (!withinListBounds) {
    clearActiveRows();
    return;
  }

  const row = getRowFromPointer(lastPointerClientY);

  if (row) {
    setActiveRow(row);
  }
}

catalogRows.forEach((row) => {
  row.addEventListener("focusin", () => {
    setActiveRow(row);
  });

  row.addEventListener("focusout", (event) => {
    if (!row.contains(event.relatedTarget)) {
      clearActiveRows();
    }
  });
});

if (catalogList) {
  catalogList.addEventListener("pointerenter", (event) => {
    hoverPrimed = false;
    hoverReadyAfterPrime = false;
    listPointerClientX = event.clientX;
    listPointerClientY = event.clientY;
  });

  catalogList.addEventListener("pointermove", (event) => {
    if (!hoverPrimed) {
      if (listPointerClientX === null || listPointerClientY === null) {
        listPointerClientX = event.clientX;
        listPointerClientY = event.clientY;
        lastPointerClientX = event.clientX;
        lastPointerClientY = event.clientY;
        return;
      }

      const movement = Math.hypot(
        event.clientX - listPointerClientX,
        event.clientY - listPointerClientY
      );

      if (movement > 4) {
        hoverPrimed = true;
        hoverReadyAfterPrime = false;
        listPointerClientX = event.clientX;
        listPointerClientY = event.clientY;
        lastPointerClientX = event.clientX;
        lastPointerClientY = event.clientY;
        return;
      }

      lastPointerClientX = event.clientX;
      lastPointerClientY = event.clientY;
      return;
    }

    listPointerClientX = event.clientX;
    listPointerClientY = event.clientY;
    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;

    if (!hoverReadyAfterPrime) {
      hoverReadyAfterPrime = true;
      return;
    }

    const row = getRowFromPointer(event.clientY);
    const activeRow = getActiveRow();

    if (!row) {
      return;
    }

    if (!activeRow) {
      setActiveRow(row);
      rowStepArmed = true;
      return;
    }

    if (row === activeRow) {
      rowStepArmed = true;
      return;
    }

    const activeIndex = catalogRows.indexOf(activeRow);
    const nextIndex = catalogRows.indexOf(row);
    const isAdjacent = Math.abs(nextIndex - activeIndex) === 1;

    if (rowStepArmed && isAdjacent) {
      setActiveRow(row);
      rowStepArmed = false;
    }
  });

  catalogList.addEventListener("mouseleave", () => {
    hoverPrimed = false;
    hoverReadyAfterPrime = false;
    listPointerClientX = null;
    listPointerClientY = null;
    if (!isPointerNearActiveRow(lastPointerClientX ?? -Infinity, lastPointerClientY ?? -Infinity)) {
      lastPointerClientX = null;
      lastPointerClientY = null;
      clearActiveRows();
    }
  });
}

document.addEventListener("mousemove", (event) => {
  lastPointerClientX = event.clientX;
  lastPointerClientY = event.clientY;

  if (!catalogList || !getActiveRow()) {
    return;
  }

  const listRect = catalogList.getBoundingClientRect();
  const insideList =
    event.clientX >= listRect.left &&
    event.clientX <= listRect.right &&
    event.clientY >= listRect.top &&
    event.clientY <= listRect.bottom;

  if (insideList || isPointerNearActiveRow(event.clientX, event.clientY)) {
    return;
  }

  clearActiveRows();
});

function getLogoHitRect() {
  const rect = logoAnchor.getBoundingClientRect();

  return {
    left: rect.left + rect.width * 0.194,
    top: rect.top + rect.height * 0.218,
    right: rect.left + rect.width * 0.806,
    bottom: rect.top + rect.height * 0.782,
  };
}

function getLogoWindowRect() {
  const rect = logoAnchor.getBoundingClientRect();
  const left = rect.left + rect.width * logoWindowMetrics.left;
  const top = rect.top + rect.height * logoWindowMetrics.top;
  const width = rect.width * logoWindowMetrics.width;
  const height = rect.height * logoWindowMetrics.height;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function hideNavReveal() {
  if (!mainNav) {
    return;
  }

  navItems.forEach((item) => {
    item.classList.remove("is-logo-hit");
    item.style.removeProperty("--window-left");
    item.style.removeProperty("--window-top");
    item.style.removeProperty("--window-width");
    item.style.removeProperty("--window-height");
  });
  navRevealHits.clear();
}

function updateLogoState() {
  document.body.classList.toggle("nav-logo-active", logoDragging);
}

function updateNavReveal() {
  if (!logoAnchor || !mainNav) {
    return;
  }

  const logoRect = getLogoWindowRect();
  const navRect = mainNav.getBoundingClientRect();
  const revealLeft = Math.max(logoRect.left, navRect.left);
  const revealTop = Math.max(logoRect.top, navRect.top);
  const revealRight = Math.min(logoRect.right, navRect.right);
  const revealBottom = Math.min(logoRect.bottom, navRect.bottom);

  if (revealLeft >= revealRight || revealTop >= revealBottom) {
    hideNavReveal();
    return;
  }

  navItems.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const overlaps =
      logoRect.right > itemRect.left &&
      logoRect.left < itemRect.right &&
      logoRect.bottom > itemRect.top &&
      logoRect.top < itemRect.bottom;

    if (overlaps && !navRevealHits.has(item)) {
      applyRandomNavVariant(item);
      item.classList.add("is-logo-hit");
      navRevealHits.add(item);
    }

    if (!overlaps && navRevealHits.has(item)) {
      item.classList.remove("is-logo-hit");
      navRevealHits.delete(item);
    }

    if (overlaps) {
      item.style.setProperty("--window-left", `${logoRect.left - itemRect.left}px`);
      item.style.setProperty("--window-top", `${logoRect.top - itemRect.top}px`);
      item.style.setProperty("--window-width", `${logoRect.width}px`);
      item.style.setProperty("--window-height", `${logoRect.height}px`);
      return;
    }

    item.style.removeProperty("--window-left");
    item.style.removeProperty("--window-top");
    item.style.removeProperty("--window-width");
    item.style.removeProperty("--window-height");
  });
}

if (logoAnchor && mainNav && navItems.length > 0) {
  navItems.forEach((item) => {
    item.classList.add("variant-0");
    item.addEventListener("click", (event) => {
      const miniLabel = item.querySelector(".nav-label-mini");
      const miniRect = miniLabel?.getBoundingClientRect();
      const clickedMini =
        miniRect &&
        event.clientX >= miniRect.left &&
        event.clientX <= miniRect.right &&
        event.clientY >= miniRect.top &&
        event.clientY <= miniRect.bottom;

      if (!item.classList.contains("is-logo-hit") || !clickedMini) {
        event.preventDefault();
      }
    });
  });

  hideNavReveal();
  updateNavReveal();

  window.addEventListener("resize", () => {
    updateNavReveal();
    syncPreviewMetrics();
    syncActiveRowFromPointer();
  });
  window.addEventListener(
    "scroll",
    () => {
      updateNavReveal();
      syncActiveRowFromPointer();
    },
    { passive: true }
  );

  logoAnchor.addEventListener("click", (event) => {
    if (!suppressLogoClick) {
      return;
    }

    event.preventDefault();
    suppressLogoClick = false;
  });

  logoAnchor.addEventListener("pointerdown", (event) => {
    const rect = logoAnchor.getBoundingClientRect();

    logoDragging = true;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    document.body.classList.add("logo-dragging");
    logoAnchor.setPointerCapture(event.pointerId);
    updateLogoState();
    updateNavReveal();
    event.preventDefault();
  });

  logoAnchor.addEventListener("pointermove", (event) => {
    if (!logoDragging) {
      return;
    }

    const maxLeft = window.innerWidth - logoAnchor.offsetWidth;
    const maxTop = window.innerHeight - logoAnchor.offsetHeight;
    const nextLeft = Math.min(Math.max(event.clientX - dragOffsetX, 0), maxLeft);
    const nextTop = Math.min(Math.max(event.clientY - dragOffsetY, 0), maxTop);

    logoAnchor.style.left = `${nextLeft}px`;
    logoAnchor.style.top = `${nextTop}px`;
    logoAnchor.style.transform = "translate(0, 0)";
    suppressLogoClick = true;
    updateNavReveal();
  });

  logoAnchor.addEventListener("pointerup", (event) => {
    if (!logoDragging) {
      return;
    }

    logoDragging = false;
    document.body.classList.remove("logo-dragging");
    logoAnchor.releasePointerCapture(event.pointerId);
    updateLogoState();
    updateNavReveal();
  });

  logoAnchor.addEventListener("pointercancel", () => {
    logoDragging = false;
    document.body.classList.remove("logo-dragging");
    updateLogoState();
    updateNavReveal();
  });
}

preparePreviewImages();
syncPreviewMetrics();

[firstCatalogItemLink, firstCatalogPreviewLink].forEach((link) => {
  if (!link) {
    return;
  }

  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.open(link.href, "_blank", "noopener,noreferrer");
  });
});
