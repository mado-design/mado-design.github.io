const logoIntro = document.querySelector("#logoIntro");
const logoAnchor = document.querySelector(".logo-anchor");
const mainNav = document.querySelector(".main-nav");
const groundLine = document.querySelector(".ground-line");
const windowWorld = document.querySelector(".window-world");
const windowTransition = document.querySelector(".window-transition");
const sliceBoard = document.querySelector(".slice-board");
const navItems = document.querySelectorAll(".nav-item");
const sliceNavInvertLayer = mainNav && logoAnchor ? document.createElement("div") : null;

if (sliceNavInvertLayer) {
  sliceNavInvertLayer.className = "slice-nav-invert-layer";
  sliceNavInvertLayer.setAttribute("aria-hidden", "true");
  document.body.append(sliceNavInvertLayer);
}

function getUsableViewportHeight() {
  if (window.matchMedia("(max-width: 640px)").matches && window.visualViewport) {
    return window.visualViewport.height;
  }

  return window.innerHeight;
}

navItems.forEach((item) => {
  item.dataset.initialHref = item.getAttribute("href") || "#home";
});
let introFinished = false;
let logoSettled = false;
let navEscaping = false;
let logoHovering = false;
let logoDragging = false;
let logoJumping = false;
let suppressLogoClick = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragVelocityX = 0;
let dragVelocityY = 0;
let lastDragX = 0;
let lastDragY = 0;
let lastDragTime = 0;
const activeFlyingNavs = new Set();
let logoX = 0;
let logoBaseY = 0;
let jumpOffset = 0;
let jumpVelocity = 0;
let keyboardLoopRunning = false;
let previousKeyboardTop = 0;
let previousLogoHitTop = 0;
let groundActive = false;
let groundVisible = false;
let windowOpened = false;
let windowClosing = false;
const hitNavItems = new Set();
const sliceNavRevealHits = new Set();
const fallenNavs = [];
const miniNavs = new Map();
const miniNavVariants = new Map();
const bumpedMiniNavs = new Set();
const heldKeys = new Set();
const navCollisionInsetX = 0.08;
const navCollisionInsetY = 0.14;
const sliceSizeSteps = [190, 290, 410, 540];
const maxSliceWidthRatio = 1 / 3;
const maxSliceHeightRatio = 1 / 2;
let topSliceLayer = 400;
let activeSlice = null;
let mobileGyroscopeActive = false;
let mobileGyroscopePermissionPending = false;
let mobileSlicePhysicsFrame = 0;
let mobileGravityX = 0;
let mobileGravityY = 0.3;
let mobileGravityTargetX = 0;
let mobileGravityTargetY = 0.3;
let mobileLastShake = 0;
let mobileSensorListenersAttached = false;
let mobileMotionGravityAvailable = false;
const mobileSliceStates = new Map();
const sliceOverrides = {
  "slices/Snipaste_2026-08-08_19-09-50.jpg": {
    className: "is-featured",
    left: 39,
    top: 18,
    width: 24,
    rotate: -4,
    aspectRatio: 1482 / 2100,
    z: 80,
  },
};
const sliceFiles = [
  "slices/Snipaste_2026-08-08_19-14-35.jpg",
  "slices/lunfun-logo-3.png",
  "slices/lunfun-logo1.png",
  "slices/mado-gara.png",
  "slices/test.mp4",
  "slices/Snipaste_2026-08-08_19-10-21.jpg",
  "slices/Snipaste_2026-08-08_19-15-51.jpg",
  "slices/ammo-logo2.png",
  "slices/Snipaste_2026-08-08_19-16-00.jpg",
  "slices/Snipaste_2026-08-08_21-35-29.jpg",
  "slices/Snipaste_2026-08-08_20-35-56.png",
  "slices/ammo-logo.png",
  "slices/lenfun-logo-2.png",
  "slices/Snipaste_2026-08-08_19-42-44.jpg",
  "slices/ammo-font.png",
  "slices/Snipaste_2026-08-08_19-09-50.jpg",
  "slices/Snipaste_2026-08-08_19-09-19.jpg",
  "slices/mado-gara2.png",
];

function updateLogoState() {
  document.body.classList.toggle("nav-logo-active", navEscaping || logoHovering || logoDragging || logoJumping);
}

function hideNavReveal() {
  mainNav.style.setProperty("--nav-reveal-top", "50%");
  mainNav.style.setProperty("--nav-reveal-right", "50%");
  mainNav.style.setProperty("--nav-reveal-bottom", "50%");
  mainNav.style.setProperty("--nav-reveal-left", "50%");
  sliceNavRevealHits.clear();
  hideSliceNavInvertLayer();
}

function hideSliceNavInvertLayer() {
  if (!sliceNavInvertLayer) return;

  sliceNavInvertLayer.classList.remove("is-visible");
  sliceNavInvertLayer.replaceChildren();
}

function updateSliceNavInvertLayer() {
  if (!sliceNavInvertLayer) return;

  // Keep the inversion layer aligned with the visible logo pixels, not the
  // larger draggable anchor around it.
  const logoRect = getLogoHitRect();
  sliceNavInvertLayer.replaceChildren();
  sliceNavInvertLayer.style.left = `${logoRect.left}px`;
  sliceNavInvertLayer.style.top = `${logoRect.top}px`;
  sliceNavInvertLayer.style.width = `${logoRect.width}px`;
  sliceNavInvertLayer.style.height = `${logoRect.height}px`;

  navItems.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const overlaps =
      logoRect.right > itemRect.left &&
      logoRect.left < itemRect.right &&
      logoRect.bottom > itemRect.top &&
      logoRect.top < itemRect.bottom;

    if (!overlaps) return;

    const label = document.createElement("span");
    label.className = "slice-nav-invert-label";
    label.textContent = item.dataset.miniLabel || "";
    label.style.left = `${itemRect.left - logoRect.left}px`;
    label.style.top = `${itemRect.top - logoRect.top}px`;
    label.style.width = `${itemRect.width}px`;
    label.style.height = `${itemRect.height}px`;
    sliceNavInvertLayer.append(label);
  });

  sliceNavInvertLayer.classList.toggle(
    "is-visible",
    sliceNavInvertLayer.childElementCount > 0
  );
}

