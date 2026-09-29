/* Kevin Walsh & Associates: the red line, the plan.
   Plain JS. Everything that moves eases, rests when idle, and honours reduced motion.
   Shared by the home page and the service pages: every part checks its elements exist. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const onMQ = (m, fn) => (m.addEventListener ? m.addEventListener('change', fn) : m.addListener(fn));

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
  // Enquiries go through Web3Forms (web3forms.com) straight to Kevin's inbox, with Reply set to the visitor.
  // Access key for kwa819@gmail.com (public by design: it can only send to that inbox).
  // If sending ever fails, the visitor gets the same request as a ready-to-send email instead.
  const TO = 'kwa819@gmail.com';
  const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
  const WEB3FORMS_KEY = 'd126d0b0-9a7c-4eb4-8587-7989c34d2416';
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
      if (data.get('_honey')) return;
      const v = k => String(data.get(k) || '').trim();
      const first = v('name').split(/\s+/)[0];
      const payload = {
        'name': v('name'),
        'email': v('email'),
        'Phone': v('phone') || '-',
        'Firm': v('firm') || '-',
        'Property address': v('address'),
        'What they need': v('need'),
        'Closing date': v('closing') || '-',
        'Message': v('message') || '-',
        'Sent from': location.pathname
      };
      const subject = `Website quote request: ${v('need')}, ${v('address')}`;
      const mail = () => {
        const body = Object.entries(payload).map(([k, val]) => `${k[0].toUpperCase() + k.slice(1)}: ${val}`).join('\n');
        return `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      };
      // Never lose an enquiry: offer the same request as a ready-to-send email instead.
      const offerEmail = lead => {
        status.textContent = lead;
        const a = document.createElement('a');
        a.href = mail();
        a.textContent = 'Email it to Kevin instead';
        status.append(a, ' (your request is already filled in), or call 086 272 1126.');
      };
      if (!WEB3FORMS_KEY) {
        location.href = mail();
        offerEmail('Your email app should open with the request ready, so just press send. If it didn’t open: ');
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending your request…';
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject, from_name: 'Kevin Walsh & Associates website', ...payload })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.success !== true) throw new Error(out.message || 'Form service said ' + res.status);
        status.textContent = '';
        $('.fd-name', form).textContent = first ? `, ${first}` : '';
        $('.form-done', form).hidden = false;
        form.classList.add('sent');
      } catch (_) {
        offerEmail("That didn't send. ");
        status.classList.add('err');
      } finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
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
    onPageScroll();
  });
  addEventListener('load', () => { measureHow(); onPageScroll(); });

  /* =========================================================
     Live modes: the gates re-evaluate on rotate, resize and preference flips
     ========================================================= */
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
  onMQ(RM, e => {
    applyGlide();
    if (e.matches) pinToFinalStates();
    else unpinFinalStates();
  });
  onMQ(FINE, applyGlide);

  measureHow();
  applyGlide();
  onPageScroll();
  if (reduced()) pinToFinalStates();
  pageFrame();
})();
