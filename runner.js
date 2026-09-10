(() => {
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a", "b", "a"];
  let input = [];
  let lastKeyTime = 0;
  let phase = "idle";
  let frame = 0;
  let lastTime = 0;
  let y = 0;
  let velocity = 0;
  let elapsed = 0;
  let bestScore = 0;
  let lastScoreText = "";
  let spawnIn = 0.7;
  let obstacles = [];
  let saved = null;
  let angelFlight = null;
  const gravity = 2200;
  const ui = document.createElement("section");
  ui.className = "runner-ui";
  ui.hidden = true;
  ui.setAttribute("aria-label", "Logo 跑酷");
  document.body.append(ui);

  const scoreCanvas = document.createElement("canvas");
  scoreCanvas.className = "runner-score";
  scoreCanvas.width = 89;
  scoreCanvas.height = 7;
  scoreCanvas.setAttribute("role", "img");
  ui.append(scoreCanvas);
  const scoreContext = scoreCanvas.getContext("2d");
  const scoreGlyphs = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  };

  function paintScore() {
    const current = Math.min(99999, Math.floor(elapsed * 10));
    bestScore = Math.max(bestScore, current);
    const text = `HI ${String(bestScore).padStart(5, "0")}  ${String(current).padStart(5, "0")}`;
    if (text === lastScoreText) return;
    lastScoreText = text;
    scoreCanvas.setAttribute("aria-label", `本局 ${current} 分，最高 ${bestScore} 分`);
    if (!scoreContext) return;
    scoreContext.clearRect(0, 0, scoreCanvas.width, scoreCanvas.height);
    [...text].forEach((letter, index) => {
      scoreContext.fillStyle = index < 8 ? "#777" : "#000";
      scoreGlyphs[letter]?.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          if (pixel === "1") scoreContext.fillRect(index * 6 + x, y, 1, 1);
        });
      });
    });
  }

  const angel = document.createElement("div");
  angel.className = "runner-angel";
  angel.setAttribute("aria-hidden", "true");
  const wing = '<svg viewBox="0 0 28 24" shape-rendering="crispEdges"><path fill="#000" d="M0 0H6V3H10V6H14V9H18V12H22V15H28V21H24V24H16V21H10V18H6V14H3V9H0Z"/><path fill="#fff" d="M2 2H4V5H8V8H12V11H16V14H20V17H26V19H22V22H18V19H12V16H8V12H5V7H2Z"/><path fill="#bbb" d="M8 8H10V12H14V15H18V17H22V19H18V18H14V16H10V13H8Z"/></svg>';
  angel.innerHTML = `<span class="runner-angel-wing runner-angel-left">${wing}</span><span class="runner-angel-wing runner-angel-right">${wing}</span><svg class="runner-angel-halo" viewBox="0 0 28 12" shape-rendering="crispEdges"><path fill="#dba900" d="M6 1H22V3H26V5H28V8H24V10H4V8H0V5H2V3H6ZM6 4V5H3V7H6V8H22V7H25V5H22V4Z" fill-rule="evenodd"/><path fill="#ffe885" d="M7 1H21V3H7Z"/></svg>`;
  logoAnchor.append(angel);

  function clearAngel() {
    if (angelFlight) {
      angelFlight.onfinish = null;
      angelFlight.cancel();
      angelFlight = null;
    }
    document.body.classList.remove("runner-ascending");
  }

  function flyAway() {
    phase = "dying";
    velocity = 0;
    document.body.classList.remove("runner-jumping");
    document.body.classList.add("runner-crashed", "runner-ascending");
    const travel = logoAnchor.getBoundingClientRect().bottom + 100;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    angelFlight = logoAnchor.animate([
      { transform: "translate(0, 0)", opacity: 1, offset: 0 },
      { transform: "translate(0, 5px)", opacity: 1, offset: 0.1 },
      { transform: `translate(-8px, -${travel * 0.15}px)`, opacity: 1, offset: 0.35 },
      { transform: `translate(8px, -${travel * 0.5}px)`, opacity: 1, offset: 0.65 },
      { transform: `translate(0, -${travel}px)`, opacity: 0, offset: 1 },
    ], { duration: reducedMotion ? 600 : 1900, easing: "ease-in", fill: "forwards" });
    angelFlight.onfinish = () => {
      if (runnerActive && phase === "dying") phase = "over";
    };
  }

  // Low-resolution sprites use the site's own logo geometry, not a new mark.
  function makeLogoSprite(kind) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 72;
    canvas.className = `runner-logo-pixels runner-logo-${kind}`;
    canvas.setAttribute("aria-hidden", "true");
    logoAnchor.append(canvas);
    return canvas;
  }

  function snapPixels(context) {
    const pixels = context.getImageData(0, 0, 72, 72);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 0;
      pixels.data[i + 3] = pixels.data[i + 3] >= 72 ? 255 : 0;
    }
    context.putImageData(pixels, 0, 0);
  }

  const outlineSprite = makeLogoSprite("outline");
  const solidSprite = makeLogoSprite("solid");
  const outlineContext = outlineSprite.getContext("2d");
  if (outlineContext) {
    outlineContext.save();
    outlineContext.scale(72 / 1080, 72 / 1080);
    outlineContext.translate(209.455, 235.205);
    outlineContext.strokeStyle = "#000";
    outlineContext.lineWidth = 15;
    logoAnchor.querySelectorAll(".logo-outline polyline, .logo-outline path").forEach((shape) => {
      if (shape.tagName.toLowerCase() === "path") {
        outlineContext.stroke(new Path2D(shape.getAttribute("d")));
      } else {
        const points = shape.getAttribute("points").trim().split(/[\s,]+/).map(Number);
        outlineContext.beginPath();
        outlineContext.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) outlineContext.lineTo(points[i], points[i + 1]);
        outlineContext.stroke();
      }
    });
    outlineContext.restore();
    snapPixels(outlineContext);
    logoAnchor.classList.add("runner-outline-ready");
  }

  const solidSource = logoAnchor.querySelector(".logo-solid");
  function prepareSolidSprite() {
    const context = solidSprite.getContext("2d");
    if (!context || !solidSource.naturalWidth) return;
    try {
      context.clearRect(0, 0, 72, 72);
      context.drawImage(solidSource, 72 * 0.19394, 72 * 0.21778, 72 * 0.61212, 72 * 0.56443);
      snapPixels(context);
      logoAnchor.classList.add("runner-solid-ready");
    } catch {
      // Keep the original solid logo if local-file canvas access is restricted.
    }
  }
  if (solidSource.complete) prepareSolidSprite();
  else solidSource.addEventListener("load", prepareSolidSprite, { once: true });

  const tools = [
    { label: "Ps", name: "Photoshop", ink: "#31a8ff", base: "#001e36" },
    { label: "Ai", name: "Illustrator", ink: "#ff9a00", base: "#330000" },
    { label: "Ae", name: "After Effects", ink: "#9999ff", base: "#00005b" },
    { label: "Pr", name: "Premiere Pro", ink: "#9999ff", base: "#250044" },
    { label: "Id", name: "InDesign", ink: "#ff3366", base: "#490021" },
  ];
  const glyphs = {
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
    i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
    e: ["00000", "00000", "01110", "10001", "11111", "10000", "01111"],
    r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
    d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
  };
  let toolBag = [];
  function nextTool() {
    if (!toolBag.length) {
      toolBag = [...tools];
      for (let i = toolBag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [toolBag[i], toolBag[j]] = [toolBag[j], toolBag[i]];
      }
    }
    return toolBag.pop();
  }

  function makeToolSprite(tool) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const context = canvas.getContext("2d");
    if (context) {
      // Stepped corners and bitmap lettering use nearest-neighbor scaling.
      context.fillStyle = tool.ink;
      context.fillRect(2, 0, 20, 24);
      context.fillRect(0, 2, 24, 20);
      context.fillStyle = tool.base;
      context.fillRect(3, 2, 18, 20);
      context.fillRect(2, 3, 20, 18);
      context.fillStyle = tool.ink;
      [...tool.label].forEach((letter, index) => {
        glyphs[letter].forEach((row, y) => {
          [...row].forEach((pixel, x) => {
            if (pixel === "1") context.fillRect(6 + index * 6 + x, 8 + y, 1, 1);
          });
        });
      });
    }
    return canvas;
  }

  function floorY() {
    return getGroundTop() - logoAnchor.offsetHeight * 0.78221;
  }

  function paint() {
    paintScore();
    logoAnchor.style.top = `${y}px`;
    obstacles.forEach((obstacle) => {
      obstacle.element.style.transform = `translate(${obstacle.x}px, ${getGroundTop() - obstacle.height}px)`;
    });
  }

  function clearObstacles() {
    obstacles.forEach((obstacle) => obstacle.element.remove());
    obstacles = [];
  }

  function start() {
    clearAngel();
    if (!runnerActive) {
      saved = {
        style: logoAnchor.getAttribute("style"),
        groundActive, groundVisible, logoBaseY, logoX, jumpOffset, jumpVelocity,
      };
    }
    cancelAnimationFrame(frame);
    clearObstacles();
    runnerActive = true;
    heldKeys.clear();
    logoJumping = false;
    logoHovering = false;
    navEscaping = false;
    mainNav.classList.remove("is-escaping");
    navItems.forEach((item) => {
      item.style.setProperty("--escape-x", "0px");
      item.style.setProperty("--escape-y", "0px");
      item.style.setProperty("--escape-rotate", "0deg");
    });
    updateLogoState();
    document.body.classList.remove("logo-threat", "logo-keyboard", "runner-crashed", "runner-jumping");
    document.body.classList.add("runner-active", "ground-active");
    groundActive = true;
    groundVisible = true;
    ui.hidden = false;
    miniNavs.forEach((link) => { link.hidden = true; });
    phase = "dropping";
    elapsed = 0;
    velocity = 0;
    spawnIn = 0.7;
    const rect = logoAnchor.getBoundingClientRect();
    y = Math.min(rect.top, floorY());
    const groundRect = groundLine.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth * 0.16, groundRect.left + 40));
    logoAnchor.style.left = `${x}px`;
    logoAnchor.style.top = `${y}px`;
    logoAnchor.style.transform = "none";
    lastTime = performance.now();
    paint();
    frame = requestAnimationFrame(tick);
  }

  function jump() {
    if (phase === "over") { start(); return; }
    if (phase === "running" && Math.abs(y - floorY()) < 0.5) {
      velocity = -880;
      document.body.classList.add("runner-jumping");
    }
  }

  function spawn() {
    const element = makeToolSprite(nextTool());
    element.className = "runner-obstacle";
    element.setAttribute("aria-hidden", "true");
    const width = Math.random() < 0.75 ? 48 : 60;
    const height = width;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    ui.append(element);
    obstacles.push({ element, width, height, x: window.innerWidth + 4 });
  }

  function tick(now) {
    if (!runnerActive || phase === "over" || phase === "paused" || phase === "dying") return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    velocity += gravity * dt;
    y = Math.min(floorY(), y + velocity * dt);
    if (y >= floorY()) {
      velocity = 0;
      document.body.classList.remove("runner-jumping");
      if (phase === "dropping") {
        phase = "running";
      }
    }
    if (phase === "running") {
      elapsed += dt;
      // Ramp quickly in the first ten seconds, then climb toward a minute.
      // Narrow windows retain at least 0.85s of visible approach time.
      const targetSpeed = 380 + 340 * (1 - Math.exp(-elapsed / 9)) + Math.min(elapsed, 60) * 4.5;
      const runway = window.innerWidth - (parseFloat(logoAnchor.style.left) + logoAnchor.offsetWidth * 0.80606);
      const speed = Math.min(targetSpeed, Math.max(180, runway / 0.85));
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        // The full jump lasts 0.8s; keep enough recovery time between icons.
        const pressure = 1 - Math.exp(-elapsed / 10);
        spawnIn = 1.42 - pressure * 0.44 + Math.random() * (0.4 - pressure * 0.2);
      }
      obstacles.forEach((obstacle) => { obstacle.x -= speed * dt; });
      obstacles = obstacles.filter((obstacle) => {
        if (obstacle.x + obstacle.width < 0) { obstacle.element.remove(); return false; }
        return true;
      });
    }
    paint();
    const logo = getLogoHitRect();
    // A small inset makes edge grazes forgiving without missing direct hits.
    const hit = obstacles.some((obstacle) =>
      logo.right - 8 > obstacle.x && logo.left + 8 < obstacle.x + obstacle.width &&
      logo.bottom - 5 > getGroundTop() - obstacle.height && logo.top + 5 < getGroundTop());
    if (hit) {
      paint();
      flyAway();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function exitGame() {
    if (!runnerActive) return;
    clearAngel();
    cancelAnimationFrame(frame);
    clearObstacles();
    runnerActive = false;
    phase = "idle";
    ui.hidden = true;
    document.body.classList.remove("runner-active", "runner-crashed", "runner-jumping");
    document.body.classList.toggle("ground-active", saved.groundVisible);
    groundActive = saved.groundActive;
    groundVisible = saved.groundVisible;
    logoBaseY = saved.logoBaseY;
    logoX = saved.logoX;
    jumpOffset = saved.jumpOffset;
    jumpVelocity = saved.jumpVelocity;
    if (saved.style === null) logoAnchor.removeAttribute("style");
    else logoAnchor.setAttribute("style", saved.style);
    miniNavs.forEach((link) => { link.hidden = false; });
    syncLogoKeyboardPosition();
    updateLogoState();
    if (jumpOffset !== 0 || jumpVelocity !== 0) startKeyboardLoop();
  }

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (runnerActive) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Escape"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        if (event.key === "Escape") exitGame();
        else if (event.key === " " || event.key === "ArrowUp") {
          if (phase === "paused") resume();
          else jump();
        }
      }
      return;
    }
    if (!logoSettled || windowOpened || windowClosing || logoDragging) return;
    if (event.repeat) {
      if (input.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }
    const now = performance.now();
    if (now - lastKeyTime > 4000) input = [];
    lastKeyTime = now;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    input.push(key);
    while (input.length && !input.every((value, index) => value === code[index])) input.shift();
    if (input.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (input.length === code.length) { input = []; start(); }
  }, true);

  function pause() {
    if (phase !== "running" && phase !== "dropping") return;
    cancelAnimationFrame(frame);
    phase = "paused";
  }

  function resume() {
    phase = y < floorY() && elapsed === 0 ? "dropping" : "running";
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  window.addEventListener("pointerdown", (event) => {
    if (!runnerActive || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (phase === "paused") resume();
    else jump();
  }, true);
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("resize", () => {
    if (!runnerActive) return;
    if (phase === "dying" || phase === "over") return;
    pause();
    y = Math.min(y, floorY());
    if (y >= floorY()) document.body.classList.remove("runner-jumping");
    logoAnchor.style.left = `${Math.min(parseFloat(logoAnchor.style.left), Math.max(0, window.innerWidth - logoAnchor.offsetWidth))}px`;
    paint();
  });
})();