function updateNavReveal() {
  if (!windowOpened) {
    hideNavReveal();
    return;
  }

  const logoRect = getLogoHitRect();
  const navRect = mainNav.getBoundingClientRect();
  const revealLeft = Math.max(logoRect.left, navRect.left);
  const revealTop = Math.max(logoRect.top, navRect.top);
  const revealRight = Math.min(logoRect.right, navRect.right);
  const revealBottom = Math.min(logoRect.bottom, navRect.bottom);

  if (revealLeft >= revealRight || revealTop >= revealBottom) {
    hideNavReveal();
    return;
  }

  mainNav.style.setProperty("--nav-reveal-top", `${revealTop - navRect.top}px`);
  mainNav.style.setProperty("--nav-reveal-right", `${navRect.right - revealRight}px`);
  mainNav.style.setProperty("--nav-reveal-bottom", `${navRect.bottom - revealBottom}px`);
  mainNav.style.setProperty("--nav-reveal-left", `${revealLeft - navRect.left}px`);
  updateSliceNavInvertLayer();

  navItems.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const overlaps =
      logoRect.right > itemRect.left &&
      logoRect.left < itemRect.right &&
      logoRect.bottom > itemRect.top &&
      logoRect.top < itemRect.bottom;

    if (overlaps && !sliceNavRevealHits.has(item)) {
      sliceNavRevealHits.add(item);
    } else if (!overlaps && sliceNavRevealHits.has(item)) {
      sliceNavRevealHits.delete(item);
    }
  });
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function buildSliceBoard() {
  if (sliceBoard.children.length > 0) {
    return;
  }

  const random = seededRandom(260808);
  const maxSlices = 20;
  const selected = sliceFiles.slice(-maxSlices);
  const placed = [];
  const boardHeight = sliceBoard.clientHeight || getUsableViewportHeight();

  function getStickerBox(left, top, width, aspectRatio, rotate) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = boardHeight;
    const widthPx = (width / 100) * viewportWidth;
    const heightPx = widthPx / aspectRatio;
    const x = (left / 100) * viewportWidth;
    const y = (top / 100) * viewportHeight;
    const radians = (Math.abs(rotate) * Math.PI) / 180;
    const rotatedWidth = Math.abs(widthPx * Math.cos(radians)) + Math.abs(heightPx * Math.sin(radians));
    const rotatedHeight = Math.abs(widthPx * Math.sin(radians)) + Math.abs(heightPx * Math.cos(radians));

    return {
      left: x - (rotatedWidth - widthPx) / 2,
      top: y - (rotatedHeight - heightPx) / 2,
      right: x - (rotatedWidth - widthPx) / 2 + rotatedWidth,
      bottom: y - (rotatedHeight - heightPx) / 2 + rotatedHeight,
      area: rotatedWidth * rotatedHeight,
    };
  }

  function getOverlapScore(box) {
    return placed.reduce((score, existing) => {
      const overlapX = Math.max(0, Math.min(box.right, existing.right) - Math.max(box.left, existing.left));
      const overlapY = Math.max(0, Math.min(box.bottom, existing.bottom) - Math.max(box.top, existing.top));

      return score + (overlapX * overlapY) / Math.min(box.area, existing.area);
    }, 0);
  }

  function getOverflowPenalty(box) {
    const allowedX = (box.right - box.left) * 0.1;
    const allowedY = (box.bottom - box.top) * 0.1;
    const overflowLeft = Math.max(0, -box.left - allowedX);
    const overflowRight = Math.max(0, box.right - window.innerWidth - allowedX);
    const overflowTop = Math.max(0, -box.top - allowedY);
    const overflowBottom = Math.max(0, box.bottom - boardHeight - allowedY);

    return (overflowLeft + overflowRight + overflowTop + overflowBottom) * 100;
  }

  selected.forEach((file, index) => {
    const sticker = document.createElement("figure");
    const isVideo = /\.(mp4|webm)$/i.test(file);
    const isTransparentImage = /\.png$/i.test(file);
    const media = document.createElement(isVideo ? "video" : "img");
    const override = sliceOverrides[file];
    const width = override?.width ?? 10 + random() * 13;
    const aspectRatio = override?.aspectRatio ?? (isVideo ? 16 / 9 : 1 + random() * 0.7);
    let bestPlacement = null;

    if (override?.left !== undefined && override?.top !== undefined) {
      const box = getStickerBox(override.left, override.top, width, aspectRatio, override.rotate ?? 0);
      bestPlacement = {
        left: override.left,
        top: override.top,
        rotate: override.rotate ?? 0,
        box,
        score: 0,
      };
    } else {
      for (let attempt = 0; attempt < 36; attempt += 1) {
        const rotate = random() * 44 - 22;
        const left = random() * Math.max(8, 92 - width);
        const top = random() * 76 + 8;
        const box = getStickerBox(left, top, width, aspectRatio, rotate);
        const score = getOverlapScore(box) + getOverflowPenalty(box);

        if (!bestPlacement || score < bestPlacement.score) {
          bestPlacement = { left, top, rotate, box, score };
        }

        if (score < 0.04) {
          break;
        }
      }
    }

    sticker.className = "slice-sticker";
    sticker.dataset.sizeStep = "1";
    sticker.dataset.initialHeightLocked = "true";
    if (isVideo) {
      sticker.classList.add("is-video");
    }
    if (isTransparentImage) {
      sticker.classList.add("is-transparent");
    }
    if (override?.className) {
      sticker.classList.add(override.className);
    }
    sticker.style.left = `${bestPlacement.left}%`;
    sticker.style.top = `${bestPlacement.top}%`;
    sticker.style.setProperty("--slice-width", `${width}vw`);
    sticker.style.setProperty("--slice-rotate", `${bestPlacement.rotate.toFixed(2)}deg`);
    const layer = override?.z ?? (isVideo ? 300 + index : isTransparentImage ? 200 + index : index + 1);
    sticker.style.setProperty("--slice-z", `${layer}`);
    sticker.style.zIndex = `${layer}`;
    placed.push(bestPlacement.box);

    media.src = encodeURI(file);
    media.alt = "";
    media.draggable = false;

    if (isVideo) {
      media.muted = true;
      media.autoplay = true;
      media.loop = true;
      media.playsInline = true;
    } else {
      media.loading = "lazy";
      media.decoding = "async";
    }

    sticker.appendChild(media);
    sliceBoard.appendChild(sticker);

    const clampAfterMediaLoads = () => requestAnimationFrame(() => {
      if (sticker.dataset.initialHeightLocked === "true") {
        limitInitialRenderedSliceSize(sticker);
        sticker.dataset.initialHeightLocked = "false";
      }
      clampSliceInsideBoard(sticker);
    });

    if (isVideo) {
      media.addEventListener("loadedmetadata", clampAfterMediaLoads, { once: true });
      if (media.readyState >= 1) {
        clampAfterMediaLoads();
      }
    } else {
      media.addEventListener("load", clampAfterMediaLoads, { once: true });
      if (media.complete) {
        clampAfterMediaLoads();
      }
    }
  });
}

