const logoIntro = document.querySelector("#logoIntro");
const logoAnchor = document.querySelector(".logo-anchor");
const mainNav = document.querySelector(".main-nav");
const groundLine = document.querySelector(".ground-line");
const windowWorld = document.querySelector(".window-world");
const windowTransition = document.querySelector(".window-transition");
const navItems = document.querySelectorAll(".nav-item");
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
const hitNavItems = new Set();
const fallenNavs = [];
const miniNavs = new Map();
const miniNavVariants = new Map();
const bumpedMiniNavs = new Set();
const heldKeys = new Set();
const navCollisionInsetX = 0.08;
const navCollisionInsetY = 0.14;

function updateLogoState() {
  document.body.classList.toggle("nav-logo-active", navEscaping || logoHovering || logoDragging || logoJumping);
}

function updateNavFear() {
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
  if (!logoSettled || windowOpened || logoDragging) {
    return;
  }

  windowOpened = true;
  const logoRect = logoAnchor.getBoundingClientRect();
  const hitRect = getLogoHitRect();
  const centerX = hitRect.left + hitRect.width / 2;
  const centerY = hitRect.top + hitRect.height / 2;
  const farthestX = Math.max(centerX, window.innerWidth - centerX);
  const farthestY = Math.max(centerY, window.innerHeight - centerY);
  const radius = Math.hypot(farthestX, farthestY) + 140;
  const startRadius = Math.max(hitRect.width, hitRect.height) / 2;
  const scale = radius / Math.max(startRadius, 1);

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
  updateLogoState();
  navItems.forEach((item) => {
    if (hitNavItems.has(item)) {
      return;
    }

    item.style.setProperty("--escape-x", "0px");
    item.style.setProperty("--escape-y", "0px");
    item.style.setProperty("--escape-rotate", "0deg");
  });
}

function createMiniNav(item) {
  const rect = item.getBoundingClientRect();
  let link = miniNavs.get(item);
  const currentVariant = miniNavVariants.get(item);
  const variant = currentVariant === undefined ? Math.floor(Math.random() * 4) : currentVariant % 4;

  if (!link) {
    link = document.createElement("a");
    link.className = "mini-nav-link";
    link.href = item.dataset.realHref || item.getAttribute("href") || "#home";
    link.textContent = item.textContent.trim();
    document.body.appendChild(link);
    miniNavs.set(item, link);
  }

  link.classList.remove("variant-0", "variant-1", "variant-2", "variant-3");
  link.classList.add(`variant-${variant}`);
  link.style.left = `${rect.left + rect.width / 2}px`;
  link.style.top = `${Math.max(10, rect.top - 28)}px`;
  link.style.animation = "none";
  link.offsetHeight;
  link.style.animation = "";
  miniNavVariants.set(item, variant + 1);
}

function checkMiniNavBlocks() {
  if (jumpVelocity >= 0) {
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
      createMiniNav(item);
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
    : Math.min(Math.max(logoBaseY, 0), window.innerHeight - logoHeight);

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
  if (!logoSettled || logoDragging) {
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

window.addEventListener("pointermove", escapeNavItems);
window.addEventListener("pointerleave", resetNavItems);

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
  const rect = logoAnchor.getBoundingClientRect();

  return {
    left: rect.left + rect.width * 0.194,
    top: rect.top + rect.height * 0.218,
    right: rect.left + rect.width * 0.806,
    bottom: rect.top + rect.height * 0.782,
    width: rect.width * 0.612,
    height: rect.height * 0.564,
  };
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
  if (hitNavItems.has(item)) {
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
  item.href = item.dataset.realHref || item.getAttribute("href") || "#home";
  item.classList.add("is-hit");
  document.body.appendChild(item);

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

    if (bounds.bottom > window.innerHeight - 18) {
      y -= bounds.bottom - (window.innerHeight - 18);
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

    const floorTop = window.innerHeight - rect.height - 18;
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
    } else if (currentBounds.bottom >= window.innerHeight - 18) {
      y -= currentBounds.bottom - (window.innerHeight - 18);
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
    const isOnFloor = currentSettledBounds.bottom >= window.innerHeight - 19;
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
    window.innerHeight - logoAnchor.offsetHeight
  );

  dragVelocityX = (clientX - lastDragX) / elapsed;
  dragVelocityY = (clientY - lastDragY) / elapsed;
  lastDragX = clientX;
  lastDragY = clientY;
  lastDragTime = now;

  logoAnchor.style.left = `${nextLeft}px`;
  logoAnchor.style.top = `${nextTop}px`;
  logoAnchor.style.transform = "translate(0, 0)";
  updateNavFear();
  checkLogoHits();
}

logoAnchor.addEventListener("pointerdown", (event) => {
  if (!logoSettled) {
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

  logoDragging = false;
  document.body.classList.remove("logo-dragging");
  logoAnchor.releasePointerCapture(event.pointerId);
  updateLogoState();
  updateNavFear();
});

logoAnchor.addEventListener("pointercancel", () => {
  logoDragging = false;
  document.body.classList.remove("logo-dragging");
  updateLogoState();
  updateNavFear();
});

window.addEventListener("keydown", (event) => {
  if (!logoSettled || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();

    if (!groundActive) {
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
