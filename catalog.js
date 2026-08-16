const catalogRows = Array.from(document.querySelectorAll(".catalog-row"));
const catalogList = document.querySelector(".catalog-list");
const logoAnchor = document.querySelector(".logo-anchor");
const previewImages = Array.from(document.querySelectorAll(".catalog-inline-image"));

let logoDragging = false;
let suppressLogoClick = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastPointerClientX = null;
let lastPointerClientY = null;
let listPointerClientX = null;
let listPointerClientY = null;
let mobileLongPressTouch = null;
let suppressNextMobileCatalogClick = false;
let mobileClickSuppressTimer = 0;
const mobileLongPressDelay = 300;

function suppressMobileCatalogClickBriefly() {
  suppressNextMobileCatalogClick = true;
  window.clearTimeout(mobileClickSuppressTimer);
  mobileClickSuppressTimer = window.setTimeout(() => {
    suppressNextMobileCatalogClick = false;
  }, 500);
}

function getActiveRow() {
  return catalogRows.find((row) => row.classList.contains("is-active")) || null;
}

function getRowPointerBounds(row, toleranceY = 0) {
  const rowRect = row.getBoundingClientRect();
  const title = row.querySelector(".catalog-item");
  const titleRect = title?.getBoundingClientRect();
  const previewSlot = row.querySelector(".catalog-preview-slot");
  const previewRect = previewSlot?.getBoundingClientRect();

  return {
    top: (previewRect?.top ?? rowRect.top) - toleranceY,
    bottom: (titleRect?.bottom ?? rowRect.bottom) + toleranceY,
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
  const isMobileCatalog = window.matchMedia("(max-width: 700px)").matches;

  catalogRows.forEach((row) => {
    const previewFrame = row.querySelector(".catalog-preview-frame");
    const previewImage = row.querySelector(".catalog-inline-image");

    if (!previewFrame || !previewImage) {
      return;
    }

    const frameStyle = getComputedStyle(previewFrame);
    const gapTop = parseFloat(frameStyle.paddingTop) || 0;
    const gapBottom = parseFloat(frameStyle.paddingBottom) || 0;
    const frameRect = previewFrame.getBoundingClientRect();
    const naturalWidth = previewImage.naturalWidth || previewImage.width || 1;
    const naturalHeight = previewImage.naturalHeight || previewImage.height || 1;
    const aspectRatio = naturalWidth / naturalHeight;
    const widthScale = isMobileCatalog
      ? 1
      : previewImage.classList.contains("catalog-inline-image--silver-width")
        ? 0.65
        : previewImage.classList.contains("catalog-inline-image--oto-width")
          ? 0.433333
          : previewImage.classList.contains("catalog-inline-image--ammo-size")
            ? 0.75
            : previewImage.classList.contains("catalog-inline-image--underground-size")
              ? 0.666667
              : previewImage.classList.contains("catalog-inline-image--lenfun-size")
                ? 0.75
                : 1;
    const maxWidth = Math.min(frameRect.width || Infinity, window.innerWidth * 0.46, 720) * widthScale;
    const maxHeight = isMobileCatalog
      ? Infinity
      : previewImage.classList.contains("catalog-inline-image--small")
        ? 399 * 0.666667
        : 399;
    const widthLimitedHeight = maxWidth / aspectRatio;
    const imageHeight = Math.min(maxHeight, widthLimitedHeight);
    const openSpace = imageHeight + gapTop + gapBottom;

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
    catalogList.style.setProperty(
      "--active-row-growth",
      `calc(${activeOpenSpace} - var(--catalog-title-row-height))`
    );
  }

  catalogRows.forEach((row, index) => {
    row.classList.toggle("is-active", row === activeRow);
    row.classList.toggle("is-before-active", activeIndex > -1 && index < activeIndex);
  });

}

function clearActiveRows() {
  if (catalogList) {
    catalogList.style.removeProperty("--active-row-open-space");
    catalogList.style.removeProperty("--active-row-growth");
  }

  catalogRows.forEach((row) => {
    row.classList.remove("is-active");
    row.classList.remove("is-before-active");
  });
}

function getRowFromPointer(clientY) {
  const activeRow = getActiveRow();
  const tolerance = 14;

  const titleRow = catalogRows.find((row) => {
    const title = row.querySelector(".catalog-item");
    const titleRect = title?.getBoundingClientRect();

    return titleRect && clientY >= titleRect.top - tolerance && clientY <= titleRect.bottom + tolerance;
  });

  if (titleRow) {
    return titleRow;
  }

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

function setAdjacentRowFromPointer(row) {
  const activeRow = getActiveRow();

  if (!row) {
    return;
  }

  if (!activeRow) {
    setActiveRow(row);
    return;
  }

  if (row === activeRow) {
    return;
  }

  const activeIndex = catalogRows.indexOf(activeRow);
  const nextIndex = catalogRows.indexOf(row);

  if (Math.abs(nextIndex - activeIndex) === 1) {
    setActiveRow(row);
  }
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
  catalogList.addEventListener(
    "click",
    (event) => {
      if (!window.matchMedia("(max-width: 700px)").matches) {
        return;
      }

      const row = event.target.closest(".catalog-row");
      if (!row || !catalogList.contains(row)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (suppressNextMobileCatalogClick) {
        suppressNextMobileCatalogClick = false;
        window.clearTimeout(mobileClickSuppressTimer);
        return;
      }

      const link = row.querySelector(".catalog-item, .catalog-preview-link");

      if (row.classList.contains("is-active")) {
        if (link?.href) {
          window.open(link.href, "_blank", "noopener,noreferrer");
        }
      } else {
        setActiveRow(row);
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    true
  );

  catalogList.addEventListener("pointerenter", (event) => {
    listPointerClientX = event.clientX;
    listPointerClientY = event.clientY;
  });

  catalogList.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    listPointerClientX = event.clientX;
    listPointerClientY = event.clientY;
    lastPointerClientX = event.clientX;
    lastPointerClientY = event.clientY;

    const row = getRowFromPointer(event.clientY);
    if (!row) {
      return;
    }

    setAdjacentRowFromPointer(row);
  });

  catalogList.addEventListener("touchstart", (event) => {
    if (!window.matchMedia("(max-width: 700px)").matches || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const row = getRowFromPointer(touch.clientY);
    const identifier = touch.identifier;

    const timer = window.setTimeout(() => {
      if (
        !mobileLongPressTouch ||
        mobileLongPressTouch.identifier !== identifier ||
        mobileLongPressTouch.moved
      ) {
        return;
      }

      mobileLongPressTouch.isLongPress = true;
      if (row) {
        setActiveRow(row);
      }
    }, mobileLongPressDelay);

    mobileLongPressTouch = {
      identifier,
      timer,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
      isLongPress: false,
    };
  }, { passive: true });

  catalogList.addEventListener("touchmove", (event) => {
    if (!mobileLongPressTouch) {
      return;
    }

    const touch = Array.from(event.touches).find(
      (item) => item.identifier === mobileLongPressTouch.identifier
    );

    if (!touch) {
      return;
    }

    if (!mobileLongPressTouch.isLongPress) {
      const movedX = Math.abs(touch.clientX - mobileLongPressTouch.startX);
      const movedY = Math.abs(touch.clientY - mobileLongPressTouch.startY);

      if (Math.max(movedX, movedY) >= 8) {
        mobileLongPressTouch.moved = true;
        window.clearTimeout(mobileLongPressTouch.timer);
        suppressMobileCatalogClickBriefly();
      }
      return;
    }

    event.preventDefault();
    const row = getRowFromPointer(touch.clientY);
    if (row) {
      setActiveRow(row);
    }
  }, { passive: false });

  ["touchend", "touchcancel"].forEach((eventName) => {
    catalogList.addEventListener(eventName, () => {
      if (!mobileLongPressTouch) {
        return;
      }

      window.clearTimeout(mobileLongPressTouch.timer);
      if (mobileLongPressTouch.isLongPress) {
        suppressMobileCatalogClickBriefly();
      } else if (mobileLongPressTouch.moved) {
        suppressMobileCatalogClickBriefly();
      }
      mobileLongPressTouch = null;
    });
  });

  catalogList.addEventListener("mouseleave", () => {
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
  if (window.matchMedia("(max-width: 700px)").matches) {
    return;
  }

  lastPointerClientX = event.clientX;
  lastPointerClientY = event.clientY;

  const hoveredRow = getRowFromPointer(event.clientY);

  if (hoveredRow) {
    setAdjacentRowFromPointer(hoveredRow);
    return;
  }

  if (!catalogList || !getActiveRow()) {
    return;
  }

  if (isPointerNearActiveRow(event.clientX, event.clientY)) {
    return;
  }

  clearActiveRows();
});

function updateLogoState() {
  document.body.classList.toggle("nav-logo-active", logoDragging);
}

window.addEventListener("resize", () => {
  syncPreviewMetrics();
  syncActiveRowFromPointer();
});
window.addEventListener("scroll", syncActiveRowFromPointer, { passive: true });

if (logoAnchor) {
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
  });

  logoAnchor.addEventListener("pointerup", (event) => {
    if (!logoDragging) {
      return;
    }

    logoDragging = false;
    document.body.classList.remove("logo-dragging");
    logoAnchor.releasePointerCapture(event.pointerId);
    updateLogoState();
  });

  logoAnchor.addEventListener("pointercancel", () => {
    logoDragging = false;
    document.body.classList.remove("logo-dragging");
    updateLogoState();
  });
}

preparePreviewImages();
syncPreviewMetrics();

document.querySelectorAll(".catalog-item[target='_blank'], .catalog-preview-link[target='_blank']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    clearActiveRows();
    window.open(link.href, "_blank", "noopener,noreferrer");
  });
});