function enableMobileGyroscope() {
  if (!window.matchMedia('(max-width: 640px)').matches) {
    return;
  }

  const clampGravity = (value) => Math.max(-0.5, Math.min(0.5, value));

  const getScreenAngle = () => {
    const modernAngle = Number(window.screen.orientation?.angle);
    const legacyAngle = Number(window.orientation);

    // iOS Chrome often leaves screen.orientation.angle at 0 in landscape.
    if (window.innerWidth > window.innerHeight && Number.isFinite(legacyAngle)) {
      return legacyAngle;
    }
    return Number.isFinite(modernAngle) ? modernAngle : (Number.isFinite(legacyAngle) ? legacyAngle : 0);
  };

  const setScreenGravity = (deviceX, deviceY) => {
    // Sensor axes belong to the device's natural portrait orientation. Rotate
    // that vector once into the currently visible screen coordinate system.
    const radians = (-getScreenAngle() * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const screenX = deviceX * cos - deviceY * sin;
    const screenY = deviceX * sin + deviceY * cos;
    // The target iOS browser reports this vector opposite to the direction in
    // which the loose slices should fall, so invert it once at the final exit.
    mobileGravityTargetX = clampGravity(-screenX);
    mobileGravityTargetY = clampGravity(-screenY);
  };

  const applyOrientationFallback = (event) => {
    if (mobileMotionGravityAvailable) {
      return;
    }

    const beta = ((Number(event.beta) || 0) * Math.PI) / 180;
    const gamma = ((Number(event.gamma) || 0) * Math.PI) / 180;
    const deviceX = Math.sin(gamma) * 0.46;
    const deviceY = Math.sin(beta) * 0.46;
    setScreenGravity(deviceX, deviceY);
  };

  const applyMotion = (event) => {
    const gravity = event.accelerationIncludingGravity;
    if (gravity) {
      mobileMotionGravityAvailable = true;
      // Convert the device reading into the portrait-oriented basis used above.
      const deviceGravityX = -(gravity.x || 0) / 9.81 * 0.46;
      const deviceGravityY = (gravity.y || 0) / 9.81 * 0.46;
      setScreenGravity(deviceGravityX, deviceGravityY);
    }

    const acceleration = event.acceleration;
    if (!acceleration) {
      return;
    }

    const strength = Math.hypot(acceleration.x || 0, acceleration.y || 0, acceleration.z || 0);
    const now = performance.now();
    if (strength < 7 || now - mobileLastShake < 160) {
      return;
    }

    mobileLastShake = now;
    const shuffled = [...mobileSliceStates.entries()].sort(() => Math.random() - 0.5);
    shuffled.forEach(([sticker, state], index) => {
      const impulse = Math.min(strength, 18);
      state.vx += (Math.random() - 0.5) * impulse * 0.8;
      state.vy -= Math.random() * impulse * 0.65;
      state.angularVelocity += (Math.random() - 0.5) * impulse * 0.12;
      sticker.style.zIndex = `${300 + index}`;
    });
  };

  const startPhysics = () => {
    if (mobileSlicePhysicsFrame || !windowOpened) {
      return;
    }

    sliceBoard.querySelectorAll('.slice-sticker').forEach((sticker) => {
      mobileSliceStates.set(sticker, {
        x: sticker.offsetLeft,
        y: sticker.offsetTop,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0,
        rotation: Number.parseFloat(sticker.style.getPropertyValue('--slice-rotate')) || 0,
        angularVelocity: (Math.random() - 0.5) * 0.1,
        // A little variation makes differently sized stickers drift and fall differently.
        gravityFactor: 0.74 + Math.min(0.58, sticker.offsetWidth / window.innerWidth),
      });
    });

    const tick = () => {
      if (!windowOpened || !window.matchMedia('(max-width: 640px)').matches) {
        mobileSlicePhysicsFrame = 0;
        return;
      }

      mobileGravityX += (mobileGravityTargetX - mobileGravityX) * 0.22;
      mobileGravityY += (mobileGravityTargetY - mobileGravityY) * 0.22;

      const boardWidth = sliceBoard.clientWidth;
      const boardHeight = sliceBoard.clientHeight;
      const states = [...mobileSliceStates.entries()].filter(([sticker]) => sticker.isConnected);

      states.forEach(([sticker, state]) => {
        const width = sticker.offsetWidth;
        const height = sticker.offsetHeight;
        state.vx = Math.max(-13, Math.min(13, (state.vx + mobileGravityX * state.gravityFactor) * 0.992));
        state.vy = Math.max(-14, Math.min(14, (state.vy + mobileGravityY * state.gravityFactor) * 0.996));
        state.angularVelocity = Math.max(
          -3,
          Math.min(3, (state.angularVelocity + state.vx * 0.003 + mobileGravityX * 0.02) * 0.975)
        );
        state.x += state.vx;
        state.y += state.vy;
        state.rotation += state.angularVelocity;

        if (state.x < 0) {
          state.x = 0;
          state.vx *= -0.32;
          state.angularVelocity += state.vy * 0.01;
        } else if (state.x + width > boardWidth) {
          state.x = boardWidth - width;
          state.vx *= -0.32;
          state.angularVelocity -= state.vy * 0.01;
        }

        if (state.y < 0) {
          state.y = 0;
          state.vy *= -0.28;
          state.angularVelocity -= state.vx * 0.012;
        } else if (state.y + height > boardHeight) {
          state.y = boardHeight - height;
          state.vy *= -0.18;
          state.vx *= 0.93;
          state.angularVelocity += state.vx * 0.014;
          if (Math.abs(state.vy) < 0.35) {
            state.vy = 0;
          }
        }
      });

      states.forEach(([sticker, state]) => {
        sticker.style.left = `${state.x}px`;
        sticker.style.top = `${state.y}px`;
        sticker.style.setProperty('--slice-rotate', `${state.rotation.toFixed(2)}deg`);
      });

      mobileSlicePhysicsFrame = requestAnimationFrame(tick);
    };

    mobileSlicePhysicsFrame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!mobileSensorListenersAttached) {
      mobileSensorListenersAttached = true;
      mobileGyroscopeActive = true;
      window.addEventListener('deviceorientation', applyOrientationFallback, { passive: true });
      window.addEventListener('devicemotion', applyMotion, { passive: true });
    }

    startPhysics();
  };

  const orientationNeedsPermission = typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';
  const motionNeedsPermission = typeof DeviceMotionEvent !== 'undefined'
    && typeof DeviceMotionEvent.requestPermission === 'function';

  if (orientationNeedsPermission || motionNeedsPermission) {
    if (mobileGyroscopeActive || mobileGyroscopePermissionPending) {
      startPhysics();
      return;
    }

    mobileGyroscopePermissionPending = true;
    const requests = [];
    if (orientationNeedsPermission) {
      requests.push(DeviceOrientationEvent.requestPermission());
    }
    if (motionNeedsPermission) {
      requests.push(DeviceMotionEvent.requestPermission());
    }

    Promise.all(requests)
      .then((permissions) => {
        mobileGyroscopePermissionPending = false;
        if (permissions.includes('granted')) {
          start();
        }
      })
      .catch(() => {
        mobileGyroscopePermissionPending = false;
      });
    return;
  }

  start();
}

function bringSliceToFront(sticker) {
  topSliceLayer += 1;
  sticker.style.zIndex = `${topSliceLayer}`;
}

function clampSliceInsideBoard(sticker) {
  for (let pass = 0; pass < 3; pass += 1) {
    const boardRect = sliceBoard.getBoundingClientRect();
    const stickerRect = sticker.getBoundingClientRect();
    let shiftX = 0;
    let shiftY = 0;

    if (stickerRect.width > boardRect.width) {
      shiftX = boardRect.left + (boardRect.width - stickerRect.width) / 2 - stickerRect.left;
    } else if (stickerRect.left < boardRect.left) {
      shiftX = boardRect.left - stickerRect.left;
    } else if (stickerRect.right > boardRect.right) {
      shiftX = boardRect.right - stickerRect.right;
    }

    if (stickerRect.height > boardRect.height) {
      shiftY = boardRect.top + (boardRect.height - stickerRect.height) / 2 - stickerRect.top;
    } else if (stickerRect.top < boardRect.top) {
      shiftY = boardRect.top - stickerRect.top;
    } else if (stickerRect.bottom > boardRect.bottom) {
      shiftY = boardRect.bottom - stickerRect.bottom;
    }

    if (Math.abs(shiftX) < 0.5 && Math.abs(shiftY) < 0.5) {
      break;
    }

    sticker.style.left = `${sticker.offsetLeft + shiftX}px`;
    sticker.style.top = `${sticker.offsetTop + shiftY}px`;
  }
}

function getMediaAspectRatio(media) {
  const naturalWidth = media.naturalWidth || media.videoWidth || media.clientWidth || 1;
  const naturalHeight = media.naturalHeight || media.videoHeight || media.clientHeight || 1;

  return naturalWidth / naturalHeight;
}

function limitInitialRenderedSliceSize(sticker) {
  const media = sticker.querySelector("img, video");

  if (!media) {
    return;
  }

  const aspectRatio = getMediaAspectRatio(media);
  const maxWidth = window.innerWidth * maxSliceWidthRatio;
  const maxHeight = getUsableViewportHeight() * maxSliceHeightRatio;

  if (aspectRatio >= 1) {
    if (sticker.offsetWidth <= maxWidth) {
      return;
    }

    sticker.style.width = `${maxWidth}px`;
    return;
  }

  if (sticker.offsetHeight <= maxHeight) {
    return;
  }

  const nextWidth = sticker.offsetWidth * (maxHeight / sticker.offsetHeight);
  sticker.style.width = `${nextWidth}px`;
}

function resizeSlice(sticker) {
  const currentWidth = sticker.offsetWidth;
  const largerStep = sliceSizeSteps.findIndex((size) => size > currentWidth + 8);
  const nextStep = largerStep === -1 ? 0 : largerStep;
  sticker.dataset.sizeStep = `${nextStep}`;
  sticker.style.width = `${sliceSizeSteps[nextStep]}px`;
  sticker.dataset.initialHeightLocked = "false";
  requestAnimationFrame(() => {
    clampSliceInsideBoard(sticker);
  });
}

sliceBoard.addEventListener("pointerdown", (event) => {
  const sticker = event.target.closest(".slice-sticker");

  if (!sticker) {
    return;
  }

  event.preventDefault();
  const rect = sticker.getBoundingClientRect();
  bringSliceToFront(sticker);
  activeSlice = {
    sticker,
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };
  sticker.classList.add("is-dragging");
  sticker.setPointerCapture(event.pointerId);
});

