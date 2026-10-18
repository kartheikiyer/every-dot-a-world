/* Wiring: URL state (#seed=…&mode=…&d=…), controls, renderer, sheet. */
(function () {
  const EXO = window.EXO;
  let view = null, sys = null, specMode = 'transmission';
  try { view = new EXO.PlanetView(document.getElementById('planet')); }
  catch (e) { console.warn(e); document.getElementById('glfail').hidden = false; }
  window.__exoView = view;
  const surfCanvas = document.createElement('canvas');
  surfCanvas.setAttribute('aria-label', 'Artist-style view from the planet\'s surface');
  let surf = null;
  try { surf = new EXO.SurfaceView(surfCanvas); } catch (e) { console.warn(e); }
  window.__exoSurf = surf;

  // distance slider: log scale 1–100 ly
  const sliderToLy = (v) => Math.pow(10, 2 * v / 1000);
  const lyToSlider = (ly) => Math.round(Math.log10(ly) / 2 * 1000);

  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    return { seed: q.get('seed'), mode: q.get('mode') === 'realistic' ? 'realistic' : 'interesting', d: Math.min(100, Math.max(1, parseFloat(q.get('d')) || 10)) };
  }
  let state = readHash();
  function writeHash(push) {
    const h = `#seed=${encodeURIComponent(state.seed)}&mode=${state.mode}&d=${+state.d.toFixed(2)}`;
    if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
  }

  function hexOf(rgb) { return '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join(''); }
  function setAccent(teff) {
    // lift the star colour into a readable UI accent
    let c = EXO.blackbodyRGB(teff);
    const m = Math.max(...c); c = c.map((x) => x / m);
    c = c.map((x) => 0.35 + 0.65 * x);
    document.documentElement.style.setProperty('--star', hexOf(c));
    document.documentElement.style.setProperty('--star-soft', `rgba(${c.map((x) => Math.round(x * 255))},0.22)`);
  }

  function load(push) {
    if (!state.seed) state.seed = EXO.randomSeed();
    sys = EXO.generate(state.seed, state.mode);
    writeHash(push);
    document.getElementById('seedInput').value = state.seed;
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    document.title = `${sys.planet.name} – Every Dot a World`;
    setAccent(sys.star.teff);
    if (view) view.setPlanet(sys.planet.vis);
    EXO.ui.renderSheet(sys, state);
    const slot = document.getElementById('surfSlot');
    if (surf && slot) {
      slot.appendChild(surfCanvas);
      const scene = EXO.makeSurfaceScene(sys.planet, sys.star);
      surf.setScene(scene);
      document.getElementById('surfCaption').textContent = scene.caption;
    } else if (slot) {
      slot.innerHTML = '<p class="glfail">WebGL is unavailable, so the surface view can\'t be drawn.</p>';
    }
    EXO.ui.drawHZ(sys);
    EXO.ui.drawXSection(sys);
    const slider = document.getElementById('dist');
    slider.value = lyToSlider(state.d);
    slider.addEventListener('input', () => {
      state.d = sliderToLy(+slider.value);
      updateDistance();
      writeHash(false);
    });
    document.querySelectorAll('[data-spec]').forEach((b) => b.addEventListener('click', () => { specMode = b.dataset.spec; updateSpec(); }));
    updateDistance();
  }
  function updateDistance() {
    const d = state.d;
    document.getElementById('distOut').textContent = `${d < 10 ? d.toFixed(1) : Math.round(d)} light-years`;
    EXO.ui.renderObservability(sys, d);
    updateSpec();
  }
  function updateSpec() {
    document.querySelectorAll('[data-spec]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spec === specMode)));
    EXO.ui.drawSpectrum(sys, specMode, state.d);
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 1800);
  }

  document.getElementById('newPlanet').addEventListener('click', () => { state.seed = EXO.randomSeed(); load(true); window.scrollTo({ top: 0 }); });
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode; load(true);
  }));
  document.getElementById('seedForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = document.getElementById('seedInput').value.trim().toUpperCase();
    if (!v) { toast('Type a seed first, or press New planet.'); return; }
    state.seed = v; load(true);
  });
  document.getElementById('copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
    catch { toast('Copy failed; the link is in the address bar.'); }
  });
  window.addEventListener('popstate', () => { state = readHash(); load(false); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') document.getElementById('newPlanet').click();
  });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sys) { EXO.ui.drawHZ(sys); updateSpec(); } }, 150); });

  load(false);
})();
