(() => {
  "use strict";

  const STATES = Object.freeze({
    IDLE: "idle",
    WAITING: "waiting",
    READY: "ready",
    TOO_EARLY: "too_early",
    RESULT: "result",
  });

  const STORAGE_KEY_BEST = "rg_best_ms_v1";

  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n | 0));
  const now = () => performance.now();

  const formatMs = (ms) => {
    if (!Number.isFinite(ms)) return "—";
    return `${Math.round(Math.max(0, ms))} ms`;
  };

  const getCategoryBadge = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return { class: "", text: "" };
    if (ms < 150) return { class: "amazing", text: "Amazing" };
    if (ms < 200) return { class: "veryGood", text: "Very Good" };
    if (ms < 250) return { class: "good", text: "Good" };
    if (ms < 350) return { class: "average", text: "Average" };
    return { class: "belowAverage", text: "Below Average" };
  };

  const avg = (arr) => {
    if (!arr.length) return NaN;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  };

  const Storage = (() => {
    const readBest = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BEST);
        if (!raw) return NaN;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : NaN;
      } catch {
        return NaN;
      }
    };

    const writeBest = (ms) => {
      try {
        if (Number.isFinite(ms) && ms > 0) localStorage.setItem(STORAGE_KEY_BEST, String(Math.round(ms)));
      } catch {}
    };

    const clearBest = () => {
      try {
        localStorage.removeItem(STORAGE_KEY_BEST);
      } catch {}
    };

    return Object.freeze({ readBest, writeBest, clearBest });
  })();

  const Stats = (() => {
    let attempts = [];
    const addAttempt = (ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return;
      attempts.unshift(ms);
      if (attempts.length > 10) attempts = attempts.slice(0, 10);
    };
    const resetSession = () => {
      attempts = [];
    };
    const getAttempts = () => attempts.slice();
    const getAverage = () => avg(attempts);
    const getLast = () => (attempts.length ? attempts[0] : NaN);
    const getCount = () => attempts.length;

    return Object.freeze({ addAttempt, resetSession, getAttempts, getAverage, getLast, getCount });
  })();

  const UI = (() => {
    const el = {
      arena: document.getElementById("arena"),
      arenaButton: document.getElementById("arenaButton"),
      headline: document.getElementById("headline"),
      helpText: document.getElementById("helpText"),
      big: document.getElementById("big"),
      stateLabel: document.getElementById("stateLabel"),
      statePill: document.getElementById("statePill"),
      bestValue: document.getElementById("bestValue"),
      avgValue: document.getElementById("avgValue"),
      currentValue: document.getElementById("currentValue"),
      currentCategory: document.getElementById("currentCategory"),
      lastValue: document.getElementById("lastValue"),
      lastCategory: document.getElementById("lastCategory"),
      attemptsGrid: document.getElementById("attemptsGrid"),
      sessionCount: document.getElementById("sessionCount"),
      live: document.getElementById("live"),
      btnResetSession: document.getElementById("btnResetSession"),
      btnClearBest: document.getElementById("btnClearBest"),
    };

    const announce = (msg) => {
      el.live.textContent = "";
      requestAnimationFrame(() => {
        el.live.textContent = msg;
      });
    };

    const setStatePill = (state) => {
      el.stateLabel.textContent = state;
      let variant = "neutral";
      if (state === STATES.READY) variant = "ready";
      if (state === STATES.WAITING || state === STATES.TOO_EARLY) variant = "error";
      el.statePill.dataset.variant = variant;
    };

    const setArenaState = (state) => {
      el.arena.dataset.state = state;
      el.arenaButton.dataset.state = state;
    };

    const setPrimaryReadout = (text, tone) => {
      el.big.textContent = text;
      if (tone === "accent") el.big.dataset.tone = "accent";
      else if (tone === "error") el.big.dataset.tone = "error";
      else el.big.removeAttribute("data-tone");
    };

    const renderAttempts = (attempts) => {
      el.attemptsGrid.innerHTML = "";
      for (let i = 0; i < 10; i++) {
        const chip = document.createElement("div");
        chip.className = "chip";
        if (i >= attempts.length) {
          chip.classList.add("empty");
          chip.textContent = "—";
        } else {
          chip.textContent = `${Math.round(attempts[i])}`;
          chip.setAttribute("aria-label", `Attempt ${i + 1}: ${formatMs(attempts[i])}`);
        }
        el.attemptsGrid.appendChild(chip);
      }
    };

    const renderStats = ({ currentMs, bestMs, avgMs, lastMs, sessionCount }) => {
      el.bestValue.textContent = formatMs(bestMs);
      el.avgValue.textContent = formatMs(avgMs);
      el.currentValue.textContent = formatMs(currentMs);
      const currentCat = getCategoryBadge(currentMs);
      if (currentCat.text) {
        el.currentCategory.textContent = currentCat.text;
        el.currentCategory.className = `categoryBadge ${currentCat.class}`;
      } else {
        el.currentCategory.textContent = "";
        el.currentCategory.className = "categoryBadge";
      }
      el.lastValue.textContent = formatMs(lastMs);
      const lastCat = getCategoryBadge(lastMs);
      if (lastCat.text) {
        el.lastCategory.textContent = lastCat.text;
        el.lastCategory.className = `categoryBadge ${lastCat.class}`;
      } else {
        el.lastCategory.textContent = "";
        el.lastCategory.className = "categoryBadge";
      }
      el.sessionCount.textContent = `Session: ${sessionCount}`;
    };

    const renderStateView = (state, data = {}) => {
      setStatePill(state);
      setArenaState(state);

      let headline = "Click to start";
      let help = "When you start, wait for green. Click (or press Space/Enter) as fast as you can.";
      let bigText = "—";
      let tone = null;

      if (state === STATES.IDLE) {
        headline = "Click to start";
        help = "You will get a random delay. React when the panel turns green.";
        bigText = "—";
        tone = null;
      } else if (state === STATES.WAITING) {
        headline = "WAIT";
        help = "Red means do not click yet. Wait for green.";
        bigText = "HOLD";
        tone = "error";
        announce("Wait. Do not click yet.");
      } else if (state === STATES.READY) {
        headline = "GO!";
        help = "Click now!";
        bigText = "NOW";
        tone = "accent";
        announce("Go!");
      } else if (state === STATES.TOO_EARLY) {
        headline = "False start";
        help = "You clicked too early. Click to try again.";
        bigText = "Too early";
        tone = "error";
        announce("False start. You clicked too early.");
      } else if (state === STATES.RESULT) {
        headline = "Reaction Game";
        help = "Click to play again.";
        bigText = formatMs(data.currentMs);
        tone = "accent";
        if (Number.isFinite(data.currentMs)) announce(`Reaction game ${Math.round(data.currentMs)} milliseconds.`);
      }

      el.headline.textContent = headline;
      el.helpText.textContent = help;
      setPrimaryReadout(bigText, tone);
    };

    return Object.freeze({ el, renderStateView, renderAttempts, renderStats, announce });
  })();

  const Visuals3D = (() => {
    const canvas = document.getElementById("arena3d");
    const arena = document.getElementById("arena");

    let renderer = null;
    let scene = null;
    let camera = null;

    let group = null;
    let knot = null;
    let core = null;
    let satellites = [];
    let lightAccent = null;

    let rafId = 0;

    const anim = {
      targetSpeed: 0.18,
      speed: 0.18,
      targetGlow: 0.1,
      glow: 0.1,
      targetRed: 0.0,
      red: 0.0,
      targetJitter: 0.0,
      jitter: 0.0,
    };

    const COLORS = {
      surface: 0x1e293b,
      muted: 0x94a3b8,
      accent: 0x22c55e,
      error: 0xef4444,
    };

    const prefersReducedMotion = () =>
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lerp = (a, b, t) => a + (b - a) * t;

    const getArenaSize = () => {
      const r = arena.getBoundingClientRect();
      return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
    };

    const init = () => {
      if (!window.THREE) return;

      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
      camera.position.set(0, 0.15, 4.6);

      const amb = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(amb);

      const dir = new THREE.DirectionalLight(0xffffff, 0.75);
      dir.position.set(3, 4, 3);
      scene.add(dir);

      lightAccent = new THREE.PointLight(COLORS.accent, 0.6, 12, 2);
      lightAccent.position.set(0.5, 0.5, 2.2);
      scene.add(lightAccent);

      group = new THREE.Group();
      scene.add(group);

      const matCore = new THREE.MeshStandardMaterial({
        color: COLORS.surface,
        roughness: 0.25,
        metalness: 0.55,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1.0,
      });

      const matKnot = new THREE.MeshStandardMaterial({
        color: COLORS.muted,
        roughness: 0.35,
        metalness: 0.35,
        transparent: true,
        opacity: 0.55,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1.0,
      });

      knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.18, 64, 8, 2, 3), matKnot);
      knot.rotation.x = Math.PI * 0.15;
      group.add(knot);

      core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), matCore);
      group.add(core);

      const satMat = new THREE.MeshStandardMaterial({
        color: COLORS.surface,
        roughness: 0.4,
        metalness: 0.2,
        transparent: true,
        opacity: 0.75,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1.0,
      });

      satellites = [];
      const satGeo = new THREE.SphereGeometry(0.09, 10, 10);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(satGeo, satMat.clone());
        satellites.push(m);
        group.add(m);
      }

      resize();

      // Keep the canvas sized to the arena (not the window)
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => resize());
        ro.observe(arena);
      } else {
        window.addEventListener("resize", resize, { passive: true });
      }

      loop();
    };

    const resize = () => {
      if (!renderer || !camera) return;
      const { w, h } = getArenaSize();
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const setMode = (state) => {
      const reduced = prefersReducedMotion();

      if (state === STATES.WAITING) {
        anim.targetSpeed = reduced ? 0.10 : 0.14;
        anim.targetGlow = 0.25;
        anim.targetRed = 1.0;
        anim.targetJitter = 0.0;
      } else if (state === STATES.READY) {
        anim.targetSpeed = reduced ? 0.18 : 0.55;
        anim.targetGlow = 0.95;
        anim.targetRed = 0.0;
        anim.targetJitter = 0.0;
      } else if (state === STATES.TOO_EARLY) {
        anim.targetSpeed = reduced ? 0.2 : 0.42;
        anim.targetGlow = 0.35;
        anim.targetRed = 1.0;
        anim.targetJitter = 1.0;
      } else if (state === STATES.RESULT) {
        anim.targetSpeed = reduced ? 0.10 : 0.16;
        anim.targetGlow = 0.18;
        anim.targetRed = 0.0;
        anim.targetJitter = 0.0;
      } else {
        anim.targetSpeed = reduced ? 0.08 : 0.12;
        anim.targetGlow = 0.12;
        anim.targetRed = 0.0;
        anim.targetJitter = 0.0;
      }
    };

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!renderer || !scene || !camera || !group || !knot || !core) return;

      anim.speed = lerp(anim.speed, anim.targetSpeed, 0.06);
      anim.glow = lerp(anim.glow, anim.targetGlow, 0.08);
      anim.red = lerp(anim.red, anim.targetRed, 0.09);
      anim.jitter = lerp(anim.jitter, anim.targetJitter, 0.22);
      anim.targetJitter = lerp(anim.targetJitter, 0.0, 0.14);

      const t = performance.now() * 0.001;

      group.rotation.y += 0.0075 * anim.speed;
      group.rotation.x = Math.sin(t * 0.55) * 0.12;

      knot.rotation.z += 0.014 * anim.speed;
      core.rotation.y -= 0.02 * anim.speed;

      for (let i = 0; i < satellites.length; i++) {
        const a = t * (0.9 + i * 0.05) + i;
        const r = 1.55 + Math.sin(t * 0.7 + i) * 0.08;
        satellites[i].position.set(Math.cos(a) * r, Math.sin(a * 0.9) * 0.6, Math.sin(a) * 0.45);
        satellites[i].rotation.y += 0.02 * anim.speed;
      }

      const accent = new THREE.Color(COLORS.accent);
      const err = new THREE.Color(COLORS.error);
      const base = new THREE.Color(0x000000);
      const glowColor = base.clone().lerp(accent, anim.glow).lerp(err, anim.red * 0.9);

      knot.material.emissive.copy(glowColor);
      core.material.emissive.copy(glowColor.clone().lerp(accent, 0.3));

      for (let i = 0; i < satellites.length; i++) {
        satellites[i].material.emissive.copy(glowColor);
        satellites[i].material.opacity = 0.62 + anim.glow * 0.22;
      }

      if (lightAccent) {
        lightAccent.color.setHex(anim.red > 0.4 ? COLORS.error : COLORS.accent);
        lightAccent.intensity = 0.35 + anim.glow * 0.85;
      }

      if (anim.jitter > 0.001) {
        group.position.x = Math.sin(t * 60) * 0.03 * anim.jitter;
        group.position.y = Math.cos(t * 58) * 0.02 * anim.jitter;
      } else {
        group.position.x = 0;
        group.position.y = 0;
      }

      knot.material.opacity = 0.42 + anim.glow * 0.28;

      renderer.render(scene, camera);
    };

    return Object.freeze({ init, resize, setMode });
  })();

  const Game = (() => {
    let state = STATES.IDLE;
    let waitTimerId = 0;
    let readyAt = 0;

    const canInput = (s) =>
      s === STATES.IDLE || s === STATES.WAITING || s === STATES.READY || s === STATES.RESULT || s === STATES.TOO_EARLY;

    const clearWaitTimer = () => {
      if (waitTimerId) {
        clearTimeout(waitTimerId);
        waitTimerId = 0;
      }
    };

    const setState = (next, payload = {}) => {
      if (state === next) return;
      state = next;
      UI.renderStateView(state, payload);
      Visuals3D.setMode(state);
      UI.el.arenaButton.setAttribute("aria-label", `Game area. State ${state}. Press to interact.`);
    };

    const scheduleReady = () => {
      const delay = clampInt(1000 + Math.random() * 4000, 1000, 5000);
      clearWaitTimer();
      waitTimerId = setTimeout(() => {
        waitTimerId = 0;
        if (state !== STATES.WAITING) return;
        readyAt = now();
        setState(STATES.READY);
      }, delay);
    };

    const startRound = () => {
      if (state !== STATES.IDLE && state !== STATES.RESULT && state !== STATES.TOO_EARLY) return;
      readyAt = 0;
      setState(STATES.WAITING);
      scheduleReady();
    };

    const falseStart = () => {
      if (state !== STATES.WAITING) return;
      clearWaitTimer();
      readyAt = 0;
      setState(STATES.TOO_EARLY);
    };

    const stopOnReady = () => {
      if (state !== STATES.READY) return;

      const clickedAt = now();
      const reactionMs = clickedAt - readyAt;

      if (!Number.isFinite(reactionMs) || reactionMs <= 0 || reactionMs > 60000) {
        setState(STATES.IDLE);
        UI.announce("Invalid timing sample. Try again.");
        return;
      }

      Stats.addAttempt(reactionMs);

      const best = Storage.readBest();
      if (!Number.isFinite(best) || reactionMs < best) Storage.writeBest(reactionMs);

      const bestMs = Storage.readBest();
      const attempts = Stats.getAttempts();
      const avgMs = Stats.getAverage();
      const lastMs = Stats.getLast();

      UI.renderAttempts(attempts);
      UI.renderStats({
        currentMs: reactionMs,
        bestMs,
        avgMs,
        lastMs,
        sessionCount: Stats.getCount(),
      });

      setState(STATES.RESULT, { currentMs: reactionMs });
    };

    const onPrimaryInput = () => {
      if (!canInput(state)) return;

      if (state === STATES.IDLE || state === STATES.RESULT || state === STATES.TOO_EARLY) return startRound();
      if (state === STATES.WAITING) return falseStart();
      if (state === STATES.READY) return stopOnReady();
    };

    const resetSession = () => {
      Stats.resetSession();
      UI.renderAttempts(Stats.getAttempts());
      UI.renderStats({
        currentMs: NaN,
        bestMs: Storage.readBest(),
        avgMs: Stats.getAverage(),
        lastMs: Stats.getLast(),
        sessionCount: Stats.getCount(),
      });
      setState(STATES.IDLE);
      UI.announce("Session stats reset.");
    };

    const clearBest = () => {
      Storage.clearBest();
      UI.renderStats({
        currentMs: NaN,
        bestMs: Storage.readBest(),
        avgMs: Stats.getAverage(),
        lastMs: Stats.getLast(),
        sessionCount: Stats.getCount(),
      });
      UI.announce("Best time cleared.");
    };

    const init = () => {
      UI.renderAttempts(Stats.getAttempts());
      UI.renderStats({
        currentMs: NaN,
        bestMs: Storage.readBest(),
        avgMs: Stats.getAverage(),
        lastMs: Stats.getLast(),
        sessionCount: Stats.getCount(),
      });

      UI.renderStateView(STATES.IDLE);
      Visuals3D.setMode(STATES.IDLE);

      UI.el.arenaButton.addEventListener("click", (e) => {
        e.preventDefault();
        onPrimaryInput();
      });

      window.addEventListener(
        "keydown",
        (e) => {
          if (e.code === "Space" || e.code === "Enter") {
            if (e.repeat) return;
            e.preventDefault();
            onPrimaryInput();
          }
        },
        { passive: false }
      );

      UI.el.btnResetSession.addEventListener("click", (e) => {
        e.preventDefault();
        resetSession();
      });

      UI.el.btnClearBest.addEventListener("click", (e) => {
        e.preventDefault();
        clearBest();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          clearWaitTimer();
          if (state === STATES.WAITING || state === STATES.READY) {
            setState(STATES.IDLE);
            UI.announce("Paused. Click to start again.");
          }
        }
      });
    };

    return Object.freeze({ init });
  })();

  const HowToPlay = (() => {
    const STORAGE_KEY_SHOWN = "rg_how_to_play_shown_v1";

    const hasShown = () => {
      try {
        return localStorage.getItem(STORAGE_KEY_SHOWN) === "true";
      } catch {
        return false;
      }
    };

    const markShown = () => {
      try {
        localStorage.setItem(STORAGE_KEY_SHOWN, "true");
      } catch {}
    };

    const show = () => {
      const overlay = document.getElementById("howToPlayOverlay");
      if (overlay) {
        overlay.classList.add("active");
      }
    };

    const hide = () => {
      const overlay = document.getElementById("howToPlayOverlay");
      if (overlay) {
        overlay.classList.remove("active");
      }
      markShown();
    };

    const init = () => {
      if (hasShown()) {
        const overlay = document.getElementById("howToPlayOverlay");
        if (overlay) {
          overlay.style.display = "none";
        }
      } else {
        show();
      }

      const closeBtn = document.getElementById("closeHowToPlay");
      if (closeBtn) {
        closeBtn.addEventListener("click", hide);
      }

      const overlay = document.getElementById("howToPlayOverlay");
      if (overlay) {
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            hide();
          }
        });
      }
    };

    return Object.freeze({ init, show, hide });
  })();

  const boot = () => {
    try {
      Visuals3D.init();
    } catch {}

    HowToPlay.init();
    Game.init();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