sliceBoard.addEventListener("pointermove", (event) => {
  if (!activeSlice || activeSlice.pointerId !== event.pointerId) {
    return;
  }

  const { sticker } = activeSlice;
  const boardRect = sliceBoard.getBoundingClientRect();
  const maxLeft = Math.max(0, boardRect.width - sticker.offsetWidth);
  const maxTop = Math.max(0, boardRect.height - sticker.offsetHeight);
  const nextLeft = Math.min(Math.max(event.clientX - boardRect.left - activeSlice.offsetX, 0), maxLeft);
  const nextTop = Math.min(Math.max(event.clientY - boardRect.top - activeSlice.offsetY, 0), maxTop);
  const movement = Math.hypot(event.clientX - activeSlice.startX, event.clientY - activeSlice.startY);

  if (movement > 4) {
    activeSlice.moved = true;
  }

  sticker.style.left = `${nextLeft}px`;
  sticker.style.top = `${nextTop}px`;
});

function finishSlicePointer(event) {
  if (!activeSlice || activeSlice.pointerId !== event.pointerId) {
    return;
  }

  const { sticker, moved } = activeSlice;
  sticker.classList.remove("is-dragging");

  if (sticker.hasPointerCapture(event.pointerId)) {
    sticker.releasePointerCapture(event.pointerId);
  }

  if (!moved) {
    resizeSlice(sticker);
  } else {
    clampSliceInsideBoard(sticker);
  }

  activeSlice = null;
}

sliceBoard.addEventListener("pointerup", finishSlicePointer);
sliceBoard.addEventListener("pointercancel", finishSlicePointer);

function updateNavFear() {
  if (windowOpened) {
    document.body.classList.remove("logo-threat");
    navItems.forEach((item) => item.style.setProperty("--fear", "0"));
    return;
  }

  if (!logoSettled || (!logoHovering && !logoDragging)) {
    document.body.classList.remove("logo-threat");
    navItems.forEach((item) => item.style.setProperty("--fear", "0"));
    return;
  }

  const logoRect = getLogoHitRect();
  const logoCenterX = logoRect.left + logoRect.width / 2;
  const logoCenterY = logoRect.top + logoRect.height / 2;
  let anyFear = false;

  navItems.forEach((item) => {
    if (hitNavItems.has(item)) {
      item.style.setProperty("--fear", "0");
      return;
    }

    const rect = item.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(centerX - logoCenterX, centerY - logoCenterY);
    const fearRadius = Math.max(360, rect.width * 1.3);
    const distanceFear = Math.max(0, Math.min(1, 1 - distance / fearRadius));
    const baseFear = logoHovering ? 0.28 : 0;
    const fear = Math.max(baseFear, distanceFear);

    item.style.setProperty("--fear", fear.toFixed(3));

    if (fear > 0.04) {
      anyFear = true;
    }
  });

  document.body.classList.toggle("logo-threat", anyFear);
}

function syncLogoKeyboardPosition() {
  const rect = logoAnchor.getBoundingClientRect();
  logoX = rect.left;
  logoBaseY = rect.top - jumpOffset;
  previousKeyboardTop = rect.top;
  previousLogoHitTop = getLogoHitRect().top;
}

function getGroundTop() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--ground-top").trim();
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.top = value;
  probe.style.height = "0";
  document.body.appendChild(probe);
  const top = probe.getBoundingClientRect().top;
  probe.remove();
  return top;
}

function activateGround() {
  if (!logoSettled) {
    return;
  }

  if (!groundActive) {
    const rect = logoAnchor.getBoundingClientRect();
    const groundTop = getGroundTop();
    groundActive = true;
    logoX = rect.left;
    logoBaseY = groundTop - rect.height + rect.height * 0.15;
    jumpOffset = rect.top - logoBaseY;
    jumpVelocity = 0;
    previousKeyboardTop = rect.top;
  }

  const logoCenterX = logoX + logoAnchor.offsetWidth / 2;
  const lineRect = groundLine.getBoundingClientRect();
  const originX = Math.min(Math.max(logoCenterX - lineRect.left, 0), lineRect.width);
  groundLine.style.transformOrigin = `${originX}px center`;
  groundVisible = true;
  document.body.classList.add("ground-active");
}

function hideGroundIfIdle() {
  if (heldKeys.size === 0 && jumpVelocity === 0 && jumpOffset === 0) {
    groundVisible = false;
    document.body.classList.remove("ground-active");
  }
}

function openWindowWorld() {
  if (!logoSettled || windowOpened || windowClosing || logoDragging) {
    return;
  }

  windowOpened = true;
  groundActive = false;
  groundVisible = false;
  heldKeys.clear();
  document.body.classList.remove("ground-active", "logo-threat");
  resetNavItems();
  const logoRect = logoAnchor.getBoundingClientRect();
  const hitRect = getLogoHitRect();
  const centerX = hitRect.left + hitRect.width / 2;
  const centerY = hitRect.top + hitRect.height / 2;
  const farthestX = Math.max(centerX, window.innerWidth - centerX);
  const farthestY = Math.max(centerY, getUsableViewportHeight() - centerY);
  const radius = Math.hypot(farthestX, farthestY) + 140;
  const startRadius = Math.max(hitRect.width, hitRect.height) / 2;
  const scale = radius / Math.max(startRadius, 1);
  buildSliceBoard();
  // Falling starts as soon as the slice page opens. Sensor data can arrive later.
  enableMobileGyroscope();

  document.documentElement.style.setProperty("--window-x", `${centerX}px`);
  document.documentElement.style.setProperty("--window-y", `${centerY}px`);
  document.documentElement.style.setProperty("--window-radius", `${radius}px`);
  document.documentElement.style.setProperty("--window-frame-left", `${logoRect.left}px`);
  document.documentElement.style.setProperty("--window-frame-top", `${logoRect.top}px`);
  document.documentElement.style.setProperty("--window-scale", scale.toFixed(3));
  windowTransition.style.left = `${logoRect.left}px`;
  windowTransition.style.top = `${logoRect.top}px`;
  windowTransition.style.width = `${logoRect.width}px`;
  windowTransition.style.height = `${logoRect.height}px`;
  windowTransition.style.transform = "scale(1)";
  windowWorld.style.clipPath = `circle(${startRadius}px at ${centerX}px ${centerY}px)`;
  windowWorld.removeAttribute("aria-hidden");
  document.body.classList.add("window-opening");
  updateNavReveal();

  const duration = 1200;
  const startTime = performance.now();

  function easeInOutQuart(progress) {
    return progress < 0.5
      ? 8 * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 4) / 2;
  }

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = easeInOutQuart(progress);
    const currentRadius = startRadius + (radius - startRadius) * eased;
    const currentScale = 1 + (scale - 1) * eased;

    windowWorld.style.clipPath = `circle(${currentRadius}px at ${centerX}px ${centerY}px)`;
    windowTransition.style.transform = `scale(${currentScale})`;
    windowTransition.style.opacity = `${(1 - eased) * 0.28}`;

    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }

    document.body.classList.add("window-opened");
    windowWorld.style.clipPath = "none";
    logoAnchor.style.transition = "none";
    logoAnchor.style.removeProperty("left");
    logoAnchor.style.removeProperty("top");
    logoAnchor.style.transform = "translate(0, 0)";
    document.body.classList.remove("window-opening");
    requestAnimationFrame(() => {
      logoAnchor.offsetHeight;
      logoAnchor.style.removeProperty("transition");
      document.body.classList.add("window-logo-return");
    });
    syncLogoKeyboardPosition();
    updateNavReveal();
  }

  requestAnimationFrame(step);
}

