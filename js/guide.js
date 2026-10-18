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
    { sel: '.stage', text: 'This is your planet, drawn from its physics: its colours, clouds, rings and glow all come from the model. Drag it to look around; double-click to reset.' },
    { sel: '.ident', text: 'Its name, type and a one-line summary, the five essential numbers, and its field marks: the few facts that set this world apart. Each field mark links to the page that explains it.' },
    { sel: '.minis', text: 'Where its orbit sits against the habitable zone, and a slice through its interior.' },
    { sel: '#tabs', text: 'Like a field guide, each tab turns to a page: the view from the surface, its star, orbit, body, air, magnetic field, habitability, similar known worlds, and whether we could observe it.' },
    { sel: 'details.why', text: 'Every page has a “Why these values?” note. Open it to see the reasoning and the papers each number comes from.' },
    { sel: '#sec-observe .distrow', text: 'Slide to move the system nearer or farther, and see which telescopes, working now or planned, could detect it.' },
    { sel: '.view', text: 'Technical key shows every value, unit and note up front, and lets you edit the model\'s inputs. Field guide brings you back.' },
    { sel: '.controls', text: 'Make a new world, switch between Interesting and Realistic, or copy a link to share this exact planet. Press N for a new planet anytime.' }
  ];
  let step = 0;

  function place() {
    const s = STEPS[step];
    const el = document.querySelector(s.sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 0;
    const minTop = (s.sel === '.controls' || s.sel === '.view') ? 4 : barH + 8; // stay below the sticky header
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
