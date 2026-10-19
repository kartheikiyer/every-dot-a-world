/* The flowchart page: every step from a seed to a finished planet, traced for one seed. */
(function () {
  const EXO = window.EXO, ST = EXO.state;
  const $ = (id) => document.getElementById(id);
  const n = EXO.fmt.num;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const SUB = { H2O: 'H₂O', CH4: 'CH₄', CO2: 'CO₂', NH3: 'NH₃', O2: 'O₂', O3: 'O₃', SO2: 'SO₂', H2S: 'H₂S', N2: 'N₂', H2: 'H₂' };
  const mol = (m) => SUB[m] || m;
  const isGiantish = (p) => p.regime !== 'solid' && p.regime !== 'thinH2';
  const days = (d) => d === Infinity ? '∞' : d < 2 ? `${n(d * 24)} h` : d < 800 ? `${n(d)} d` : `${n(d / 365.25)} yr`;
  const label = (st) => (EXO.TYPE_INFO[st] || { label: st }).label;

  const cited = new Set();
  function refs(keys) {
    return (keys || []).filter((k) => EXO.REFS[k]).map((k) => {
      cited.add(k);
      const r = EXO.REFS[k];
      return `<a class="ref" href="#ref-${k}" title="${esc(r.cite + ': ' + r.note)}">[${esc(r.cite.split(/,| \(/)[0])}]</a>`;
    }).join('');
  }
  const figs = (cells) => `<div class="figs">${cells.filter(Boolean).map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  const trace = (sysName, cells, note) => `<div class="trace"><p class="trace-h">${esc(sysName)}</p>${cells ? figs(cells) : ''}${note ? `<p class="trace-note">${note}</p>` : ''}</div>`;
  const relations = (items) => `<details class="why"><summary>The relations</summary><ul>${items.map(([t, r]) => `<li>${t}${refs(r)}</li>`).join('')}</ul></details>`;
  // a dichotomous key: rows of [code, condition, outcome, taken]
  const key = (title, rows) => `<div class="key"><p class="key-h">${title}</p><ol>${rows.map(([c, cond, out, taken]) => `<li${taken ? ' class="taken"' : ''}><span class="kc">${c}</span><span class="kq">${cond}</span><span class="ko">${out}</span>${taken ? '<span class="kt">This planet</span>' : '<span></span>'}</li>`).join('')}</ol></div>`;

  // ---------------------------------------------------------------- steps
  // ink: the guide tab whose page this step fills
  const STEPS = [
    { id: 'seed', label: 'Seed', ink: '--t-plate' },
    { id: 'rng', label: 'Random streams', ink: '--t-plate' },
    { id: 'mode', label: 'One system or forty', ink: '--t-plate' },
    { id: 'star', label: 'Star', ink: '--t-star', loop: true },
    { id: 'init', label: 'Initial conditions', ink: '--t-orbit', loop: true },
    { id: 'orbit', label: 'Orbit', ink: '--t-orbit', loop: true },
    { id: 'bulk', label: 'Bulk structure', ink: '--t-body', loop: true },
    { id: 'hz', label: 'Habitable zone', ink: '--t-orbit', loop: true },
    { id: 'shore', label: 'Atmosphere retention', ink: '--t-air', loop: true },
    { id: 'tides', label: 'Tides and spin', ink: '--t-orbit', loop: true },
    { id: 'climate', label: 'Climate state', ink: '--t-air', loop: true },
    { id: 'interior', label: 'Interior', ink: '--t-body', loop: true },
    { id: 'field', label: 'Magnetic field', ink: '--t-field', loop: true },
    { id: 'life', label: 'Habitability', ink: '--t-life', loop: true },
    { id: 'identity', label: 'Type, name, colours', ink: '--t-plate', loop: true },
    { id: 'pick', label: 'Pick one', ink: '--t-plate' },
    { id: 'render', label: 'Render', ink: '--t-plate', out: true },
    { id: 'surface', label: 'Surface view', ink: '--t-surface', out: true },
    { id: 'similar', label: 'Similar worlds', ink: '--t-kin', out: true },
    { id: 'observe', label: 'Observability', ink: '--t-observe', out: true },
    { id: 'spectrum', label: 'Spectrum', ink: '--t-observe', out: true }
  ];
  const INK = Object.fromEntries(STEPS.map((s) => [s.id, s.ink]));

  // ---------------------------------------------------------------- candidates (Interesting mode)
  function candidates(seed, mode) {
    const I = EXO._internal;
    const root = new EXO.RNG(seed + '|' + mode);
    const N = mode === 'realistic' ? 1 : 40;
    const list = [];
    for (let i = 0; i < N; i++) {
      const c = I.buildSystem(seed, root.fork('cand' + i), mode, i);
      list.push({ i, sys: c, score: I.interestScore(c) });
    }
    const mx = Math.max(...list.map((c) => c.score));
    const tot = list.reduce((a, c) => a + Math.exp((c.score - mx) / 0.9), 0);
    list.forEach((c) => (c.prob = Math.exp((c.score - mx) / 0.9) / tot));
    return list;
  }

  // ---------------------------------------------------------------- climate key, traced
  function climateKey(sys) {
    const p = sys.planet, s = sys.star, hz = p.hz, S = p.S, st = p.state;
    const wet = (p.wmf || 0) >= 0.05;
    const I = EXO._internal;
    if (p.regime === 'thinH2') {
      return key('Key to climate: water world under thin hydrogen', [
        ['1a', 'Surface warmed to 273–420 K by H₂ collision-induced greenhouse', 'Hycean candidate', st === 'hycean'],
        ['1b', 'Colder than 273 K', 'Icy water world', st === 'ice-world'],
        ['1c', 'Hotter than 420 K', 'Steam world (supercritical water)', st === 'steam']
      ]);
    }
    if (isGiantish(p)) {
      if (p.regime === 'giant') {
        const T = p.Teff;
        return key(`Key to giant-planet clouds (Sudarsky classes) by effective temperature: this planet ${Math.round(T)} K`, [
          ['1a', 'Below 150 K', 'Ammonia clouds (class I)', st === 'giant-ammonia'],
          ['1b', '150–300 K', 'Water clouds (class II)', st === 'giant-water'],
          ['1c', '300–850 K', 'Cloudless, blue (class III)', st === 'giant-clear'],
          ['1d', '850–1400 K', 'Alkali absorbers, dark (class IV)', st === 'giant-alkali'],
          ['1e', '1400–2200 K', 'Silicate clouds (class V)', st === 'giant-silicate'],
          ['1f', 'Above 2200 K', 'Ultra-hot, thermal inversion', st === 'giant-ultrahot']
        ]);
      }
      return key(`Key to gas-rich small planets: this planet T<sub>eq</sub> ${Math.round(p.Teq)} K`, [
        ['1a', 'Envelope mostly stripped by its star (regime: chthonian)', 'Exposed giant-planet core', st === 'chthonian'],
        ['1b', 'Low mass holding a huge envelope (super-puff draw)', 'Super-puff', st === 'super-puff'],
        ['1c', 'Neptune-mass, below 200 K', 'Ice giant', st === 'ice-giant'],
        ['1d', 'Neptune-mass, 200–900 K', 'Warm Neptune', st === 'warm-neptune'],
        ['1e', 'Neptune-mass, above 900 K', 'Hot Neptune', st === 'hot-neptune'],
        ['1f', 'Rocky core inside a thicker hydrogen envelope', 'Sub-Neptune', st === 'sub-neptune']
      ]);
    }
    // solid worlds
    const lost = p.Psurf == null && p.atm && p.atm.type === 'none';
    const out = [];
    out.push(key('Key to climate, part 1: did the air survive?', [
      ['1a', 'Atmosphere lost at the cosmic shoreline (see Atmosphere retention)', 'go to 2', lost],
      ['1b', 'Atmosphere kept', 'go to 3', !lost]
    ]));
    if (lost) {
      const A = p.albedo, T0 = 394.1 * Math.pow(S * (1 - A), 0.25);
      out.push(key(`2. Airless: substellar ${Math.round(p.Tsubstellar || 0)} K at periastron, dayside scale ${Math.round(T0)} K`, [
        ['2a', 'Substellar point above 1400 K: rock melts', 'Lava world', st === 'lava'],
        ['2b', 'Water-rich and colder than 230 K', 'Icy water world', st === 'ice-world'],
        ['2c', 'Dayside scale above 500 K', 'Scorched rock', st === 'hot-rock'],
        ['2d', 'Otherwise', 'Airless rocky world', st === 'airless']
      ]));
      return out.join('');
    }
    const cov = p.oceanCover || 0;
    let Srun = hz.runaway; if (p.locked && cov > 0.3) Srun *= 1.3; if (!wet && cov < 0.12) Srun *= 1.6;
    const Smax = hz.maxGreenhouse;
    const band = S >= Srun ? 4 : S >= Smax ? 5 : 6;
    out.push(key(`3. Starlight ${n(S)} S⊕ against the runaway limit ${n(Srun)} and the maximum-greenhouse limit ${n(Smax)} S⊕`, [
      ['3a', 'Above the runaway-greenhouse limit', 'go to 4', band === 4],
      ['3b', 'Between the two limits (habitable-zone climates)', 'go to 5', band === 5],
      ['3c', 'Below the maximum-greenhouse limit', 'go to 6', band === 6]
    ]));
    if (band === 4) out.push(key('4. Runaway greenhouse', [
      ['4a', 'Water-rich: oceans boil into a supercritical envelope', 'Steam world', st === 'steam'],
      ['4b', 'Dry: CO₂ piles up once weathering stops (above 600 K: no acid clouds)', 'Venus-like / Hot CO₂ world', st === 'venus' || st === 'venus-hot'],
      ['4c', 'Greenhouse surface above 1500 K', 'Lava world under a thick atmosphere', st === 'lava']
    ]));
    if (band === 5) out.push(key('5. Inside the habitable zone', [
      ['5a', 'Air thinner than 6 mbar (water’s triple point)', 'Desert world, Mars-like', st === 'desert' && (p.Psurf || 0) < 0.006],
      ['5b', 'Global ocean, no land: no carbonate–silicate thermostat (below 265 K it freezes)', 'Ocean world / Icy water world', st === 'ocean' || st === 'ice-world'],
      ['5c', 'Ocean cover of 12% or more: weathering regulates CO₂', p.locked ? 'Temperate terrestrial (locked: “eyeball” below 285 K, else “lobster”)' : 'Temperate terrestrial', st === 'temperate'],
      ['5d', 'Little surface water', 'Desert world, a “land planet”', st === 'desert' && (p.Psurf || 0) >= 0.006]
    ]));
    if (band === 6) {
      const Tc = I.teqOf(S, 0.3);
      out.push(key(`6. Beyond the outer edge: T<sub>eq</sub> ${Math.round(Tc)} K`, [
        ['6a', 'Below 60 K: N₂ and CO₂ freeze out', 'Atmospheric collapse (Icy water world / Airless)', Tc < 60],
        ['6b', 'Below 120 K with more than 0.05 bar (a 60% draw)', 'Titan-like haze world', st === 'titan'],
        ['6c', 'Some water: it freezes globally', 'Snowball / Icy water world', Tc >= 60 && (st === 'snowball' || st === 'ice-world')],
        ['6d', 'Dry', 'Desert world, an exo-Mars', st === 'desert']
      ]));
    }
    return out.join('');
  }

  // ---------------------------------------------------------------- sections
  function sections(sys, ctx) {
    const s = sys.star, p = sys.planet, init = p.init, name = p.name;
    const H = {};
    const hex = (EXO.hashSeed(`${sys.seed}|${sys.mode}`) >>> 0).toString(16).padStart(8, '0');

    H.seed = { title: 'The seed', lede: 'Any string can be a seed. New planet draws eight characters from a 32-letter alphabet (no I, O, 0 or 1, so seeds are easy to read aloud) using the browser’s cryptographic random source. The seed and the generation mode travel in the page link, which is why every planet can be shared and reproduced exactly.',
      trace: [[esc(sys.seed), 'seed'], [cap(sys.mode), 'mode']],
      rel: [['Seed alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789; 8 characters give 32⁸ ≈ 1.1 × 10¹² seeds.'], ['Link format: <code>#seed=…&amp;mode=…&amp;d=…</code>; edited model inputs add <code>p=…</code>.']] };

    H.rng = { title: 'Random streams', lede: 'The seed and mode are joined (“SEED|mode”) and hashed into a 32-bit number that starts a small, fast pseudo-random generator. Each part of the model then forks its own stream by appending a label, so the star, the planet, its name and its climate draws never borrow numbers from each other: changing how one is drawn leaves the others untouched.',
      trace: [[`0x${hex}`, 'hashed state'], ['star · planet · name · derive', 'forked streams']],
      rel: [['Hash: xmur3 (string → 32-bit state); generator: mulberry32. The first four outputs are discarded so similar seeds diverge.'], ['fork(label) starts a new generator from <i>seed</i> + “|” + <i>label</i>.'], ['Normal draws use Box–Muller; Beta draws use two Gamma draws (Marsaglia–Tsang).']] };

    H.mode = { title: 'One system or forty', lede: ctx.realistic
      ? 'Realistic mode builds a single system, drawn straight from the occurrence rates, so most results are what the galaxy mostly makes: M-dwarf planets, sub-Neptunes and cold worlds.'
      : 'Interesting mode builds 40 complete candidate systems with the same physics, each from its own stream, then picks one with odds tilted toward rarer and more habitable outcomes (see Pick one). Its sampling is also flattened: fewer M dwarfs, and giants and Neptunes 2.5× and 1.8× more likely.',
      trace: [[ctx.realistic ? '1' : '40', 'candidate systems'], [ctx.realistic ? 'none' : 'softmax on interest', 'selection']],
      rel: [['Candidate <i>i</i> uses the stream fork(“cand<i>i</i>”), so the same seed always yields the same 40 candidates.']] };

    const sw = ctx.realistic ? 'M 72%, K 13%, G 7%, F 3%, A 0.7%, white dwarf 4.3%' : 'M 36%, K 22%, G 18%, F 11%, A 6%, white dwarf 7%';
    H.star = { title: 'Star', lede: s.isWD
      ? 'The host class is drawn from the local census, and this one came up a white dwarf: its mass, cooling age and temperature are drawn directly, and its planet survived the star’s giant phase.'
      : 'The host class is drawn from the census of stars within 10 parsecs; the mass within the class follows the initial mass function. Age and metallicity are drawn, then luminosity, radius and temperature follow from main-sequence relations, along with a history of X-ray and extreme-ultraviolet (XUV) output that later decides whether the planet keeps its air.',
      trace: [[esc(s.spt), s.className], [`${n(s.mass)} M☉`, 'mass'], [`${n(s.age)} Gyr`, 'age'], [`${s.feh >= 0 ? '+' : ''}${s.feh.toFixed(2)}`, '[Fe/H]'], [`${n(s.lum)} L☉`, 'luminosity'], [`${Math.round(s.teff).toLocaleString('en-US')} K`, 'temperature']],
      rel: [[`Class weights (${cap(sys.mode)}): ${sw}.`, ['R21']], ['Mass within a class: power law from the initial mass function; main-sequence lifetime t<sub>MS</sub> = 10 Gyr × (M/M☉)<sup>−2.5</sup>; age uniform up to 0.92 t<sub>MS</sub> (11.5 Gyr at most).', ['Kr01']], ['[Fe/H] ~ normal(−0.05, 0.22). L and R from mass–luminosity and mass–radius relations, brightening with age; T<sub>eff</sub> from L = 4πR²σT⁴.', ['PM13']], ['XUV: saturated at L<sub>XUV</sub>/L<sub>bol</sub> ≈ 10⁻³ until t<sub>sat</sub> ≈ 0.1 (M/M☉)⁻² Gyr, then fading as t<sup>−1.5</sup>.', ['J12', 'P25']]] };

    const kindTxt = { small: 'rocky or water-rich (optionally with an envelope)', neptune: 'Neptune-class', giant: 'giant' }[init.kind];
    H.init = { title: 'Initial conditions', lede: 'Next come the few numbers the model draws for the planet itself: what kind of planet formed, where it orbits, and what it is made of. Everything after this step is calculated, apart from a handful of probabilistic outcomes that are flagged where they happen.',
      trace: [[cap(init.kind === 'small' ? 'small' : init.kind), kindTxt], init.P ? [days(init.P), 'orbital period drawn'] : [`${n(init.a)} au`, 'distance drawn'], init.coreMass ? [`${n(init.coreMass)} M⊕`, 'rock + iron + water'] : [`${n(init.mass)} M⊕`, 'planet mass'], init.kind === 'small' ? [`${Math.round(init.cmf * 100)}% · ${init.wmf >= 0.01 ? Math.round(init.wmf * 100) + '%' : '<1%'}`, 'iron · water fraction'] : null, [`${((init.fEnv0 || 0) * 100).toFixed(1)}%`, 'initial H/He'], [init.e.toFixed(3), 'eccentricity']],
      rel: [['Kind weights: small 2.5, Neptune 0.3, giant 0.15 × 10<sup>1.8[Fe/H]</sup> × M★ (giants and Neptunes rarer around stars below 0.35 M☉; ×2.5 and ×1.8 in Interesting).', ['FV05']], ['Small planets: dN/dlogP ∝ P<sup>1.5</sup> out to 6–10 days, flat beyond, declining past 500 days; core mass log-normal around 4.5 M⊕ × M★<sup>0.5</sup>; iron fraction ~normal(0.32, 0.07); water-rich with 25–45% probability; an envelope becomes likely above ~1 M⊕ of core.', ['How12', 'G26']], ['Giants: mass power law 0.1–13 M♃; a hot-Jupiter draw (6%, 2.5% for M dwarfs) or a broken power law peaking near the snow line; eccentricity Beta(0.867, 3.03); orbits under 5 days are circularised.', ['Fe19', 'W12', 'Ki13']]] };

    H.orbit = { title: 'Orbit', lede: 'Kepler’s third law turns the drawn period (or distance) into the other; the star’s luminosity then gives the starlight the planet receives, and its XUV history gives the lifetime dose of high-energy radiation.',
      trace: [[`${n(p.a)} au`, 'semi-major axis'], [days(p.period), 'year'], [`${n(p.S)} S⊕`, 'starlight vs. Earth'], [`${n(p.fluenceRel)}×`, 'lifetime XUV vs. Earth'], [`${n(p.frostLine)} au`, 'frost line']],
      rel: [['a³ = (M★ + M<sub>p</sub>) P² (au, years, solar masses).'], ['Instellation S = L/a² / √(1 − e²), averaged over the orbit.'], ['Frost line ≈ 3.45 √L au (present day).']] };

    const regimeTxt = { solid: 'solid surface', thinH2: 'water world, thin H₂', envelope: 'thick H/He envelope', giant: 'giant', superpuff: 'super-puff', chthonian: 'stripped core' }[p.regime];
    H.bulk = { title: 'Bulk structure', lede: 'The core’s size follows from its mass and iron and water fractions. Any primordial hydrogen envelope then faces the star’s lifetime XUV dose: energy-limited escape strips it partly or completely, which is what carves the radius valley between super-Earths and sub-Neptunes.',
      trace: [[regimeTxt, 'regime'], [`${n(p.radius)} R⊕`, 'radius'], [`${n(p.mass)} M⊕`, 'mass'], [`${n(p.density)} g/cm³`, 'density'], p.envLossFrac != null ? [`${Math.round(p.envLossFrac * 100)}%`, 'envelope lost to escape'] : null],
      key: init.kind === 'small' ? key('Key to regime (small planets)', [
        ['1a', 'Never captured hydrogen, or escape removed all of it', 'Solid surface', p.regime === 'solid' && !(init.fEnv0 > 0 && p.fEnv > 0)],
        ['1b', 'A thin layer survives (base below 2000 bar) on a water-rich world', 'Water world under thin H₂', p.regime === 'thinH2'],
        ['1c', 'A thicker envelope survives (2000 bar or more at its base)', 'Sub-Neptune envelope', p.regime === 'envelope']
      ]) : init.kind === 'neptune' ? key('Key to regime (Neptune-class)', [
        ['1a', 'Escape would remove more than 60% of the envelope', 'Exposed core (chthonian)', p.regime === 'chthonian'],
        ['1b', 'Super-puff draw keeps a huge envelope', 'Super-puff', p.regime === 'superpuff'],
        ['1c', 'Otherwise', 'Neptune-like envelope', p.regime === 'envelope']
      ]) : '',
      rel: [['Rocky radius: Zeng et al. relation for the iron and water fractions.', ['Z16']], ['Escape: M<sub>lost</sub> = ε π R³ F<sub>XUV</sub> / (G M), with F<sub>XUV</sub> the lifetime fluence.', ['OW17', 'F17']], ['Envelope thickness: Lopez & Fortney (gas fraction, instellation, age); Neptunes follow Chen & Kipping; giants use a mass–radius curve with youth and irradiation inflation.', ['LF14', 'CK17', 'F07', 'TF18']]] };

    H.hz = { title: 'Habitable zone', lede: 'The habitable-zone limits come from climate-model fits as a function of the star’s temperature; for solid planets the inner edge also depends on the planet’s mass. They are used later to decide the climate.',
      trace: [[`${n(p.hzDist.runaway)}–${n(p.hzDist.maxGreenhouse)} au`, 'conservative zone'], [`${n(p.hzDist.recentVenus)}–${n(p.hzDist.earlyMars)} au`, 'optimistic zone'], [esc(p.hzZone), 'this planet']],
      rel: [['S<sub>eff</sub> = S₀ + aT + bT² + cT³ + dT⁴ with T = T<sub>eff</sub> − 5780 K, for the recent-Venus, runaway, maximum-greenhouse and early-Mars limits.', ['K13', 'K14']]] };

    const sh = p.shoreline;
    H.shore = { title: 'Atmosphere retention', lede: 'Rocky planets close to active stars can lose their air altogether. The model compares the planet’s lifetime XUV dose with a “cosmic shoreline” that rises steeply with escape velocity, turns the margin into a probability, and draws the outcome. Gas-rich planets skip this step.',
      trace: sh ? [[p.Psurf == null && p.atm.type === 'none' ? 'Lost' : 'Kept', 'outcome of the draw'], [`${n(p.fluenceRel)}×`, 'XUV dose vs. Earth'], [`${n(sh.Ishore)}×`, 'retention limit'], [n(sh.margin), 'margin (limit ÷ dose)'], [`${Math.round(sh.pAtm * 100)}%`, 'chance to keep air']] : null, chart: sh ? null : 'Skipped',
      note: sh ? null : 'Not applied: this planet is gas-rich, so its envelope was handled in Bulk structure.',
      key: sh ? key('Key to retention', [
        ['1a', 'Random draw below the retention probability', 'Atmosphere kept', !(p.Psurf == null && p.atm.type === 'none')],
        ['1b', 'Otherwise', 'Atmosphere lost: bare rock', p.Psurf == null && p.atm.type === 'none']
      ]) : '',
      rel: [['I<sub>shore</sub> = 25 × (v<sub>esc</sub> / 11.2 km s⁻¹)⁴ Earth-doses (×3 for water-rich planets, which keep re-supplying vapour).', ['ZC17']], ['P(keep) = 1 / (1 + exp(−log₁₀(margin) / 0.35)); a single draw from the derive stream decides.', ['P25']]] };

    H.tides = { title: 'Tides and spin', lede: 'Tides from the star slow the planet’s spin. If the despinning time is shorter than the system’s age, the planet is locked; the orbit’s eccentricity then decides which kind of lock. Eccentric orbits also heat the interior.',
      trace: [[esc(p.spinState), 'spin state'], [`${EXO.fmt.time(p.tLock)}`, 'locking timescale'], [`${n(s.age)} Gyr`, 'system age'], [days(p.protDays), 'rotation period'], p.tidalFlux > 0.01 ? [`${n(p.tidalFlux)} W/m²`, 'tidal heating'] : null],
      key: key('Key to spin', [
        ['1a', 'Locking time longer than the age', 'Free rotation, still slowing', p.spinState === 'free rotation'],
        ['1b', 'Locked on paper, but a thick atmosphere’s thermal tides keep it turning (habitable-zone planets of 0.5–0.8 M☉ stars, a 60% draw)', 'Asynchronous, like Venus', /asynchronous/.test(p.spinState)],
        ['1c', 'Locked, eccentricity below 0.1', 'Synchronous: one face to the star', p.spinState === 'synchronous'],
        ['1d', 'Locked, solid, eccentricity 0.1–0.25', '3:2 resonance, like Mercury', /3:2/.test(p.spinState)],
        ['1e', 'Locked, more eccentric', 'Pseudo-synchronous', p.spinState === 'pseudo-synchronous']
      ]),
      rel: [['t<sub>lock</sub> = ω₀ a⁶ I Q / (3 G M★² k₂ R⁵) (Q = 100 rocky, 10⁴ envelopes, 10⁵ giants).', ['G96', 'Ba17']], ['Pseudo-synchronous rate from Hut (1981); tidal heating Ė = (21/2)(k₂/Q) G M★² R⁵ n e² / a⁶.', ['Hut81', 'DB15']], ['Thermal-tide exception for Venus-like rotation.', ['Le15']]] };

    H.climate = { title: 'Climate state', lede: 'This is the heart of the model: a key that sorts the planet into one of about 25 climate states, using what the earlier steps established. Each state fixes the albedo, surface pressure and temperature, and the atmosphere’s make-up. The planet’s path through the key is marked.',
      trace: [[esc(label(p.state)), 'climate state'], p.Tsurf != null ? [`${Math.round(p.Tsurf)} K`, 'mean surface'] : [`${Math.round(p.Teq)} K`, 'equilibrium'], p.Psurf != null && !isGiantish(p) ? [`${n(p.Psurf)} bar`, 'surface pressure'] : null, p.oceanCover > 0 ? [`${Math.round(p.oceanCover * 100)}%`, 'ocean cover'] : null, [p.albedo.toFixed(2), 'Bond albedo']],
      key: climateKey(sys),
      rel: [['Greenhouse warming: T<sub>s</sub> = T<sub>eq</sub> (1 + ¾ τ)<sup>¼</sup> with an optical depth set by the atmosphere.', ['K13']], ['Carbonate–silicate thermostat for temperate worlds; ocean worlds without land lose it.', ['WHK81', 'KF18']], ['Locked climates: “eyeball” and “lobster” states; dry land planets; hycean worlds (contested).', ['HY14', 'Ab11', 'M21']], ['Giant classes: Sudarsky et al.; hydrogen-rich chemistry at about 1 bar.', ['Su00']]] };

    H.interior = { title: 'Interior', lede: 'The bulk composition is summarised as layers for the cross-section and the composition bars: iron core, silicate mantle, water or ice, and any envelope, sized from the mass fractions.',
      trace: [[`${p.layers.length} layers`, 'core to surface'], ...p.layers.slice().sort((a, b) => a.r - b.r).map((L) => [esc(L.name), `out to ${Math.round(L.r * 100)}% of the radius`])].slice(0, 5) };

    const m = p.magnetic;
    H.field = { title: 'Magnetic field', lede: 'Rocky planets run a core dynamo for a lifetime that grows with mass and iron, and shrinks under a stagnant lid; if the planet is younger than that, the field is on. Giants and Neptunes always have one, scaled from the heat flowing out of their interiors.',
      trace: [[m.present ? 'Yes' : 'No', 'global field'], m.present ? [`${n(m.B)} G`, 'surface field'] : null, m.dynamoLifetime ? [`${n(m.dynamoLifetime)} Gyr`, 'dynamo lifetime'] : null, m.tectonics ? [esc(m.tectonics), 'tectonics (a draw)'] : null],
      rel: [['Rocky dynamo lifetime ≈ 8 Gyr × M<sup>1.24</sup> × (lid factor) × √(cmf/0.33); field from energy-flux scaling B ∝ q<sup>1/3</sup>.', ['DB15', 'C09']], ['Magnetopause stand-off ≈ 10 R<sub>p</sub> (B/0.3 G)<sup>1/3</sup> (P<sub>wind</sub>)<sup>−1/6</sup>.']] };

    const hb = p.habitability;
    const low = hb.factors.slice().sort((a, b) => a.v - b.v).slice(0, 3);
    H.life = { title: 'Habitability', lede: 'A transparent score: “hard” requirements for surface life as we know it (temperature, atmosphere, water, size) are multiplied together, then softened by modifiers such as stellar activity, magnetic shielding, rotation, age and orbit. It is a heuristic, not a probability of life.',
      trace: [[`${hb.index}/100`, hb.label.toLowerCase()], [hb.esi.toFixed(2), 'Earth Similarity Index'], ...low.map((x) => [x.v.toFixed(2), `limit: ${x.name.toLowerCase()}`])],
      rel: [['Index = 100 × Π(hard factors) × Π(modifiers<sup>0.6</sup>); gas-rich worlds are capped near zero.'], ['Earth Similarity Index from radius, density, escape velocity and temperature.', ['SM11']]] };

    H.identity = { title: 'Type, name, colours', lede: 'The climate state names the planet’s type; a catalogue-style name is drawn from its own stream (survey prefixes depend on the host); and the physics is translated into shader colours, clouds, glow and rings for the render.',
      trace: [[esc(name), 'name'], [esc(p.typeInfo.label), 'type'], [esc(p.sizeClass), 'size class']],
      swatches: p.vis ? p.vis.c : null };

    H.pick = { title: 'Pick one', lede: ctx.realistic
      ? 'Realistic mode built a single system, so there is nothing to choose: what you see is one honest draw from the occurrence rates.'
      : 'Each candidate gets an interest score: rarer climate states score higher, plus bonuses for habitability, rings, tidal heating, eccentric orbits, white-dwarf or A-star hosts, youth and locked climates. One candidate is then drawn with probability proportional to exp(score / 0.9). Every result is still a legitimate output of the model; only the selection is biased.',
      cands: ctx.cands, chosen: sys.index };

    const sc = EXO.makeSurfaceScene ? EXO.makeSurfaceScene(p, s) : null;
    const an = EXO.findAnalogs(p, s);
    const ob = EXO.observe(sys, 10);
    const sp = EXO.spectrum(sys, 'transmission', 10);
    const yes = ob.instruments.filter((i) => i.verdict === 'yes');
    const det = sp.mols.filter((x) => x.inJWST && x.verdict === 'yes').map((x) => mol(x.mol));
    H.render = { title: 'Render', lede: 'The shader draws the planet from those parameters on every frame: surface pattern, oceans, ice, clouds, haze, atmospheric glow, night-side thermal emission and rings, lit by the star’s colour.', result: true };
    H.surface = { title: 'Surface view', lede: 'A second shader stands on the surface: the sky colour comes from how this atmosphere scatters this star’s light, the star is drawn at its true angular size, and the terrain follows the climate state.', trace: sc ? [[esc(cap(sc.label)), 'time of day where you stand']] : null, note: sc ? esc(sc.caption) : null };
    H.similar = { title: 'Similar worlds', lede: 'The planet is compared with about 60 Solar System and exoplanet worlds by mass, radius, starlight, host temperature and eccentricity, with a penalty when planet classes differ.',
      trace: an.map((a) => [`${a.sim}%`, esc(a.an.name)]) };
    H.observe = { title: 'Observability', lede: 'Placed at a chosen distance (10 light-years here), the system’s brightness, the planet’s separation and contrast, the star’s wobble and the transit odds are compared with what 16 current and planned facilities can do.',
      trace: [[`${yes.length} of ${ob.instruments.length}`, 'likely detections at 10 ly'], ...yes.slice(0, 3).map((i) => ['Likely', esc(i.name)])] };
    H.spectrum = { title: 'Spectrum', lede: 'Transmission and emission spectra are built from band-averaged molecular opacities, the atmosphere’s scale height and temperature profile, with JWST-like noise for the number of transits or eclipses that occur within five years.',
      trace: [[det.length ? det.join(', ') : 'none', 'JWST-detectable gases at 10 ly'], [`±${n(sp.noise)} ppm`, 'assumed precision']],
      rel: [['Transmission altitude z(λ) = H ln(σ(λ) n₀ √(2πR<sub>p</sub>H) / 0.56), H = kT/(μg).', ['LdE08']], ['Noise model after Kempton et al. (TSM).', ['K18']]] };
    return H;
  }

  // ---------------------------------------------------------------- render
  let view = null, sys = null, state = null;
  function render() {
    state = ST.readHash(location.hash);
    if (!state.seed) state.seed = EXO.randomSeed();
    const r = ST.build(state.seed, state.mode, state.over);
    sys = r.sys;
    const ctx = { realistic: state.mode === 'realistic', cands: candidates(state.seed, state.mode), custom: r.custom };
    history.replaceState(null, '', ST.hashOf(state, false));
    $('seedInput').value = state.seed;
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    $('backLink').href = `index.html${ST.hashOf(state, false)}`;
    document.title = `How ${sys.planet.name} was built – Every Dot a World`;
    $('tracing').innerHTML = `Tracing seed <b>${esc(state.seed)}</b> (${state.mode}) to <a href="index.html${ST.hashOf(state, false)}"><b>${esc(sys.planet.name)}</b>, ${esc(sys.planet.typeInfo.label.toLowerCase())}</a>${r.custom ? ', rebuilt from edited model inputs' : ''}.`;

    cited.clear();
    const H = sections(sys, ctx);
    const p = sys.planet;

    // chart: steps outside the loop, the per-candidate loop, the pick, then the outputs
    const node = (st) => {
      const h = H[st.id];
      const v = h.chart || (h.trace && h.trace[0] ? h.trace[0][0] : (st.id === 'pick' ? (ctx.realistic ? 'not needed' : `candidate ${sys.index + 1}`) : ''));
      return `<li class="node" data-id="${st.id}" style="--tab:var(${st.ink})"><a href="#st-${st.id}"><i></i><span class="nl">${esc(st.label)}</span><span class="nv">${v}</span></a></li>`;
    };
    const pre = STEPS.filter((s) => !s.loop && !s.out && s.id !== 'pick');
    const loop = STEPS.filter((s) => s.loop), outs = STEPS.filter((s) => s.out);
    $('chart').innerHTML = `<ol class="flowchart">
      ${pre.map(node).join('')}
      <li class="loop"><p class="loop-h">For each candidate${ctx.realistic ? ' (1 in Realistic)' : ' (40 in Interesting)'}</p><ol>${loop.map(node).join('')}</ol></li>
      ${node(STEPS.find((s) => s.id === 'pick'))}
      <li class="fan"><p class="loop-h">What you see</p><ol>${outs.map((st) => `<li class="node out" data-id="${st.id}" style="--tab:var(${st.ink})"><a href="#st-${st.id}"><i></i><span class="nl">${esc(st.label)}</span></a></li>`).join('')}</ol></li>
    </ol>`;

    // detail sections
    const html = STEPS.map((st) => {
      const h = H[st.id];
      let body = `<p class="lede">${h.lede}</p>`;
      if (h.trace || h.note) body += trace(sys.planet.name, h.trace, h.note);
      if (h.swatches) body += `<div class="swatches" role="img" aria-label="Shader palette for this planet">${h.swatches.map((c) => `<span style="background:rgb(${c.map((x) => Math.round(x * 255)).join(',')})"></span>`).join('')}<small>Shader palette, from the climate state and composition</small></div>`;
      if (h.cands && !ctx.realistic) {
        const top = h.cands.slice().sort((a, b) => b.prob - a.prob).slice(0, 8);
        const mx = top[0].prob;
        body += `<p class="sublabel">The eight most likely of 40 candidates</p><div class="tablewrap"><table class="cands"><thead><tr><th>#</th><th>Candidate</th><th>Host</th><th>Score</th><th>Chance</th></tr></thead><tbody>${top.map((c) => `<tr${c.i === h.chosen ? ' class="chosen"' : ''}><td>${c.i + 1}</td><td>${esc(c.sys.planet.typeInfo.label)}${c.i === h.chosen ? ' <span class="kt">Chosen</span>' : ''}</td><td>${esc(c.sys.star.spt)}</td><td>${c.score.toFixed(2)}</td><td><span class="pbar"><span style="width:${(100 * c.prob / mx).toFixed(1)}%"></span></span>${(c.prob * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>${top.some((c) => c.i === h.chosen) ? '' : `<p class="trace-note">The chosen candidate (#${h.chosen + 1}) was a less likely draw, outside the top eight.</p>`}`;
      }
      if (h.result) body += `<figure class="plate mini"><div class="stage"><canvas id="miniPlanet" aria-label="Rotating render of ${esc(p.name)}"></canvas></div><figcaption><span class="capline"><b>${esc(p.name)}</b><span>${esc(p.typeInfo.label)}</span></span><span class="captext">The finished planet, drawn by the same renderer as the guide. <a href="index.html${ST.hashOf(state, false)}">Open its guide pages</a>.</span></figcaption></figure>`;
      if (h.key) body += h.key;
      if (h.rel) body += relations(h.rel);
      return `<section class="gp step" id="st-${st.id}" data-id="${st.id}" style="--tab:var(${st.ink})"><h2>${esc(h.title)}</h2>${body}</section>`;
    }).join('');
    const refList = [...cited].sort((a, b) => EXO.REFS[a].cite.localeCompare(EXO.REFS[b].cite));
    $('stages').innerHTML = html + `<section class="gp refs" id="st-sources" style="--tab:var(--t-sources)"><h2>Papers cited on this page</h2><ol>${refList.map((k) => { const r = EXO.REFS[k]; return `<li id="ref-${k}">${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.cite)}</a>` : esc(r.cite)} <span>— ${esc(r.note)}</span></li>`; }).join('')}</ol><p class="fine">The full list, and every planet-specific note, is on each planet's Sources page.</p></section>`;

    // shrink astronomical symbols, text nodes only
    const st = $('stages');
    st.innerHTML = st.innerHTML.replace(/>([^<]*)(?=<)/g, (m, t) => '>' + t.replace(/([⊕☉♃])/g, '<span class="sym">$1</span>'));

    // the finished planet
    try {
      const cv = $('miniPlanet');
      if (cv) { if (view) view.stop(); view = new EXO.PlanetView(cv); view.setPlanet(p.vis); }
    } catch (e) { const c = $('miniPlanet'); if (c) c.parentNode.innerHTML = '<p class="glfail">WebGL is unavailable, so the planet can’t be drawn here.</p>'; }
    spy();
  }

  // chart follows the section being read
  let raf = 0;
  function spy() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar')) || 0) + 140;
      let cur = 'seed';
      document.querySelectorAll('.step').forEach((el) => { if (el.getBoundingClientRect().top <= line) cur = el.dataset.id; });
      document.querySelectorAll('#chart .node').forEach((li) => {
        const on = li.dataset.id === cur;
        li.querySelector('a').setAttribute('aria-current', on ? 'step' : 'false');
        if (on && window.innerWidth > 900) {
          const pane = document.querySelector('.chartpage'), r = li.getBoundingClientRect(), pr = pane.getBoundingClientRect();
          if (r.top < pr.top + 20 || r.bottom > pr.bottom - 20) pane.scrollTop += r.top - pr.top - pr.height / 3;
        }
      });
    });
  }
  window.addEventListener('scroll', spy, { passive: true });

  const bar = document.querySelector('.topbar');
  const syncBar = () => document.documentElement.style.setProperty('--bar', (getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight : 0) + 'px');
  try { new ResizeObserver(syncBar).observe(bar); } catch (e) { /* default stays */ }
  syncBar();

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 1800);
  }
  function go(seed, mode) {
    const s = ST.readHash(location.hash);
    s.seed = seed; s.mode = mode || s.mode; s.over = { star: {}, init: {} };
    history.pushState(null, '', ST.hashOf(s, false));
    render(); window.scrollTo({ top: 0 });
  }
  $('traceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('seedInput').value.trim().toUpperCase();
    if (!v) { toast('Type a seed to trace, or press Random seed.'); return; }
    go(v);
  });
  $('randomSeed').addEventListener('click', () => go(EXO.randomSeed()));
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode !== state.mode) go(state.seed, b.dataset.mode); }));
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);

  render();
})();