function closeWindowWorld() {
  if (!windowOpened || windowClosing) {
    return;
  }

  windowClosing = true;
  groundActive = false;
  groundVisible = false;
  jumpOffset = 0;
  jumpVelocity = 0;
  logoJumping = false;
  heldKeys.clear();
  const logoRect = logoAnchor.getBoundingClientRect();
  const hitRect = getLogoHitRect();
  const centerX = hitRect.left + hitRect.width / 2;
  const centerY = hitRect.top + hitRect.height / 2;
  const farthestX = Math.max(centerX, window.innerWidth - centerX);
  const farthestY = Math.max(centerY, getUsableViewportHeight() - centerY);
  const radius = Math.hypot(farthestX, farthestY) + 140;
  const endRadius = Math.max(hitRect.width, hitRect.height) / 2;
  const scale = radius / Math.max(endRadius, 1);

  document.documentElement.style.setProperty("--window-x", `${centerX}px`);
  document.documentElement.style.setProperty("--window-y", `${centerY}px`);
  document.documentElement.style.setProperty("--window-frame-left", `${logoRect.left}px`);
  document.documentElement.style.setProperty("--window-frame-top", `${logoRect.top}px`);
  windowTransition.style.left = `${logoRect.left}px`;
  windowTransition.style.top = `${logoRect.top}px`;
  windowTransition.style.width = `${logoRect.width}px`;
  windowTransition.style.height = `${logoRect.height}px`;
  windowTransition.style.transform = `scale(${scale})`;
  windowTransition.style.opacity = "0";
  windowWorld.style.clipPath = `circle(${radius}px at ${centerX}px ${centerY}px)`;
  document.body.classList.remove(
    "window-opening",
    "window-opened",
    "window-logo-return",
    "ground-active",
    "logo-threat",
    "logo-keyboard"
  );
  document.body.classList.add("window-closing");
  resetNavItems();
  hideNavReveal();

  const duration = 900;
  const startTime = performance.now();

  function easeInOutQuart(progress) {
    return progress < 0.5
      ? 8 * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 4) / 2;
  }

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = easeInOutQuart(progress);
    const currentRadius = radius + (endRadius - radius) * eased;
    const currentScale = scale + (1 - scale) * eased;

    windowWorld.style.clipPath = `circle(${currentRadius}px at ${centerX}px ${centerY}px)`;
    windowTransition.style.transform = `scale(${currentScale})`;
    windowTransition.style.opacity = `${eased * 0.2}`;

    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }

    windowOpened = false;
    document.body.classList.remove("window-closing");
    windowWorld.setAttribute("aria-hidden", "true");
    windowWorld.style.clipPath = "";
    windowTransition.style.opacity = "";
    windowTransition.style.transform = "";
    const currentLogoRect = logoAnchor.getBoundingClientRect();
    logoAnchor.style.transition = "none";
    logoAnchor.style.left = `${currentLogoRect.left}px`;
    logoAnchor.style.top = `${currentLogoRect.top}px`;
    logoAnchor.style.transform = "translate(0, 0)";
    document.body.classList.add("logo-returning-home");

    requestAnimationFrame(() => {
      logoAnchor.offsetHeight;
      logoAnchor.style.removeProperty("transition");
      logoAnchor.style.left = "var(--logo-anchor-left)";
      logoAnchor.style.top = "var(--logo-inset-y)";

      window.setTimeout(() => {
        document.body.classList.remove("logo-returning-home");
        logoAnchor.style.removeProperty("left");
        logoAnchor.style.removeProperty("top");
        syncLogoKeyboardPosition();
        windowClosing = false;
      }, 940);
    });
  }

  requestAnimationFrame(step);
}

function finishIntro() {
  if (introFinished) {
    return;
  }

  introFinished = true;
  logoIntro.pause();
  document.body.classList.add("svg-active");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add("intro-finished");
    });
  });

  window.setTimeout(() => {
    logoSettled = true;
    document.body.classList.add("logo-settled");
    logoAnchor.removeAttribute("aria-disabled");
    logoAnchor.removeAttribute("tabindex");
    syncLogoKeyboardPosition();
  }, 1200);
}

logoIntro.addEventListener("ended", finishIntro);

logoIntro.addEventListener("error", () => {
  finishIntro();
});

logoIntro.play().catch(() => {
  finishIntro();
});

logoAnchor.addEventListener("click", (event) => {
  if (!document.body.classList.contains("intro-finished") || suppressLogoClick) {
    event.preventDefault();
    suppressLogoClick = false;
    return;
  }

  event.preventDefault();
  if (windowOpened) {
    const revealedItem = getRevealedNavItem();

    if (revealedItem) {
      window.location.href = revealedItem.getAttribute("href") || "#home";
      return;
    }

    closeWindowWorld();
    return;
  }

  // iOS only accepts motion permission while this logo click is still active.
  enableMobileGyroscope();
  openWindowWorld();
});

document.addEventListener("click", () => {
  if (!document.body.classList.contains("intro-finished")) {
    finishIntro();
  }
});

function resetNavItems() {
  mainNav.classList.remove("is-escaping");
  navEscaping = false;

  document.querySelectorAll(".nav-placeholder").forEach((placeholder) => {
    placeholder.remove();
  });

  miniNavs.forEach((link) => link.remove());
  miniNavs.clear();
  miniNavVariants.clear();
  hitNavItems.clear();
  fallenNavs.length = 0;
  activeFlyingNavs.clear();
  bumpedMiniNavs.clear();

  updateLogoState();
  navItems.forEach((item) => {
    item.classList.remove("is-hit");
    item.classList.remove("mobile-nav-escaped");
    item.removeAttribute("tabindex");
    item.removeAttribute("aria-hidden");
    item.setAttribute("href", item.dataset.initialHref || "#home");
    item.style.removeProperty("--fallen-left");
    item.style.removeProperty("--fallen-top");
    item.style.removeProperty("--fallen-rotate");
    item.style.removeProperty("--mobile-left");
    item.style.removeProperty("--mobile-top");

    item.style.setProperty("--escape-x", "0px");
    item.style.setProperty("--escape-y", "0px");
    item.style.setProperty("--escape-rotate", "0deg");
    mainNav.appendChild(item);
  });
}

function createMiniNav(item, source = "bump") {
  const rect = item.getBoundingClientRect();
  let link = miniNavs.get(item);
  const currentVariant = miniNavVariants.get(item);
  const variant = currentVariant === undefined ? Math.floor(Math.random() * 4) : currentVariant % 4;

  if (!link) {
    link = document.createElement("a");
    link.className = "mini-nav-link";
    link.href = item.dataset.realHref || item.getAttribute("href") || "#home";
    document.body.appendChild(link);
    miniNavs.set(item, link);
  }

  link.textContent = item.dataset.miniLabel || item.textContent.trim();
  link.classList.remove("variant-0", "variant-1", "variant-2", "variant-3");
  link.classList.add(`variant-${variant}`);
  link.style.left = `${rect.left + rect.width / 2}px`;
  link.style.top =
    source === "hit"
      ? `${rect.top + rect.height / 2}px`
      : `${Math.max(18, rect.top - (rect.height * 0.42))}px`;
  link.style.animation = "none";
  link.offsetHeight;
  link.style.animation = "";
  miniNavVariants.set(item, variant + 1);
}

function checkMiniNavBlocks() {
  if (windowOpened || jumpVelocity >= 0) {
    return;
  }

  const logoRect = getLogoHitRect();

  navItems.forEach((item) => {
    if (hitNavItems.has(item)) {
      return;
    }

    const rect = item.getBoundingClientRect();
    const overlapsHorizontally = logoRect.right > rect.left && logoRect.left < rect.right;
    const hitFromBelow = previousLogoHitTop >= rect.bottom - 16 && logoRect.top <= rect.bottom + 10;

    if (overlapsHorizontally && hitFromBelow && !bumpedMiniNavs.has(item)) {
      jumpVelocity = Math.max(jumpVelocity, 6);
      createMiniNav(item, "bump");
      bumpedMiniNavs.add(item);
    } else if (!hitFromBelow) {
      bumpedMiniNavs.delete(item);
    }
  });
}

function applyLogoKeyboardPosition() {
  const renderedTop = logoBaseY + jumpOffset;

  logoAnchor.style.left = `${logoX}px`;
  logoAnchor.style.top = `${renderedTop}px`;
  logoAnchor.style.transform = "translate(0, 0)";
  previousKeyboardTop = renderedTop;
  updateNavReveal();
}

