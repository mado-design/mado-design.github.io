(() => {
const logoAnchor = document.querySelector('.logo-anchor');
const windowWorld = document.querySelector('.window-world');
const windowTransition = document.querySelector('.window-transition');
const sliceBoard = document.querySelector('.slice-board');
const catalogContent = document.querySelectorAll('.catalog-shell, .catalog-footer');
let windowOpened = false;
let transitioning = false;
function getUsableViewportHeight() {
  if (window.matchMedia("(max-width: 640px)").matches && window.visualViewport) {
    return window.visualViewport.height;
  }

  return window.innerHeight;
}

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


function setCatalogInert(inert) {
  catalogContent.forEach((element) => { element.inert = inert; });
}

function returnLogoHome() {
  const current = logoAnchor.getBoundingClientRect();
  logoAnchor.style.transition = 'none';
  logoAnchor.style.left = `${current.left}px`;
  logoAnchor.style.top = `${current.top}px`;
  logoAnchor.style.transform = 'translate(0, 0)';
  // Commit the position where the slice wall finished shrinking.
  void logoAnchor.offsetWidth;
  document.body.classList.add('home-logo-return');
  logoAnchor.style.removeProperty('transition');
  logoAnchor.style.left = 'var(--logo-anchor-left)';
  logoAnchor.style.top = 'var(--logo-inset-y)';

  let done = false;
  let timer;
  function finishReturn() {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    logoAnchor.removeEventListener('transitionend', onReturnEnd);
    document.body.classList.remove('home-logo-return');
    logoAnchor.style.removeProperty('left');
    logoAnchor.style.removeProperty('top');
    logoAnchor.style.removeProperty('transform');
    transitioning = false;
  }
  function onReturnEnd(event) {
    if (event.target === logoAnchor && ['left', 'top'].includes(event.propertyName)) finishReturn();
  }
  logoAnchor.addEventListener('transitionend', onReturnEnd);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishReturn();
  else {
    const duration = getComputedStyle(logoAnchor).getPropertyValue('--move-duration').trim();
    const milliseconds = duration.endsWith('ms') ? parseFloat(duration) : parseFloat(duration) * 1000;
    timer = window.setTimeout(finishReturn, (milliseconds || 1200) + 80);
  }
}

function transitionWorld(opening) {
  if (transitioning) return;
  transitioning = true;
  const logoRect = logoAnchor.getBoundingClientRect();
  const hitRect = getLogoHitRect();
  const centerX = hitRect.left + hitRect.width / 2;
  const centerY = hitRect.top + hitRect.height / 2;
  const radius = Math.hypot(Math.max(centerX, innerWidth - centerX),
    Math.max(centerY, getUsableViewportHeight() - centerY)) + 140;
  const smallRadius = Math.max(hitRect.width, hitRect.height) / 2;
  const scale = radius / Math.max(smallRadius, 1);
  windowTransition.style.left = `${logoRect.left}px`;
  windowTransition.style.top = `${logoRect.top}px`;
  windowTransition.style.width = `${logoRect.width}px`;
  windowTransition.style.height = `${logoRect.height}px`;
  windowWorld.style.clipPath = `circle(${opening ? smallRadius : radius}px at ${centerX}px ${centerY}px)`;
  document.body.classList.remove('window-logo-return');

  if (opening) {
    windowOpened = true;
    buildSliceBoard();
    enableMobileGyroscope();
    setCatalogInert(true);
    windowWorld.inert = false;
    windowWorld.setAttribute('aria-hidden', 'false');
    document.body.classList.add('slices-active', 'window-opening');
    sliceBoard.querySelectorAll('video').forEach(video => video.play().catch(() => {}));
  } else {
    windowOpened = false;
    windowWorld.inert = true;
    document.body.classList.remove('window-opened');
    document.body.classList.add('window-closing');
  }

  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : opening ? 1200 : 900;
  const start = performance.now();
  function step(now) {
    const progress = duration ? Math.min(1, (now - start) / duration) : 1;
    const eased = progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2;
    const amount = opening ? eased : 1 - eased;
    windowWorld.style.clipPath = `circle(${smallRadius + (radius - smallRadius) * amount}px at ${centerX}px ${centerY}px)`;
    windowTransition.style.transform = `scale(${1 + (scale - 1) * amount})`;
    windowTransition.style.opacity = `${(1 - amount) * (opening ? 0.28 : 0.2)}`;
    if (progress < 1) { requestAnimationFrame(step); return; }

    document.body.classList.remove('window-opening', 'window-closing');
    windowTransition.style.opacity = '';
    windowTransition.style.transform = '';
    if (opening) {
      logoAnchor.style.removeProperty('left');
      logoAnchor.style.removeProperty('top');
      logoAnchor.style.removeProperty('transform');
      document.body.classList.add('window-opened', 'window-logo-return');
      windowWorld.style.clipPath = 'none';
    } else {
      document.body.classList.remove('slices-active');
      windowWorld.style.clipPath = '';
      windowWorld.setAttribute('aria-hidden', 'true');
      setCatalogInert(false);
      sliceBoard.querySelectorAll('video').forEach(video => video.pause());
      window.dispatchEvent(new Event('resize'));
    }
    logoAnchor.setAttribute('aria-expanded', String(opening));
    logoAnchor.setAttribute('aria-label', opening ? '返回作品目录' : '打开切片页面');
    if (opening) transitioning = false;
    else returnLogoHome();
  }
  requestAnimationFrame(step);
}

// catalog.js handles dragging first and prevents the click after a drag.
logoAnchor.addEventListener('click', event => {
  if (event.defaultPrevented) return;
  event.preventDefault();
  if (!document.body.classList.contains('logo-settled')) return;
  transitionWorld(!windowOpened);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && windowOpened && !transitioning) {
    transitionWorld(false);
    logoAnchor.focus({ preventScroll: true });
  }
});
window.addEventListener('resize', () => {
  if (windowOpened) sliceBoard.querySelectorAll('.slice-sticker').forEach(clampSliceInsideBoard);
});
})();
