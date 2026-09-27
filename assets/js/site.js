/* Kevin Walsh & Associates: the descent, the red line, the plan.
   Plain JS. Everything that moves eases, rests when idle, and honours reduced motion.
   Shared by the home page and the service pages: every part checks its elements exist. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const onMQ = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));

  requestAnimationFrame(() => document.body.classList.add('is-ready'));

  /* The five static-hero gates. Character for character the same as the CSS. */
  const GATES = [
    '(max-width: 720px)',
    '(orientation: portrait) and (max-width: 1024px)',
    '(orientation: portrait) and (pointer: coarse)',
    '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
    '(prefers-reduced-motion: reduce)'
  ];
  const MQLS = GATES.map(q => matchMedia(q));
  const gated = () => MQLS.some(m => m.matches);

  /* =========================================================
     GLIDE: inertial page scroll for mouse and trackpad
     ========================================================= */
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const glide = (() => {
    const LERP = 0.075;
    let on = false, raf = null, last = 0, lastSet = -1;
    let target = 0, current = 0, tween = null;
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    function frame(now) {
      const dt = Math.min(64, now - (last || now));
      last = now;
      let done;
      if (tween) {
        const t = clamp((now - tween.t0) / tween.dur, 0, 1);
        current = tween.from + (tween.to - tween.from) * easeInOut(t);
        target = current;
        done = t >= 1;
        if (done) {
          const fix = tween.el ? clamp(tween.el.getBoundingClientRect().top + scrollY, 0, maxScroll()) : current;
          tween = null;
          if (Math.abs(fix - current) > 1) { target = fix; done = false; }
        }
      } else {
        current += (target - current) * (1 - Math.pow(1 - LERP, dt / 16.667));
        done = Math.abs(target - current) < 0.4;
        if (done) current = target;
      }
      lastSet = Math.round(current);
      scrollTo(0, current);
      if (done) { raf = null; last = 0; } else raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (raf === null) raf = requestAnimationFrame(frame); };
    function canScrollInside(el, dy) {
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
          if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        }
      }
      return false;
    }
    function onWheel(e) {
      if (e.ctrlKey || e.defaultPrevented || document.body.style.overflow === 'hidden') return;
      let dy = e.deltaY;
      if (Math.abs(e.deltaX) > Math.abs(dy)) return;
      if (e.deltaMode === 1) dy *= 40; else if (e.deltaMode === 2) dy *= innerHeight;
      if (canScrollInside(e.target, dy)) return;
      e.preventDefault();
      if (raf === null) current = target = scrollY;
      if (tween) { tween = null; target = current; }
      target = clamp(target + dy, 0, maxScroll());
      kick();
    }
    function onScroll() {
      if (Math.abs(scrollY - lastSet) > 2) {
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = 0; }
        tween = null;
        current = target = lastSet = scrollY;
      }
    }
    function to(y, el) {
      y = clamp(y, 0, maxScroll());
      if (!on) { scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' }); return; }
      const from = raf === null ? scrollY : current;
      const dist = Math.abs(y - from);
      tween = { from, to: y, el, t0: performance.now(), dur: clamp(700 + dist * 0.12, 800, 2000) };
      last = 0;
      kick();
    }
    function enable() {
      if (on) return;
      on = true;
      document.documentElement.classList.add('glide');
      current = target = lastSet = scrollY;
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('scroll', onScroll, { passive: true });
    }
    function disable() {
      if (!on) return;
      on = false;
      document.documentElement.classList.remove('glide');
      removeEventListener('wheel', onWheel);
      removeEventListener('scroll', onScroll);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; last = 0; }
      tween = null;
    }
    return { enable, disable, to, get on() { return on; } };
  })();
  const applyGlide = () => (FINE.matches && !reduced() ? glide.enable() : glide.disable());

  // In-page links glide there too; links to /#section from another page just navigate.
  document.addEventListener('click', e => {
    if (!glide.on || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 ? document.getElementById(id.slice(1)) : null;
    if (!el) return;
    e.preventDefault();
    glide.to(el.getBoundingClientRect().top + scrollY, el);
  });

  /* =========================================================
     HERO: the descent onto one plot, then the red line
     ========================================================= */
  const hero = $('.hero');
  const stage = $('.stage');
  const hasFilm = !!(hero && stage && $('.hero-canvas', stage));
  const FRAME_W = 1920, FRAME_H = 1080, ANCHOR_Y = 515;   // the plot's centre, kept on screen at every aspect
  const FRAMES = 94;
  const frameUrl = i => `/assets/frames/v2/f${String(i + 1).padStart(3, '0')}.webp`;
  const POSTER_URL = '/assets/hero-poster.jpg';
  const ENDING_URL = '/assets/hero-ending.jpg';

  let scrubOn = false;
  let enableScrub = () => {}, disableScrub = () => {}, heroResize = () => {};

  if (hasFilm) {
    const canvas = $('.hero-canvas', stage);
    const poster = $('.poster', stage);
    const posterEnd = $('.poster-end', stage);
    const ring = $('.ring', stage);
    const hud = $('.hud', stage);
    const scaleEl = $('.hud .scale', stage);
    const redline = $('.redline', stage);
    const tag = $('.rl-tag', stage);

    const bands = $$('.band', stage).map((el, i, arr) => ({
      el, a: +el.dataset.a, b: +el.dataset.b, ramp: el.dataset.ramp ? +el.dataset.ramp : 0,
      first: i === 0, last: i === arr.length - 1, op: -1, k: -1, vis: undefined, cta: null
    }));

    /* Split each band headline once: a hidden full sentence for screen readers,
       plus word and character spans with seeded offsets for the entrances. */
    function splitBand(el, seed, fx, spread) {
      const r = rng(seed);
      const full = el.textContent.replace(/\s+/g, ' ').trim();
      const vis = document.createElement('span');
      vis.className = 'vis sharp';
      vis.setAttribute('aria-hidden', 'true');
      const words = [], chars = [];
      [...el.childNodes].forEach(node => {
        if (node.nodeType === 1 && node.tagName === 'BR') { vis.appendChild(document.createElement('br')); return; }
        const isEm = node.nodeType === 1 && node.tagName === 'EM';
        node.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { vis.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = isEm ? 'w em' : 'w';
          for (const ch of tok) {
            const c = document.createElement('span');
            c.className = 'c';
            c.textContent = ch;
            w.appendChild(c);
            chars.push(c);
          }
          vis.appendChild(w);
          words.push(w);
        });
      });
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = full;
      el.textContent = '';
      el.append(sr, vis);

      if (fx === 'focus') {
        const soft = vis.cloneNode(true);
        soft.className = 'vis soft';
        el.appendChild(soft);
      } else if (fx === 'grid') {
        const n = chars.length || 1;
        chars.forEach((c, i) => {
          c.style.setProperty('--th', ((i / n) * spread + r() * 0.05).toFixed(3));
          c.style.setProperty('--jx', ((r() < 0.5 ? -1 : 1) * (10 + r() * 16)).toFixed(1) + 'px');
        });
      } else {
        const span = fx === 'baseline' ? 0.36 : 0.5;
        const n = words.length;
        words.forEach((w, i) => w.style.setProperty('--th', (n > 1 ? (i / (n - 1)) * span + r() * 0.02 : 0).toFixed(3)));
      }
    }
    bands.forEach((b, i) => {
      const head = $('.split', b.el);
      const fx = ([...b.el.classList].find(c => c.startsWith('fx-')) || 'fx-drift').slice(3);
      if (head) splitBand(head, 11 + i * 7, fx, +(b.el.dataset.spread || 0.45));
    });

    function heroProgress() {
      const range = hero.offsetHeight - innerHeight;
      if (range <= 0) return 0;
      return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
    }

    /* The film reaches its resting frame at 90% of the hero, easing in like an
       arrival, and holds still while the red line draws around the plot. */
    const FILM_END = 0.9, P0 = 0.68, S = 1 / (1 - (1 - P0) / 2);
    function filmT(p) {
      const q = clamp(p / FILM_END, 0, 1);
      if (q <= P0) return S * q;
      const d = q - P0;
      return Math.min(1, S * (q - (d * d) / (2 * (1 - P0))));
    }

    /* One layout for the canvas, the posters and the red line: cover the stage,
       centred across, and vertically as close to the plot's centre as the edges allow. */
    let L = { s: 1, dx: 0, dy: 0, w: FRAME_W, h: FRAME_H, W: 1, H: 1 };
    function measure() {
      const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
      const s = Math.max(W / FRAME_W, H / FRAME_H);
      const w = FRAME_W * s, h = FRAME_H * s;
      const dx = (W - w) / 2;
      const dy = clamp(H / 2 - ANCHOR_Y * s, H - h, 0);
      L = { s, dx, dy, w, h, W, H };
      redline.style.cssText = `left:${dx}px;top:${dy}px;width:${w}px;height:${h}px`;
      const bg = `${w}px ${h}px`, pos = `${dx}px ${dy}px`;
      poster.style.backgroundSize = bg; poster.style.backgroundPosition = pos;
      posterEnd.style.backgroundSize = bg; posterEnd.style.backgroundPosition = pos;
      // the tag sits just outside the plot's top-right corner
      tag.style.left = `${dx + 1112 * s}px`;
      tag.style.top = `${dy + 90 * s}px`;
    }

    /* Captions: opacity per band paced in scroll distance, assembly progress --k.
       Every DOM write is delta-gated. */
    let loadK = 0, lastEnd = -1, hudOff = null, lastLabel = '', lastLabelAt = 0, lastRl = -1, lastRt = -1;

    function updateLabel(p, now, force) {
      const t = filmT(p);
      let v = 10000 * Math.pow(500 / 10000, t);
      v = v > 2000 ? Math.round(v / 250) * 250 : Math.round(v / 50) * 50;
      const text = '1:' + v.toLocaleString('en-IE');
      if (!force && now - lastLabelAt < 100) return;
      if (text === lastLabel) return;
      lastLabel = text;
      lastLabelAt = now;
      scaleEl.textContent = text;
    }

    function updateCaptions(p, now = performance.now(), force = false) {
      for (const b of bands) {
        const len = b.b - b.a;
        const f = Math.min(0.02, len / 3);
        let op;
        if ((!b.first && p < b.a) || (!b.last && p > b.b)) op = 0;
        else op = (b.first ? 1 : smoothstep(p, b.a, b.a + f)) * (b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b));
        op = Math.round(op * 200) / 200;
        const ramp = b.ramp || Math.min(0.025, len * 0.35);
        let k = clamp((p - b.a) / ramp, 0, 1);
        if (b.first) k = Math.max(k, loadK);
        if (op !== b.op) {
          b.op = op;
          b.el.style.opacity = op;
          const vis = op > 0.01;
          if (vis !== b.vis) { b.vis = vis; b.el.style.visibility = vis ? 'visible' : 'hidden'; }
        }
        if (Math.abs(k - b.k) >= 0.008 || (k === 1 && b.k !== 1) || (k === 0 && b.k !== 0)) {
          b.k = k;
          b.el.style.setProperty('--k', k.toFixed(3));
        }
        if (b.last) {
          const on = k > 0.9 && op > 0.5;
          if (on !== b.cta) { b.cta = on; b.el.classList.toggle('cta-on', on); }
        }
      }
      // THE RED LINE: draws once the film has come to rest
      const rl = Math.round(easeInOut(clamp((p - 0.895) / 0.075, 0, 1)) * 400) / 400;
      const rt = Math.round(clamp((p - 0.955) / 0.035, 0, 1) * 100) / 100;
      if (rl !== lastRl) { lastRl = rl; stage.style.setProperty('--rl', rl); }
      if (rt !== lastRt) { lastRt = rt; stage.style.setProperty('--rt', rt); }
      updateLabel(p, now, force);
      const off = p > 0.8;
      if (off !== hudOff) { hudOff = off; hud.classList.toggle('off', off); }
      if (filmFailed) {
        const e = Math.round(smoothstep(p, 0.4, 0.85) * 100) / 100;
        if (e !== lastEnd) { lastEnd = e; posterEnd.style.opacity = e; }
      }
    }

    /* The film as a frame sequence drawn to a canvas, neighbouring frames blended. */
    const imgs = new Array(FRAMES).fill(null);
    const loaded = new Uint8Array(FRAMES);
    const warmed = new Uint8Array(FRAMES);
    const ctx2 = canvas.getContext('2d', { alpha: false });
    let cw = 0, ch = 0, drawnF = -1, lastIdx = -1, lastF = 0;
    let framesReady = false, filmFailed = false, framesStarted = false;
    let loadedCount = 0, failedCount = 0, lastRing = 0, lastLoadAt = 0;

    function sizeCanvas() {
      measure();
      const scale = Math.min(devicePixelRatio || 1, 1920 / Math.max(1, L.W), 2);
      const w = Math.max(1, Math.round(L.W * scale)), h = Math.max(1, Math.round(L.H * scale));
      if (w !== cw || h !== ch) { cw = canvas.width = w; ch = canvas.height = h; drawnF = -1; }
    }
    function nearestLoaded(i) {
      if (loaded[i]) return i;
      for (let d = 1; d < FRAMES; d++) {
        if (i - d >= 0 && loaded[i - d]) return i - d;
        if (i + d < FRAMES && loaded[i + d]) return i + d;
      }
      return -1;
    }
    function blit(img, alpha) {
      const k = cw / L.W;
      ctx2.globalAlpha = alpha;
      ctx2.drawImage(img, L.dx * k, L.dy * k, L.w * k, L.h * k);
    }
    function warm(i, dir) {
      for (let d = 1; d <= 6; d++) {
        const j = i + d * dir;
        if (j < 0 || j >= FRAMES || !loaded[j] || warmed[j]) continue;
        warmed[j] = 1;
        imgs[j].decode().catch(() => { warmed[j] = 0; });
      }
    }
    function drawFrame(f, force) {
      if (!framesReady) return;
      f = clamp(f, 0, FRAMES - 1);
      if (!force && Math.abs(f - drawnF) < 0.002) return;
      const i0 = Math.floor(f), a = f - i0, i1 = Math.min(FRAMES - 1, i0 + 1);
      const base = nearestLoaded(i0);
      if (base < 0) return;
      blit(imgs[base], 1);
      if (a > 0.004 && base === i0 && i1 !== i0 && loaded[i1]) blit(imgs[i1], a);
      ctx2.globalAlpha = 1;
      drawnF = f;
      const idx = Math.round(f);
      if (idx !== lastIdx) { lastIdx = idx; stage.dataset.frame = idx; warm(idx, f >= lastF ? 1 : -1); }
      lastF = f;
    }

    /* Coarse to fine: the ends and every 16th and 8th frame first, so the scrub works
       within moments, then the gaps fill in. A stall before the first pass falls back. */
    function startFrames() {
      if (framesStarted) return;
      framesStarted = true;
      const order = [], seen = new Uint8Array(FRAMES);
      const push = i => { if (i >= 0 && i < FRAMES && !seen[i]) { seen[i] = 1; order.push(i); } };
      push(0); push(FRAMES - 1);
      for (let i = 0; i < FRAMES; i += 16) push(i);
      for (let i = 0; i < FRAMES; i += 8) push(i);
      const readyCount = order.length;
      for (const s of [4, 2, 1]) for (let i = 0; i < FRAMES; i += s) push(i);
      let next = 0, active = 0;
      lastLoadAt = performance.now();
      const settle = () => {
        if (loadedCount + failedCount < FRAMES) return;
        ring.style.setProperty('--ld', 0);
        stage.classList.add('film-loaded');
        if (!framesReady) { if (loadedCount) makeReady(); else failFilm(); }
      };
      const pump = () => {
        while (active < 6 && next < order.length) {
          const i = order[next++];
          active++;
          const img = new Image();
          img.decoding = 'async';
          if ('fetchPriority' in img) img.fetchPriority = 'low';
          img.onload = () => {
            imgs[i] = img; loaded[i] = 1; loadedCount++; active--;
            lastLoadAt = performance.now();
            if (lastLoadAt - lastRing > 100) { lastRing = lastLoadAt; ring.style.setProperty('--ld', Math.round(126 * (1 - loadedCount / FRAMES))); }
            if (!framesReady && loadedCount >= readyCount) makeReady();
            else if (framesReady && Math.abs(i - fd) <= 1.5) drawFrame(fd, true);
            pump(); settle();
          };
          img.onerror = () => { failedCount++; active--; pump(); settle(); };
          img.src = frameUrl(i);
        }
      };
      pump();
      const watch = () => {
        if (framesReady || filmFailed) return;
        if (performance.now() - lastLoadAt > 20000) failFilm(); else setTimeout(watch, 2000);
      };
      setTimeout(watch, 2000);
    }
    function makeReady() {
      if (framesReady || filmFailed) return;
      framesReady = true;
      sizeCanvas();
      drawFrame(fd, true);
      stage.classList.add('film-ready');
      onScroll();
    }
    function failFilm() {
      if (filmFailed || framesReady) return;
      filmFailed = true;
      ring.style.display = 'none';
      stage.classList.add('film-failed');
      posterEnd.style.backgroundImage = `url('${ENDING_URL}')`;
      updateCaptions(shown, performance.now(), true);
    }

    /* Two eases, one loop that rests. */
    let target = 0, shown = 0, fd = 0, rafId = null, lastTick = 0, heroOnScreen = true;
    function tick(now) {
      const dt = Math.min(100, now - (lastTick || now));
      lastTick = now;
      const ease = n => 1 - Math.pow(1 - n, dt / 16.667);
      shown += (target - shown) * ease(0.1);
      const resting = Math.abs(target - shown) < 0.0005;
      if (resting) shown = target;
      const exact = filmT(shown) * (FRAMES - 1);
      const goal = resting ? Math.round(exact) : exact;
      fd += (goal - fd) * ease(resting ? 0.18 : 0.5);
      const settled = resting && Math.abs(goal - fd) < 0.01;
      if (settled) fd = goal;
      drawFrame(fd);
      updateCaptions(shown, now, settled);
      if (settled) { rafId = null; lastTick = 0; } else rafId = requestAnimationFrame(tick);
    }
    function onScroll() {
      target = heroProgress();
      if (rafId === null && heroOnScreen && scrubOn) rafId = requestAnimationFrame(tick);
    }
    new IntersectionObserver(es => {
      heroOnScreen = es[0].isIntersecting;
      if (heroOnScreen) onScroll();
    }).observe(hero);

    function startLoadRamp() {
      let t0 = 0;
      const step = now => {
        if (!t0) t0 = now;
        loadK = easeOut(clamp((now - t0) / 1600, 0, 1));
        updateCaptions(shown, now, true);
        if (loadK < 1) requestAnimationFrame(step);
      };
      let went = false;
      const go = () => { if (!went) { went = true; requestAnimationFrame(step); } };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      setTimeout(go, 900);
    }

    let heroInit = false;
    function initHeroOnce() {
      if (heroInit) return;
      heroInit = true;
      measure();
      poster.style.backgroundImage = `url('${POSTER_URL}')`;
      const afterLoad = () => (document.readyState === 'complete' ? setTimeout(startFrames, 0) : addEventListener('load', () => setTimeout(startFrames, 0), { once: true }));
      const img = new Image();
      img.onload = afterLoad;
      img.onerror = afterLoad;
      img.src = POSTER_URL;
      setTimeout(startFrames, 5000);
      startLoadRamp();
    }

    enableScrub = () => {
      if (scrubOn) return;
      scrubOn = true;
      initHeroOnce();
      addEventListener('scroll', onScroll, { passive: true });
      bands.forEach(b => { b.op = -1; b.k = -1; b.vis = undefined; b.cta = null; });
      hudOff = null; lastLabel = ''; lastEnd = -1; lastRl = -1; lastRt = -1;
      target = shown = heroProgress();
      fd = filmT(shown) * (FRAMES - 1);
      measure();
      if (framesReady) { sizeCanvas(); drawFrame(fd, true); }
      updateCaptions(shown, performance.now(), true);
      onScroll();
    };
    disableScrub = () => {
      if (!scrubOn) return;
      scrubOn = false;
      removeEventListener('scroll', onScroll);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; lastTick = 0; }
    };
    heroResize = () => { if (scrubOn) { sizeCanvas(); drawFrame(fd, true); onScroll(); } };
  }

  // The static hero's plate: the ending frame, loaded only when the static hero is showing.
  const hsImg = $('.hs-img');
  function armStaticPlate() {
    if (hsImg && gated() && !hsImg.getAttribute('href')) hsImg.setAttribute('href', ENDING_URL);
  }

  /* =========================================================
     Reveals, living elements, pause on hidden tabs
     ========================================================= */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    revealIO.unobserve(el);
    const n = $$('.rc', el).length;
    setTimeout(() => el.classList.add('settled'), 1200 + n * 110);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  $$('.rv').forEach(el => revealIO.observe(el));

  const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec').forEach(s => liveIO.observe(s));

  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* =========================================================
     Nav and mobile menu
     ========================================================= */
  const nav = $('.nav');
  const menuBtn = $('.menu-btn');
  const menu = $('#mobile-menu');
  let menuOpen = false, navScrolled = null, navTucked = null, lastY = scrollY;
  function toggleMenu(open) {
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    if (open) {
      setTuck(false);
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('open'));
      document.body.style.overflow = 'hidden';
      const first = $('a', menu);
      if (first) first.focus({ preventScroll: true });
    } else {
      menu.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 460);
    }
  }
  function setTuck(t) { if (t !== navTucked) { navTucked = t; nav.classList.toggle('tucked', t); } }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => toggleMenu(!menuOpen));
    $$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { toggleMenu(false); menuBtn.focus(); } });
  }
  nav.addEventListener('focusin', () => setTuck(false));

  /* =========================================================
     Mark what's changed: the plan, outlined in red
     ========================================================= */
  const markSec = $('#mark');
  if (markSec) {
    const picked = new Set();
    const togs = $$('.tog', markSec);
    const zones = $$('.zone', markSec);
    const items = $$('.needs-list li', markSec);
    const empty = $('.needs-empty', markSec);
    const cta = $('#mark-cta');
    const render = () => {
      togs.forEach(t => t.setAttribute('aria-pressed', String(picked.has(t.dataset.z))));
      zones.forEach(z => z.classList.toggle('on', picked.has(z.dataset.z)));
      items.forEach(li => { li.hidden = !picked.has(li.dataset.z); });
      empty.hidden = picked.size > 0;
      cta.hidden = picked.size === 0;
    };
    const flip = z => { if (picked.has(z)) picked.delete(z); else picked.add(z); render(); };
    togs.forEach(t => t.addEventListener('click', () => flip(t.dataset.z)));
    zones.forEach(z => z.addEventListener('click', () => flip(z.dataset.z)));
    cta.addEventListener('click', () => {
      const form = $('#quote-form');
      if (!form) return;
      const names = togs.filter(t => picked.has(t.dataset.z)).map(t => t.textContent.trim());
      form.elements.need.value = 'Certificate of compliance';
      const msg = form.elements.message;
      const line = 'Changes to the property: ' + names.join(', ') + '.';
      if (!msg.value.includes('Changes to the property:')) msg.value = msg.value ? line + '\n' + msg.value : line;
      else msg.value = msg.value.replace(/Changes to the property:[^\n]*/, line);
      setTimeout(() => { const f = form.elements.name; if (f) f.focus({ preventScroll: true }); }, reduced() ? 0 : 1100);
    });
    render();
  }

  /* =========================================================
     How it works: the red line draws across on scroll
     ========================================================= */
  const howTrack = $('.how-track');
  const howPath = $('.how-line path');
  let howLast = -1, pinned = false;
  function measureHow() {
    if (!howTrack) return;
    const fig = $('.step figure', howTrack);
    if (fig) howTrack.style.setProperty('--img-h', fig.offsetHeight + 'px');
  }
  function updateHowLine() {
    if (!howTrack || !howPath) return;
    const r = howTrack.getBoundingClientRect();
    if (!pinned && (r.bottom < 0 || r.top > innerHeight)) return;
    const prog = pinned ? 1 : clamp((innerHeight * 0.85 - r.top) / (r.height * 0.8), 0, 1);
    const v = Math.round(prog * 200) / 200;
    if (v !== howLast) { howLast = v; howPath.style.strokeDashoffset = (1 - v).toFixed(3); }
  }
  // Service pages: the vertical steps fill in red as you read down
  const vsteps = $$('.vsteps');
  const vLast = vsteps.map(() => -1);
  function updateVSteps() {
    vsteps.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (!pinned && (r.bottom < -100 || r.top > innerHeight + 100)) return;
      const prog = pinned ? 1 : clamp((innerHeight * 0.7 - r.top) / r.height, 0, 1);
      const v = Math.round(prog * 200) / 200;
      if (v !== vLast[i]) { vLast[i] = v; el.style.setProperty('--vp', v); }
    });
  }

  /* =========================================================
     FAQ accordion
     ========================================================= */
  $$('.qa-q').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    btn.closest('.qa').classList.toggle('open', open);
  }));

  /* =========================================================
     The quote form: the one call to action
     ========================================================= */
  // DEPLOY STEP: paste a form service endpoint here (for example https://formspree.io/f/xxxxxxx).
  // Until it is set, the button opens the visitor's email app with the request filled in, addressed to Kevin.
  const FORM_ENDPOINT = '';
  const TO = 'kwa819@gmail.com';
  const form = $('#quote-form');
  if (form) {
    const status = $('.form-status', form);
    if (form.dataset.need) form.elements.need.value = form.dataset.need;
    const MSG = {
      name: 'Please tell us your name.',
      email: 'Please check your email address.',
      address: 'Where is the property?'
    };
    const setErr = (input, msg) => {
      const field = input.closest('.field');
      field.classList.toggle('bad', !!msg);
      $('.err', field).textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    const validate = () => {
      let first = null;
      ['name', 'email', 'address'].forEach(n => {
        const el = form.elements[n];
        const v = el.value.trim();
        const bad = !v || (n === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v));
        setErr(el, bad ? MSG[n] : '');
        if (bad && !first) first = el;
      });
      if (first) first.focus();
      return !first;
    };
    ['name', 'email', 'address'].forEach(n => form.elements[n].addEventListener('input', e => {
      if (e.target.closest('.field').classList.contains('bad')) setErr(e.target, '');
    }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      status.textContent = '';
      status.classList.remove('err');
      if (!validate()) return;
      const data = new FormData(form);
      if (data.get('_gotcha')) return;
      const first = String(data.get('name')).trim().split(/\s+/)[0];
      if (!FORM_ENDPOINT) {
        const subject = `Quote request: ${data.get('need')}, ${data.get('address')}`;
        const body = [
          `Name: ${data.get('name')}`,
          `Firm: ${data.get('firm') || '-'}`,
          `Email: ${data.get('email')}`,
          `Phone: ${data.get('phone') || '-'}`,
          `Property: ${data.get('address')}`,
          `Needs: ${data.get('need')}`,
          `Closing date: ${data.get('closing') || '-'}`,
          '',
          String(data.get('message') || '')
        ].join('\n');
        location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        status.textContent = 'Your email app should open with the request ready. Just press send.';
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Form service said ' + res.status);
        $('.fd-name', form).textContent = first ? `, ${first}` : '';
        $('.form-done', form).hidden = false;
        form.classList.add('sent');
      } catch (_) {
        status.textContent = `That didn't send. Please email ${TO} or call 086 272 1126.`;
        status.classList.add('err');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* =========================================================
     One page-scroll frame for everything outside the hero
     ========================================================= */
  let pageTicking = false;
  function pageFrame() {
    pageTicking = false;
    const y = scrollY;
    const sc = y > 40;
    if (sc !== navScrolled) { navScrolled = sc; nav.classList.toggle('scrolled', sc); }
    if (!menuOpen && !reduced()) {
      if (y > lastY + 6 && y > 200 && !nav.contains(document.activeElement)) setTuck(true);
      else if (y < lastY - 6 || y < 200) setTuck(false);
    }
    lastY = y;
    updateHowLine();
    updateVSteps();
  }
  function onPageScroll() { if (!pageTicking) { pageTicking = true; requestAnimationFrame(pageFrame); } }
  addEventListener('scroll', onPageScroll, { passive: true });
  addEventListener('resize', () => {
    measureHow();
    howLast = -1;
    heroResize();
    onPageScroll();
  });
  addEventListener('load', () => { measureHow(); onPageScroll(); });

  /* =========================================================
     Live modes: the gates re-evaluate on rotate, resize and preference flips
     ========================================================= */
  function applyHeroMode() {
    if (gated()) { disableScrub(); armStaticPlate(); } else if (hasFilm) enableScrub();
    onPageScroll();
  }
  function pinToFinalStates() {
    pinned = true;
    howLast = -1;
    vLast.fill(-1);
    updateHowLine();
    updateVSteps();
    setTuck(false);
  }
  function unpinFinalStates() {
    pinned = false;
    howLast = -1;
    vLast.fill(-1);
    updateHowLine();
    updateVSteps();
  }
  MQLS.forEach(m => onMQ(m, applyHeroMode));
  onMQ(RM, e => {
    applyGlide();
    if (e.matches) pinToFinalStates();
    else { unpinFinalStates(); applyHeroMode(); }
  });
  onMQ(FINE, applyGlide);

  measureHow();
  applyGlide();
  applyHeroMode();
  if (reduced()) pinToFinalStates();
  pageFrame();
})();