function runKeyboardLoop() {
  if (!logoSettled) {
    keyboardLoopRunning = false;
    return;
  }

  const logoWidth = logoAnchor.offsetWidth;
  const logoHeight = logoAnchor.offsetHeight;
  const moveSpeed = 8;

  if (heldKeys.has("ArrowLeft")) {
    logoX -= moveSpeed;
  }

  if (heldKeys.has("ArrowRight")) {
    logoX += moveSpeed;
  }

  if (!groundActive && heldKeys.has("ArrowUp")) {
    logoBaseY -= moveSpeed;
  }

  if (!groundActive && heldKeys.has("ArrowDown")) {
    logoBaseY += moveSpeed;
  }

  if (jumpVelocity !== 0 || jumpOffset !== 0) {
    logoJumping = true;
    jumpOffset += jumpVelocity;
    jumpVelocity += 0.9;

    if (jumpOffset > 0) {
      jumpOffset = 0;
      jumpVelocity = 0;
      logoJumping = false;
    }

    updateLogoState();
  }

  logoX = Math.min(Math.max(logoX, 0), window.innerWidth - logoWidth);
  logoBaseY = groundActive
    ? getGroundTop() - logoHeight + logoHeight * 0.15
    : Math.min(Math.max(logoBaseY, 0), getUsableViewportHeight() - logoHeight);

  const lastTop = previousKeyboardTop;
  const lastHitTop = previousLogoHitTop;
  applyLogoKeyboardPosition();
  previousKeyboardTop = lastTop;
  previousLogoHitTop = lastHitTop;
  checkMiniNavBlocks();
  previousKeyboardTop = logoBaseY + jumpOffset;
  previousLogoHitTop = getLogoHitRect().top;

  if (heldKeys.size > 0 || jumpVelocity !== 0 || jumpOffset !== 0) {
    requestAnimationFrame(runKeyboardLoop);
  } else {
    keyboardLoopRunning = false;
    document.body.classList.remove("logo-keyboard");
    hideGroundIfIdle();
  }
}

function startKeyboardLoop() {
  if (!logoSettled || keyboardLoopRunning || logoDragging) {
    return;
  }

  keyboardLoopRunning = true;
  document.body.classList.add("logo-keyboard");
  syncLogoKeyboardPosition();
  requestAnimationFrame(runKeyboardLoop);
}

function escapeNavItems(event) {
  if (
    event.pointerType === "touch" ||
    window.matchMedia("(max-width: 640px)").matches ||
    !logoSettled ||
    logoDragging ||
    windowOpened
  ) {
    return;
  }

  let escaping = false;

  navItems.forEach((item, index) => {
    if (hitNavItems.has(item)) {
      return;
    }

    const rect = item.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = centerX - event.clientX;
    const distanceY = centerY - event.clientY;
    const distance = Math.hypot(distanceX, distanceY);
    const triggerDistance = Math.max(180, rect.width * 0.85);

    if (distance < triggerDistance) {
      escaping = true;
      const force = (triggerDistance - distance) / triggerDistance;
      const angle = Math.atan2(distanceY || 1, distanceX || 1);
      const jump = 190 * force + 42;
      const offsetX = Math.cos(angle) * jump;
      const offsetY = Math.sin(angle) * jump;
      const rotation = (index % 2 === 0 ? -1 : 1) * (10 + 18 * force);

      item.style.setProperty("--escape-x", `${offsetX.toFixed(2)}px`);
      item.style.setProperty("--escape-y", `${offsetY.toFixed(2)}px`);
      item.style.setProperty("--escape-rotate", `${rotation.toFixed(2)}deg`);
    } else {
      item.style.setProperty("--escape-x", "0px");
      item.style.setProperty("--escape-y", "0px");
      item.style.setProperty("--escape-rotate", "0deg");
    }
  });

  navEscaping = escaping;
  mainNav.classList.toggle("is-escaping", navEscaping);
  updateLogoState();
}

function escapeMobileNavItem(item, event) {
  if (!logoSettled || windowOpened || hitNavItems.has(item)) {
    return false;
  }

  // Mobile navigation has its own coordinate system. Do not reuse the
  // desktop transform-based escape, which can be clipped or accumulate.
  const rect = item.getBoundingClientRect();
  const margin = 8;
  const gap = 8;
  const otherRects = [...navItems]
    .filter((other) => other !== item)
    .map((other) => other.getBoundingClientRect());
  const fits = (left, top) => {
    const candidate = {
      left: left - gap,
      right: left + rect.width + gap,
      top: top - gap,
      bottom: top + rect.height + gap,
    };

    return otherRects.every(
      (other) =>
        candidate.right <= other.left ||
        candidate.left >= other.right ||
        candidate.bottom <= other.top ||
        candidate.top >= other.bottom
    );
  };

  let targetLeft = margin;
  let targetTop = margin;
  let foundPosition = false;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const left = margin + Math.random() * Math.max(0, window.innerWidth - rect.width - margin * 2);
    const top = margin + Math.random() * Math.max(0, getUsableViewportHeight() - rect.height - margin * 2);

    if (fits(left, top)) {
      targetLeft = left;
      targetTop = top;
      foundPosition = true;
      break;
    }
  }

  // Keep a deterministic fallback for very small screens where random
  // placement cannot find a free slot quickly.
  if (!foundPosition) {
    const step = Math.max(12, rect.height + gap * 2);
    for (let top = margin; top <= getUsableViewportHeight() - rect.height - margin; top += step) {
      for (let left = margin; left <= window.innerWidth - rect.width - margin; left += step) {
        if (fits(left, top)) {
          targetLeft = left;
          targetTop = top;
          foundPosition = true;
          break;
        }
      }
      if (foundPosition) {
        break;
      }
    }
  }

  const rotation = (Math.random() - 0.5) * 16;

  item.style.setProperty("--mobile-left", `${targetLeft.toFixed(2)}px`);
  item.style.setProperty("--mobile-top", `${targetTop.toFixed(2)}px`);
  item.style.setProperty("--escape-rotate", `${rotation.toFixed(2)}deg`);
  // Set the destination before switching to fixed positioning. This avoids
  // the one-frame flash caused by an unset left/top value on first touch.
  item.classList.add("mobile-nav-escaped");
  return true;
}

function clampEscapedMobileNavItems() {
  if (!window.matchMedia("(max-width: 640px)").matches) {
    return;
  }

  const margin = 8;
  const viewportHeight = getUsableViewportHeight();

  navItems.forEach((item) => {
    if (!item.classList.contains("mobile-nav-escaped")) {
      return;
    }

    const rect = item.getBoundingClientRect();
    const nextLeft = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, window.innerWidth - rect.width - margin)
    );
    const nextTop = Math.min(
      Math.max(rect.top, margin),
      Math.max(margin, viewportHeight - rect.height - margin)
    );

    item.style.setProperty("--mobile-left", `${nextLeft.toFixed(2)}px`);
    item.style.setProperty("--mobile-top", `${nextTop.toFixed(2)}px`);
  });
}

window.addEventListener("pointermove", escapeNavItems);
window.addEventListener("pointerleave", resetNavItems);

navItems.forEach((item) => {
  item.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }

    if (escapeMobileNavItem(item, event)) {
      event.preventDefault();
    }
  });

  item.addEventListener("click", (event) => {
    if (!window.matchMedia("(max-width: 640px)").matches) return;
    event.preventDefault();
    event.stopPropagation();
  });
});

logoAnchor.addEventListener("pointerenter", () => {
  if (logoSettled) {
    logoHovering = true;
    updateLogoState();
    updateNavFear();
  }
});

logoAnchor.addEventListener("pointerleave", () => {
  logoHovering = false;
  updateLogoState();
  updateNavFear();
});

