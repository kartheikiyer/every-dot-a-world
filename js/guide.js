/* First-visit splash screen and a short guided tour of the page. */
(function () {
  const KEY = 'everydot-seen-intro';
  const $ = (id) => document.getElementById(id);
  const splash = $('splash'), tour = $('tour'), ring = $('tourRing'), tip = $('tourTip');
  let lastFocus = null;

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ } }

  function openSplash() {
    lastFocus = document.activeElement;
    splash.hidden = false;
    $('splashGo').focus();
  }
  function closeSplash() {
    splash.hidden = true;
    markSeen();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  const STEPS = [
    { sel: '.stage', text: 'This is your planet, rendered from its physics: its colours, clouds, rings and glow all come from the model. Drag it to look around; double-click to reset.' },
    { sel: '.hero', text: 'Its name, type and a one-line summary. The numbers underneath are the essentials: size, mass, temperature, orbit and a habitability score.' },
    { sel: '.sec.surface', text: 'What it might look like standing on it: the sky colour comes from how this atmosphere scatters this star’s light, and the star is drawn at its true size.' },
    { sel: 'details.why', text: 'Every section has a “Why these values?” note. Open it to see the reasoning and the papers each number comes from.' },
    { sel: '#obsSec .distrow', text: 'Slide to move the system nearer or farther, and see which telescopes — working now or planned — could detect it.' },
    { sel: '#specSec', text: 'A simulated spectrum: the fingerprints of its gases, and which ones JWST could actually pick out.' },
    { sel: '.controls', text: 'Make a new world, switch between Interesting and Realistic, or copy a link to share this exact planet. Press N for a new planet anytime.' }
  ];
  let step = 0;

  function place() {
    const s = STEPS[step];
    const el = document.querySelector(s.sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const minTop = s.sel === '.controls' ? 4 : 70; // stay below the sticky header
    const top = Math.max(minTop, r.top - pad), left = Math.max(4, r.left - pad);
    const w = Math.min(window.innerWidth - left - 4, r.width + pad * 2);
    const h = Math.min(window.innerHeight - top - 4, r.height + pad * 2);
    Object.assign(ring.style, { top: top + 'px', left: left + 'px', width: w + 'px', height: h + 'px' });
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let ty = top + h + 12;
    if (ty + th > window.innerHeight - 8) ty = Math.max(8, top - th - 12);
    if (ty < 8 || (ty > top && ty < top + h)) ty = Math.min(window.innerHeight - th - 8, top + 16);
    let tx = Math.min(Math.max(8, left), window.innerWidth - tw - 8);
    Object.assign(tip.style, { top: ty + 'px', left: tx + 'px' });
  }
  function show() {
    const s = STEPS[step];
    const el = document.querySelector(s.sel);
    $('tourText').textContent = s.text;
    $('tourCount').textContent = `${step + 1} of ${STEPS.length}`;
    $('tourBack').disabled = step === 0;
    $('tourNext').textContent = step === STEPS.length - 1 ? 'Done' : 'Next';
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 40) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(place, reduce ? 30 : 420);
      }
    }
    place();
    $('tourNext').focus();
  }
  function startTour() {
    closeSplash();
    step = 0;
    tour.hidden = false;
    show();
  }
  function endTour() { tour.hidden = true; markSeen(); }

  $('splashGo').addEventListener('click', closeSplash);
  $('splashTour').addEventListener('click', startTour);
  $('openGuide').addEventListener('click', openSplash);
  $('tourNext').addEventListener('click', () => { if (step < STEPS.length - 1) { step++; show(); } else endTour(); });
  $('tourBack').addEventListener('click', () => { if (step > 0) { step--; show(); } });
  splash.addEventListener('click', (e) => { if (e.target === splash) closeSplash(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!splash.hidden) closeSplash(); else if (!tour.hidden) endTour(); }
    if (!tour.hidden && e.key === 'ArrowRight') $('tourNext').click();
    if (!tour.hidden && e.key === 'ArrowLeft') $('tourBack').click();
  });
  window.addEventListener('resize', () => { if (!tour.hidden) place(); });
  window.addEventListener('scroll', () => { if (!tour.hidden) place(); }, { passive: true });

  if (!seen() || new URLSearchParams(location.search).has('intro')) openSplash();
})();
