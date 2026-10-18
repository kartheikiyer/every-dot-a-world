/* =====================================================================
 * Every Dot a World — physical model
 *
 * Pipeline:  star  ->  orbit  ->  bulk structure (incl. XUV envelope loss)
 *            -> habitable zone  ->  atmosphere retention (cosmic shoreline)
 *            -> tidal spin state  ->  climate state & temperatures
 *            -> magnetic field  ->  habitability  ->  analogues  ->  visuals
 *
 * Units: masses M⊕, radii R⊕ (planets) / R☉ (stars), distances au,
 *        periods days, temperatures K, instellation S⊕, ages Gyr.
 * Every quantity is derived from a handful of randomly drawn "initial
 * conditions"; reasoning is recorded in planet.notes[section].
 * ===================================================================== */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});

  const C = {
    G: 6.674e-8, Msun: 1.989e33, Lsun: 3.828e33, Rsun: 6.957e10,
    Me: 5.972e27, Re: 6.371e8, AU: 1.496e13, MJ: 317.83, RJ: 11.209,
    Gyr: 3.156e16, day: 86400, kB: 1.380649e-16, mH: 1.6735e-24, Tsun: 5772
  };
  EXO.C = C;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const log10 = Math.log10;
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  EXO.util = { clamp, lerp, sigmoid };

  // Solar reference XUV history (used to normalise fluences to Earth's).
  const SUN_FSAT = 5e-4, SUN_TSAT = 0.1, SUN_AGE = 4.57;
  const EARTH_XUV_EFRAC = SUN_FSAT * (SUN_TSAT + 2 * SUN_TSAT * (1 - Math.sqrt(SUN_TSAT / SUN_AGE)));
  const EARTH_XUV_FLUENCE = C.Lsun * EARTH_XUV_EFRAC * C.Gyr / (4 * Math.PI * C.AU * C.AU);
  const EPS_ESCAPE = 0.06; // energy-limited escape efficiency (calibrated to put the radius valley near 10–20 d)

  // ================================================================ STAR
  const SPECTRAL = [
    [2380, 'M9'], [2570, 'M8'], [2680, 'M7'], [2810, 'M6'], [3060, 'M5'], [3210, 'M4'], [3430, 'M3'], [3560, 'M2'], [3660, 'M1'], [3850, 'M0'],
    [4050, 'K7'], [4210, 'K6'], [4440, 'K5'], [4600, 'K4'], [4830, 'K3'], [5030, 'K2'], [5170, 'K1'], [5270, 'K0'],
    [5390, 'G9'], [5500, 'G8'], [5640, 'G6'], [5720, 'G4'], [5770, 'G2'], [5880, 'G1'], [5930, 'G0'],
    [6060, 'F9'], [6170, 'F8'], [6340, 'F6'], [6510, 'F5'], [6640, 'F4'], [6810, 'F2'], [7020, 'F1'], [7220, 'F0'],
    [7400, 'A9'], [7650, 'A7'], [8000, 'A5'], [8450, 'A3'], [8840, 'A2'], [9300, 'A1'], [9700, 'A0'], [10400, 'B9']
  ];
  function spectralType(T) {
    let best = SPECTRAL[0];
    for (const s of SPECTRAL) if (Math.abs(s[0] - T) < Math.abs(best[0] - T)) best = s;
    return best[1] + 'V';
  }
  const STAR_CLASS_NAMES = { M: 'red dwarf', K: 'orange dwarf', G: 'yellow dwarf', F: 'yellow-white dwarf', A: 'white main-sequence star', WD: 'white dwarf' };

  function powerLawSample(rng, a, b, alpha) {
    const k = 1 - alpha, u = rng.random();
    return Math.pow((Math.pow(b, k) - Math.pow(a, k)) * u + Math.pow(a, k), 1 / k);
  }
  function lumMS(m) {
    const low = 0.17 * Math.pow(m, 2.15), mid = Math.pow(m, 4), hi = 1.4 * Math.pow(m, 3.5);
    if (m < 0.4) return low;
    if (m < 0.5) return Math.exp(lerp(Math.log(low), Math.log(mid), (m - 0.4) / 0.1));
    if (m < 2) return mid;
    return hi;
  }
  function radiusMS(m, ageFrac) {
    const rl = 0.0324 + 0.9 * m;
    const rh = Math.pow(m, 0.88) * (0.88 + 0.26 * ageFrac);
    if (m < 0.55) return rl;
    if (m > 0.7) return rh;
    return lerp(rl, rh, (m - 0.55) / 0.15);
  }

  function makeStar(rng, mode) {
    const w = mode === 'realistic'
      ? { M: 0.72, K: 0.13, G: 0.07, F: 0.03, A: 0.007, WD: 0.043 }
      : { M: 0.36, K: 0.22, G: 0.18, F: 0.11, A: 0.06, WD: 0.07 };
    const cls = rng.weighted(w);
    const s = { cls };
    if (cls === 'WD') {
      s.isWD = true;
      s.mass = clamp(rng.normal(0.62, 0.07), 0.5, 0.9);
      s.radius = 0.0127 * Math.pow(0.6 / s.mass, 1 / 3);
      s.coolingAge = rng.logUniform(0.2, 9);
      s.teff = clamp(17000 * Math.pow(s.coolingAge / 0.2, -0.38), 3800, 17000);
      s.age = s.coolingAge + rng.uniform(0.3, 2.5);
      s.lum = s.radius * s.radius * Math.pow(s.teff / C.Tsun, 4);
      s.tMS = s.age; // already past the main sequence
    } else {
      const ranges = { M: [0.08, 0.57, 1.3], K: [0.57, 0.88, 2.3], G: [0.88, 1.06, 2.3], F: [1.06, 1.6, 2.3], A: [1.6, 2.3, 2.3] };
      const [lo, hi, al] = ranges[cls];
      s.mass = powerLawSample(rng, lo, hi, al);
      s.tMS = 10 * Math.pow(s.mass, -2.5);
      s.age = rng.uniform(0.1, Math.min(11.5, 0.92 * s.tMS));
    }
    s.feh = clamp(rng.normal(-0.05, 0.22), -0.9, 0.5);
    return finishStar(s);
  }

  // Fill in luminosity, radius, Teff, activity history for a star given mass/age.
  function finishStar(s) {
    if (!s.isWD) {
      const m = s.mass;
      if (!s.tMS) s.tMS = 10 * Math.pow(m, -2.5);
      const af = clamp(s.age / s.tMS, 0, 1);
      let L = lumMS(m);
      if (m > 0.6) L *= 0.72 + 0.62 * af; // main-sequence brightening (faint young Sun)
      s.lum = s.lum || L;
      s.radius = s.radius || radiusMS(m, af);
      s.teff = s.teff || C.Tsun * Math.pow(s.lum / (s.radius * s.radius), 0.25);
      s.spt = spectralType(s.teff);
      s.cls = s.cls || s.spt[0];
      // XUV: saturated at L_XUV/L_bol = f_sat until t_sat, then decays ∝ t^-1.5
      s.tSat = clamp(0.1 * Math.pow(m, -2), 0.05, 3.0);
      s.fSat = m < 0.6 ? 1e-3 : m < 0.9 ? 7e-4 : m < 1.1 ? 5e-4 : m < 1.5 ? 2e-4 : 3e-5;
      const t = s.age, ts = s.tSat;
      s.xuvEfrac = s.fSat * (t <= ts ? t : ts + 2 * ts * (1 - Math.sqrt(ts / t)));
      s.xuvNow = s.fSat * (t <= ts ? 1 : Math.pow(t / ts, -1.5));
      s.activity = t < ts ? 'saturated — frequent strong flares' : t < 3 * ts ? 'moderately active' : 'quiet';
      s.remaining = Math.max(0, s.tMS - s.age);
      // pre-main-sequence over-luminosity matters for M dwarfs (water loss)
      s.pmsBoost = m < 0.45 ? 5 * (0.45 / m) : 1;
    } else {
      s.spt = 'DA' + (50400 / s.teff).toFixed(1);
      s.cls = 'WD';
      s.tSat = 0; s.fSat = 0;
      s.xuvEfrac = 2e-5; s.xuvNow = 1e-7;
      s.activity = 'no flares (degenerate star)';
      s.remaining = Infinity;
      s.pmsBoost = 1;
    }
    s.className = STAR_CLASS_NAMES[s.cls] || 'star';
    return s;
  }

  // ================================================================ HABITABLE ZONE
  // Kopparapu et al. 2014: Seff = S0 + a T + b T² + c T³ + d T⁴, T = Teff − 5780
  const HZC = {
    recentVenus: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
    runaway1: [1.107, 1.332e-4, 1.580e-8, -8.308e-12, -1.931e-15],
    runaway5: [1.188, 1.433e-4, 1.707e-8, -8.968e-12, -2.084e-15],
    runaway01: [0.99, 1.209e-4, 1.404e-8, -7.418e-12, -1.713e-15],
    maxGreenhouse: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
    earlyMars: [0.320, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16]
  };
  function seff(c, teff) {
    const T = clamp(teff, 2600, 7200) - 5780;
    return c[0] + c[1] * T + c[2] * T * T + c[3] * T * T * T + c[4] * T * T * T * T;
  }
  function hzFluxes(teff, massE) {
    const lm = log10(clamp(massE, 0.1, 5));
    const r01 = seff(HZC.runaway01, teff), r1 = seff(HZC.runaway1, teff), r5 = seff(HZC.runaway5, teff);
    const runaway = lm < 0 ? lerp(r01, r1, (lm + 1)) : lerp(r1, r5, lm / log10(5));
    return {
      recentVenus: seff(HZC.recentVenus, teff),
      runaway,
      maxGreenhouse: seff(HZC.maxGreenhouse, teff),
      earlyMars: seff(HZC.earlyMars, teff)
    };
  }
  EXO.hzFluxes = hzFluxes;

  // ================================================================ STRUCTURE
  // Zeng et al. 2016 rocky relation, inflated by water (∼25% larger at 50% water)
  function rCore(M, cmf, wmf) {
    return (1.07 - 0.21 * cmf) * Math.pow(M, 1 / 3.7) * (1 + 0.5 * Math.min(wmf, 0.6));
  }
  // Lopez & Fortney 2014 envelope thickness (solar-metallicity fit)
  function rEnv(Mtot, f, S, age) {
    return 2.06 * Math.pow(Mtot, -0.21) * Math.pow(Math.max(f, 1e-5) / 0.05, 0.59) *
      Math.pow(Math.max(S, 1e-3), 0.044) * Math.pow(Math.max(age, 0.02) / 5, -0.11);
  }
  // Giant-planet radius (RJ): mass–radius curve (Fortney+07-like), youth, irradiation inflation (TF18)
  function rGiant(Mj, Teq, age) {
    let R;
    if (Mj < 0.3) R = 0.62 + 0.74 * Mj;
    else if (Mj < 1) R = 0.84 + 0.16 * Math.log(Mj / 0.3) / Math.log(1 / 0.3);
    else if (Mj < 4) R = 1.0 + 0.04 * Math.log(Mj) / Math.log(4);
    else R = 1.04 - 0.07 * Math.log(Mj / 4) / Math.log(13 / 4);
    R *= 1 + 0.12 * Math.max(0, -log10(Math.max(age, 0.01)));
    if (Teq > 1000) R += Math.min(0.9, 0.7 * Math.pow((Teq - 1000) / 1000, 1.2) * Math.pow(Mj, -0.2));
    return R;
  }

  // ================================================================ PLANET INITIAL CONDITIONS
  function sampleInit(rng, star, mode) {
    const m = star.mass, init = {};
    let wSmall = 2.5, wNep = 0.3, wGiant = 0.15 * Math.pow(10, 1.8 * star.feh) * Math.pow(clamp(m, 0.3, 2.3), 1.0);
    if (star.isWD) { wGiant = 0.15; wSmall = 1.2; }
    if (!star.isWD && m < 0.35) { wGiant *= 0.25; wNep *= 0.5; }
    if (mode !== 'realistic') { wGiant *= 2.5; wNep *= 1.8; }
    init.kind = rng.weighted({ small: wSmall, neptune: wNep, giant: wGiant });

    if (init.kind === 'small') {
      // dN/dlogP ∝ P^1.5 inside P0, flat beyond, gently declining past 500 d (How12)
      const P0 = m < 0.5 ? 6 : 10;
      let Pd = 10;
      for (let i = 0; i < 300; i++) {
        Pd = Math.exp(rng.uniform(Math.log(0.25), Math.log(3000)));
        let w = Math.min(1, Math.pow(Pd / P0, 1.5));
        if (Pd > 500) w *= Math.pow(Pd / 500, -0.5);
        if (rng.random() < w) break;
      }
      init.P = Pd;
      init.coreMass = clamp(rng.logNormal10(log10(4.5) + 0.5 * log10(Math.max(m, 0.1)), 0.32), 0.03, 25);
      init.cmf = rng.chance(0.06) ? rng.uniform(0.55, 0.75) : clamp(rng.normal(0.32, 0.07), 0.12, 0.5);
      const pWet = (m < 0.5 ? 0.45 : 0.25) * (Pd > 100 ? 1.3 : 1);
      init.wmf = rng.chance(pWet) ? rng.uniform(0.08, 0.5) : rng.logUniform(1e-5, 3e-3);
      let pGas = sigmoid((log10(init.coreMass) + 0.05) / 0.12);
      if (!star.isWD && m < 0.35) pGas *= 0.35; // G26: few sub-Neptunes around mid–late M dwarfs
      init.fEnv0 = rng.chance(pGas)
        ? clamp(rng.logNormal10(log10(0.025 * Math.pow(init.coreMass / 5, 0.5)), 0.35), 0.002, 0.2)
        : 0;
      init.e = Math.min(0.6, rng.rayleigh(0.05));
      init.prot0 = rng.logUniform(8, 48);
    } else if (init.kind === 'neptune') {
      init.superPuff = rng.chance(0.06);
      init.mass = init.superPuff ? rng.uniform(2, 9) : rng.logUniform(10, 50);
      init.fEnv0 = init.superPuff ? rng.uniform(0.25, 0.5) : rng.uniform(0.08, 0.2);
      init.wmf = init.superPuff ? 0.05 : 0.45;
      init.cmf = 0.3;
      for (let i = 0; i < 200; i++) {
        init.a = rng.logUniform(0.03, 40) * Math.pow(Math.max(m, 0.2), 0.5);
        const S = star.lum / (init.a * init.a);
        if (S < 300 || rng.random() < 0.12) break; // hot-Neptune desert
      }
      init.e = Math.min(0.7, rng.rayleigh(0.1));
      init.prot0 = rng.uniform(14, 20);
    } else {
      const Mj = powerLawSample(rng, 0.1, 13, 1.3);
      init.mass = Mj * C.MJ;
      if (rng.chance((m > 0.5 || star.isWD ? 0.06 : 0.025) * (mode === 'realistic' ? 1 : 2.5))) {
        init.P = clamp(rng.logNormal10(log10(3.5), 0.15), 0.8, 10);
      } else {
        const aB = 2.5 * Math.pow(Math.max(m, 0.3), 0.7);
        for (let i = 0; i < 300; i++) {
          init.a = rng.logUniform(0.08, 100);
          const x = init.a / aB;
          const wgt = x < 1 ? Math.pow(x, 1.0) : Math.pow(x, -1.0);
          if (rng.random() < wgt) break;
        }
      }
      init.e = Math.min(0.93, rng.beta(0.867, 3.03));
      init.prot0 = rng.uniform(9, 16);
      init.cmf = 0.3; init.wmf = 0.3;
    }
    // tidal circularisation of short-period orbits
    const Ptest = init.P || 365.25 * Math.sqrt(Math.pow(init.a, 3) / m);
    if (Ptest < 5) init.e *= 0.03;
    init.obliquity = rng.chance(0.08) ? rng.uniform(60, 150) : Math.min(90, Math.abs(rng.normal(0, 22)));
    // ring system (needs an icy reservoir; mostly cold giants)
    init.ringRoll = rng.random();
    init.visSeed = [rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)];
    init.paletteRoll = rng.random();
    init.spotRoll = rng.random();
    return init;
  }

  // ================================================================ DERIVATION
  const ALBEDO = {
    lava: 0.1, 'hot-rock': 0.1, airless: 0.12, venus: 0.75, 'venus-hot': 0.25, steam: 0.45,
    temperate: 0.3, ocean: 0.32, desert: 0.25, snowball: 0.55, 'ice-world': 0.55, titan: 0.25,
    hycean: 0.3, 'sub-neptune': 0.3, 'super-puff': 0.25, 'ice-giant': 0.3, 'warm-neptune': 0.25,
    'hot-neptune': 0.1, chthonian: 0.1, 'giant-ammonia': 0.34, 'giant-water': 0.75, 'giant-clear': 0.12,
    'giant-alkali': 0.05, 'giant-silicate': 0.15, 'giant-ultrahot': 0.1
  };
  const REDDENED = ['snowball', 'ice-world', 'temperate', 'ocean', 'giant-water', 'hycean'];

  EXO.TYPE_INFO = {
    lava: { label: 'Lava world', group: 'rocky', blurb: 'A rocky world hot enough that its dayside surface is molten rock.' },
    'hot-rock': { label: 'Scorched rock', group: 'rocky', blurb: 'A hot, airless rocky surface baked by its star.' },
    airless: { label: 'Airless rocky world', group: 'rocky', blurb: 'A bare, cratered rocky body that cannot hold an atmosphere.' },
    venus: { label: 'Venus-like greenhouse world', group: 'rocky', blurb: 'A rocky planet smothered by a thick CO₂ atmosphere after a runaway greenhouse.' },
    'venus-hot': { label: 'Hot CO₂ world', group: 'rocky', blurb: 'A runaway-greenhouse world too hot for sulfuric-acid clouds.' },
    steam: { label: 'Steam world', group: 'water', blurb: 'A water-rich planet whose oceans exist as a supercritical steam envelope.' },
    temperate: { label: 'Temperate terrestrial', group: 'rocky', blurb: 'A rocky world with oceans, continents and a climate that allows liquid surface water.' },
    ocean: { label: 'Ocean world', group: 'water', blurb: 'A planet covered entirely by a deep global ocean.' },
    desert: { label: 'Desert world', group: 'rocky', blurb: 'A rocky planet with an atmosphere but little surface water.' },
    snowball: { label: 'Snowball world', group: 'rocky', blurb: 'A rocky planet whose surface water is frozen into global ice sheets.' },
    'ice-world': { label: 'Icy water world', group: 'water', blurb: 'A water-rich world with an ice shell, possibly over a hidden ocean.' },
    titan: { label: 'Titan-like haze world', group: 'rocky', blurb: 'A frigid world under an orange nitrogen–methane haze.' },
    hycean: { label: 'Hycean candidate', group: 'subnep', blurb: 'A water world under a thin hydrogen atmosphere — habitable if the ocean is real.' },
    'sub-neptune': { label: 'Sub-Neptune', group: 'subnep', blurb: 'The galaxy’s most common planet type: a rocky/icy core inside a hydrogen-rich envelope.' },
    'super-puff': { label: 'Super-puff', group: 'subnep', blurb: 'A low-mass planet with an enormous, cotton-candy-density envelope.' },
    'ice-giant': { label: 'Ice giant', group: 'neptune', blurb: 'A Neptune-like world of water, ammonia and methane ices under hydrogen.' },
    'warm-neptune': { label: 'Warm Neptune', group: 'neptune', blurb: 'A Neptune-mass planet warmed by its star.' },
    'hot-neptune': { label: 'Hot Neptune', group: 'neptune', blurb: 'A rare Neptune surviving inside the “hot Neptune desert”.' },
    chthonian: { label: 'Exposed giant-planet core', group: 'neptune', blurb: 'The dense remnant of a giant whose envelope was largely stripped away.' },
    'giant-ammonia': { label: 'Cold gas giant (ammonia clouds)', group: 'giant', blurb: 'A Jupiter-like giant with banded ammonia clouds — Sudarsky class I.' },
    'giant-water': { label: 'Water-cloud giant', group: 'giant', blurb: 'A temperate giant capped by bright water clouds — Sudarsky class II.' },
    'giant-clear': { label: 'Cloudless blue giant', group: 'giant', blurb: 'Too warm for water clouds, too cool for silicates: a deep blue Rayleigh-scattering giant — Sudarsky class III.' },
    'giant-alkali': { label: 'Hot Jupiter (alkali)', group: 'giant', blurb: 'A dark hot Jupiter whose sodium and potassium absorb visible light — Sudarsky class IV.' },
    'giant-silicate': { label: 'Silicate-cloud hot Jupiter', group: 'giant', blurb: 'A scorching giant with clouds of rock and iron — Sudarsky class V.' },
    'giant-ultrahot': { label: 'Ultra-hot Jupiter', group: 'giant', blurb: 'A giant so hot that molecules dissociate and metals vaporise on its dayside.' }
  };

  function blackbodyRGB(T) {
    // Tanner Helland approximation, returns sRGB 0..1
    const t = clamp(T, 1000, 40000) / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
  }
  EXO.blackbodyRGB = blackbodyRGB;

  function teqOf(S, A) { return 278.6 * Math.pow(Math.max(S, 0) * (1 - A), 0.25); }

  function derive(star, init, seed) {
    const rng = new EXO.RNG(seed + '|derive');
    const p = { init, kind: init.kind, notes: {} };
    const note = (sec, text, refs) => (p.notes[sec] = p.notes[sec] || []).push({ text, refs: refs || [] });
    const age = star.age;

    // ------------------------------------------------ orbit
    const Mstar = star.mass;
    const mGuess = init.mass || init.coreMass || 1;
    let a, Pd;
    if (init.a) { a = init.a; Pd = 365.25 * Math.sqrt(a * a * a / (Mstar + mGuess / 332946)); }
    else { Pd = init.P; a = Math.cbrt((Mstar + mGuess / 332946) * Math.pow(Pd / 365.25, 2)); }
    const e = init.e;
    p.a = a; p.period = Pd; p.e = e;
    p.S = star.lum / (a * a) / Math.sqrt(1 - e * e);
    p.Speri = star.lum / Math.pow(a * (1 - e), 2);
    p.Sapo = star.lum / Math.pow(a * (1 + e), 2);
    p.vOrb = 29.78 * Math.sqrt(Mstar / a);
    const S = p.S;
    const aCm = a * C.AU;
    p.fluenceXUV = star.lum * C.Lsun * star.xuvEfrac * C.Gyr / (4 * Math.PI * aCm * aCm) / Math.sqrt(1 - e * e);
    p.fluenceRel = p.fluenceXUV / EARTH_XUV_FLUENCE;
    p.frostLine = 3.45 * Math.sqrt(star.lum);
    note('orbit', `Instellation S = L/a² = ${fmtNum(S)} S⊕ (time-averaged over the eccentric orbit${e > 0.05 ? `; ${fmtNum(p.Sapo)}–${fmtNum(p.Speri)} S⊕ between apastron and periastron` : ''}).`);
    if (init.kind === 'small') note('orbit', 'Small-planet periods are drawn from Kepler occurrence: dN/dlogP rises as P^1.5 out to ~6–10 days, then flattens.', ['How12']);
    if (init.kind === 'giant') note('orbit', Pd < 10 ? 'This giant belongs to the hot-Jupiter pile-up at ~3–5 days (only ~0.5–1% of Sun-like stars host one).' : 'Giant-planet orbits follow a broken power law peaking near the snow line (~2–3 au for a Sun-like star).', Pd < 10 ? ['W12'] : ['Fe19']);
    if (e > 0.3) note('orbit', `Eccentricity ${e.toFixed(2)} is drawn from the observed beta distribution; giants scattered by siblings often end up this eccentric.`, ['Ki13']);
    if (Pd < 5) note('orbit', 'Tides from the star have circularised this short orbit.');

    // ------------------------------------------------ bulk structure
    let M, R, regime, fEnv = 0, Mc = 0, Rc = 0, Pbase = 0;
    const cmf = init.cmf, wmf = init.wmf || 0;
    const Teq0 = teqOf(S, 0.3);
    if (init.kind === 'small') {
      Mc = init.coreMass;
      Rc = rCore(Mc, cmf, wmf);
      const f0 = init.fEnv0;
      if (f0 > 0) {
        const Mt0 = Mc / (1 - f0);
        const Ryoung = Rc + rEnv(Mt0, f0, S, 0.1);
        const Mloss = EPS_ESCAPE * Math.PI * Math.pow(Ryoung * C.Re, 3) * p.fluenceXUV / (C.G * Mt0 * C.Me);
        const Menv0 = f0 * Mt0 * C.Me;
        const Menv = Math.max(0, Menv0 - Mloss);
        fEnv = Menv / (Mc * C.Me + Menv);
        p.envLossFrac = Math.min(1, Mloss / Menv0);
        p.fEnv0 = f0;
      }
      M = Mc / (1 - fEnv);
      const gC = 981 * M / (Rc * Rc);
      Pbase = fEnv * M * C.Me * gC / (4 * Math.PI * Math.pow(Rc * C.Re, 2)) / 1e6; // bar
      if (fEnv <= 0) regime = 'solid';
      else if (Pbase < 2000) {
        if (wmf >= 0.05) regime = 'thinH2';
        else { regime = 'solid'; fEnv = 0; M = Mc; Pbase = 0; note('bulk', 'Only a wisp of the primordial hydrogen survives; on a dry world it escapes quickly, leaving a stripped core.', ['OW17']); }
      } else regime = 'envelope';

      if (init.fEnv0 > 0) {
        if (fEnv === 0) note('bulk', `It formed with a ${(init.fEnv0 * 100).toFixed(1)}% hydrogen/helium envelope, but XUV-driven (energy-limited) escape over ${fmtNum(age)} Gyr removed it. This photoevaporation is what carves the radius valley between super-Earths and sub-Neptunes.`, ['OW17', 'F17']);
        else note('bulk', `It kept ${(fEnv * 100).toFixed(fEnv < 0.01 ? 2 : 1)}% of its mass as hydrogen/helium (lost ${Math.round(p.envLossFrac * 100)}% of the initial envelope to XUV-driven escape).`, ['OW17', 'LF14']);
      } else note('bulk', 'Its core never grew massive enough to capture hydrogen from the protoplanetary disk.', ['F17']);
      if (!star.isWD && Mstar < 0.35) note('bulk', 'Around mid-to-late M dwarfs, TESS finds super-Earths outnumber sub-Neptunes about 5.5:1, so gas-rich outcomes are suppressed here.', ['G26']);

      if (regime === 'envelope') R = Rc + rEnv(M, fEnv, S, age);
      else R = Rc;
      note('bulk', `Core radius from the Zeng et al. rocky relation for an iron fraction of ${Math.round(cmf * 100)}%${wmf >= 0.05 ? ` plus ${Math.round(wmf * 100)}% water by mass` : ''}${regime === 'envelope' ? '; the envelope thickness follows Lopez & Fortney (depends on gas fraction, instellation and age)' : ''}.`, regime === 'envelope' ? ['Z16', 'LF14'] : ['Z16']);
    } else if (init.kind === 'neptune') {
      M = init.mass;
      let f0 = init.fEnv0;
      Mc = M * (1 - f0);
      Rc = rCore(Mc, 0.3, init.superPuff ? 0.05 : 0.45);
      const Rnow = init.superPuff ? Rc + rEnv(M, f0, S, age) : Math.sqrt(M) * (1 + 0.08 * Math.max(0, log10(S / 50)));
      const Ryoung = Rnow * 1.2;
      const Mloss = EPS_ESCAPE * Math.PI * Math.pow(Ryoung * C.Re, 3) * p.fluenceXUV / (C.G * M * C.Me);
      const Menv0 = f0 * M * C.Me;
      p.envLossFrac = Math.min(1, Mloss / Menv0);
      if (Mloss > 0.6 * Menv0) {
        fEnv = Math.max(0.01, (Menv0 - Mloss) / (M * C.Me));
        if (fEnv < f0 * 0.4) fEnv = Math.max(0.01, Math.min(fEnv, 0.04));
        regime = 'chthonian';
        R = rCore(Mc, 0.33, 0.2) + rEnv(M, fEnv, S, age);
        note('bulk', 'Intense irradiation stripped most of its gaseous envelope, exposing a dense core — like TOI-849 b.', ['OW17']);
      } else {
        fEnv = Math.max(0.01, f0 * (1 - p.envLossFrac));
        regime = init.superPuff ? 'superpuff' : 'envelope';
        R = init.superPuff ? Rc + rEnv(M, fEnv, S, age) : Rnow;
        note('bulk', init.superPuff
          ? `A ${fmtNum(M)} M⊕ core holding a ${Math.round(fEnv * 100)}% hydrogen envelope swells to ${fmtNum(R)} R⊕ — super-puffs like Kepler-51 b have densities below 0.1 g/cm³.`
          : 'Neptune-mass worlds follow the Chen & Kipping “Neptunian” mass–radius branch (R ∝ M^~0.5–0.6).', init.superPuff ? ['LF14'] : ['CK17']);
      }
    } else {
      M = init.mass;
      const Mj = M / C.MJ;
      R = rGiant(Mj, teqOf(S, 0.1), age) * C.RJ;
      regime = 'giant';
      fEnv = 1 - Math.min(0.5, 0.1 * Math.pow(Mj, -0.45));
      note('bulk', `Giant radius from the mass–radius relation for degenerate hydrogen (≈1 R♃ across 0.5–10 M♃)${teqOf(S, 0.1) > 1000 ? ', inflated by stellar irradiation as seen in hot Jupiters' : ''}${age < 0.5 ? ', and still puffed up from formation heat' : ''}.`, teqOf(S, 0.1) > 1000 ? ['F07', 'TF18'] : ['F07']);
      note('bulk', `Heavy-element fraction ≈ ${Math.round((1 - fEnv) * 100)}% — lower-mass giants are more metal-enriched.`, ['T16']);
    }
    // steam inflation for very wet, very hot solid worlds
    p.mass = M; p.radius = R; p.regime = regime; p.fEnv = fEnv; p.cmf = cmf; p.wmf = wmf; p.Pbase = Pbase;
    p.density = 5.51 * M / Math.pow(R, 3);
    p.gravity = M / (R * R);
    p.vesc = 11.19 * Math.sqrt(M / R);
    p.hillRadius = a * Math.cbrt(M / (3 * 332946 * Mstar)); // au

    // ------------------------------------------------ habitable zone
    const hzMass = regime === 'solid' ? M : 1;
    const hz = hzFluxes(star.teff, hzMass);
    p.hz = hz;
    p.hzDist = {
      recentVenus: Math.sqrt(star.lum / hz.recentVenus), runaway: Math.sqrt(star.lum / hz.runaway),
      maxGreenhouse: Math.sqrt(star.lum / hz.maxGreenhouse), earlyMars: Math.sqrt(star.lum / hz.earlyMars)
    };
    if (S > hz.recentVenus) p.hzZone = 'interior to the habitable zone';
    else if (S > hz.runaway) p.hzZone = 'optimistic habitable zone (inner)';
    else if (S >= hz.maxGreenhouse) p.hzZone = 'conservative habitable zone';
    else if (S >= hz.earlyMars) p.hzZone = 'optimistic habitable zone (outer)';
    else p.hzZone = 'beyond the habitable zone';
    note('orbit', `Habitable zone for a ${star.spt} star (Kopparapu et al.): conservative ${fmtNum(p.hzDist.runaway)}–${fmtNum(p.hzDist.maxGreenhouse)} au, optimistic ${fmtNum(p.hzDist.recentVenus)}–${fmtNum(p.hzDist.earlyMars)} au${regime === 'solid' ? `; the inner edge is adjusted for this planet's mass` : ''}. This planet is ${p.hzZone.startsWith('beyond') || p.hzZone.startsWith('interior') ? '' : 'in the '}${p.hzZone}.`, regime === 'solid' ? ['K13', 'K14'] : ['K13']);

    // ------------------------------------------------ atmosphere retention (solid worlds)
    const wet = wmf >= 0.05;
    let hasAtm = true, shoreMargin = Infinity, pAtm = 1;
    if (regime === 'solid') {
      const Ishore = 25 * Math.pow(p.vesc / 11.19, 4) * (wet ? 3 : 1);
      shoreMargin = Ishore / Math.max(p.fluenceRel, 1e-9);
      pAtm = 1 / (1 + Math.exp(-log10(shoreMargin) / 0.35));
      hasAtm = rng.random() < pAtm;
      p.shoreline = { margin: shoreMargin, pAtm, Ishore };
      note('atmosphere', `Cosmic shoreline: lifetime XUV fluence is ${fmtNum(p.fluenceRel)}× Earth's, versus a retention limit of ≈${fmtNum(Ishore)}× for its ${p.vesc.toFixed(1)} km/s escape velocity (I ∝ v_esc⁴). ${shoreMargin > 1 ? 'It sits on the atmosphere side' : 'It sits on the airless side'} — probability of keeping an atmosphere ≈ ${Math.round(pAtm * 100)}%. Outcome: ${hasAtm ? 'atmosphere retained' : 'atmosphere lost'}.`, ['ZC17', 'S3D']);
      if (!star.isWD && Mstar < 0.6) note('atmosphere', `M dwarfs stay XUV-saturated for ~${fmtNum(star.tSat)} Gyr. JWST has so far found M-dwarf rocky planets like TRAPPIST-1 b/c and GJ 3929 b to be bare rocks.`, ['P25', 'X25']);
      if (wet) note('atmosphere', 'A large water inventory keeps re-supplying vapour, making the atmosphere harder to strip completely.');
    }

    // ------------------------------------------------ tides and spin
    const isGiant = regime === 'giant';
    const envLike = regime === 'envelope' || regime === 'superpuff' || regime === 'chthonian';
    const Q = isGiant ? 1e5 : envLike ? 1e4 : 100;
    const k2 = isGiant ? 0.5 : 0.3;
    const alphaI = regime === 'solid' || regime === 'thinH2' ? 0.33 : 0.25;
    const w0 = 2 * Math.PI / (init.prot0 * 3600);
    const Ig = alphaI * M * C.Me * Math.pow(R * C.Re, 2);
    const tLock = w0 * Math.pow(aCm, 6) * Ig * Q / (3 * C.G * Math.pow(Mstar * C.Msun, 2) * k2 * Math.pow(R * C.Re, 5)) / C.Gyr;
    p.tLock = tLock;
    const n = 2 * Math.PI / (Pd * C.day);
    let locked = tLock < age, spinState, protDays;
    let asyncAtm = false;
    if (locked && regime === 'solid' && hasAtm && Mstar >= 0.5 && Mstar <= 0.8 && S < hz.runaway * 1.2 && S > hz.maxGreenhouse * 0.8 && rng.random() < 0.6) {
      locked = false; asyncAtm = true;
    }
    if (locked) {
      if (e < 0.1) { spinState = 'synchronous'; protDays = Pd; }
      else if (regime === 'solid' && e < 0.25) { spinState = '3:2 spin–orbit resonance'; protDays = Pd * 2 / 3; }
      else {
        const e2 = e * e;
        const ps = (1 + 7.5 * e2 + 5.625 * e2 * e2 + 0.3125 * e2 * e2 * e2) / ((1 + 3 * e2 + 0.375 * e2 * e2) * Math.pow(1 - e2, 1.5));
        spinState = 'pseudo-synchronous'; protDays = Pd / ps;
      }
    } else {
      const fr = asyncAtm ? 0.5 : Math.max(0, 1 - age / tLock);
      const w = n + (w0 - n) * fr;
      protDays = 2 * Math.PI / w / C.day;
      spinState = asyncAtm ? 'asynchronous (atmospheric thermal tides)' : 'free rotation';
    }
    p.locked = locked; p.spinState = spinState; p.protDays = protDays;
    p.obliquity = locked ? Math.min(init.obliquity, 1) * 0.5 : init.obliquity;
    p.solarDay = (spinState === 'synchronous') ? Infinity : 1 / Math.abs(1 / protDays - 1 / Pd);
    p.vEq = 2 * Math.PI * R * C.Re / (protDays * C.day) / 1e5; // km/s
    note('spin', `Tidal despinning timescale (Gladman et al., Q=${Q.toExponential(0)}, k₂=${k2}) ≈ ${fmtTime(tLock)} versus a system age of ${fmtNum(age)} Gyr → ${locked ? 'tidally locked' : 'not locked'}.`, ['G96', 'Ba17']);
    if (locked && spinState !== 'synchronous') note('spin', spinState.startsWith('3:2') ? 'With a moderately eccentric orbit, capture into a 3:2 resonance (like Mercury) is likely instead of 1:1.' : 'On a very eccentric orbit, tides drive the spin toward pseudo-synchronous rotation, matching the orbital speed near periastron.', spinState.startsWith('3:2') ? [] : ['Hut81']);
    if (asyncAtm) note('spin', 'Although tides should lock it, thermal tides in a thick atmosphere can hold habitable-zone planets of 0.5–0.8 M☉ stars in asynchronous rotation (as for Venus).', ['Le15']);

    // tidal heating (eccentricity tides)
    const Edot = 10.5 * (k2 / Q) * C.G * Math.pow(Mstar * C.Msun, 2) * Math.pow(R * C.Re, 5) * n * e * e / Math.pow(aCm, 6);
    p.tidalFlux = Edot / (4 * Math.PI * Math.pow(R * C.Re, 2)) * 1e-3; // W/m²
    if (regime === 'solid' || regime === 'thinH2') {
      p.radiogenicFlux = 0.09 * Math.pow(M, 0.25) * Math.exp(-(age - 4.5) / 4.5);
      if (p.tidalFlux > 1) note('interior', `Eccentricity tides deposit ${fmtNum(p.tidalFlux)} W/m² — comparable to or above Io's ~2.5 W/m², implying extreme volcanism.`, ['DB15']);
      else if (p.tidalFlux > 0.05) note('interior', `Tidal heating adds ${fmtNum(p.tidalFlux)} W/m² (Earth's interior heat flow is ~0.09 W/m²).`, ['DB15']);
    }

    // ------------------------------------------------ climate / atmosphere state
    let state, A, Tsurf = null, Tday, Tnight, Psurf = null, atm = null;
    const mDwarfLight = star.teff < 4000;
    let wSurf = wmf, cov = 0, lockedClimate = null;
    p.desiccated = false;

    if (regime === 'solid') {
      // water inventory and M-dwarf pre-main-sequence desiccation
      if (!wet && !star.isWD && star.pmsBoost > 1 && S < hz.recentVenus && S * star.pmsBoost > hz.recentVenus) {
        const lost = 2.3e-4 * 5 * (0.45 / Mstar - 1);
        if (lost > 0) {
          wSurf = Math.max(0, wmf - lost);
          p.desiccated = wSurf < wmf * 0.5;
          note('climate', `During its star's bright pre-main-sequence phase this orbit sat inside the runaway-greenhouse limit; up to ~${fmtNum(lost / 2.3e-4)} Earth oceans of water could have been lost to space.`, ['LB15']);
        }
      }
      if (wet) cov = 1;
      else if (wSurf < 3e-6) cov = 0;
      else cov = clamp(0.71 * Math.pow(wSurf / 2.3e-4, 0.35) * Math.pow(p.gravity, 0.15), 0, 1);
      if (!hasAtm) cov = 0;
      p.waterMassFrac = wSurf;

      if (!hasAtm) {
        A = wet && Teq0 < 230 ? 0.55 : (cmf > 0.5 ? 0.08 : 0.12);
        const T0 = 394.1 * Math.pow(S * (1 - A), 0.25);
        const T0peri = 394.1 * Math.pow(p.Speri * (1 - A), 0.25);
        Tday = locked && spinState === 'synchronous' ? T0 * Math.pow(2 / 3, 0.25) : T0 / Math.SQRT2 * 1.1;
        Tnight = locked && spinState === 'synchronous' ? Math.max(40, 30 + 200 * Math.pow(p.tidalFlux + (p.radiogenicFlux || 0), 0.25) * 0.3) : Math.max(40, 0.35 * teqOf(S, A));
        p.Tsubstellar = T0peri;
        if (T0peri > 1400) state = 'lava';
        else if (wet && teqOf(S, A) < 230) state = 'ice-world';
        else if (T0 > 500) state = 'hot-rock';
        else state = 'airless';
        Tsurf = locked && spinState === 'synchronous' ? null : teqOf(S, A);
        note('climate', `Without an atmosphere there is no heat redistribution: substellar temperature ≈ ${Math.round(T0peri)} K${locked ? `, dayside mean ≈ ${Math.round(Tday)} K, nightside ≈ ${Math.round(Tnight)} K` : ''}.`, ['CA11']);
        if (state === 'lava') note('climate', 'Above ~1400 K basaltic rock melts: the dayside hosts a magma ocean (like K2-141 b or 55 Cnc e).');
        if (state === 'ice-world') note('climate', 'Its water is frozen into an ice crust; internal heat could still sustain a subsurface ocean, as on Europa.');
        atm = { type: 'none', vmr: {}, P: 0 };
      } else {
        const retention = Math.min(1, Math.pow(shoreMargin / 25, 2));
        let Pinv = rng.logNormal10(0, 0.45) * Math.pow(M, 0.7) * (wet ? 2 : 1);
        let Srun = hz.runaway;
        if (locked && cov > 0.3) Srun *= 1.3;
        if (!wet && cov < 0.12) Srun *= 1.6;
        const Smax = hz.maxGreenhouse;
        const PN2 = Math.max(1e-4, Pinv * retention);
        if (S >= Srun) {
          if (wet) {
            state = 'steam'; A = 0.45;
            Psurf = Math.min(1e6, wmf * M * C.Me * 981 * p.gravity / (4 * Math.PI * Math.pow(R * C.Re, 2)) / 1e6);
            Tsurf = Math.max(650, teqOf(S, A) * Math.pow(1 + 0.75 * 1000, 0.25));
            R *= 1 + 0.12 * Math.min(1, wmf / 0.3); p.radius = R;
            note('climate', 'Beyond the runaway-greenhouse limit its oceans have boiled into a supercritical steam envelope, inflating the radius.', ['T20', 'K13']);
            atm = { type: 'steam', vmr: { H2O: 0.9, CO2: 0.08, N2: 0.02 } };
          } else {
            // heavy CO₂ resists escape; only planets close to the shoreline lose much of it
            Psurf = clamp(rng.logNormal10(log10(70), 0.3) * Math.pow(M, 0.7) * (shoreMargin >= 3 ? 1 : Math.sqrt(retention)), 0.5, 2000);
            const hot = Teq0 > 600;
            state = hot ? 'venus-hot' : 'venus'; A = hot ? 0.25 : 0.75;
            const tau = Math.min(3000, 0.13 + 1.5 * Math.pow(Psurf, 1.05));
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * tau, 0.25);
            note('climate', `Above the runaway-greenhouse limit (${fmtNum(Srun)} S⊕) surface water cannot condense, carbonate weathering stops and outgassed CO₂ accumulates: ~${fmtNum(Psurf)} bar, surface ≈ ${Math.round(Tsurf)} K (grey-atmosphere greenhouse).`, ['K13']);
            atm = { type: 'co2', vmr: { CO2: 0.96, N2: 0.035, SO2: hot ? 1e-5 : 1.5e-4, H2O: 3e-5, CO: 2e-5 }, cloudTopP: hot ? null : 0.05 };
            if (Tsurf > 1500) { state = 'lava'; note('climate', 'The surface under this greenhouse is hot enough to stay molten: a magma ocean beneath a thick volatile atmosphere (cf. 55 Cnc e, TOI-561 b).'); atm = { type: 'lava-atm', vmr: { CO: 0.45, CO2: 0.35, N2: 0.15, SiO: 1e-4, Na: 1e-5, H2O: 0.05 } }; }
          }
        } else if (S >= Smax) {
          const Ptot0 = PN2;
          if (Ptot0 < 0.006) {
            state = 'desert'; A = 0.25; Psurf = Ptot0;
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * (0.05 + 0.25 * Math.pow(Psurf, 0.8)), 0.25);
            note('climate', `The surviving atmosphere (~${fmtNum(Psurf * 1000)} mbar) is below water's triple-point pressure, so liquid water cannot persist at the surface — like Mars.`);
            atm = { type: 'thin-co2', vmr: { CO2: 0.95, N2: 0.03, Ar: 0.02, H2O: 2e-4 } };
          } else if (cov >= 0.97 && wet) {
            const tau = rng.logUniform(0.3, 4);
            A = 0.32; Psurf = Ptot0 + 0.1 * tau;
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * tau, 0.25);
            if (Tsurf < 265) {
              state = 'ice-world'; A = 0.55; Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * tau, 0.25);
              note('climate', 'With no exposed land, silicate weathering cannot regulate CO₂, and this water world has slid into a frozen state.', ['KF18']);
            } else {
              state = 'ocean';
              note('climate', `A global ocean with no exposed continents lacks the carbonate–silicate thermostat, so its climate (≈${Math.round(Tsurf)} K) is set by its inherited greenhouse inventory rather than regulated.`, ['KF18']);
            }
            atm = { type: 'temperate', vmr: { N2: 0.75, CO2: Math.min(0.2, 0.01 * tau), H2O: 1e-3, Ar: 0.01 } };
          } else if (cov >= 0.12) {
            state = 'temperate'; A = mDwarfLight ? 0.25 : 0.3;
            const x = clamp(Math.log(Srun / S) / Math.log(Srun / Smax), 0, 1);
            Tsurf = 273 + 67 * Math.pow(1 - x, 14) + rng.normal(0, 3);
            const pCO2 = clamp(Math.pow(10, -3.4 + 4.3 * (x - 0.09) / 0.91), 1e-5, 10);
            Psurf = Ptot0 + pCO2;
            p.pCO2 = pCO2;
            note('climate', `Inside the habitable zone with ${Math.round(cov * 100)}% ocean cover, the carbonate–silicate cycle regulates CO₂ (≈${fmtNum(pCO2 * 1000)} mbar here, rising toward the outer edge), holding the mean surface near ${Math.round(Tsurf)} K.`, ['WHK81', 'K13']);
            atm = { type: 'temperate', vmr: { N2: Math.max(0.05, 1 - pCO2 / Psurf - 0.02), CO2: pCO2 / Psurf, H2O: 1e-5, Ar: 0.01 } };
            if (locked) {
              lockedClimate = Tsurf < 285 ? 'eyeball' : 'lobster';
              note('climate', lockedClimate === 'eyeball' ? 'Tidally locked and cool: an “eyeball” state with open ocean around the substellar point and ice elsewhere.' : 'Tidally locked but warm: ocean currents spread heat into a “lobster” pattern of open water along the equator.', ['HY14', 'Y13']);
            }
          } else {
            state = 'desert'; A = 0.25; Psurf = Ptot0;
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * (0.05 + 0.25 * Math.pow(Psurf, 0.8)), 0.25);
            note('climate', `Little surface water (${p.desiccated ? 'lost early on' : 'a dry formation'}): a “land planet”. Dry worlds resist both runaway greenhouse and global glaciation, widening their habitable range.`, ['Ab11']);
            atm = { type: 'desert', vmr: { N2: 0.7, CO2: 0.28, Ar: 0.02, H2O: 1e-5 } };
          }
        } else {
          Psurf = PN2;
          const TeqCold = teqOf(S, 0.3);
          if (TeqCold < 60) {
            // N₂ and CO₂ freeze out: atmospheric collapse (Pluto/Triton-like)
            state = wet ? 'ice-world' : 'airless'; A = wet ? 0.6 : 0.5;
            Tsurf = teqOf(S, A); Psurf = 1e-5;
            note('climate', `At ≈${Math.round(Tsurf)} K nitrogen and CO₂ freeze onto the surface; only a tenuous, seasonal atmosphere remains (like Pluto or Triton).`);
            atm = { type: 'none', vmr: {}, P: 0 };
            hasAtm = false;
          } else if (TeqCold < 120 && Psurf > 0.05 && rng.random() < 0.6) {
            state = 'titan'; A = 0.25;
            Tsurf = teqOf(S, A) * 1.1;
            note('climate', `So cold (${Math.round(Tsurf)} K) that methane, not water, is the active liquid: a Titan-like world with an orange photochemical haze.`);
            atm = { type: 'titan', vmr: { N2: 0.95, CH4: 0.049, H2: 1e-3, HCN: 1e-6 }, haze: 1 };
          } else if (cov > 0.02 || wet) {
            state = wet ? 'ice-world' : 'snowball'; A = mDwarfLight ? 0.45 : 0.55;
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * (0.2 + 0.5 * Math.pow(Psurf, 0.6)), 0.25);
            note('climate', `Beyond the outer edge of the habitable zone even maximal CO₂ greenhouse warming fails; surface water freezes into global ice (${Math.round(Tsurf)} K).`, ['K13']);
            atm = { type: 'cold', vmr: { N2: 0.9, CO2: 0.1, H2O: 1e-7 } };
          } else {
            state = 'desert'; A = 0.25;
            Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * (0.05 + 0.25 * Math.pow(Psurf, 0.8)), 0.25);
            note('climate', 'A cold, dry world with a thin atmosphere — an exo-Mars.');
            atm = { type: 'thin-co2', vmr: { CO2: 0.9, N2: 0.08, Ar: 0.02 } };
          }
        }
        if (state === 'ocean' || state === 'temperate') p.surfaceLiquid = true;
        atm.P = Psurf;
        if (mDwarfLight && REDDENED.includes(state)) note('climate', 'Red/infrared M-dwarf light is reflected less by ice and Rayleigh scattering, so the planet absorbs more of it (lower albedo).');
      }
    } else if (regime === 'thinH2') {
      const PH2 = clamp(Pbase, 1, 2000);
      const tau = Math.min(1e4, 0.15 * Math.pow(PH2, 1.5));
      A = 0.3;
      Tsurf = teqOf(S, A) * Math.pow(1 + 0.75 * tau, 0.25);
      Psurf = PH2;
      if (Tsurf >= 273 && Tsurf <= 420) {
        state = 'hycean'; p.surfaceLiquid = true;
        note('climate', `A water-rich world (${Math.round(wmf * 100)}% water) left with only a thin hydrogen layer (~${fmtNum(PH2)} bar). Collision-induced H₂ warming keeps its ocean surface at ≈${Math.round(Tsurf)} K: a hycean candidate.`, ['M21', 'PG11']);
        note('climate', 'Caveat: hycean worlds are contested. For K2-18 b the same JWST data are also fit by a thick water-rich envelope or a magma ocean; claims of DMS have not held up in independent reanalyses.', ['S25', 'H25', 'Sh24']);
      } else if (Tsurf < 273) {
        state = 'ice-world';
        note('climate', `Even with ~${fmtNum(PH2)} bar of hydrogen greenhouse the surface stays frozen (${Math.round(Tsurf)} K): an ice-covered water world under an H₂ sky.`, ['PG11']);
      } else {
        state = 'steam';
        note('climate', `Hydrogen greenhouse warming pushes the water layer to ≈${Math.round(Tsurf)} K — supercritical, not a liquid ocean.`, ['PG11']);
      }
      atm = { type: 'h2-thin', vmr: { H2: 0.9, He: 0.08, CH4: 0.01, CO2: 3e-3, H2O: state === 'steam' ? 0.05 : 1e-5, NH3: 1e-7 }, P: PH2 };
    } else {
      // envelope / giant worlds
      const Mj = M / C.MJ;
      let Tint;
      if (isGiant) {
        Tint = Math.max(30, 100 * Math.pow(Mj, 0.5) * Math.pow(Math.max(age, 0.01) / 4.5, -0.32));
        const Teq1 = teqOf(S, 0.1);
        if (Teq1 > 1000) Tint = Math.max(Tint, Math.min(700, 400 * Math.pow(Teq1 / 1500, 1.5)));
      } else Tint = regime === 'chthonian' ? 80 : 30 + 40 * Math.pow(M / 15, 0.5) * Math.pow(Math.max(age, 0.05) / 4.5, -0.3);
      p.Tint = Tint;
      // classify with a first-guess albedo then iterate once
      const classify = (Ab) => {
        const Teq = teqOf(S, Ab);
        const Teff = Math.pow(Math.pow(Teq, 4) + Math.pow(Tint, 4), 0.25);
        let st;
        if (isGiant) {
          st = Teff < 150 ? 'giant-ammonia' : Teff < 300 ? 'giant-water' : Teff < 850 ? 'giant-clear' : Teff < 1400 ? 'giant-alkali' : Teff < 2200 ? 'giant-silicate' : 'giant-ultrahot';
        } else if (regime === 'chthonian') st = 'chthonian';
        else if (regime === 'superpuff') st = 'super-puff';
        else if (init.kind === 'neptune') st = Teq < 200 ? 'ice-giant' : Teq < 900 ? 'warm-neptune' : 'hot-neptune';
        else st = 'sub-neptune';
        return { st, Teq, Teff };
      };
      let c1 = classify(0.3);
      let Ab = ALBEDO[c1.st];
      if (mDwarfLight && REDDENED.includes(c1.st)) Ab *= 0.8;
      c1 = classify(Ab);
      state = c1.st; A = ALBEDO[state] * (mDwarfLight && REDDENED.includes(state) ? 0.8 : 1);
      p.Teff = c1.Teff;
      const T1bar = 1.3 * c1.Teff;
      Tsurf = null; p.T1bar = T1bar;
      // atmospheric chemistry
      const Z = isGiant ? clamp(3 * Math.pow(10, star.feh) * Math.pow(Mj, -0.9), 1, 100)
        : regime === 'superpuff' ? 3
        : clamp(30 * Math.pow(M / 10, -1) * Math.pow(10, star.feh), 5, 500);
      p.metallicity = Z;
      const vmr = buildH2Chem(c1.Teff, Z, wmf >= 0.1 && !isGiant);
      let cloudTopP = null, haze = 0, inversion = false;
      if (state === 'giant-ammonia') cloudTopP = 0.5;
      if (state === 'giant-water') cloudTopP = 2;
      if (state === 'giant-silicate') cloudTopP = 0.05;
      if (state === 'ice-giant') cloudTopP = 1.5;
      if (state === 'giant-ultrahot') inversion = true;
      if ((state === 'sub-neptune' || state === 'warm-neptune' || state === 'super-puff') && c1.Teq > 350 && c1.Teq < 900) haze = rng.uniform(0.3, 1);
      atm = { type: 'h2', vmr, cloudTopP, haze, inversion, P: 1 };
      note('atmosphere', `Hydrogen/helium-dominated with metals at ≈${fmtNum(Z)}× solar${isGiant ? ' (heavier giants are less enriched, Jupiter ≈3×)' : ' (smaller planets are more metal-rich)'}.`, isGiant ? ['T16'] : []);
      if (isGiant) note('climate', `Effective temperature ${Math.round(c1.Teff)} K (equilibrium ${Math.round(c1.Teq)} K plus ${Math.round(Tint)} K of internal heat${Tint > c1.Teq ? ' — it glows mainly from its own formation heat' : ''}) places it in Sudarsky class ${{ 'giant-ammonia': 'I', 'giant-water': 'II', 'giant-clear': 'III', 'giant-alkali': 'IV', 'giant-silicate': 'V', 'giant-ultrahot': 'V+ (ultra-hot)' }[state]}.`, ['Su00', 'Bu97']);
      if (state === 'giant-ultrahot') note('atmosphere', 'Above ~2200 K the dayside has a thermal inversion: TiO/VO and metals absorb starlight high up, water dissociates, and H⁻ opacity flattens the spectrum (cf. WASP-121 b, KELT-9 b).');
      if (haze > 0) note('atmosphere', 'Warm hydrogen atmospheres with methane form photochemical hazes that can mute spectral features (as for GJ 1214 b).');
      if (state === 'sub-neptune') {
        const Tbase = Math.min(12000, T1bar * Math.pow(Math.max(Pbase, 1), 0.28));
        p.envelopeBaseP = Pbase; p.envelopeBaseT = Tbase;
        note('interior', `At the base of the envelope (~${fmtNum(Pbase)} bar, ≈${Math.round(Tbase)} K) rock is molten: sub-Neptunes likely hide magma oceans that react with the gas.`, ['Sh24']);
        if (wmf >= 0.1) note('interior', `Water-rich (${Math.round(wmf * 100)}% by mass): much of it exists as supercritical fluid mixed into the envelope — the leading “water-rich mini-Neptune” alternative to the hycean picture.`, ['H25', 'G26']);
      }
    }
    if (A === undefined) A = 0.3;
    p.state = state; p.albedo = A; p.lockedClimate = lockedClimate; p.oceanCover = cov;
    p.Teq = teqOf(S, A);
    if (Tday === undefined) {
      if (regime === 'solid' || regime === 'thinH2') Tday = (Tsurf || p.Teq) * (locked && (Psurf || 0) < 0.3 ? 1.15 : 1.02);
      else Tday = Math.pow(Math.pow(p.Teq * (locked ? 1.15 : 1.0), 4) + Math.pow(p.Tint || 0, 4), 0.25);
    }
    if (Tnight === undefined) Tnight = (regime === 'solid' || regime === 'thinH2') ? (Tsurf || p.Teq) * (locked && (Psurf || 0) < 1 ? 0.75 : 0.97) : Math.max(p.Tint || 0, p.Teq * (locked && p.Teq > 1200 ? 0.45 : 0.85));
    p.Tsurf = Tsurf; p.Tday = Tday; p.Tnight = Tnight; p.Psurf = Psurf;
    p.hasAtm = regime !== 'solid' || hasAtm;

    // finalise atmosphere object (scale height etc.)
    if (atm) {
      atm.T = isGiant || envLike ? (p.Teff || p.Teq) : (Tsurf || p.Teq);
      if (atm.type !== 'none') {
        let mu = 0, tot = 0;
        for (const k in atm.vmr) { mu += atm.vmr[k] * (EXO.MOLWT[k] || 30); tot += atm.vmr[k]; }
        atm.mu = mu / tot;
        const gcgs = 981 * p.gravity;
        // transmission probes the upper atmosphere: use ~0.8 × surface/photospheric T
        const Tup = isGiant || envLike ? p.Teq : Math.max(p.Teq * 0.85, 50);
        atm.Tup = Tup;
        atm.H = C.kB * Tup / (atm.mu * C.mH * gcgs); // cm
        atm.Hkm = atm.H / 1e5;
      }
      p.atm = atm;
    }

    // ------------------------------------------------ composition summary
    p.composition = describeComposition(p, init, regime);
    p.layers = interiorLayers(p, regime, Rc);

    // ------------------------------------------------ magnetism
    p.magnetic = magneticField(p, star, regime, rng, note);

    // ------------------------------------------------ seasons
    if (!locked && p.obliquity > 10) note('spin', `An axial tilt of ${Math.round(p.obliquity)}° gives ${p.obliquity > 54 ? 'extreme seasons: poles receive more annual sunlight than the equator' : 'Earth-like seasons'}.`);
    if (e > 0.2) note('orbit', `Instellation swings by a factor of ${fmtNum(p.Speri / p.Sapo)} around the orbit, driving strong eccentricity seasons.`);

    // ------------------------------------------------ habitability
    p.habitability = habitability(p, star, regime);

    // ------------------------------------------------ type & summary
    p.typeInfo = EXO.TYPE_INFO[state];
    p.sizeClass = sizeClass(p);
    p.summary = summarize(p, star);
    return p;
  }

  // Equilibrium-ish chemistry for H₂-dominated atmospheres (quench-free, 1 bar)
  function buildH2Chem(T, Z, waterRich) {
    const v = { H2: 0.84, He: 0.155 };
    const fCH4 = 1 / (1 + Math.exp((T - 1100) / 90));
    const O = 1e-3 * Z * (waterRich ? 3 : 1), Cc = 5e-4 * Z;
    if (T < 300) v.H2O = O * Math.exp(-(300 - T) / 25); // condensed below the cloud deck
    else v.H2O = O * (T > 2200 ? Math.exp(-(T - 2200) / 400) : 1);
    v.CH4 = Cc * fCH4;
    v.CO = Cc * (1 - fCH4);
    v.CO2 = 1e-7 * Z * Z * (T > 500 ? 1 : 0.3);
    if (T < 150) v.NH3 = 1e-6; else if (T < 700) v.NH3 = 1e-4 * Z * 0.2; else v.NH3 = 1e-6 * Z;
    v.H2S = T < 500 ? 3e-5 * Z * 0.3 : 3e-5 * Z;
    if (T > 700 && T < 1600 && Z > 5) v.SO2 = 1e-6 * Math.min(Z, 100) / 10; // photochemical (WASP-39 b)
    if (T > 900) { v.Na = 2e-6 * Z; v.K = 1e-7 * Z; }
    if (T > 2000) { v.TiO = 1e-7 * Z; v.VO = 1e-8 * Z; }
    let metals = 0;
    for (const k in v) if (k !== 'H2' && k !== 'He') metals += v[k];
    if (metals > 0.6) { const s = 0.6 / metals; for (const k in v) if (k !== 'H2' && k !== 'He') v[k] *= s; metals = 0.6; }
    v.H2 = (1 - metals) * 0.84; v.He = (1 - metals) * 0.16;
    return v;
  }

  function describeComposition(p, init, regime) {
    const out = [];
    if (regime === 'giant') {
      const Z = 1 - p.fEnv;
      out.push(['Hydrogen + helium', Math.round(p.fEnv * 100)]);
      out.push(['Heavy elements (rock, ice, metals)', Math.round(Z * 100)]);
      return out;
    }
    const fEnv = p.fEnv || 0;
    const core = 1 - fEnv;
    const w = regime === 'solid' || regime === 'thinH2' ? p.wmf : (init.kind === 'neptune' ? p.wmf : p.wmf);
    const rockyFrac = core * (1 - Math.min(w, 0.6));
    const iron = rockyFrac * p.cmf, silicate = rockyFrac * (1 - p.cmf);
    out.push(['Iron–nickel core', +(iron * 100).toFixed(1)]);
    out.push(['Silicate mantle & crust', +(silicate * 100).toFixed(1)]);
    if (w >= 0.01) out.push(['Water / high-pressure ices', +(core * Math.min(w, 0.6) * 100).toFixed(1)]);
    if (fEnv > 0) out.push(['Hydrogen + helium envelope', +(fEnv * 100).toFixed(fEnv < 0.01 ? 3 : 1)]);
    return out;
  }

  function interiorLayers(p, regime, Rc) {
    const R = p.radius;
    const L = [];
    if (regime === 'giant') {
      const Mj = p.mass / C.MJ;
      const core = 0.12 + 0.08 * (1 - p.fEnv);
      const metallic = Mj > 0.2 ? clamp(0.55 + 0.25 * log10(Mj / 0.3 + 1), 0.5, 0.88) : core + 0.05;
      L.push({ name: 'Rock/ice core (possibly dilute)', r: core, color: '#8a6b4f' });
      if (Mj > 0.2) L.push({ name: 'Metallic hydrogen', r: metallic, color: '#6f7fa8' });
      L.push({ name: 'Molecular H₂/He envelope', r: 1, color: '#d9c49a' });
      return L;
    }
    if (regime === 'envelope' || regime === 'superpuff' || regime === 'chthonian') {
      const dry = rCore(p.mass * (1 - p.fEnv), p.cmf, 0);
      const ironR = dry * Math.sqrt(p.cmf / 0.33) * 0.55;
      L.push({ name: 'Iron core', r: ironR / R, color: '#b5652d' });
      L.push({ name: 'Silicate mantle (likely molten at top)', r: dry / R, color: '#a8553a' });
      if (p.wmf >= 0.05) L.push({ name: 'Supercritical water / ionic ices', r: Math.min(0.95, Rc / R + 0.02), color: '#3d7fb0' });
      L.push({ name: 'H₂/He envelope', r: 1, color: p.state === 'ice-giant' ? '#8fd3e0' : '#c8b796' });
      return L;
    }
    const dry = rCore(p.mass * (1 - (p.fEnv || 0)), p.cmf, 0);
    const ironR = dry * Math.sqrt(p.cmf / 0.33) * 0.55;
    L.push({ name: 'Iron core', r: ironR / R, color: '#b5652d' });
    L.push({ name: 'Silicate mantle', r: Math.min(0.995, dry / R), color: '#9c4a32' });
    if (p.wmf >= 0.05) L.push({ name: p.state === 'ice-world' || p.state === 'snowball' ? 'High-pressure ice + (sub)surface ocean' : p.state === 'steam' ? 'Supercritical water' : 'Deep ocean over high-pressure ice', r: 1, color: '#2f6fa0' });
    else L.push({ name: 'Crust', r: 1, color: '#7d6a55' });
    return L;
  }

  function magneticField(p, star, regime, rng, note) {
    const age = star.age;
    const out = { present: false, B: 0, morphology: '—', magnetopause: null };
    if (regime === 'solid' || regime === 'thinH2') {
      const water = p.state === 'temperate' || p.state === 'ocean' || p.state === 'hycean';
      const pPT = p.tidalFlux > 1 ? 0 : water && p.mass > 0.3 && p.mass < 6 ? 0.6 : (p.wmf > 1e-4 && p.hasAtm ? 0.3 : 0.1);
      const pt = rng.random() < pPT;
      out.tectonics = p.tidalFlux > 1 ? 'heat-pipe volcanism (tidally heated)' : pt ? 'plate tectonics' : 'stagnant lid';
      let tdyn = 8 * Math.pow(Math.min(p.mass, 4), 1.24) * (pt ? 1 : 0.4) * Math.sqrt(p.cmf / 0.33);
      if (p.mass > 4) tdyn *= 0.8; // uncertain: high mantle viscosity in big super-Earths
      if (p.tidalFlux > 0.3) tdyn *= 0.5;
      tdyn = Math.min(tdyn, 25);
      out.dynamoLifetime = tdyn;
      if (age < tdyn) {
        out.present = true;
        const slow = p.protDays > 15;
        out.B = 0.3 * Math.pow(p.mass, 0.4) * Math.sqrt(p.cmf / 0.33) * Math.pow(Math.max(0.05, 1 - age / tdyn), 0.25) * (slow ? 0.4 : 1);
        out.morphology = slow ? 'multipolar (slow rotation)' : 'dipolar';
      }
      note('magnetism', `Core dynamo lifetime ≈ ${fmtNum(tdyn)} Gyr for a ${fmtNum(p.mass)} M⊕ planet with an iron fraction of ${Math.round(p.cmf * 100)}% and ${out.tectonics} (a stagnant lid insulates the core and shortens the dynamo). Age ${fmtNum(age)} Gyr → ${out.present ? 'dynamo active' : 'dynamo has shut off (like Mars and Venus)'}.`, ['DB15']);
      if (out.present) note('magnetism', `Field strength from energy-flux scaling (B ∝ q^(1/3)), normalised to Earth's 0.3 G.`, ['C09']);
    } else if (regime === 'giant') {
      const Mj = p.mass / C.MJ;
      out.present = true;
      out.B = Math.min(3000, 4.2 * Math.pow(Mj, 0.5) * Math.pow((p.Tint || 100) / 100, 4 / 3));
      out.morphology = 'dipolar (metallic-hydrogen dynamo)';
      note('magnetism', `Christensen's energy-flux scaling (B ∝ q^(1/3) with q ∝ T_int⁴) normalised to Jupiter's 4.2 G gives ≈${fmtNum(out.B)} G.`, ['C09']);
      if (p.Teq > 1000) note('magnetism', 'Inflated hot Jupiters carry extra internal heat, so their dynamos may reach tens of gauss.', ['YT17']);
    } else {
      out.present = true;
      out.B = 0.15 * Math.sqrt(p.mass / 15);
      out.morphology = 'multipolar (ionic-water shell dynamo, like Uranus/Neptune)';
      note('magnetism', 'Neptune-like interiors generate offset, multipolar fields in a thin convecting shell of ionic water.');
    }
    if (out.present && out.B > 0) {
      const Psw = (1 / (p.a * p.a)) * (star.isWD ? 1e-3 : Math.sqrt(star.xuvNow / 1.6e-6));
      out.windPressure = Psw;
      out.magnetopause = 10 * Math.pow(out.B / 0.3, 1 / 3) * Math.pow(Psw, -1 / 6);
      out.cyclotronMHz = 2.8 * out.B * 2; // polar field ≈ 2× equatorial
      if (out.magnetopause < 1.5) note('magnetism', `The stellar wind pressure (~${fmtNum(Psw)}× Earth's) crushes the magnetosphere to ${fmtNum(out.magnetopause)} planetary radii — the atmosphere is directly exposed.`);
      else note('magnetism', `Magnetopause stand-off ≈ ${fmtNum(out.magnetopause)} planetary radii against a stellar wind ~${fmtNum(Psw)}× Earth's (Earth: ~10).`);
    }
    return out;
  }

  function habitability(p, star, regime) {
    const f = [];
    const add = (name, v, why) => f.push({ name, v: clamp(v, 0, 1), why });
    const T = p.Tsurf;
    let base;
    const solidish = regime === 'solid' || regime === 'thinH2';
    if (!solidish) {
      add('Solid surface', 0.02, 'No accessible solid or liquid surface.');
      if (p.state === 'sub-neptune' && p.wmf >= 0.1 && p.Teq < 400) add('Envelope water', 0.15, 'Water-rich envelope could host liquid layers in some models.');
      base = 0.02;
    } else {
      let ft;
      if (T == null) ft = p.Tday > 273 && p.Tnight < 373 && p.hasAtm ? 0.3 : 0.02;
      else if (T >= 273 && T <= 373) ft = Math.exp(-Math.pow((T - 290) / 40, 2));
      else if (T > 373 && T < 420 && (p.Psurf || 0) > 3) ft = 0.3;
      else ft = 0.02;
      if (p.state === 'ice-world' || p.state === 'snowball') ft = Math.max(ft, p.mass > 0.05 ? 0.15 : 0.05);
      add('Surface temperature', ft, T == null ? 'No atmosphere to even out day and night.' : `${Math.round(T)} K mean surface temperature${p.state === 'ice-world' || p.state === 'snowball' ? '; possible subsurface ocean' : ''}.`);
      const P = p.Psurf || 0;
      add('Atmosphere', !p.hasAtm ? 0.02 : P < 0.006 ? 0.15 : P < 0.05 ? 0.5 : P <= 20 ? 1 : P <= 200 ? 0.35 : 0.1, !p.hasAtm ? 'No atmosphere.' : `${fmtNum(P)} bar.`);
      add('Water', p.state === 'hycean' || p.state === 'ocean' ? 0.85 : p.oceanCover > 0.05 ? 1 : p.state === 'desert' ? 0.4 : (p.wmf > 1e-4 ? 0.3 : 0.1), p.state === 'ocean' ? 'Global ocean (no land: weaker climate regulation and nutrient cycling).' : p.oceanCover > 0.05 ? `${Math.round(p.oceanCover * 100)}% ocean cover.` : 'Scarce surface water.');
      const R = p.radius;
      add('Size', p.state === 'hycean' ? 0.6 : R < 0.4 ? 0.2 : R < 0.6 ? 0.6 : R <= 1.6 ? 1 : R <= 2.2 ? 0.6 : 0.3, `${fmtNum(R)} R⊕${R > 1.6 ? ' (above the ~1.6 R⊕ rocky/volatile transition)' : ''}.`);
      base = 1;
    }
    const xr = p.fluenceRel;
    add('Stellar activity', 1 / (1 + Math.pow(xr / 30, 0.6)), `Lifetime XUV dose ${fmtNum(xr)}× Earth's; host is ${star.activity}.`);
    add('Magnetic shielding', p.magnetic.present ? (p.magnetic.magnetopause && p.magnetic.magnetopause < 2 ? 0.75 : 1) : 0.7, p.magnetic.present ? 'Active dynamo.' : 'No global field (role in habitability is debated).');
    add('Rotation', p.locked ? (p.hasAtm && (p.Psurf || 1) > 0.3 ? 0.85 : 0.55) : 1, p.locked ? `Tidally locked (${p.spinState}); a thick atmosphere or ocean can still carry heat to the night side.` : 'Day–night cycle.');
    add('Age & stability', star.age < 0.5 ? 0.6 : star.remaining < 0.5 ? 0.5 : 1, `${fmtNum(star.age)} Gyr old; ${star.isWD ? 'white dwarf (cooling, stable)' : `${star.remaining > 50 ? '>50' : fmtNum(star.remaining)} Gyr of main sequence left`}.`);
    add('Orbit', p.e > 0.3 ? 0.65 : 1, p.e > 0.3 ? 'Strongly eccentric orbit drives extreme seasons.' : 'Near-circular orbit.');
    if (p.tidalFlux > 2) f.push({ name: 'Tidal heating', v: 0.6, why: 'Extreme volcanism resurfaces the planet.' });

    // weighted geometric mean of the "hard" factors times softer modifiers
    const hard = f.filter((x) => ['Surface temperature', 'Atmosphere', 'Water', 'Size', 'Solid surface', 'Envelope water'].includes(x.name));
    const soft = f.filter((x) => !hard.includes(x));
    let idx = 1;
    for (const x of hard) idx *= x.v;
    for (const x of soft) idx *= Math.pow(x.v, 0.6);
    let index = Math.round(100 * idx * base);
    if (!solidish) index = Math.min(index, p.state === 'sub-neptune' && p.wmf >= 0.1 ? 4 : 1);

    // Earth Similarity Index
    const Tesi = p.Tsurf != null ? p.Tsurf : (solidish ? p.Teq : (p.T1bar || p.Teq));
    const terms = [[p.radius, 1, 0.57], [p.density / 5.51, 1, 1.07], [p.vesc / 11.19, 1, 0.70], [Tesi, 288, 5.58]];
    let esi = 1;
    for (const [x, x0, w] of terms) esi *= Math.pow(1 - Math.abs((x - x0) / (x + x0)), w / 4);

    let label;
    if (index >= 55) label = 'Potentially habitable';
    else if (index >= 30) label = 'Marginally habitable';
    else if (index >= 10) label = 'Hostile, with possible niches';
    else label = 'Uninhabitable surface';
    const extras = [];
    if ((p.state === 'ice-world' || p.state === 'snowball') && p.mass > 0.05) extras.push('A subsurface ocean beneath the ice is plausible (cf. Europa, Enceladus).');
    if (regime === 'giant' && p.S < p.hz.recentVenus && p.S > p.hz.earlyMars) extras.push('It orbits in the habitable zone: large moons of this giant could have temperate surfaces.');
    if (p.lockedClimate === 'eyeball') extras.push('Liquid water is confined to an “eyeball” of open ocean beneath the star.');
    if (p.state === 'hycean') extras.push('Habitability hinges on whether the ocean really exists beneath the hydrogen — currently debated for real candidates.');
    return { index, esi, label, factors: f, extras };
  }

  function sizeClass(p) {
    const R = p.radius, M = p.mass;
    if (p.regime === 'giant') return M > 4 * C.MJ ? 'super-Jupiter' : M > 0.6 * C.MJ ? 'Jupiter-mass' : 'Saturn-mass';
    if (p.state === 'super-puff') return 'super-puff';
    if (p.kind === 'neptune') return 'Neptune-mass';
    if (R < 0.8) return 'sub-Earth';
    if (R < 1.25) return 'Earth-size';
    if (p.regime === 'envelope') return R < 3 ? 'mini-Neptune' : 'sub-Neptune';
    return R < 2 ? 'super-Earth' : 'mega-Earth';
  }

  function summarize(p, star) {
    const bits = [];
    const lockStr = p.locked ? (p.spinState === 'synchronous' ? 'tidally locked ' : '') : '';
    let t = p.typeInfo.label;
    if (!/^(Titan|Venus)/.test(t)) t = t[0].toLowerCase() + t.slice(1);
    const dropSize = ['sub-neptune', 'super-puff', 'ice-giant', 'warm-neptune', 'hot-neptune'].includes(p.state) || /Jupiter/.test(t);
    const phrase = `${lockStr}${dropSize ? '' : p.sizeClass + ' '}${t}`;
    bits.push(`${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}`);
    let where;
    if (p.hzZone.includes('conservative')) where = 'in the habitable zone';
    else if (p.hzZone.includes('optimistic')) where = 'at the edge of the habitable zone';
    else if (p.S > 100) where = 'on a scorching close-in orbit';
    else if (p.hzZone.startsWith('interior')) where = 'closer in than the habitable zone';
    else where = 'in the cold outer system';
    bits.push(`${where} of ${/^[AEFHILMNORSX]/.test(star.spt) ? 'an' : 'a'} ${star.spt} ${star.className}`);
    return bits.join(' ') + '.';
  }

  // ================================================================ NAMES
  function makeName(rng, star) {
    let pre;
    if (star.isWD) {
      const ra = String(rng.int(0, 2359)).padStart(4, '0');
      const dec = (rng.chance(0.5) ? '+' : '-') + String(rng.int(0, 899)).padStart(3, '0');
      return { host: `WD ${ra}${dec}`, letter: rng.pick(['b', 'b', 'c']) };
    }
    if (star.cls === 'M') pre = rng.pick(['LHS', 'GJ', 'Wolf', 'Ross', 'LP', 'TOI-', 'TIC', 'LTT', 'G']);
    else if (star.cls === 'A') pre = rng.pick(['HD', 'HR', 'HIP']);
    else pre = rng.pick(['HD', 'HIP', 'Kepler-', 'K2-', 'WASP-', 'TOI-', 'HAT-P-', 'GJ']);
    const num = {
      LHS: rng.int(100, 3999), GJ: rng.int(1000, 9999), Wolf: rng.int(300, 1500), Ross: rng.int(100, 999), LP: `${rng.int(100, 999)}-${rng.int(10, 99)}`,
      'TOI-': rng.int(1000, 9999), TIC: rng.int(10000000, 499999999), LTT: rng.int(1000, 9999), G: `${rng.int(1, 299)}-${rng.int(1, 99)}`,
      HD: rng.int(1000, 240000), HR: rng.int(100, 9100), HIP: rng.int(1000, 120000), 'Kepler-': rng.int(100, 1999), 'K2-': rng.int(100, 420),
      'WASP-': rng.int(100, 199), 'HAT-P-': rng.int(70, 99)
    }[pre];
    const sep = pre.endsWith('-') ? '' : ' ';
    return { host: `${pre}${sep}${num}`, letter: rng.pick(['b', 'b', 'b', 'c', 'c', 'd', 'e', 'f']) };
  }

  // ================================================================ INTERESTINGNESS
  const RARITY = {
    lava: 2, 'hot-rock': 0.6, airless: 0.2, venus: 1.6, 'venus-hot': 1.2, steam: 1.6, temperate: 3.8, ocean: 3.2, desert: 1.6,
    snowball: 1.4, 'ice-world': 1.6, titan: 2.4, hycean: 3.5, 'sub-neptune': 0.6, 'super-puff': 3, 'ice-giant': 1.2,
    'warm-neptune': 1.0, 'hot-neptune': 2, chthonian: 3, 'giant-ammonia': 1.4, 'giant-water': 2.2, 'giant-clear': 2.2,
    'giant-alkali': 2.2, 'giant-silicate': 2.4, 'giant-ultrahot': 3.0
  };
  function interestScore(sys) {
    const p = sys.planet, s = sys.star;
    let sc = RARITY[p.state] || 1;
    sc += 2.5 * p.habitability.index / 100;
    if (p.vis && p.vis.hasRing) sc += 1.3;
    if (p.tidalFlux > 1) sc += 1.0;
    if (p.e > 0.4) sc += 0.8;
    if (s.isWD) sc += 1.5;
    if (s.cls === 'A') sc += 0.5;
    if (s.age < 0.4) sc += 0.4;
    if (p.lockedClimate) sc += 0.6;
    if (p.obliquity > 60) sc += 0.4;
    if (p.Tsurf && p.Tsurf > 273 && p.Tsurf < 330) sc += 0.6;
    return sc;
  }

  // ================================================================ PUBLIC API
  function buildSystem(seed, rng, mode, index) {
    const star = makeStar(rng.fork('star'), mode);
    const init = sampleInit(rng.fork('planet'), star, mode);
    const planet = derive(star, init, seed + '#' + index);
    planet.vis = EXO.makeVisual ? EXO.makeVisual(planet, star) : null;
    const name = makeName(rng.fork('name'), star);
    star.name = name.host;
    planet.name = `${name.host} ${name.letter}`;
    return { star, planet };
  }

  EXO.generate = function (seed, mode) {
    mode = mode === 'realistic' ? 'realistic' : 'interesting';
    const root = new EXO.RNG(seed + '|' + mode);
    if (mode === 'realistic') {
      const sys = buildSystem(seed, root.fork('cand0'), mode, 0);
      return Object.assign(sys, { seed, mode, considered: 1, index: 0 });
    }
    const N = 40, cands = [];
    for (let i = 0; i < N; i++) cands.push(buildSystem(seed, root.fork('cand' + i), mode, i));
    const scores = cands.map(interestScore);
    const temp = 0.9;
    const mx = Math.max(...scores);
    const w = scores.map((s) => Math.exp((s - mx) / temp));
    const tot = w.reduce((x, y) => x + y, 0);
    let r = root.fork('select').random() * tot, chosen = 0;
    for (let i = 0; i < N; i++) { r -= w[i]; if (r <= 0) { chosen = i; break; } }
    return Object.assign(cands[chosen], { seed, mode, considered: N, chosenScore: scores[chosen], index: chosen });
  };

  // Build a system from explicit parameters (used by tests / sanity checks).
  EXO.customSystem = function (starSpec, initSpec, seed) {
    const star = finishStar(Object.assign({}, starSpec));
    const init = Object.assign({ e: 0, obliquity: 23, prot0: 24, ringRoll: 0.9, visSeed: [1, 2, 3], paletteRoll: 0.5, spotRoll: 0.5, wmf: 2.3e-4, cmf: 0.32, fEnv0: 0 }, initSpec);
    const planet = derive(star, init, seed || 'custom');
    planet.vis = EXO.makeVisual ? EXO.makeVisual(planet, star) : null;
    star.name = starSpec.name || 'Test star';
    planet.name = initSpec.name || 'Test planet';
    return { star, planet, seed: seed || 'custom', mode: 'custom' };
  };

  // ================================================================ ANALOGUES
  const GROUP_COMPAT = {
    rocky: { rocky: 0, water: 0.8, moon: 1.2, subnep: 2, neptune: 3, giant: 4 },
    water: { water: 0, rocky: 0.8, subnep: 1, moon: 1.2, neptune: 2.5, giant: 4 },
    subnep: { subnep: 0, water: 1, neptune: 1.2, rocky: 2, giant: 3, moon: 3 },
    neptune: { neptune: 0, subnep: 1.2, giant: 1.8, water: 2.5, rocky: 3, moon: 3 },
    giant: { giant: 0, neptune: 1.8, subnep: 3, water: 4, rocky: 4, moon: 4 }
  };
  EXO.findAnalogs = function (p, star) {
    const g = p.typeInfo.group;
    const res = EXO.ANALOGS.map((an) => {
      const dM = (log10(p.mass) - log10(an.M)) / 0.35;
      const dR = (log10(p.radius) - log10(an.R)) / 0.15;
      const dS = (log10(p.S) - log10(an.S)) / 0.5;
      const dT = (star.teff - an.Teff) / 1800;
      const de = (p.e - an.e) / 0.3;
      const gp = (GROUP_COMPAT[g] || {})[an.group] ?? 2;
      const d2 = dM * dM + dR * dR + dS * dS + 0.5 * dT * dT + 0.3 * de * de + gp * gp;
      const sim = Math.round(100 * Math.exp(-d2 / 10));
      const why = [];
      const rr = p.radius / an.R, ss = p.S / an.S, mm = p.mass / an.M;
      why.push(Math.abs(log10(rr)) < 0.08 ? 'same size' : `${fmtRatio(rr)} the radius`);
      why.push(Math.abs(log10(mm)) < 0.12 ? 'similar mass' : `${fmtRatio(mm)} the mass`);
      why.push(Math.abs(log10(ss)) < 0.15 ? 'similar instellation' : `${fmtRatio(ss)} the starlight`);
      return { an, sim, why: why.join(', ') };
    });
    res.sort((x, y) => y.sim - x.sim);
    return res.slice(0, 3);
  };

  // ================================================================ FORMAT HELPERS
  function fmtNum(x) {
    if (x === Infinity) return '∞';
    if (!isFinite(x)) return '—';
    const ax = Math.abs(x);
    if (ax === 0) return '0';
    if (ax >= 1e5 || ax < 1e-3) return sci(x);
    if (ax >= 100) return Math.round(x).toLocaleString('en-US');
    if (ax >= 10) return x.toFixed(1);
    if (ax >= 1) return x.toFixed(2);
    return x.toPrecision(2);
  }
  const SUPS = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  function sci(x) {
    const [m, ex] = x.toExponential(1).split('e');
    return `${m}×10${String(parseInt(ex, 10)).split('').map((c) => SUPS[c] || c).join('')}`;
  }
  function fmtTime(gyr) {
    if (gyr < 1e-6) return `${fmtNum(gyr * 1e9 * 365.25)} days`;
    if (gyr < 1e-3) return `${fmtNum(gyr * 1e9)} yr`;
    if (gyr < 1) return `${fmtNum(gyr * 1e3)} Myr`;
    return `${fmtNum(gyr)} Gyr`;
  }
  function fmtRatio(r) {
    if (r >= 1) return `${r < 10 ? r.toFixed(1) : Math.round(r)}×`;
    return `1/${(1 / r) < 10 ? (1 / r).toFixed(1) : Math.round(1 / r)}`;
  }
  EXO.fmt = { num: fmtNum, time: fmtTime, ratio: fmtRatio, sci };
  EXO._internal = { rCore, rEnv, rGiant, lumMS, radiusMS, teqOf, EARTH_XUV_FLUENCE };
})(typeof window !== 'undefined' ? window : globalThis);