function rectanglesOverlap(first, second) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function getLogoHitRect() {
  // Use the visible solid logo bounds, not the larger draggable anchor.
  const solidLogo = document.querySelector(".logo-solid");
  const rect = (solidLogo || logoAnchor).getBoundingClientRect();

  if (solidLogo) {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    left: rect.left + rect.width * 0.194,
    top: rect.top + rect.height * 0.218,
    right: rect.left + rect.width * 0.806,
    bottom: rect.top + rect.height * 0.782,
    width: rect.width * 0.612,
    height: rect.height * 0.564,
  };
}

function getRevealedNavItem() {
  const logoRect = getLogoHitRect();
  let selectedItem = null;
  let largestOverlap = 0;

  navItems.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const overlapWidth = Math.min(logoRect.right, itemRect.right) - Math.max(logoRect.left, itemRect.left);
    const overlapHeight = Math.min(logoRect.bottom, itemRect.bottom) - Math.max(logoRect.top, itemRect.top);
    const overlapArea = Math.max(0, overlapWidth) * Math.max(0, overlapHeight);

    if (overlapArea > largestOverlap) {
      largestOverlap = overlapArea;
      selectedItem = item;
    }
  });

  return selectedItem;
}

function getBodyRect(body) {
  const insetX = body.width * navCollisionInsetX;
  const insetY = body.height * navCollisionInsetY;

  return {
    left: body.x + insetX,
    top: body.y + insetY,
    right: body.x + body.width - insetX,
    bottom: body.y + body.height - insetY,
    width: body.width - insetX * 2,
    height: body.height - insetY * 2,
  };
}

function getBodyBox(body) {
  const rect = getBodyRect(body);
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const centerX = rect.left + halfWidth;
  const centerY = rect.top + halfHeight;
  const rotation = ((body.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localCorners = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ];
  const corners = localCorners.map(([x, y]) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }));

  return { centerX, centerY, corners };
}

function getBoxAabb(box) {
  const xs = box.corners.map((corner) => corner.x);
  const ys = box.corners.map((corner) => corner.y);

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function getAxes(box) {
  return [
    {
      x: box.corners[1].x - box.corners[0].x,
      y: box.corners[1].y - box.corners[0].y,
    },
    {
      x: box.corners[3].x - box.corners[0].x,
      y: box.corners[3].y - box.corners[0].y,
    },
  ].map((axis) => {
    const length = Math.hypot(axis.x, axis.y) || 1;
    return { x: axis.x / length, y: axis.y / length };
  });
}

function projectBox(box, axis) {
  const values = box.corners.map((corner) => corner.x * axis.x + corner.y * axis.y);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function getRotatedCollision(first, second) {
  const firstBox = getBodyBox(first);
  const secondBox = getBodyBox(second);
  const axes = [...getAxes(firstBox), ...getAxes(secondBox)];
  let smallestOverlap = Infinity;
  let smallestAxis = axes[0];

  for (const axis of axes) {
    const firstProjection = projectBox(firstBox, axis);
    const secondProjection = projectBox(secondBox, axis);
    const overlap = Math.min(firstProjection.max, secondProjection.max) - Math.max(firstProjection.min, secondProjection.min);

    if (overlap <= 0) {
      return null;
    }

    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      smallestAxis = axis;
    }
  }

  const directionX = firstBox.centerX - secondBox.centerX;
  const directionY = firstBox.centerY - secondBox.centerY;

  if (directionX * smallestAxis.x + directionY * smallestAxis.y < 0) {
    smallestAxis = { x: -smallestAxis.x, y: -smallestAxis.y };
  }

  return {
    axisX: smallestAxis.x,
    axisY: smallestAxis.y,
    overlap: smallestOverlap,
  };
}

function hitNavItem(item) {
  if (windowOpened || hitNavItems.has(item)) {
    return;
  }

  activeFlyingNavs.add(item);
  const rect = item.getBoundingClientRect();
  const logoRect = logoAnchor.getBoundingClientRect();
  hitNavItems.add(item);

  const startLeft = rect.left;
  const startTop = rect.top;
  const placeholder = document.createElement("span");
  placeholder.className = "nav-placeholder";
  placeholder.style.setProperty("--placeholder-width", `${rect.width}px`);
  placeholder.style.setProperty("--placeholder-height", `${rect.height}px`);
  item.parentElement.insertBefore(placeholder, item);
  const itemBody = {
    element: item,
    x: startLeft,
    y: startTop,
    width: rect.width,
    height: rect.height,
    rotation: 0,
  };
  fallenNavs.push(itemBody);
  const logoCenterX = logoRect.left + logoRect.width / 2;
  const logoCenterY = logoRect.top + logoRect.height / 2;
  const itemCenterX = rect.left + rect.width / 2;
  const itemCenterY = rect.top + rect.height / 2;
  const fallbackAngle = Math.atan2(itemCenterY - logoCenterY, itemCenterX - logoCenterX);
  const speed = Math.hypot(dragVelocityX, dragVelocityY);
  const impulseX = speed > 0.08 ? dragVelocityX : Math.cos(fallbackAngle) * 1.8;
  const impulseY = speed > 0.08 ? dragVelocityY : Math.sin(fallbackAngle) * 1.8;
  const spinDirection = impulseX >= 0 ? 1 : -1;

  item.style.setProperty("--escape-x", "0px");
  item.style.setProperty("--escape-y", "0px");
  item.style.setProperty("--escape-rotate", "0deg");
  item.style.setProperty("--fallen-left", `${startLeft}px`);
  item.style.setProperty("--fallen-top", `${startTop}px`);
  item.style.setProperty("--fallen-rotate", "0deg");
  item.removeAttribute("href");
  item.setAttribute("tabindex", "-1");
  item.setAttribute("aria-hidden", "true");
  item.classList.add("is-hit");
  document.body.appendChild(item);
  createMiniNav(item, "hit");

  let x = startLeft;
  let y = startTop;
  let velocityX = Math.max(-26, Math.min(26, impulseX * 15));
  let velocityY = Math.max(-22, Math.min(22, impulseY * 15));
  const launchSpeed = Math.hypot(velocityX, velocityY);

  if (launchSpeed < 10) {
    const launchAngle = Math.atan2(impulseY, impulseX);
    velocityX = Math.cos(launchAngle) * 10;
    velocityY = Math.sin(launchAngle) * 10;
  }
  let rotation = 0;
  let angularVelocity = spinDirection * Math.max(3, Math.min(15, Math.abs(velocityX) * 0.45));
  let bounceCount = 0;
  let lastTime = performance.now();
  const flightStartTime = lastTime;

  function settle() {
    const bounds = getBoxAabb(getBodyBox({
      x,
      y,
      width: rect.width,
      height: rect.height,
      rotation,
    }));

    if (bounds.bottom > getUsableViewportHeight() - 18) {
      y -= bounds.bottom - (getUsableViewportHeight() - 18);
    }

    if (bounds.left < 12) {
      x += 12 - bounds.left;
    } else if (bounds.right > window.innerWidth - 12) {
      x -= bounds.right - (window.innerWidth - 12);
    }

    itemBody.x = x;
    itemBody.y = y;
    itemBody.rotation = rotation;
    item.style.setProperty("--fallen-left", `${x.toFixed(2)}px`);
    item.style.setProperty("--fallen-top", `${y.toFixed(2)}px`);
    item.style.setProperty("--fallen-rotate", `${rotation.toFixed(2)}deg`);
    resolveFallenNavCollisions();
    activeFlyingNavs.delete(item);
  }

  function step(now) {
    const delta = Math.min(32, now - lastTime) / 16.67;
    lastTime = now;

    velocityY += 0.72 * delta;
    x += velocityX * delta;
    y += velocityY * delta;
    rotation += angularVelocity * delta;
    angularVelocity *= 0.992;

    const floorTop = getUsableViewportHeight() - rect.height - 18;
    const currentBody = {
      x,
      y,
      width: rect.width,
      height: rect.height,
      rotation,
    };
    const currentBounds = getBoxAabb(getBodyBox(currentBody));
    const rightWall = window.innerWidth - 12;

    if (currentBounds.left <= 12) {
      x += 12 - currentBounds.left;
      velocityX = Math.abs(velocityX) * 0.78;
      angularVelocity *= -0.82;
      bounceCount += 1;
    } else if (currentBounds.right >= rightWall) {
      x -= currentBounds.right - rightWall;
      velocityX = -Math.abs(velocityX) * 0.78;
      angularVelocity *= -0.82;
      bounceCount += 1;
    }

    if (currentBounds.top <= 8) {
      y += 8 - currentBounds.top;
      velocityY = Math.abs(velocityY) * 0.68;
      bounceCount += 1;
    } else if (currentBounds.bottom >= getUsableViewportHeight() - 18) {
      y -= currentBounds.bottom - (getUsableViewportHeight() - 18);
      velocityY = -Math.abs(velocityY) * 0.58;
      velocityX *= 0.78;
      angularVelocity *= 0.75;
      bounceCount += 1;
    }

    const currentBodyForCollision = {
      x,
      y,
      width: rect.width,
      height: rect.height,
      rotation,
    };

    fallenNavs.forEach((body) => {
      const collision = getRotatedCollision(currentBodyForCollision, body);

      if (body === itemBody || !collision) {
        return;
      }

      x += collision.axisX * (collision.overlap + 2);
      y += collision.axisY * (collision.overlap + 2);
      const velocityOnAxis = velocityX * collision.axisX + velocityY * collision.axisY;

      if (velocityOnAxis < 0) {
        velocityX -= 1.55 * velocityOnAxis * collision.axisX;
        velocityY -= 1.55 * velocityOnAxis * collision.axisY;
      } else {
        velocityX += collision.axisX * 4;
        velocityY += collision.axisY * 4;
      }

      velocityX *= 0.82;
      velocityY *= 0.82;
      angularVelocity *= -0.82;
      bounceCount += 1;
    });

    itemBody.x = x;
    itemBody.y = y;
    itemBody.rotation = rotation;
    item.style.setProperty("--fallen-left", `${x.toFixed(2)}px`);
    item.style.setProperty("--fallen-top", `${y.toFixed(2)}px`);
    item.style.setProperty("--fallen-rotate", `${rotation.toFixed(2)}deg`);

    const currentSettledBounds = getBoxAabb(getBodyBox({
      x,
      y,
      width: rect.width,
      height: rect.height,
      rotation,
    }));
    const isOnFloor = currentSettledBounds.bottom >= getUsableViewportHeight() - 19;
    const isAlmostStill = Math.abs(velocityX) < 0.32 && Math.abs(velocityY) < 1.2 && isOnFloor;

    if (isAlmostStill || now - flightStartTime > 3000) {
      settle();
      return;
    }

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function checkLogoHits() {
  if (windowOpened) {
    updateNavReveal();
    return;
  }

  const logoRect = getLogoHitRect();
  const logoCenterX = logoRect.left + logoRect.width / 2;
  const logoCenterY = logoRect.top + logoRect.height / 2;
  let closestItem = null;
  let closestDistance = Infinity;

  navItems.forEach((item) => {
    if (!hitNavItems.has(item) && rectanglesOverlap(logoRect, item.getBoundingClientRect())) {
      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - logoCenterX, centerY - logoCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestItem = item;
      }
    }
  });

  if (closestItem) {
    hitNavItem(closestItem);
  }
}

function resolveFallenNavCollisions() {
  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 0; index < fallenNavs.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < fallenNavs.length; nextIndex += 1) {
        const first = fallenNavs[index];
        const second = fallenNavs[nextIndex];
        const collision = getRotatedCollision(first, second);

        if (!collision) {
          continue;
        }

        const push = collision.overlap / 2 + 4;
        first.x += collision.axisX * push;
        first.y += collision.axisY * push;
        second.x -= collision.axisX * push;
        second.y -= collision.axisY * push;

        first.x = Math.min(Math.max(first.x, 12), window.innerWidth - first.width - 12);
        second.x = Math.min(Math.max(second.x, 12), window.innerWidth - second.width - 12);
      }
    }
  }

  fallenNavs.forEach((body) => {
    body.element.style.setProperty("--fallen-left", `${body.x.toFixed(2)}px`);
    body.element.style.setProperty("--fallen-top", `${body.y.toFixed(2)}px`);
  });
}

