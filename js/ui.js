/* DOM rendering of the property sheet and the small canvases. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const f = () => EXO.fmt.num;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUB = { H2O: 'H₂O', CH4: 'CH₄', CO2: 'CO₂', CO: 'CO', NH3: 'NH₃', O2: 'O₂', O3: 'O₃', SO2: 'SO₂', H2S: 'H₂S', HCN: 'HCN', Na: 'Na', K: 'K', TiO: 'TiO', VO: 'VO', SiO: 'SiO', N2: 'N₂', H2: 'H₂', He: 'He', Ar: 'Ar' };
  const mol = (m) => SUB[m] || m;

  function refLinks(keys) {
    return (keys || []).map((k) => {
      const r = EXO.REFS[k];
      if (!r) return '';
      return `<a class="ref" href="#ref-${k}" title="${esc(r.cite + ': ' + r.note)}">[${esc(r.cite.split(/,| \(/)[0])}]</a>`;
    }).join('');
  }
  function why(notes, title) {
    if (!notes || !notes.length) return '';
    return `<details class="why"><summary>${title || 'Why these values?'}</summary><ul>${notes.map((n) => `<li>${esc(n.text)}${refLinks(n.refs)}</li>`).join('')}</ul></details>`;
  }
  const kv = (rows) => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  function fmtDays(d) {
    const n = f();
    if (d === Infinity) return 'permanent (one side always faces the star)';
    if (d < 2) return `${n(d * 24)} hours`;
    if (d < 800) return `${n(d)} days`;
    return `${n(d / 365.25)} years`;
  }
  function temp(T) { return T == null ? '—' : `${Math.round(T)} K <small>(${Math.round(T - 273.15)} °C)</small>`; }

  EXO.ui = {};

  EXO.ui.renderSheet = function (sys, state) {
    const n = f();
    const s = sys.star, p = sys.planet, v = p.vis;
    const N = p.notes;
    const isGiantish = p.regime !== 'solid' && p.regime !== 'thinH2';
    const h = [];
    // ---- hero
    h.push(`<div class="hero">
      <h1>${esc(p.name)}</h1>
      <p class="kind">${esc(p.typeInfo.label)}</p>
      <p class="summary">${esc(p.summary)}</p>
      <p class="blurb">${esc(p.typeInfo.blurb)}</p>
      <p class="meta">Seed ${esc(sys.seed)}, ${sys.mode === 'realistic' ? 'drawn from realistic occurrence rates' : `picked from ${sys.considered} physically generated systems, weighted toward rarer and more habitable outcomes`}.</p>
    </div>`);
    const tShown = p.Tsurf != null ? p.Tsurf : (isGiantish ? p.T1bar : p.Tday);
    h.push(`<div class="keystats">
      <div><b>${n(p.radius)} R⊕</b><span>radius${p.regime === 'giant' ? ` (${n(p.radius / EXO.C.RJ)} R♃)` : ''}</span></div>
      <div><b>${n(p.mass)} M⊕</b><span>mass${p.mass > 30 ? ` (${n(p.mass / EXO.C.MJ)} M♃)` : ''}</span></div>
      <div><b>${tShown ? Math.round(tShown) + ' K' : '—'}</b><span>${p.Tsurf != null ? 'mean surface temp.' : isGiantish ? 'temp. at 1 bar' : 'dayside temp.'}</span></div>
      <div><b>${n(p.a)} au</b><span>orbit, ${fmtDays(p.period)}</span></div>
      <div><b>${p.habitability.index}</b><span>habitability index /100</span></div>
    </div>`);

    // ---- surface impression (canvas is persistent; main.js moves it in)
    h.push(`<section class="sec surface"><h2>View from the surface</h2>
      <div id="surfSlot" class="surfslot"></div>
      <p class="lede surfcap" id="surfCaption"></p>
      <p class="fine">An artist's-impression scene computed from this planet's model: sky colour from Rayleigh scattering of the star's light by this atmosphere (or its hazes and clouds), the star at its true angular size, terrain from its climate state.</p>
    </section>`);

    // ---- star
    const sunSize = (s.radius * 0.00465 / p.a) / (0.00465 / 1);
    h.push(`<section class="sec"><h2>Host star</h2>
      <p class="lede">${esc(s.name)} is ${/^[AEFHILMNORSX]/.test(s.spt) ? 'an' : 'a'} ${esc(s.spt)} ${esc(s.className)}${s.isWD ? ', the cooling core of a dead Sun-like star' : ''}.</p>
      ${kv([
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
      ], 'How the star was built')}
    </section>`);

    // ---- orbit & rotation
    h.push(`<section class="sec"><h2>Orbit and rotation</h2>
      ${kv([
        ['Semi-major axis', `${n(p.a)} au <small>(present-day frost line ≈ ${n(p.frostLine)} au)</small>`],
        ['Orbital period (year)', fmtDays(p.period)],
        ['Eccentricity', p.e.toFixed(3)],
        ['Orbital speed', `${n(p.vOrb)} km/s <small>(Earth: 29.8)</small>`],
        ['Instellation', `${n(p.S)} S⊕${p.e > 0.1 ? ` <small>(${n(p.Sapo)}–${n(p.Speri)} around the orbit)</small>` : ''}`],
        ['Habitable-zone position', esc(p.hzZone)],
        ['Spin state', `${esc(p.spinState)}${p.locked ? '' : ''}`],
        ['Tidally locked', p.locked ? 'Yes' : 'No'],
        ['Rotation period (sidereal)', fmtDays(p.protDays)],
        ['Length of a solar day', fmtDays(p.solarDay)],
        ['Equatorial rotation speed', `${n(p.vEq)} km/s <small>(Earth: 0.47)</small>`],
        ['Axial tilt', `${Math.round(p.obliquity)}°`],
        ['Tidal-locking timescale', EXO.fmt.time(p.tLock)],
        ['Hill sphere', `${n(p.hillRadius)} au`]
      ])}
      ${why([...(N.orbit || []), ...(N.spin || [])])}
    </section>`);

    // ---- bulk & interior
    const comp = p.composition.map(([lab, pct]) => `<div class="bar"><span class="label">${esc(lab)}</span><span class="track"><span class="fill" style="width:${Math.min(100, pct)}%"></span></span><span class="num">${pct}%</span></div>`).join('');
    h.push(`<section class="sec"><h2>Interior and bulk composition</h2>
      ${kv([
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
      <p class="lede" style="margin-top:16px">Composition by mass</p>
      <div class="bars">${comp}</div>
      ${why([...(N.bulk || []), ...(N.interior || [])])}
    </section>`);

    // ---- atmosphere & climate
    const atm = p.atm || { type: 'none', vmr: {} };
    const gases = Object.entries(atm.vmr || {}).sort((a, b) => b[1] - a[1]).filter(([, x]) => x >= 1e-7).slice(0, 8);
    const gasRows = gases.map(([m, x]) => {
      const pct = x * 100;
      const w = Math.max(1.5, (Math.log10(x) + 7) / 7 * 100);
      return `<div class="bar"><span class="label">${mol(m)}<small>${esc(EXO.MOLNAMES[m] || '')}</small></span><span class="track"><span class="fill" style="width:${w}%"></span></span><span class="num">${pct >= 1 ? pct.toFixed(pct >= 10 ? 0 : 1) + '%' : x >= 1e-6 ? n(x * 1e6) + ' ppm' : n(x * 1e9) + ' ppb'}</span></div>`;
    }).join('');
    h.push(`<section class="sec"><h2>Atmosphere and climate</h2>
      ${kv([
        ['Atmosphere', !p.hasAtm ? 'None (or a tenuous exosphere)' : isGiantish ? 'Deep hydrogen/helium envelope' : `${n(p.Psurf)} bar at the surface`],
        p.atm && p.atm.mu ? ['Mean molecular weight', `${n(p.atm.mu)} g/mol`] : null,
        p.atm && p.atm.Hkm ? ['Scale height', `${n(p.atm.Hkm)} km <small>(Earth: 8.5)</small>`] : null,
        ['Bond albedo', p.albedo.toFixed(2)],
        ['Equilibrium temperature', temp(p.Teq)],
        p.Tsurf != null ? ['Mean surface temperature', temp(p.Tsurf)] : null,
        isGiantish && p.T1bar ? ['Temperature at 1 bar', temp(p.T1bar)] : null,
        p.Tint ? ['Internal heat (T_int)', `${Math.round(p.Tint)} K`] : null,
        ['Dayside / nightside', `${Math.round(p.Tday)} K / ${Math.round(p.Tnight)} K`],
        p.oceanCover > 0 ? ['Ocean coverage', `${Math.round(p.oceanCover * 100)}%`] : null,
        ['Liquid surface water', p.surfaceLiquid ? 'Yes' : 'No']
      ])}
      ${gases.length ? `<p class="lede" style="margin-top:16px">Gas composition (log scale)</p><div class="bars">${gasRows}</div>` : ''}
      ${why([...(N.atmosphere || []), ...(N.climate || [])])}
    </section>`);

    // ---- magnetism
    const m = p.magnetic;
    h.push(`<section class="sec"><h2>Magnetic field</h2>
      ${kv([
        ['Global field', m.present ? 'Yes' : 'No'],
        m.present ? ['Surface strength (equator)', `${n(m.B)} G <small>(Earth: 0.3, Jupiter: 4.2)</small>`] : null,
        m.present ? ['Geometry', esc(m.morphology)] : null,
        m.dynamoLifetime ? ['Dynamo lifetime', `${n(m.dynamoLifetime)} Gyr`] : null,
        m.magnetopause ? ['Magnetopause distance', `${n(m.magnetopause)} planetary radii`] : null,
        m.windPressure ? ['Stellar-wind pressure', `${n(m.windPressure)}× Earth's`] : null,
        m.cyclotronMHz ? ['Auroral radio cut-off', `${n(m.cyclotronMHz)} MHz`] : null
      ])}
      ${why(N.magnetism)}
    </section>`);

    // ---- habitability
    const hb = p.habitability;
    const facs = hb.factors.map((x) => `<div class="bar"><span class="label">${esc(x.name)}<small>${esc(x.why)}</small></span><span class="track"><span class="fill" style="width:${Math.round(x.v * 100)}%"></span></span><span class="num">${x.v.toFixed(2)}</span></div>`).join('');
    h.push(`<section class="sec"><h2>Habitability</h2>
      <div class="habscore"><span class="big">${hb.index}</span><span class="lab">${esc(hb.label)}</span><span class="esi">Earth Similarity Index ${hb.esi.toFixed(2)}</span></div>
      <div class="bars">${facs}</div>
      ${hb.extras.length ? `<ul class="extras">${hb.extras.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${why([
        { text: 'The index multiplies "hard" requirements for surface life as we know it (liquid-water temperatures, an atmosphere of useful pressure, available water, a rocky size) and softer modifiers (stellar activity, magnetic shielding, rotation, age, orbit). It is a heuristic, not a probability of life.' },
        { text: 'The Earth Similarity Index compares radius, density, escape velocity and surface temperature with Earth. High ESI does not imply habitability — Venus scores ~0.4–0.7 depending on the temperature used.', refs: ['SM11'] }
      ], 'How the score works')}
    </section>`);

    // ---- analogues
    const an = EXO.findAnalogs(p, s);
    h.push(`<section class="sec"><h2>Most similar known worlds</h2>
      <div class="analogs">${an.map((a) => `<div class="analog"><span class="pct">${a.sim}%</span><div><b>${esc(a.an.name)}</b> <small style="color:var(--faint)">${esc(a.an.note)}</small><p>This planet has ${esc(a.why)}; host star ${Math.round(a.an.Teff)} K vs ${Math.round(s.teff)} K.</p></div></div>`).join('')}</div>
      ${why([{ text: 'Similarity weighs differences in log mass, log radius, log instellation, host-star temperature and eccentricity, with a penalty when the planet classes differ (rocky, water-rich, sub-Neptune, Neptune, giant). Catalogue values are approximate published parameters; RV-only planets use minimum masses.' }], 'How similarity is measured')}
    </section>`);

    // ---- observability (filled by renderObservability)
    h.push(`<section class="sec" id="obsSec"><h2>Could we observe it?</h2>
      <p class="lede">Place this system at a chosen distance from the Sun. Facility status is as of October 2026.</p>
      <div class="distrow"><label for="dist">Distance</label><input type="range" id="dist" min="0" max="1000" step="1"><output id="distOut"></output></div>
      <div id="obsBody"></div>
    </section>`);

    // ---- spectrum
    h.push(`<section class="sec" id="specSec"><h2>Simulated spectrum</h2>
      <p class="lede">Low-resolution model spectrum with JWST-like noise at the chosen distance; shaded band shows ±1σ.</p>
      <div class="spectoggle" role="group" aria-label="Spectrum type"><button type="button" data-spec="transmission">Transmission</button><button type="button" data-spec="emission">Emission + reflection</button></div>
      <canvas id="specCanvas" aria-label="Simulated spectrum plot"></canvas>
      <div id="specTable"></div>
      ${why([
        { text: 'Transmission: the effective altitude of the atmosphere at each wavelength is z(λ) = H·ln(σ(λ)·n₀·√(2πR_pH)/0.56), so features scale with the scale height H = kT/(μg). Clouds and the solid surface set a floor.', refs: ['LdE08'] },
        { text: 'Emission: each wavelength sees the τ = 1 level of a parametric temperature profile (with a thermal inversion on ultra-hot giants), plus reflected starlight.' },
        { text: 'Molecular bands are smoothed approximations of real opacities: positions are right, strengths are indicative. Noise assumes NIRSpec/MIRI-like precision, up to 10 transits for small temperate planets and 4 otherwise, limited by how many events occur in 5 years.', refs: ['K18'] }
      ], 'How the spectrum is modelled')}
    </section>`);

    // ---- about
    const used = new Set();
    for (const k in N) for (const x of N[k]) (x.refs || []).forEach((r) => used.add(r));
    ['R21', 'Kr01', 'PM13', 'J12', 'P25', 'SM11', 'LdE08', 'K18', 'GAIA', 'LW25', 'ROMAN', 'ELT', 'ANDES', 'HWO', 'LIFE', 'ARIEL', 'RW', 'Z07'].forEach((r) => used.add(r));
    const allRefs = Object.keys(EXO.REFS).sort((a, b) => (used.has(b) - used.has(a)) || EXO.REFS[a].cite.localeCompare(EXO.REFS[b].cite));
    h.push(`<section class="sec refs"><h2>About the model</h2>
      <p class="lede">Each planet comes from a few random initial conditions; everything else follows from published relations, in this order:</p>
      <ol class="pipeline">
        <li>Star: type from the local census, then mass, luminosity, radius, temperature and an XUV activity history.</li>
        <li>Orbit: period or distance from Kepler/radial-velocity occurrence rates; eccentricity and tilt.</li>
        <li>Bulk: core mass, iron and water fractions, primordial H/He; XUV-driven escape strips envelopes, producing the radius valley.</li>
        <li>Habitable zone, cosmic-shoreline atmosphere retention, then tides (locking, heating).</li>
        <li>Climate state: runaway greenhouse, carbonate–silicate regulation, snowball or haze; giant-planet cloud classes.</li>
        <li>Magnetic dynamo, habitability factors, known-world analogues, observability and spectra.</li>
      </ol>
      <p class="lede">References</p>
      <ol>${allRefs.map((k) => { const r = EXO.REFS[k]; return `<li id="ref-${k}">${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)} <span>— ${esc(r.note)}</span></li>`; }).join('')}</ol>
    </section>`);

    // shrink astronomical unit symbols (they render oversized in most fonts), text nodes only
    const html = h.join('').replace(/>([^<]*)</g, (m, t) => '>' + t.replace(/([⊕☉♃])/g, '<span class="sym">$1</span>') + '<');
    document.getElementById('sheet').innerHTML = html;
  };

  // -------------------------------------------------------------- observability
  EXO.ui.renderObservability = function (sys, ly) {
    const n = f();
    const ob = EXO.observe(sys, ly);
    const b = ob.basics;
    const html = [`<p class="obsbasics">At ${n(ly)} light-years (${n(b.dpc)} pc): host V = ${n(b.phot.V)}, J = ${n(b.phot.J)}; star–planet separation ${n(b.sepMas)} mas; reflected-light contrast ${EXO.fmt.sci(b.cRefl)}; 10 µm thermal contrast ${EXO.fmt.sci(b.c10)}; stellar wobble ${n(b.Kms)} m/s and ${n(b.astro)} µas; transit probability ${(b.transitProb * 100).toFixed(b.transitProb < 0.01 ? 2 : 1)}%, depth ${n(b.depth * 1e6)} ppm.</p>`];
    const order = { yes: 0, maybe: 1, no: 2 };
    const list = ob.instruments.slice().sort((x, y) => order[x.verdict] - order[y.verdict]);
    for (const i of list) {
      html.push(`<div class="inst"><span class="verdict ${i.verdict}">${{ yes: 'Likely', maybe: 'Possible', no: 'No' }[i.verdict]}</span><div>
        <h3>${esc(i.name)} ${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</h3>
        <p class="st ${i.sc}">${esc(i.technique)}. ${esc(i.status)}.</p>
        <p>${esc(i.detail)}${refLinks(i.refs)}</p></div></div>`);
    }
    document.getElementById('obsBody').innerHTML = html.join('');
  };

  // -------------------------------------------------------------- spectrum plot
  EXO.ui.drawSpectrum = function (sys, mode, ly) {
    const n = f();
    const sp = EXO.spectrum(sys, mode, ly);
    const cv = document.getElementById('specCanvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--star').trim() || '#ffd29a';
    const L = 58, R = 14, T = 16, B = 38;
    const lx = (l) => L + (Math.log(l / 0.5) / Math.log(16 / 0.5)) * (W - L - R);
    let ymin = Math.min(...sp.y), ymax = Math.max(...sp.y);
    const pad = Math.max((ymax - ymin) * 0.15, sp.noise * 2, ymax * 0.002 + 0.5);
    ymin -= pad; ymax += pad;
    if (mode === 'emission') ymin = Math.max(0, ymin);
    const yy = (y) => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
    // JWST coverage
    g.fillStyle = 'rgba(154,164,196,0.06)';
    g.fillRect(lx(0.6), T, lx(12) - lx(0.6), H - T - B);
    g.fillStyle = '#6c769a'; g.font = '11px Atkinson Hyperlegible, sans-serif';
    g.fillText('JWST NIRISS/NIRSpec + MIRI LRS', lx(0.62) + 4, T + 12);
    // axes
    g.strokeStyle = '#2a3766'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(L, T); g.lineTo(L, H - B); g.lineTo(W - R, H - B); g.stroke();
    g.fillStyle = '#9aa4c4';
    for (const t of [0.5, 0.7, 1, 1.5, 2, 3, 4, 5, 7, 10, 15]) {
      const x = lx(t);
      g.fillText(String(t), x - 6, H - B + 15);
      g.strokeStyle = 'rgba(42,55,102,0.4)'; g.beginPath(); g.moveTo(x, T); g.lineTo(x, H - B); g.stroke();
    }
    g.fillText('Wavelength (µm)', W / 2 - 40, H - 6);
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const y = ymin + (ymax - ymin) * i / ticks;
      g.fillText(y >= 1000 ? Math.round(y).toLocaleString('en-US') : y.toFixed(y < 10 ? 1 : 0), 4, yy(y) + 4);
    }
    g.save(); g.translate(12, H / 2 + 40); g.rotate(-Math.PI / 2); g.restore();
    // noise band
    g.fillStyle = 'rgba(154,164,196,0.16)';
    g.beginPath();
    sp.lam.forEach((l, i) => { const x = lx(l), y = yy(sp.y[i] + sp.noise); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    for (let i = sp.lam.length - 1; i >= 0; i--) g.lineTo(lx(sp.lam[i]), yy(sp.y[i] - sp.noise));
    g.closePath(); g.fill();
    // curve
    g.strokeStyle = accent; g.lineWidth = 2;
    g.beginPath();
    sp.lam.forEach((l, i) => { const x = lx(l), y = yy(sp.y[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    // molecule labels
    g.fillStyle = '#e6e9f4'; g.font = '12px Atkinson Hyperlegible, sans-serif';
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
    g.fillStyle = '#9aa4c4'; g.font = '11px Atkinson Hyperlegible, sans-serif';
    g.fillText(sp.yLabel, L + 6, H - B - 8);

    // table
    const tbl = document.getElementById('specTable');
    if (!sp.mols.length) {
      tbl.innerHTML = `<p class="lede" style="margin-top:12px">${sys.planet.hasAtm ? 'No molecular features stand out at this resolution.' : 'No atmosphere: the spectrum is flat. Measuring that flatness is itself how JWST tests whether rocky planets kept their air.'}</p>`;
    } else {
      tbl.innerHTML = `<table class="mols"><thead><tr><th>Molecule</th><th>Abundance</th><th>Strongest band</th><th>Feature size</th><th>JWST (${sp.nObs} ${mode === 'transmission' ? 'transit' : 'eclipse'}${sp.nObs > 1 ? 's' : ''}, ±${n(sp.noise)} ppm)</th></tr></thead><tbody>${sp.mols.map((x) => `<tr><td>${mol(x.mol)}</td><td>${x.vmr >= 0.01 ? (x.vmr * 100).toFixed(1) + '%' : n(x.vmr * 1e6) + ' ppm'}</td><td>${n(x.at)} µm</td><td>${n(x.amp)} ppm</td><td><span class="dot ${x.inJWST ? x.verdict : 'no'}"></span>${!x.inJWST ? 'outside range' : { yes: 'detectable', maybe: 'marginal', no: 'too weak' }[x.verdict]}</td></tr>`).join('')}</tbody></table>${sp.saturated ? '<p class="lede">At this distance the host is bright enough to saturate standard JWST time-series modes; real observations would need special readout modes.</p>' : ''}`;
    }
  };

  // -------------------------------------------------------------- HZ strip
  EXO.ui.drawHZ = function (sys) {
    const s = sys.star, p = sys.planet;
    const cv = document.getElementById('hzStrip');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = 86;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const d = p.hzDist;
    const lo = Math.min(p.a * (1 - p.e), d.recentVenus) / 4, hi = Math.max(p.a * (1 + p.e), d.earlyMars, p.frostLine) * 3;
    const x = (a) => 10 + (Math.log(a / lo) / Math.log(hi / lo)) * (W - 20);
    const y0 = 40;
    g.fillStyle = 'rgba(127,211,166,0.12)'; g.fillRect(x(d.recentVenus), y0 - 16, x(d.earlyMars) - x(d.recentVenus), 32);
    g.fillStyle = 'rgba(127,211,166,0.3)'; g.fillRect(x(d.runaway), y0 - 16, x(d.maxGreenhouse) - x(d.runaway), 32);
    g.strokeStyle = '#2a3766'; g.beginPath(); g.moveTo(10, y0); g.lineTo(W - 10, y0); g.stroke();
    // frost line
    g.strokeStyle = 'rgba(160,200,255,0.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x(p.frostLine), y0 - 20); g.lineTo(x(p.frostLine), y0 + 20); g.stroke(); g.setLineDash([]);
    // star
    const sc = EXO.blackbodyRGB(s.teff).map((c) => Math.round(c * 255));
    g.fillStyle = `rgb(${sc})`; g.beginPath(); g.arc(4, y0, 6, 0, 7); g.fill();
    // orbit extent
    if (p.e > 0.02) { g.strokeStyle = '#e6e9f4'; g.lineWidth = 2; g.beginPath(); g.moveTo(x(p.a * (1 - p.e)), y0); g.lineTo(x(p.a * (1 + p.e)), y0); g.stroke(); g.lineWidth = 1; }
    g.fillStyle = '#e6e9f4'; g.beginPath(); g.arc(x(p.a), y0, 5, 0, 7); g.fill();
    g.font = '11px Atkinson Hyperlegible, sans-serif'; g.fillStyle = '#9aa4c4';
    g.fillText('habitable zone', x(d.runaway) + 3, y0 - 20);
    g.fillText('frost line', x(p.frostLine) + 4, y0 + 30);
    const n = f();
    g.fillStyle = '#e6e9f4';
    const lab = `${n(p.a)} au`;
    g.fillText(lab, Math.min(W - 50, x(p.a) - 14), y0 + 18);
    // scale
    g.fillStyle = '#6c769a';
    for (const a of [0.01, 0.1, 1, 10, 100]) if (a > lo && a < hi) g.fillText(a + ' au', x(a) - 10, H - 4);
  };

  // -------------------------------------------------------------- cross-section
  EXO.ui.drawXSection = function (sys) {
    const p = sys.planet;
    const cv = document.getElementById('xsection');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 150 * dpr; cv.height = 150 * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 150, 150);
    const c = 75, R = 68;
    const layers = p.layers.slice().sort((a, b) => b.r - a.r);
    for (const L of layers) {
      g.fillStyle = L.color;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, Math.max(1.5, L.r * R), -Math.PI * 0.5, Math.PI * 1.0); g.closePath(); g.fill();
    }
    // outer (unsliced) quarter in planet colour
    const v = p.vis;
    const base = v.c[0].map((x) => Math.round(x * 255));
    g.fillStyle = `rgb(${base})`; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, Math.PI, Math.PI * 1.5); g.closePath(); g.fill();
    if (p.hasAtm) { g.strokeStyle = `rgba(${v.atmCol.map((x) => Math.round(x * 255))},0.6)`; g.lineWidth = 3; g.beginPath(); g.arc(c, c, R + 2, 0, 7); g.stroke(); }
    document.getElementById('xsecLegend').innerHTML = layers.slice().reverse().map((L) => `<span><i style="background:${L.color}"></i>${esc(L.name)}</span>`).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);
