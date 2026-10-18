/* Wiring: URL state (#seed=…&mode=…&d=…&view=…&p=…), controls, renderer, guide pages, model inputs. */
(function () {
  const EXO = window.EXO;
  let view = null, base = null, sys = null, specMode = 'transmission';
  try { view = new EXO.PlanetView(document.getElementById('planet')); }
  catch (e) { console.warn(e); document.getElementById('glfail').hidden = false; }
  window.__exoView = view;
  const surfCanvas = document.createElement('canvas');
  surfCanvas.setAttribute('aria-label', 'Artist-style view from the planet\'s surface');
  let surf = null;
  try { surf = new EXO.SurfaceView(surfCanvas); } catch (e) { console.warn(e); }
  window.__exoSurf = surf;
  const $ = (id) => document.getElementById(id);

  // distance slider: log scale 1–100 ly
  const sliderToLy = (v) => Math.pow(10, 2 * v / 1000);
  const lyToSlider = (ly) => Math.round(Math.log10(ly) / 2 * 1000);

  // edited model inputs ride in the hash as p=s.mass:0.42,i.P:12.5
  function parseOverrides(str) {
    const o = { star: {}, init: {} };
    (str || '').split(',').forEach((pair) => {
      const m = /^([si])\.(\w+):(-?[\d.eE+-]+)$/.exec(pair.trim());
      if (m && isFinite(+m[3])) o[m[1] === 's' ? 'star' : 'init'][m[2]] = +m[3];
    });
    return o;
  }
  function formatOverrides(o) {
    return [...Object.entries(o.star).map(([k, v]) => `s.${k}:${+v.toPrecision(6)}`), ...Object.entries(o.init).map(([k, v]) => `i.${k}:${+v.toPrecision(6)}`)].join(',');
  }
  const hasOverrides = (o) => Object.keys(o.star).length + Object.keys(o.init).length > 0;

  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    return {
      seed: q.get('seed'),
      mode: q.get('mode') === 'realistic' ? 'realistic' : 'interesting',
      d: Math.min(100, Math.max(1, parseFloat(q.get('d')) || 10)),
      view: q.get('view') === 'key' ? 'key' : 'guide',
      over: parseOverrides(q.get('p'))
    };
  }
  let state = readHash();
  function writeHash(push) {
    let h = `#seed=${encodeURIComponent(state.seed)}&mode=${state.mode}&d=${+state.d.toFixed(2)}`;
    if (state.view === 'key') h += '&view=key';
    if (hasOverrides(state.over)) h += `&p=${formatOverrides(state.over)}`;
    if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
  }

  // ---- build the system: the seed's draw, optionally re-derived from edited inputs
  function build() {
    base = EXO.generate(state.seed, state.mode);
    state.custom = hasOverrides(state.over);
    if (!state.custom) return base;
    const s = base.star;
    let spec;
    if (s.isWD) spec = Object.assign({}, s);
    else {
      spec = { mass: s.mass, age: s.age, feh: s.feh, cls: s.cls, tMS: s.tMS };
      Object.assign(spec, state.over.star);
      if ('mass' in state.over.star) { delete spec.cls; spec.tMS = 10 * Math.pow(spec.mass, -2.5); }
    }
    spec.name = s.name;
    const init = Object.assign({}, base.planet.init, state.over.init, { name: base.planet.name });
    const c = EXO.customSystem(spec, init, `${state.seed}#${base.index}`);
    return Object.assign(c, { seed: state.seed, mode: state.mode, considered: base.considered, index: base.index });
  }
  function currentInputs() {
    const s = base.star, i = base.planet.init;
    return {
      star: Object.assign({ mass: s.mass, age: s.age, feh: s.feh }, state.over.star),
      init: Object.assign({}, i, state.over.init)
    };
  }

  function setView(v) {
    state.view = v;
    document.body.dataset.view = v;
    document.querySelectorAll('.view button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === v)));
    $('inputs').hidden = v !== 'key';
  }

  // full render; opts.draw plays the plate-drawing transition, opts.inputs rebuilds the inputs form
  function load(push, opts) {
    opts = opts || {};
    if (!state.seed) state.seed = EXO.randomSeed();
    sys = build();
    writeHash(push);
    $('seedInput').value = state.seed;
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    setView(state.view);
    document.title = `${sys.planet.name} – Every Dot a World`;
    $('plateNo').textContent = `Plate ${state.seed}`;
    $('plateKind').textContent = `${sys.star.spt} ${sys.star.className} host`;
    if (view) {
      view.setPlanet(sys.planet.vis);
      if (opts.draw) {
        const st = document.querySelector('.stage');
        st.classList.remove('drawing'); void st.offsetWidth; st.classList.add('drawing');
      }
    }
    if (opts.inputs !== false) EXO.ui.renderInputs(base, currentInputs());
    renderPages();
    EXO.ui.drawHZ(sys);
    EXO.ui.drawXSection(sys);
  }

  function renderPages() {
    EXO.ui.renderIdent(sys, state);
    EXO.ui.renderSheet(sys, state);
    const slot = $('surfSlot');
    if (surf && slot) {
      slot.appendChild(surfCanvas);
      const scene = EXO.makeSurfaceScene(sys.planet, sys.star);
      surf.setScene(scene);
      $('surfCaption').textContent = scene.caption;
      $('polLabel').innerHTML = `${escHtml(sys.planet.name)}<small>${scene.label}</small>`;
      if (state.view !== 'key') $('surfHead').textContent = `${scene.label.charAt(0).toUpperCase() + scene.label.slice(1)} on ${sys.planet.name}`;
      $('savePostcard').onclick = () => savePostcard(scene);
    } else if (slot) {
      slot.innerHTML = '<p class="glfail">WebGL is unavailable, so the surface view can\'t be drawn.</p>';
    }
    const slider = $('dist');
    slider.value = lyToSlider(state.d);
    slider.addEventListener('input', () => {
      state.d = sliderToLy(+slider.value);
      updateDistance();
      writeHash(false);
    });
    document.querySelectorAll('[data-spec]').forEach((b) => b.addEventListener('click', () => { specMode = b.dataset.spec; updateSpec(); }));
    updateDistance();
    spy();
  }
  function updateDistance() {
    const d = state.d;
    $('distOut').textContent = `${d < 10 ? d.toFixed(1) : Math.round(d)} light-years`;
    EXO.ui.renderObservability(sys, d, state.view);
    updateSpec();
  }
  function updateSpec() {
    document.querySelectorAll('[data-spec]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.spec === specMode)));
    EXO.ui.drawSpectrum(sys, specMode, state.d, state.view);
  }

  function escHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  async function savePostcard(scene) {
    try { await document.fonts.load('600 64px Caveat'); } catch { /* fallback font */ }
    const W = 1200, pad = 56, img = W - pad * 2, H = pad + img + 210;
    surf.renderSize(img, performance.now());
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#f3efe7'; g.fillRect(0, 0, W, H);
    g.drawImage(surfCanvas, pad, pad, img, img);
    g.fillStyle = '#2a2a35'; g.textAlign = 'center';
    g.font = '600 76px Caveat, "Segoe Print", cursive';
    g.fillText(sys.planet.name, W / 2, pad + img + 100);
    g.fillStyle = '#5a5a66'; g.font = '400 48px Caveat, "Segoe Print", cursive';
    g.fillText(`${scene.label} — Every Dot a World`, W / 2, pad + img + 160);
    c.toBlob((blob) => {
      if (!blob) { toast('Could not create the image in this browser.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${sys.planet.name.replace(/[^A-Za-z0-9+-]+/g, '-')}-surface.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Image saved');
    }, 'image/png');
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 1800);
  }

  // ---- thumb tabs follow the page being read
  const tabs = () => document.querySelectorAll('#tabs a');
  let spyRaf = 0;
  function spy() {
    cancelAnimationFrame(spyRaf);
    spyRaf = requestAnimationFrame(() => {
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 0) + 140;
      let cur = 'plate';
      document.querySelectorAll('[data-page]:not(#tabs a)').forEach((el) => { if (el.getBoundingClientRect().top <= line) cur = el.dataset.page; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = 'sources';
      tabs().forEach((a) => a.setAttribute('aria-current', String(a.dataset.page === cur)));
    });
  }
  window.addEventListener('scroll', spy, { passive: true });

  // keep the sticky offsets in step with the top bar's real height
  const bar = document.querySelector('.topbar');
  const syncBar = () => document.documentElement.style.setProperty('--bar', (getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0) + 'px');
  try { new ResizeObserver(syncBar).observe(bar); } catch (e) { /* older browsers keep the default */ }
  syncBar();

  // ---- controls
  $('newPlanet').addEventListener('click', () => {
    state.seed = EXO.randomSeed(); state.over = { star: {}, init: {} };
    load(true, { draw: true }); window.scrollTo({ top: 0 });
  });
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
    if (state.mode === b.dataset.mode) return;
    state.mode = b.dataset.mode; state.over = { star: {}, init: {} };
    load(true, { draw: true });
  }));
  document.querySelectorAll('.view button').forEach((b) => b.addEventListener('click', () => {
    if (state.view === b.dataset.view) return;
    setView(b.dataset.view);
    writeHash(false);
    renderPages();
  }));
  $('seedForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('seedInput').value.trim().toUpperCase();
    if (!v) { toast('Type a seed first, or press New planet.'); return; }
    state.seed = v; state.over = { star: {}, init: {} };
    load(true, { draw: true });
  });
  $('copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
    catch { toast('Copy failed; the link is in the address bar.'); }
  });

  // ---- model inputs (Technical key)
  let editT;
  $('inputs').addEventListener('input', (e) => {
    if (!e.target.matches('input[data-k]')) return;
    clearTimeout(editT);
    editT = setTimeout(() => {
      const over = { star: {}, init: {} };
      let ok = true;
      $('inputs').querySelectorAll('input[data-k]').forEach((inp) => {
        const grp = inp.dataset.grp, k = inp.dataset.k;
        if (!inp.checkValidity() || inp.value === '') { ok = false; return; }
        const v = +inp.value;
        const orig = grp === 'star' ? base.star[k] : base.planet.init[k];
        if (Math.abs(v - orig) > Math.max(Math.abs(orig) * 1e-4, +inp.step / 2)) over[grp][k] = v;
      });
      if (!ok) return;
      state.over = over;
      load(false, { inputs: false });
    }, 250);
  });
  $('inputs').addEventListener('click', async (e) => {
    if (e.target.id === 'resetInputs') { state.over = { star: {}, init: {} }; load(false); toast('Inputs reset to the seed'); }
    if (e.target.id === 'copyParams') {
      const s = sys.star, i = Object.assign({}, sys.planet.init);
      delete i.name; delete i.visSeed; delete i.paletteRoll; delete i.spotRoll; delete i.ringRoll;
      const json = JSON.stringify({ seed: state.seed, mode: state.mode, edited: state.custom, star: { name: s.name, mass: s.mass, age: s.age, feh: s.feh, teff: s.teff, lum: s.lum, radius: s.radius }, init: i }, null, 2);
      try { await navigator.clipboard.writeText(json); toast('Parameters copied as JSON'); }
      catch { toast('Copy failed in this browser.'); }
    }
  });

  window.addEventListener('popstate', () => { state = readHash(); load(false); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) $('newPlanet').click();
  });
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sys) { EXO.ui.drawHZ(sys); EXO.ui.drawXSection(sys); updateSpec(); spy(); } }, 150); });

  EXO.ui.renderTabs();
  load(false);
})();