function moveLogo(clientX, clientY) {
  const now = performance.now();
  const elapsed = Math.max(8, now - lastDragTime);
  const nextLeft = Math.min(
    Math.max(clientX - dragOffsetX, 0),
    window.innerWidth - logoAnchor.offsetWidth
  );
  const nextTop = Math.min(
    Math.max(clientY - dragOffsetY, 0),
    getUsableViewportHeight() - logoAnchor.offsetHeight
  );

  dragVelocityX = (clientX - lastDragX) / elapsed;
  dragVelocityY = (clientY - lastDragY) / elapsed;
  lastDragX = clientX;
  lastDragY = clientY;
  lastDragTime = now;

  logoAnchor.style.left = `${nextLeft}px`;
  logoAnchor.style.top = `${nextTop}px`;
  logoAnchor.style.transform = "translate(0, 0)";
  updateNavReveal();
  updateNavFear();
  checkLogoHits();
}

logoAnchor.addEventListener("pointerdown", (event) => {
  if (!logoSettled || windowClosing) {
    return;
  }

  event.preventDefault();
  const rect = logoAnchor.getBoundingClientRect();
  logoDragging = true;
  suppressLogoClick = false;
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  dragVelocityX = 0;
  dragVelocityY = 0;
  lastDragX = event.clientX;
  lastDragY = event.clientY;
  lastDragTime = performance.now();
  navEscaping = false;
  mainNav.classList.remove("is-escaping");
  navItems.forEach((item) => {
    if (!hitNavItems.has(item)) {
      item.style.setProperty("--escape-x", "0px");
      item.style.setProperty("--escape-y", "0px");
      item.style.setProperty("--escape-rotate", "0deg");
    }
  });
  document.body.classList.add("logo-dragging");
  logoAnchor.setPointerCapture(event.pointerId);
  updateLogoState();
  updateNavReveal();
  updateNavFear();
});

logoAnchor.addEventListener("pointermove", (event) => {
  if (!logoDragging) {
    return;
  }

  suppressLogoClick = true;
  moveLogo(event.clientX, event.clientY);
});

logoAnchor.addEventListener("pointerup", (event) => {
  if (!logoDragging) {
    return;
  }

  // On iPhone, motion permission must be requested from the physical touch
  // that opens the slice page, before the synthetic click is dispatched.
  if (!suppressLogoClick && !windowOpened) {
    enableMobileGyroscope();
  }

  logoDragging = false;
  document.body.classList.remove("logo-dragging");
  logoAnchor.releasePointerCapture(event.pointerId);
  updateLogoState();
  updateNavReveal();
  updateNavFear();
});

logoAnchor.addEventListener("pointercancel", () => {
  logoDragging = false;
  document.body.classList.remove("logo-dragging");
  updateLogoState();
  updateNavReveal();
  updateNavFear();
});

window.addEventListener("keydown", (event) => {
  if (!logoSettled || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();

    if (windowOpened) {
      groundActive = false;
      groundVisible = false;
      document.body.classList.remove("ground-active");
    } else if (!groundActive) {
      activateGround();
    } else if (groundActive) {
      groundVisible = true;
      document.body.classList.add("ground-active");
    }

    heldKeys.add(event.key);
    startKeyboardLoop();
  }

  if (event.code === "Space") {
    event.preventDefault();

    if (jumpVelocity === 0 && jumpOffset === 0) {
      jumpVelocity = -17;
      logoJumping = true;
      updateLogoState();
      startKeyboardLoop();
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (heldKeys.has(event.key)) {
    heldKeys.delete(event.key);
    hideGroundIfIdle();
  }
});

window.addEventListener("resize", updateNavReveal);
window.visualViewport?.addEventListener("resize", clampEscapedMobileNavItems);
