/* DOM rendering: identification, guide pages, thumb tabs, model inputs and the small canvases. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const f = () => EXO.fmt.num;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUB = { H2O: 'H₂O', CH4: 'CH₄', CO2: 'CO₂', CO: 'CO', NH3: 'NH₃', O2: 'O₂', O3: 'O₃', SO2: 'SO₂', H2S: 'H₂S', HCN: 'HCN', Na: 'Na', K: 'K', TiO: 'TiO', VO: 'VO', SiO: 'SiO', N2: 'N₂', H2: 'H₂', He: 'He', Ar: 'Ar' };
  const mol = (m) => SUB[m] || m;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const article = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
  const css = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);

  // Guide pages, in reading order. Each owns one thumb-tab ink.
  const PAGES = [
    { id: 'plate', tab: 'Plate', ink: '--t-plate' },
    { id: 'surface', tab: 'Surface', ink: '--t-surface', title: 'View from the surface' },
    { id: 'star', tab: 'Star', ink: '--t-star', title: 'Host star' },
    { id: 'orbit', tab: 'Orbit', ink: '--t-orbit', title: 'Orbit and rotation' },
    { id: 'body', tab: 'Body', ink: '--t-body', title: 'Interior and bulk composition' },
    { id: 'air', tab: 'Air', ink: '--t-air', title: 'Atmosphere and climate' },
    { id: 'field', tab: 'Field', ink: '--t-field', title: 'Magnetic field' },
    { id: 'life', tab: 'Life', ink: '--t-life', title: 'Habitability' },
    { id: 'similar', tab: 'Similar', ink: '--t-kin', title: 'Most similar known worlds' },
    { id: 'observe', tab: 'Observe', ink: '--t-observe', title: 'Could we observe it?' },
    { id: 'sources', tab: 'Sources', ink: '--t-sources', title: 'About the model' }
  ];
  const INK = Object.fromEntries(PAGES.map((p) => [p.id, p.ink]));

  function refLinks(keys) {
    return (keys || []).map((k) => {
      const r = EXO.REFS[k];
      if (!r) return '';
      return `<a class="ref" href="#ref-${k}" title="${esc(r.cite + ': ' + r.note)}">[${esc(r.cite.split(/,| \(/)[0])}]</a>`;
    }).join('');
  }
  function why(notes, title, open) {
    if (!notes || !notes.length) return '';
    return `<details class="why"${open ? ' open' : ''}><summary>${title || 'Why these values?'}</summary><ul>${notes.map((n) => `<li>${esc(n.text)}${refLinks(n.refs)}</li>`).join('')}</ul></details>`;
  }
  const kv = (rows) => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const all = (rows, open) => `<details class="all"${open ? ' open' : ''}><summary>All measurements</summary>${kv(rows)}</details>`;
  const figs = (cells) => `<div class="figs">${cells.filter(Boolean).map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;

  function fmtDays(d) {
    const n = f();
    if (d === Infinity) return 'permanent (one side always faces the star)';
    if (d < 2) return `${n(d * 24)} hours`;
    if (d < 800) return `${n(d)} days`;
    return `${n(d / 365.25)} years`;
  }
  function shortDays(d) {
    const n = f();
    if (d === Infinity) return '∞';
    if (d < 2) return `${n(d * 24)}<small>h</small>`;
    if (d < 800) return `${n(d)}<small>d</small>`;
    return `${n(d / 365.25)}<small>yr</small>`;
  }
  function yearPhrase(d) {
    const n = f();
    if (d < 2) return `${cap(article(n(d * 24)))} ${n(d * 24)}-hour year`;
    if (d < 800) return `A ${n(d)}-day year`;
    return `A year lasting ${n(d / 365.25)} Earth years`;
  }
  function temp(T) { return T == null ? '—' : `${Math.round(T)} K <small>(${Math.round(T - 273.15)} °C)</small>`; }
  const isGiantish = (p) => p.regime !== 'solid' && p.regime !== 'thinH2';
  function ageWords(age) { return age < 1 ? `only ${Math.round(age * 1000)} million years old` : `${f()(age)} billion years old`; }
  function dominantGas(atm) {
    const e = Object.entries((atm && atm.vmr) || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? (EXO.MOLNAMES[e[0]] || e[0]) : 'gas';
  }

  // ---- findings: the one sentence each guide page opens on (derived, never invented)
  function findings(sys) {
    const n = f(), s = sys.star, p = sys.planet;
    const out = {};
    out.star = s.isWD
      ? `A white dwarf, the cooling core of a dead Sun-like star, ${ageWords(s.age)}`
      : `${cap(article(s.className))} ${s.className}, ${ageWords(s.age)}`;
    if (p.locked) out.orbit = `${yearPhrase(p.period)}, with one face always turned to its star`;
    else if (p.e > 0.3) out.orbit = `A stretched orbit, swinging between ${n(p.a * (1 - p.e))} and ${n(p.a * (1 + p.e))} au every ${fmtDays(p.period)}`;
    else out.orbit = `${yearPhrase(p.period)}, and a day lasting ${fmtDays(p.solarDay)}`;
    out.body = isGiantish(p) && p.regime === 'giant'
      ? `${cap(article(p.sizeClass))} ${p.sizeClass} giant ${n(p.radius / EXO.C.RJ)} times as wide as Jupiter`
      : `${cap(article(p.sizeClass))} ${p.sizeClass} world ${n(p.radius)} times as wide as Earth, with ${n(p.gravity)} g of gravity`;
    if (!p.hasAtm) out.air = isGiantish(p) ? 'A thin, escaping envelope' : 'Bare to space: no atmosphere survives here';
    else if (isGiantish(p)) out.air = `A deep hydrogen atmosphere, ${Math.round(p.T1bar || p.Teq)} K at the 1-bar level`;
    else out.air = `${n(p.Psurf)} bar of ${dominantGas(p.atm)}${p.Tsurf != null ? `, ${Math.round(p.Tsurf - 273.15)} °C on average at the surface` : ''}`;
    out.field = p.magnetic.present
      ? `A global magnetic field of ${n(p.magnetic.B)} gauss (Earth's is 0.3)`
      : 'No global magnetic field to shield it';
    out.life = `Habitability ${p.habitability.index} out of 100: ${p.habitability.label.toLowerCase()}`;
    const an = EXO.findAnalogs(p, s);
    out.similar = an.length ? `Most like ${an[0].an.name}, ${an[0].sim}% similar` : 'No close match among known worlds';
    out.sources = 'How this planet was built, and the papers behind it';
    out.surface = 'The view from the surface';
    return out;
  }

  // ---- field marks: the few facts that set this world apart, each linked to its page
  function fieldMarks(sys) {
    const n = f(), s = sys.star, p = sys.planet, c = [];
    const solid = !isGiantish(p);
    const add = (w, b, t, page) => c.push({ w, b, t, page });
    if (s.isWD) add(9, 'Orbits a white dwarf', 'the dead core of a Sun-like star', 'star');
    if (p.vis && p.vis.hasRing) add(8, 'Ringed', 'an icy ring system circles it', 'plate');
    if (p.state === 'super-puff' || p.density < 0.3) add(8, 'Cotton-candy density', `${n(p.density)} g/cm³, less than water's 1.0`, 'body');
    if (p.state === 'lava') add(8, 'Molten dayside', `${Math.round(p.Tday)} K under its star`, 'air');
    if (p.oceanCover >= 0.99 && p.surfaceLiquid) add(7, 'No land at all', 'ocean covers the whole surface', 'air');
    else if (p.oceanCover > 0.05 && p.surfaceLiquid) add(6, `${Math.round(p.oceanCover * 100)}% ocean`, 'liquid water on the surface', 'air');
    if (p.habitability.index >= 50) add(7, 'Promising for life', `habitability ${p.habitability.index} of 100`, 'life');
    if (p.locked) {
      const t = p.lockedClimate === 'eyeball' ? 'an “eyeball” of open water faces the star'
        : p.lockedClimate === 'lobster' ? 'open water stretches along the equator'
        : 'one face always turned to its star';
      add(6, 'Tidally locked', t, 'orbit');
    }
    if (p.e > 0.3) add(6, 'Stretched orbit', `eccentricity ${p.e.toFixed(2)}`, 'orbit');
    if (p.tidalFlux > 1) add(6, 'Squeezed by tides', `${n(p.tidalFlux)} W/m² of tidal heating`, 'body');
    if (solid && !p.hasAtm) add(6, 'No atmosphere', 'bare rock open to space', 'air');
    if (solid && p.hasAtm && p.Psurf > 3) add(5, `Thick ${dominantGas(p.atm)} air`, `${n(p.Psurf)} bar at the surface`, 'air');
    if (solid && p.hasAtm && p.Psurf < 0.3) add(4, 'Thin air', `${n(p.Psurf)} bar at the surface`, 'air');
    if (p.obliquity > 60) add(5, 'Tipped on its side', `axial tilt ${Math.round(p.obliquity)}°`, 'orbit');
    if (s.age < 0.5) add(5, 'A young system', `${Math.round(s.age * 1000)} million years old`, 'star');
    if (p.state === 'snowball' || p.state === 'ice-world') add(6, 'Sealed in ice', p.state === 'ice-world' ? 'an ice shell, perhaps over a hidden ocean' : 'its water frozen into global ice sheets', 'air');
    if (p.Tsurf != null && p.surfaceLiquid && !(p.oceanCover > 0.05)) add(5, 'Liquid water', 'temperatures allow it at the surface', 'air');
    if (p.Tsurf != null && p.Tsurf > 373) add(5, 'Scorching surface', `${Math.round(p.Tsurf - 273.15)} °C on average`, 'air');
    if (p.Tsurf != null && p.Tsurf < 230) add(4, 'Deep freeze', `${Math.round(p.Tsurf - 273.15)} °C on average`, 'air');
    if (!solid && (p.T1bar || 0) > 1500) add(5, 'Glowing hot', `${Math.round(p.T1bar)} K at the 1-bar level`, 'air');
    if (p.magnetic.present && p.magnetic.B > 1) add(4, 'Strong magnetic field', `${n(p.magnetic.B)} G, ${EXO.fmt.ratio(p.magnetic.B / 0.3)} Earth's`, 'field');
    if (solid && !p.magnetic.present) add(3, 'No magnetic shield', 'no global field protects its air', 'field');
    if (/saturated/.test(s.activity || '')) add(4, 'Flaring star', 'its star is still very active', 'star');
    if (!solid) add(2, 'No solid surface', 'a deep hydrogen envelope', 'air');
    add(1, cap(p.sizeClass), `${n(p.radius)} R⊕, ${n(p.mass)} M⊕`, 'body');
    return c.sort((a, b) => b.w - a.w).slice(0, 4);
  }

  // circles drawn to scale on one baseline: the field guide's "shown at the same scale"
  function scaleFigure(items, caption) {
    const maxR = Math.max(...items.map((x) => x.r)), k = 55 / maxR;
    return `<figure class="scale" role="img" aria-label="${esc(caption)}"><div class="scale-row">${items.map((it) => {
      const D = Math.max(3, 2 * it.r * k).toFixed(1);
      return `<div class="si"><span class="disc" style="width:${D}px;height:${D}px;background:${it.fill}"></span><span class="sn">${esc(it.name)}</span><span class="ss">${esc(it.sub)}</span></div>`;
    }).join('')}</div></figure>`;
  }
  // the planet's overall tint: the mean of its five surface/cloud palette colours
  const tintOf = (v) => `rgb(${[0, 1, 2].map((k) => Math.round(255 * v.c.reduce((a, c) => a + c[k], 0) / v.c.length)).join(',')})`;

  EXO.ui = { PAGES, findings };

  // ---- thumb tabs
  EXO.ui.renderTabs = function () {
    const nav = document.getElementById('tabs');
    nav.innerHTML = PAGES.map((p) => `<a href="#sec-${p.id}" data-page="${p.id}" style="--tab:var(${p.ink})"><span>${p.tab}</span></a>`).join('');
  };

  // ---- identification (the plate's facing page)
  EXO.ui.renderIdent = function (sys, state) {
    const n = f(), s = sys.star, p = sys.planet;
    const tShown = p.Tsurf != null ? p.Tsurf : (isGiantish(p) ? p.T1bar : p.Tday);
    const tLab = p.Tsurf != null ? 'Surface temp.' : isGiantish(p) ? 'Temp. at 1 bar' : 'Dayside temp.';
    const marks = fieldMarks(sys);
    const how = state.custom ? 'built from edited model inputs (Technical key)'
      : sys.mode === 'realistic' ? 'drawn from realistic occurrence rates'
      : `picked from ${sys.considered} physically generated systems, weighted toward rarer and more habitable outcomes`;
    document.getElementById('ident').innerHTML = `<header class="ident gp-plate" id="sec-plate" data-page="plate">
      <h1>${esc(p.name)}${state.custom ? '<span class="edited">Edited</span>' : ''}</h1>
      <p class="kind">${esc(p.typeInfo.label)}</p>
      <p class="idline">${esc(p.summary)}</p>
      <p class="blurb">${esc(p.typeInfo.blurb)}</p>
      <dl class="keyfigs">
        <div><dt>Radius</dt><dd>${n(p.radius)}<small>R⊕</small>${p.regime === 'giant' ? `<span class="sub">${n(p.radius / EXO.C.RJ)} R♃</span>` : ''}</dd></div>
        <div><dt>Mass</dt><dd>${n(p.mass)}<small>M⊕</small>${p.mass > 30 ? `<span class="sub">${n(p.mass / EXO.C.MJ)} M♃</span>` : ''}</dd></div>
        <div><dt>${tLab}</dt><dd>${tShown ? Math.round(tShown) : '—'}<small>K</small>${tShown ? `<span class="sub">${Math.round(tShown - 273.15)} °C</span>` : ''}</dd></div>
        <div><dt>Orbit</dt><dd>${n(p.a)}<small>au</small><span class="sub">year ${fmtDays(p.period)}</span></dd></div>
        <div><dt>Habitability index</dt><dd>${p.habitability.index}<small>/100</small></dd></div>
      </dl>
      <div class="marks"><h2>Field marks</h2><ul>${marks.map((m) => `<li><a href="#sec-${m.page}" style="--tab:var(${INK[m.page]})"><span><span class="mb">${esc(m.b)}</span><span class="mt">${esc(m.t)}</span></span></a></li>`).join('')}</ul></div>
      <p class="meta">Seed ${esc(sys.seed)}, ${how}. <a href="how-it-works.html${EXO.state.hashOf(state, false)}">Trace how this planet was built</a>.</p>
    </header>`;
    symbols(document.getElementById('ident'));
  };

  // ---- model inputs (Technical key)
  const FIELDS = {
    star: [
      ['mass', 'Star mass', 'M☉', 0.08, 2.3, 0.01],
      ['age', 'Star age', 'Gyr', 0.05, 13, 0.01],
      ['feh', 'Metallicity', '[Fe/H]', -0.9, 0.5, 0.01]
    ],
    small: [
      ['P', 'Orbital period', 'days', 0.2, 5000, 0.01],
      ['a', 'Semi-major axis', 'au', 0.005, 200, 0.001],
      ['coreMass', 'Rock + iron + water mass', 'M⊕', 0.03, 25, 0.01],
      ['cmf', 'Iron core fraction', 'of rock', 0.05, 0.8, 0.01],
      ['wmf', 'Water mass fraction', '', 0, 0.6, 0.0001],
      ['fEnv0', 'Initial H/He fraction', 'of mass', 0, 0.3, 0.001],
      ['e', 'Eccentricity', '', 0, 0.9, 0.001],
      ['obliquity', 'Axial tilt', '°', 0, 180, 0.1],
      ['prot0', 'Initial rotation', 'hours', 2, 200, 0.1]
    ],
    big: [
      ['mass', 'Planet mass', 'M⊕', 1, 4200, 0.01],
      ['P', 'Orbital period', 'days', 0.2, 1e6, 0.01],
      ['a', 'Semi-major axis', 'au', 0.005, 200, 0.001],
      ['fEnv0', 'Initial H/He fraction', 'of mass', 0, 0.6, 0.001],
      ['e', 'Eccentricity', '', 0, 0.95, 0.001],
      ['obliquity', 'Axial tilt', '°', 0, 180, 0.1]
    ]
  };
  EXO.ui.inputFields = FIELDS;
  const round = (x, step) => { const d = Math.max(0, -Math.floor(Math.log10(step))); return +(+x).toFixed(d); };

  EXO.ui.renderInputs = function (base, cur) {
    // base: the seed's system (for field choice); cur: current values {star:{}, init:{}}
    const box = document.getElementById('inputs');
    const s = base.star, init = base.planet.init;
    const pf = (init.kind === 'small' ? FIELDS.small : FIELDS.big).filter(([k]) => init[k] !== undefined);
    const field = (grp, [k, lab, unit, lo, hi, step]) => {
      const v = cur[grp][k];
      return `<label><span>${lab}${unit ? ` <small>(${unit})</small>` : ''}</span><input type="number" id="in-${grp}-${k}" data-grp="${grp}" data-k="${k}" min="${lo}" max="${hi}" step="${step}" value="${round(v, step)}" inputmode="decimal"></label>`;
    };
    box.innerHTML = `<h2 id="inputsTitle">Model inputs</h2>
      <p>These are the initial conditions this seed drew. Change any of them and every value below is re-derived by the same model. Edited inputs are saved in the page link.</p>
      ${s.isWD ? '<p class="note">White-dwarf hosts keep their drawn properties; only the planet can be edited.</p>' : `<fieldset><legend>Star</legend>${FIELDS.star.map((x) => field('star', x)).join('')}</fieldset>`}
      <fieldset><legend>Planet (${esc(init.kind === 'small' ? 'rocky or water-rich, with an optional envelope' : init.kind === 'neptune' ? 'Neptune-class' : 'giant')})</legend>${pf.map((x) => field('init', x)).join('')}</fieldset>
      <div class="row"><button type="button" class="btn" id="resetInputs">Reset to the seed's values</button><button type="button" class="btn" id="copyParams">Copy parameters (JSON)</button></div>`;
  };

  // shrink astronomical unit symbols (they render oversized in most fonts), text nodes only
  function symbols(el) {
    // leaves inline SVG alone: an HTML span inside SVG text breaks the drawing
    el.innerHTML = el.innerHTML.replace(/(<svg[\s\S]*?<\/svg>)|>([^<]*)(?=<)/g, (m, svg, t) => svg || '>' + t.replace(/([⊕☉♃])/g, '<span class="sym">$1</span>'));
  }

  // ---- guide pages
  EXO.ui.renderSheet = function (sys, state) {
    const n = f();
    const s = sys.star, p = sys.planet;
    const N = p.notes;
    const key = state.view === 'key';
    const F = findings(sys);
    const h = [];
    const head = (id, finding) => {
      const pg = PAGES.find((x) => x.id === id);
      return key
        ? `<h2>${pg.title}</h2><p class="lede">${esc(finding)}.</p>`
        : `<h2><span class="sr">${pg.title}: </span>${esc(finding)}</h2>`;
    };
    const open = (id, cls) => `<section class="gp${cls ? ' ' + cls : ''}" id="sec-${id}" data-page="${id}" style="--tab:var(${INK[id]})">`;

    // ---- surface impression (canvas is persistent; main.js moves it in)
    h.push(`${open('surface')}<h2 id="surfHead">${key ? 'View from the surface' : 'The view from the surface'}</h2>
      <div class="surfwrap">
        <figure class="polaroid"><div id="surfSlot" class="surfslot"></div><figcaption class="pol-label" id="polLabel">${esc(p.name)}</figcaption></figure>
        <div class="surftext">
          <p class="surfcap" id="surfCaption"></p>
          <button type="button" class="btn" id="savePostcard">Save as image</button>
          <p class="fine">An artist's-impression scene computed from this planet's model: sky colour from Rayleigh scattering of the star's light by this atmosphere (or its hazes and clouds), the star at its true angular size, terrain from its climate state.</p>
        </div>
      </div>
    </section>`);

    // ---- star
    const sunSize = (s.radius * 0.00465 / p.a) / (0.00465 / 1);
    const sc = EXO.blackbodyRGB(s.teff).map((c) => Math.round(c * 255));
    h.push(`${open('star')}${head('star', F.star)}
      ${key ? '' : `<p class="lede">${esc(s.name)} is ${/^[AEFHILMNORSX]/.test(s.spt) ? 'an' : 'a'} ${esc(s.spt)} ${esc(s.className)}${s.isWD ? ', the cooling core of a dead Sun-like star' : ''}. Seen from the planet it looks ${n(sunSize)} times as wide as the Sun does from Earth.</p>`}
      ${key ? '' : figs([
        [`<i style="display:inline-block;width:.8em;height:.8em;border-radius:50%;background:rgb(${sc});box-shadow:0 0 0 1px var(--rule-strong);margin-right:6px"></i>${esc(s.spt)}`, 'spectral type'],
        [`${Math.round(s.teff).toLocaleString('en-US')}<small>K</small>`, 'surface temperature'],
        [`${n(s.mass)}<small>M☉</small>`, 'mass'],
        [`${n(s.age)}<small>Gyr</small>`, 'age']
      ])}
      ${(key ? kv : (r) => all(r))([
        ['Spectral type', esc(s.spt)],
        ['Mass', `${n(s.mass)} M☉`],
        ['Radius', `${n(s.radius)} R☉`],
        ['Luminosity', `${n(s.lum)} L☉`],
        ['Effective temperature', `${Math.round(s.teff)} K`],
        ['Age', `${n(s.age)} Gyr${s.isWD ? '' : ` (${s.remaining > 50 ? '>50' : n(s.remaining)} Gyr left on the main sequence)`}`],
        ['Metallicity [Fe/H]', `${s.feh >= 0 ? '+' : ''}${s.feh.toFixed(2)}`],
        ['Activity', esc(s.activity)],
        ['Seen from the planet', `${n(sunSize)}× the Sun's angular size in Earth's sky, ${n(p.S)}× the light Earth receives`]
      ])}
      ${why([
        { text: s.isWD ? 'White dwarfs make up a few percent of nearby stars; their planets survived (or migrated after) the red-giant phase, like WD 1856+534 b.' : `Star type drawn from the local stellar census (M dwarfs are ~60–70% of nearby stars)${sys.mode === 'realistic' ? '' : ', flattened in Interesting mode so other types appear more often'}; mass within the class follows the initial mass function.`, refs: ['R21', 'Kr01'] },
        { text: 'Luminosity and radius from main-sequence mass–luminosity and mass–radius relations, including slow brightening with age; Teff from L = 4πR²σT⁴.', refs: ['PM13'] },
        { text: s.isWD ? 'No flares, but the planet endured the star\'s giant phases.' : `X-ray/EUV output stays saturated at L_XUV/L_bol ≈ ${s.fSat.toExponential(0)} for ~${n(s.tSat)} Gyr, then fades as t^-1.5. Low-mass stars stay active far longer.`, refs: ['J12', 'P25'] }
      ], 'How the star was built', key)}
    </section>`);

    // ---- orbit & rotation
    h.push(`${open('orbit')}${head('orbit', F.orbit)}
      ${key ? '' : figs([
        [`${n(p.a)}<small>au</small>`, 'from its star'],
        [shortDays(p.period), 'one year'],
        [shortDays(p.solarDay), 'one solar day'],
        [`${n(p.S)}<small>S⊕</small>`, 'starlight vs. Earth']
      ])}
      ${(key ? kv : (r) => all(r))([
        ['Semi-major axis', `${n(p.a)} au <small>(present-day frost line ≈ ${n(p.frostLine)} au)</small>`],
        ['Orbital period (year)', fmtDays(p.period)],
        ['Eccentricity', p.e.toFixed(3)],
        ['Orbital speed', `${n(p.vOrb)} km/s <small>(Earth: 29.8)</small>`],
        ['Instellation', `${n(p.S)} S⊕${p.e > 0.1 ? ` <small>(${n(p.Sapo)}–${n(p.Speri)} around the orbit)</small>` : ''}`],
        ['Habitable-zone position', esc(p.hzZone)],
        ['Spin state', esc(p.spinState)],
        ['Tidally locked', p.locked ? 'Yes' : 'No'],
        ['Rotation period (sidereal)', fmtDays(p.protDays)],
        ['Length of a solar day', fmtDays(p.solarDay)],
        ['Equatorial rotation speed', `${n(p.vEq)} km/s <small>(Earth: 0.47)</small>`],
        ['Axial tilt', `${Math.round(p.obliquity)}°`],
        ['Tidal-locking timescale', EXO.fmt.time(p.tLock)],
        ['Hill sphere', `${n(p.hillRadius)} au`]
      ])}
      ${why([...(N.orbit || []), ...(N.spin || [])], null, key)}
    </section>`);

    // ---- bulk & interior
    const comp = p.composition.map(([lab, pct]) => `<div class="bar"><span class="label">${esc(lab)}</span><span class="track"><span class="fill" style="width:${Math.min(100, pct)}%"></span></span><span class="num">${pct}%</span></div>`).join('');
    h.push(`${open('body')}${head('body', F.body)}
      ${key ? '' : figs([
        [`${n(p.density)}<small>g/cm³</small>`, 'bulk density (Earth 5.51)'],
        [`${n(p.gravity)}<small>g</small>`, 'surface gravity'],
        [`${n(p.vesc)}<small>km/s</small>`, 'escape velocity'],
        p.magnetic.tectonics ? [esc(cap(p.magnetic.tectonics)), 'geology'] : null
      ])}
      ${scaleFigure([
        { name: p.name, sub: `${n(p.radius)} R⊕`, r: p.radius, fill: tintOf(p.vis) },
        { name: 'Earth', sub: '1 R⊕', r: 1, fill: '#4a78b8' },
        ...(p.radius > 3 ? [{ name: 'Neptune', sub: '3.88 R⊕', r: 3.88, fill: '#5f8fd0' }] : []),
        ...(p.radius > 6 ? [{ name: 'Jupiter', sub: '11.2 R⊕', r: 11.21, fill: '#c9a47e' }] : [])
      ], `${p.name} drawn to scale with Earth`)}
      <p class="sublabel">Composition by mass</p>
      <div class="bars">${comp}</div>
      ${(key ? kv : (r) => all(r))([
        ['Size class', esc(p.sizeClass)],
        ['Radius', `${n(p.radius)} R⊕ <small>(${n(p.radius * 6371)} km)</small>`],
        ['Mass', `${n(p.mass)} M⊕`],
        ['Bulk density', `${n(p.density)} g/cm³ <small>(Earth: 5.51)</small>`],
        ['Surface gravity', `${n(p.gravity)} g`],
        ['Escape velocity', `${n(p.vesc)} km/s <small>(Earth: 11.2)</small>`],
        p.magnetic.tectonics ? ['Tectonic regime', esc(p.magnetic.tectonics)] : null,
        p.tidalFlux > 0.01 ? ['Tidal heat flow', `${n(p.tidalFlux)} W/m² <small>(Earth's interior: 0.09)</small>`] : null,
        p.metallicity ? ['Atmospheric metallicity', `${n(p.metallicity)}× solar`] : null
      ])}
      ${why([...(N.bulk || []), ...(N.interior || [])], null, key)}
    </section>`);

    // ---- atmosphere & climate
    const atm = p.atm || { type: 'none', vmr: {} };
    const gases = Object.entries(atm.vmr || {}).sort((a, b) => b[1] - a[1]).filter(([, x]) => x >= 1e-7).slice(0, 8);
    const gasRows = gases.map(([m, x]) => {
      const pct = x * 100;
      const w = Math.max(1.5, (Math.log10(x) + 7) / 7 * 100);
      return `<div class="bar"><span class="label">${mol(m)}<small>${esc(EXO.MOLNAMES[m] || '')}</small></span><span class="track"><span class="fill" style="width:${w}%"></span></span><span class="num">${pct >= 1 ? pct.toFixed(pct >= 10 ? 0 : 1) + '%' : x >= 1e-6 ? n(x * 1e6) + ' ppm' : n(x * 1e9) + ' ppb'}</span></div>`;
    }).join('');
    h.push(`${open('air')}${head('air', F.air)}
      ${key ? '' : figs([
        isGiantish(p) ? [`${Math.round(p.T1bar || p.Teq)}<small>K</small>`, 'at the 1-bar level'] : [p.hasAtm ? `${n(p.Psurf)}<small>bar</small>` : '0', 'surface pressure'],
        p.Tsurf != null ? [`${Math.round(p.Tsurf - 273.15)}<small>°C</small>`, 'mean surface'] : [`${Math.round(p.Teq)}<small>K</small>`, 'equilibrium temp.'],
        [`${Math.round(p.Tday)} / ${Math.round(p.Tnight)}<small>K</small>`, 'dayside / nightside'],
        p.oceanCover > 0 ? [`${Math.round(p.oceanCover * 100)}<small>%</small>`, 'ocean cover'] : [p.surfaceLiquid ? 'Yes' : 'No', 'liquid surface water']
      ])}
      ${gases.length ? `<p class="sublabel">Gas composition (log scale)</p><div class="bars">${gasRows}</div>` : ''}
      ${(key ? kv : (r) => all(r))([
        ['Atmosphere', !p.hasAtm ? 'None (or a tenuous exosphere)' : isGiantish(p) ? 'Deep hydrogen/helium envelope' : `${n(p.Psurf)} bar at the surface`],
        p.atm && p.atm.mu ? ['Mean molecular weight', `${n(p.atm.mu)} g/mol`] : null,
        p.atm && p.atm.Hkm ? ['Scale height', `${n(p.atm.Hkm)} km <small>(Earth: 8.5)</small>`] : null,
        ['Bond albedo', p.albedo.toFixed(2)],
        ['Equilibrium temperature', temp(p.Teq)],
        p.Tsurf != null ? ['Mean surface temperature', temp(p.Tsurf)] : null,
        isGiantish(p) && p.T1bar ? ['Temperature at 1 bar', temp(p.T1bar)] : null,
        p.Tint ? ['Internal heat (T_int)', `${Math.round(p.Tint)} K`] : null,
        ['Dayside / nightside', `${Math.round(p.Tday)} K / ${Math.round(p.Tnight)} K`],
        p.oceanCover > 0 ? ['Ocean coverage', `${Math.round(p.oceanCover * 100)}%`] : null,
        ['Liquid surface water', p.surfaceLiquid ? 'Yes' : 'No']
      ])}
      ${why([...(N.atmosphere || []), ...(N.climate || [])], null, key)}
    </section>`);

    // ---- magnetism
    const m = p.magnetic;
    h.push(`${open('field')}${head('field', F.field)}
      ${key || !m.present ? '' : figs([
        [`${n(m.B)}<small>G</small>`, 'at the equator (Earth 0.3)'],
        m.magnetopause ? [`${n(m.magnetopause)}<small>R<sub>p</sub></small>`, 'magnetopause distance'] : null,
        m.dynamoLifetime ? [`${n(m.dynamoLifetime)}<small>Gyr</small>`, 'dynamo lifetime'] : null
      ])}
      ${(key ? kv : (r) => all(r))([
        ['Global field', m.present ? 'Yes' : 'No'],
        m.present ? ['Surface strength (equator)', `${n(m.B)} G <small>(Earth: 0.3, Jupiter: 4.2)</small>`] : null,
        m.present ? ['Geometry', esc(m.morphology)] : null,
        m.dynamoLifetime ? ['Dynamo lifetime', `${n(m.dynamoLifetime)} Gyr`] : null,
        m.magnetopause ? ['Magnetopause distance', `${n(m.magnetopause)} planetary radii`] : null,
        m.windPressure ? ['Stellar-wind pressure', `${n(m.windPressure)}× Earth's`] : null,
        m.cyclotronMHz ? ['Auroral radio cut-off', `${n(m.cyclotronMHz)} MHz`] : null
      ])}
      ${why(N.magnetism, null, key)}
    </section>`);

    // ---- habitability
    const hb = p.habitability;
    const facs = hb.factors.map((x) => `<div class="bar"><span class="label">${esc(x.name)}<small>${esc(x.why)}</small></span><span class="track"><span class="fill" style="width:${Math.round(x.v * 100)}%"></span></span><span class="num">${x.v.toFixed(2)}</span></div>`).join('');
    h.push(`${open('life')}${head('life', F.life)}
      <div class="habscore">${key ? `<span class="big">${hb.index}<small>/100</small></span>` : ''}<span class="esi">Earth Similarity Index ${hb.esi.toFixed(2)}</span></div>
      ${key ? `<div class="bars">${facs}</div>` : `<p class="sublabel">What limits it most</p>
      <ul class="limits">${hb.factors.slice().sort((a, b) => a.v - b.v).slice(0, 3).map((x) => `<li><b>${x.v.toFixed(2)}</b><span>${esc(x.name)}<small>${esc(x.why)}</small></span></li>`).join('')}</ul>
      <details class="all"><summary>All ${hb.factors.length} factors</summary><div class="bars">${facs}</div></details>`}
      ${hb.extras.length ? `<ul class="extras">${hb.extras.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${why([
        { text: 'The index multiplies "hard" requirements for surface life as we know it (liquid-water temperatures, an atmosphere of useful pressure, available water, a rocky size) and softer modifiers (stellar activity, magnetic shielding, rotation, age, orbit). It is a heuristic, not a probability of life.' },
        { text: 'The Earth Similarity Index compares radius, density, escape velocity and surface temperature with Earth. High ESI does not imply habitability — Venus scores ~0.4–0.7 depending on the temperature used.', refs: ['SM11'] }
      ], 'How the score works', key)}
    </section>`);

    // ---- analogues
    const an = EXO.findAnalogs(p, s);
    h.push(`${open('similar')}${head('similar', F.similar)}
      ${scaleFigure([
        { name: p.name, sub: `${n(p.radius)} R⊕`, r: p.radius, fill: tintOf(p.vis) },
        ...an.map((a) => ({ name: a.an.name, sub: `${n(a.an.R)} R⊕`, r: a.an.R, fill: 'var(--paper-2)' }))
      ], `${p.name} drawn to scale with its closest known matches`)}
      <div class="analogs">${an.map((a) => `<div class="analog"><span class="pct">${a.sim}%</span><div><b>${esc(a.an.name)}</b> <small>${esc(a.an.note)}</small><p>This planet has ${esc(a.why)}; host star ${Math.round(a.an.Teff)} K vs ${Math.round(s.teff)} K.</p></div></div>`).join('')}</div>
      ${why([{ text: 'Similarity weighs differences in log mass, log radius, log instellation, host-star temperature and eccentricity, with a penalty when the planet classes differ (rocky, water-rich, sub-Neptune, Neptune, giant). Catalogue values are approximate published parameters; RV-only planets use minimum masses.' }], 'How similarity is measured', key)}
    </section>`);

    // ---- observability (filled by renderObservability)
    h.push(`${open('observe')}<div id="obsHead">${head('observe', 'Could we observe it?')}</div>
      <p class="lede">Place this system at a chosen distance from the Sun. Facility status is as of October 2026.</p>
      <div class="distrow"><label for="dist">Distance</label><input type="range" id="dist" min="0" max="1000" step="1"><output id="distOut" for="dist"></output></div>
      <div id="obsBody"></div>
    </section>`);

    // ---- spectrum (same tab as Observe)
    h.push(`<section class="gp" id="sec-spectrum" data-page="observe" style="--tab:var(${INK.observe})"><div id="specHead">${key ? '<h2>Simulated spectrum</h2>' : '<h2>The fingerprints of its air</h2>'}</div>
      <p class="lede">Low-resolution model spectrum with JWST-like noise at the chosen distance; the shaded band shows ±1σ.</p>
      <div class="spectoggle" role="group" aria-label="Spectrum type"><button type="button" data-spec="transmission">Transmission</button><button type="button" data-spec="emission">Emission + reflection</button></div>
      <canvas id="specCanvas" role="img" aria-label="Simulated spectrum plot"></canvas>
      <div id="specTable" class="tablewrap"></div>
      ${why([
        { text: 'Transmission: the effective altitude of the atmosphere at each wavelength is z(λ) = H·ln(σ(λ)·n₀·√(2πR_pH)/0.56), so features scale with the scale height H = kT/(μg). Clouds and the solid surface set a floor.', refs: ['LdE08'] },
        { text: 'Emission: each wavelength sees the τ = 1 level of a parametric temperature profile (with a thermal inversion on ultra-hot giants), plus reflected starlight.' },
        { text: 'Molecular bands are smoothed approximations of real opacities: positions are right, strengths are indicative. Noise assumes NIRSpec/MIRI-like precision, up to 10 transits for small temperate planets and 4 otherwise, limited by how many events occur in 5 years.', refs: ['K18'] }
      ], 'How the spectrum is modelled', key)}
    </section>`);

    // ---- about
    const used = new Set();
    for (const k in N) for (const x of N[k]) (x.refs || []).forEach((r) => used.add(r));
    ['R21', 'Kr01', 'PM13', 'J12', 'P25', 'SM11', 'LdE08', 'K18', 'GAIA', 'LW25', 'ROMAN', 'ELT', 'ANDES', 'HWO', 'LIFE', 'ARIEL', 'RW', 'Z07'].forEach((r) => used.add(r));
    const allRefs = Object.keys(EXO.REFS).sort((a, b) => EXO.REFS[a].cite.localeCompare(EXO.REFS[b].cite));
    h.push(`${open('sources', 'refs')}${head('sources', F.sources)}
      <p class="lede">Each planet comes from a few random initial conditions; everything else follows from published relations, in this order. <a href="how-it-works.html${EXO.state.hashOf(state, false)}">See the full flowchart, traced for this planet</a>.</p>
      <ol class="pipeline">
        <li>Star: type from the local census, then mass, luminosity, radius, temperature and an XUV activity history.</li>
        <li>Orbit: period or distance from Kepler/radial-velocity occurrence rates; eccentricity and tilt.</li>
        <li>Bulk: core mass, iron and water fractions, primordial H/He; XUV-driven escape strips envelopes, producing the radius valley.</li>
        <li>Habitable zone, cosmic-shoreline atmosphere retention, then tides (locking, heating).</li>
        <li>Climate state: runaway greenhouse, carbonate–silicate regulation, snowball or haze; giant-planet cloud classes.</li>
        <li>Magnetic dynamo, habitability factors, known-world analogues, observability and spectra.</li>
      </ol>
      <p class="sublabel">References</p>
      <ol>${allRefs.map((k) => { const r = EXO.REFS[k]; return `<li id="ref-${k}">${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)} <span>— ${esc(r.note)}</span></li>`; }).join('')}</ol>
    </section>`);

    const el = document.getElementById('sheet');
    el.innerHTML = h.join('');
    symbols(el);
  };

  // -------------------------------------------------------------- observability
  EXO.ui.renderObservability = function (sys, ly, view) {
    const n = f();
    const ob = EXO.observe(sys, ly);
    const b = ob.basics;
    const key = view === 'key';
    const order = { yes: 0, maybe: 1, no: 2 };
    const list = ob.instruments.slice().sort((x, y) => order[x.verdict] - order[y.verdict]);
    const cnt = { yes: 0, maybe: 0, no: 0 };
    list.forEach((i) => cnt[i.verdict]++);
    const dTxt = `${ly < 10 ? ly.toFixed(1) : Math.round(ly)} light-years`;
    const finding = cnt.yes ? `At ${dTxt}, ${cnt.yes} of ${list.length} facilities could likely detect it`
      : cnt.maybe ? `At ${dTxt}, ${cnt.maybe} facilities might just detect it`
      : `At ${dTxt}, no facility could confidently detect it`;
    document.getElementById('obsHead').innerHTML = key ? `<h2>Could we observe it?</h2><p class="lede">${esc(finding)}.</p>` : `<h2><span class="sr">Could we observe it? </span>${esc(finding)}</h2>`;
    const html = [];
    if (key) html.push(`<p class="tally"><span><b>${cnt.yes}</b>likely</span><span><b>${cnt.maybe}</b>possible</span><span><b>${cnt.no}</b>no</span></p>`);
    const basics = [
      [`${n(b.dpc)} pc`, 'distance'],
      [`V ${n(b.phot.V)} · J ${n(b.phot.J)}`, 'host brightness'],
      [`${n(b.sepMas)} mas`, 'star–planet separation'],
      [EXO.fmt.sci(b.cRefl), 'reflected-light contrast'],
      [EXO.fmt.sci(b.c10), '10 µm thermal contrast'],
      [`${n(b.Kms)} m/s · ${n(b.astro)} µas`, 'stellar wobble (RV · astrometry)'],
      [`${(b.transitProb * 100).toFixed(b.transitProb < 0.01 ? 2 : 1)}%`, 'transit probability'],
      [`${n(b.depth * 1e6)} ppm`, 'transit depth']
    ];
    const grid = `<div class="obsgrid">${basics.map(([v, l]) => `<div>${v}<span>${l}</span></div>`).join('')}</div>`;
    const detail = list.map((i) => `<div class="inst"><span class="verdict ${i.verdict}">${{ yes: 'Likely', maybe: 'Possible', no: 'No' }[i.verdict]}</span><div>
        <h3>${esc(i.name)} ${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</h3>
        <p class="st ${i.sc}">${esc(i.technique)}. ${esc(i.status)}.</p>
        <p>${esc(i.detail)}${refLinks(i.refs)}</p></div></div>`).join('');
    if (key) {
      html.push(grid, detail);
    } else {
      const grp = (v, label) => {
        const xs = list.filter((i) => i.verdict === v);
        if (v === 'no') return `<div><h3><span class="verdict no">No</span>${xs.length} cannot</h3><p class="nolist">${xs.map((i) => esc(i.name)).join(' · ')}</p></div>`;
        return xs.length ? `<div><h3><span class="verdict ${v}">${label}</span>${xs.length} ${v === 'yes' ? 'could detect it' : 'might, just'}</h3><ul>${xs.map((i) => `<li><b>${esc(i.name)}</b><span>${esc(i.technique)}. ${esc(i.status)}.</span></li>`).join('')}</ul></div>` : '';
      };
      html.push(`<div class="obsgroups">${grp('yes', 'Likely')}${grp('maybe', 'Possible')}${grp('no')}</div>`);
      html.push(`<details class="all"><summary>The numbers behind each verdict</summary>${grid}${detail}</details>`);
    }
    document.getElementById('obsBody').innerHTML = html.join('');
  };

  // -------------------------------------------------------------- spectrum plot
  EXO.ui.drawSpectrum = function (sys, mode, ly, view) {
    const n = f();
    const sp = EXO.spectrum(sys, mode, ly);
    const cv = document.getElementById('specCanvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const ink = css('--ink', '#1d2321'), muted = css('--muted', '#545c59'), faint = css('--faint', '#646b68'), rule = css('--rule', '#c9ccc2');
    const curve = css('--t-observe', '#23395d');
    const font = (px, w) => `${w || 400} ${px}px "Atkinson Hyperlegible", sans-serif`;
    const L = 58, R = 14, T = 16, B = 38;
    const lx = (l) => L + (Math.log(l / 0.5) / Math.log(16 / 0.5)) * (W - L - R);
    let ymin = Math.min(...sp.y), ymax = Math.max(...sp.y);
    const pad = Math.max((ymax - ymin) * 0.15, sp.noise * 2, ymax * 0.002 + 0.5);
    ymin -= pad; ymax += pad;
    if (mode === 'emission') ymin = Math.max(0, ymin);
    const yy = (y) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
    // JWST coverage
    g.fillStyle = 'rgba(35,57,93,0.06)';
    g.fillRect(lx(0.6), T, lx(12) - lx(0.6), H - T - B);
    g.fillStyle = faint; g.font = font(11);
    g.fillText('JWST NIRISS/NIRSpec + MIRI LRS', lx(0.62) + 4, T + 12);
    // grid and axes
    g.strokeStyle = rule; g.lineWidth = 1;
    for (const t of [0.5, 0.7, 1, 1.5, 2, 3, 4, 5, 7, 10, 15]) {
      const x = lx(t);
      g.globalAlpha = 0.55; g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = muted; g.fillText(String(t), x - 6, H - B + 15);
    }
    g.strokeStyle = ink;
    g.beginPath(); g.moveTo(L, T); g.lineTo(L, H - B); g.lineTo(W - R, H - B); g.stroke();
    g.fillStyle = muted;
    g.fillText('Wavelength (µm)', W / 2 - 40, H - 6);
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const y = ymin + (ymax - ymin) * i / ticks;
      g.fillText(y >= 1000 ? Math.round(y).toLocaleString('en-US') : y.toFixed(y < 10 ? 1 : 0), 4, yy(y) + 4);
    }
    // noise band
    g.fillStyle = 'rgba(35,57,93,0.16)';
    g.beginPath();
    sp.lam.forEach((l, i) => { const x = lx(l), y = yy(sp.y[i] + sp.noise); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    for (let i = sp.lam.length - 1; i >= 0; i--) g.lineTo(lx(sp.lam[i]), yy(sp.y[i] - sp.noise));
    g.closePath(); g.fill();
    // curve
    g.strokeStyle = curve; g.lineWidth = 2;
    g.beginPath();
    sp.lam.forEach((l, i) => { const x = lx(l), y = yy(sp.y[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    // molecule labels
    g.fillStyle = ink; g.font = font(12, 700);
    const placed = [];
    for (const m of sp.mols.slice(0, 7)) {
      if (m.amp < sp.noise * 0.5) continue;
      const x = lx(m.at);
      if (placed.some((px) => Math.abs(px - x) < 34)) continue;
      placed.push(x);
      const i = sp.lam.findIndex((l) => l >= m.at);
      const y = yy(sp.y[Math.max(0, i)]) - (mode === 'transmission' ? 8 : -16);
      g.fillText(mol(m.mol), x - 10, Math.max(T + 26, Math.min(H - B - 4, y)));
    }
    g.fillStyle = muted; g.font = font(11);
    g.fillText(sp.yLabel, L + 6, H - B - 8);

    // heading (guide view states what JWST could pick out)
    const det = sp.mols.filter((x) => x.inJWST && x.verdict === 'yes').map((x) => mol(x.mol));
    const finding = !sys.planet.hasAtm ? 'A flat spectrum: there is no air to fingerprint'
      : det.length ? `JWST could pick out ${det.length > 1 ? det.slice(0, -1).join(', ') + ' and ' + det[det.length - 1] : det[0]} at this distance`
      : 'No gas stands out above the noise at this distance';
    const head = document.getElementById('specHead');
    if (head) head.innerHTML = view === 'key' ? `<h2>Simulated spectrum</h2><p class="lede">${esc(finding)}.</p>` : `<h2><span class="sr">Simulated spectrum: </span>${esc(finding)}</h2>`;
    cv.setAttribute('aria-label', `Simulated ${mode} spectrum. ${finding}.`);

    // table
    const tbl = document.getElementById('specTable');
    if (!sp.mols.length) {
      tbl.innerHTML = `<p class="lede" style="margin-top:12px">${sys.planet.hasAtm ? 'No molecular features stand out at this resolution.' : 'No atmosphere: the spectrum is flat. Measuring that flatness is itself how JWST tests whether rocky planets kept their air.'}</p>`;
    } else {
      tbl.innerHTML = `<table class="mols"><thead><tr><th>Molecule</th><th>Abundance</th><th>Strongest band</th><th>Feature size</th><th>JWST, ${sp.nObs} ${mode === 'transmission' ? 'transit' : 'eclipse'}${sp.nObs > 1 ? 's' : ''}</th></tr></thead><tbody>${sp.mols.map((x) => `<tr><td data-label="Molecule">${mol(x.mol)}</td><td data-label="Abundance">${x.vmr >= 0.01 ? (x.vmr * 100).toFixed(1) + '%' : n(x.vmr * 1e6) + ' ppm'}</td><td data-label="Strongest band">${n(x.at)} µm</td><td data-label="Feature size">${n(x.amp)} ppm</td><td data-label="JWST"><span class="dot ${x.inJWST ? x.verdict : 'no'}"></span>${!x.inJWST ? 'outside range' : { yes: 'detectable', maybe: 'marginal', no: 'too weak' }[x.verdict]}</td></tr>`).join('')}</tbody></table><p class="fine" style="margin-top:8px">Assumed JWST precision: ±${n(sp.noise)} ppm per spectral bin.</p>${sp.saturated ? '<p class="lede">At this distance the host is bright enough to saturate standard JWST time-series modes; real observations would need special readout modes.</p>' : ''}`;
    }
  };

  // -------------------------------------------------------------- HZ strip
  EXO.ui.drawHZ = function (sys) {
    const s = sys.star, p = sys.planet;
    const cv = document.getElementById('hzStrip');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = 100;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const ink = css('--ink', '#1d2321'), muted = css('--muted', '#545c59'), faint = css('--faint', '#646b68'), rule = css('--rule-strong', '#8e9590');
    const d = p.hzDist;
    const lo = Math.min(p.a * (1 - p.e), d.recentVenus) / 4, hi = Math.max(p.a * (1 + p.e), d.earlyMars, p.frostLine) * 3;
    const x = (a) => 10 + (Math.log(a / lo) / Math.log(hi / lo)) * (W - 20);
    const y0 = 42, top = 14, below = y0 + 30, axis = H - 4;
    g.fillStyle = 'rgba(15,116,102,0.14)'; g.fillRect(x(d.recentVenus), y0 - 14, x(d.earlyMars) - x(d.recentVenus), 28);
    g.fillStyle = 'rgba(15,116,102,0.36)'; g.fillRect(x(d.runaway), y0 - 14, x(d.maxGreenhouse) - x(d.runaway), 28);
    g.strokeStyle = rule; g.beginPath(); g.moveTo(10, y0); g.lineTo(W - 10, y0); g.stroke();
    // frost line
    g.strokeStyle = 'rgba(39,71,184,0.75)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x(p.frostLine), y0 - 18); g.lineTo(x(p.frostLine), y0 + 18); g.stroke(); g.setLineDash([]);
    // star
    const sc = EXO.blackbodyRGB(s.teff).map((c) => Math.round(c * 255));
    g.fillStyle = `rgb(${sc})`; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(5, y0, 6, 0, 7); g.fill(); g.stroke();
    // orbit extent
    if (p.e > 0.02) { g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x(p.a * (1 - p.e)), y0); g.lineTo(x(p.a * (1 + p.e)), y0); g.stroke(); g.lineWidth = 1; }
    g.fillStyle = ink; g.beginPath(); g.arc(x(p.a), y0, 5, 0, 7); g.fill();
    // labels: placed in two rows (above and below the band), each kept clear of the others
    const n = f();
    const placed = [];
    const put = (txt, cx, rows, font, color, align) => {
      g.font = font; const w = g.measureText(txt).width;
      let x0 = align === 'left' ? cx : cx - w / 2;
      x0 = Math.max(2, Math.min(W - w - 2, x0));
      for (const y of rows) {
        if (!placed.some((q) => q.y === y && x0 < q.x1 + 8 && x0 + w > q.x0 - 8)) {
          g.fillStyle = color; g.fillText(txt, x0, y); placed.push({ y, x0, x1: x0 + w }); return;
        }
      }
    };
    put(`${n(p.a)} au`, x(p.a), [below, top], '700 12px "Atkinson Hyperlegible", sans-serif', ink, 'center');
    put('habitable zone', x(d.runaway), [top, below], '12px "Atkinson Hyperlegible", sans-serif', muted, 'left');
    put('frost line', x(p.frostLine) + 4, [top, below], '12px "Atkinson Hyperlegible", sans-serif', muted, 'left');
    // scale
    for (const a of [0.01, 0.1, 1, 10, 100]) if (a > lo && a < hi) put(a + ' au', x(a), [axis], '12px "Atkinson Hyperlegible", sans-serif', faint, 'center');
  };

  // -------------------------------------------------------------- cross-section
  EXO.ui.drawXSection = function (sys) {
    const p = sys.planet;
    const cv = document.getElementById('xsection');
    const S = cv.clientWidth || 132;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = S * dpr; cv.height = S * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    const c = S / 2, R = S / 2 - 7;
    const layers = p.layers.slice().sort((a, b) => b.r - a.r);
    for (const L of layers) {
      g.fillStyle = L.color;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, Math.max(1.5, L.r * R), -Math.PI * 0.5, Math.PI * 1.0); g.closePath(); g.fill();
    }
    // outer (unsliced) quarter in planet colour
    const v = p.vis;
    const base = v.c[0].map((x) => Math.round(x * 255));
    g.fillStyle = `rgb(${base})`; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, Math.PI, Math.PI * 1.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(29,35,33,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
    if (p.hasAtm) { g.strokeStyle = `rgba(${v.atmCol.map((x) => Math.round(x * 255))},0.75)`; g.lineWidth = 3; g.beginPath(); g.arc(c, c, R + 3, 0, 7); g.stroke(); }
    document.getElementById('xsecLegend').innerHTML = layers.slice().reverse().map((L) => `<span><i style="background:${L.color}"></i>${esc(L.name)}</span>`).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);
