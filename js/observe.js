/* Observability: what current and planned facilities could do with this
 * planet if its system sat at a chosen distance. Status as of October 2026. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const { C } = EXO;

  // Main-sequence bolometric corrections and colours vs Teff (after Pecaut & Mamajek 2013)
  const PHOT = [
    // Teff,  BC_V,  V-J,  J-K
    [2400, -6.2, 8.2, 1.15], [2600, -5.3, 7.2, 1.1], [2800, -4.5, 6.3, 1.03], [3000, -3.7, 5.6, 0.95],
    [3200, -2.9, 4.8, 0.9], [3400, -2.2, 4.1, 0.86], [3600, -1.6, 3.4, 0.84], [3850, -1.15, 2.75, 0.82],
    [4200, -0.82, 2.1, 0.72], [4600, -0.53, 1.75, 0.6], [5000, -0.32, 1.48, 0.5], [5400, -0.17, 1.32, 0.42],
    [5800, -0.07, 1.18, 0.37], [6200, -0.02, 1.0, 0.3], [6600, 0.0, 0.86, 0.25], [7200, -0.02, 0.62, 0.15],
    [8000, -0.1, 0.36, 0.08], [9000, -0.2, 0.12, 0.03], [10000, -0.4, 0.0, 0.0], [12000, -0.8, -0.15, -0.05], [17000, -1.6, -0.35, -0.1]
  ];
  function interpPhot(T) {
    if (T <= PHOT[0][0]) return PHOT[0].slice(1);
    for (let i = 1; i < PHOT.length; i++) {
      if (T <= PHOT[i][0]) {
        const t = (T - PHOT[i - 1][0]) / (PHOT[i][0] - PHOT[i - 1][0]);
        return [1, 2, 3].map((k) => PHOT[i - 1][k] + t * (PHOT[i][k] - PHOT[i - 1][k]));
      }
    }
    return PHOT[PHOT.length - 1].slice(1);
  }
  function photometry(star, dpc) {
    const [bc, vj, jk] = interpPhot(star.teff);
    const Mbol = 4.74 - 2.5 * Math.log10(star.lum);
    const MV = Mbol - bc;
    const dm = 5 * Math.log10(dpc / 10);
    const V = MV + dm, J = V - vj, K = J - jk;
    const G = V + (-0.04 - 0.1 * vj - 0.04 * vj * vj);
    const I = V - 0.45 * vj;
    const T = V - 0.55 * vj; // TESS band ≈ I
    return { V, J, K, G, I, T, MV };
  }
  // Planck B_λ in arbitrary units (λ in µm)
  function planck(lam, T) { return 1 / (Math.pow(lam, 5) * (Math.exp(14387.77 / (lam * T)) - 1)); }
  // Planck B_ν in cgs (erg s⁻¹ cm⁻² Hz⁻¹ sr⁻¹)
  function planckNu(lam, T) {
    const nu = 2.998e14 / lam;
    return 2 * 6.626e-27 * nu * nu * nu / (2.998e10 * 2.998e10) / (Math.exp(6.626e-27 * nu / (1.381e-16 * T)) - 1);
  }
  EXO.planck = planck;

  function fmtC(c) { return c > 0 ? EXO.fmt.sci(c) : '—'; }

  EXO.observe = function (sys, distLy) {
    const s = sys.star, p = sys.planet;
    const fmt = EXO.fmt.num;
    const dpc = distLy / 3.26156;
    const ph = photometry(s, dpc);
    const Rp = p.radius * C.Re, Rs = s.radius * C.Rsun, aCm = p.a * C.AU;
    const sep = p.a / dpc; // arcsec
    const sepMas = sep * 1000;
    const Ag = clamp(1.15 * p.albedo + 0.03, 0.03, 0.8);
    const cRefl = Ag / Math.PI * Math.pow(Rp / aCm, 2);
    const Tem = Math.max(p.Tday || p.Teq, 40);
    const cTherm = (lam) => Math.pow(Rp / Rs, 2) * planck(lam, Tem) / planck(lam, s.teff);
    const c10 = cTherm(10), c38 = cTherm(3.8), c44 = cTherm(4.4) + cRefl;
    const Vp = ph.V - 2.5 * Math.log10(cRefl);
    const transitProb = Math.min(1, (Rs + Rp) / aCm / (1 - p.e * p.e));
    const depth = Math.pow(Rp / Rs, 2);
    const durH = 13 * Math.pow(p.period / 365.25, 1 / 3) * s.radius * Math.pow(s.mass, -1 / 3);
    const Kms = 28.43 / Math.sqrt(1 - p.e * p.e) * (p.mass / C.MJ) * Math.pow(s.mass, -2 / 3) * Math.pow(p.period / 365.25, -1 / 3);
    const astro = p.mass / (332946 * s.mass) * p.a / dpc * 1e6; // µas
    const Teq0 = 278.6 * Math.pow(p.S, 0.25);
    const r = p.radius;
    const tsmScale = r < 1.5 ? 0.19 : r < 2.75 ? 1.26 : r < 4 ? 1.28 : 1.15;
    const TSM = tsmScale * r * r * r * Teq0 / (p.mass * s.radius * s.radius) * Math.pow(10, -ph.J / 5);
    const tsmThresh = r < 1.5 ? 10 : 90;
    const ESM = 4.29e6 * planck(7.5, 1.1 * Teq0) / planck(7.5, s.teff) * depth * Math.pow(10, -ph.K / 5);
    const flux10uJy = Math.PI * planckNu(10, Tem) * Math.pow(Rp / (dpc * 3.0857e18), 2) * 1e23 * 1e6;

    const basics = {
      dpc, sepMas, Ag, cRefl, c10, Vp, transitProb, depth, durH, Kms, astro, TSM, tsmThresh, ESM, flux10uJy, phot: ph
    };
    const out = [];
    const add = (o) => out.push(o);
    const transitNote = `if its orbit is aligned to transit (${(transitProb * 100).toFixed(transitProb < 0.01 ? 2 : 1)}% chance)`;

    // ---- TESS
    {
      const sig = 60 * Math.pow(10, 0.2 * Math.max(0, ph.T - 8));
      const ntr = Math.floor(54 / p.period);
      const snr = depth * 1e6 / sig * Math.sqrt(Math.max(ntr, 1) * durH);
      let v = 'no', d;
      if (ph.T < 2) { v = 'no'; d = 'Star is too bright (saturates the detectors).'; }
      else if (ntr >= 2 && snr >= 7.3) { v = 'yes'; d = `Transit depth ${fmt(depth * 1e6)} ppm; ~${ntr} transits per 2 sectors, S/N ≈ ${fmt(snr)} — detectable ${transitNote}.`; }
      else if ((ntr >= 1 && snr >= 5) || (ntr === 0 && snr >= 10 && p.period < 400)) { v = 'maybe'; d = `Depth ${fmt(depth * 1e6)} ppm, S/N ≈ ${fmt(snr)}; marginal or single-transit ${transitNote}.`; }
      else d = p.period > 54 ? `Orbit (${fmt(p.period)} d) too long for TESS's ~27-day sectors.` : `Depth ${fmt(depth * 1e6)} ppm is too shallow for this star (S/N ≈ ${fmt(snr)}).`;
      add({ name: 'TESS', technique: 'Transit photometry', status: 'Operating since 2018', sc: 'op', verdict: v, detail: d });
    }
    // ---- Ground RV
    {
      const mdw = s.teff < 4000;
      let sig = mdw ? 0.8 * Math.max(1, Math.pow(10, 0.2 * (ph.J - 7))) : 0.25 * Math.max(1, Math.pow(10, 0.2 * (ph.V - 7)));
      if (s.teff > 6500) sig *= 1 + (s.teff - 6500) / 400;
      if (s.isWD) sig *= 20;
      const jitter = s.activity.startsWith('saturated') ? 1.5 : s.activity.startsWith('moderately') ? 0.6 : 0.25;
      const Kdet = Math.max(0.45 * sig, jitter * 0.6, 0.15);
      const inst = mdw ? 'NIRPS / MAROON-X / CARMENES (near-IR)' : 'ESPRESSO / KPF / HARPS';
      let v = Kms >= 1.5 * Kdet ? 'yes' : Kms >= Kdet ? 'maybe' : 'no';
      if (p.period > 365.25 * 15) v = v === 'yes' ? 'maybe' : v;
      const d = `Reflex velocity K = ${fmt(Kms)} m/s vs ~${fmt(Kdet)} m/s detection limit (${mdw ? 'J' : 'V'} = ${fmt(mdw ? ph.J : ph.V)}, ${s.activity}). ${v !== 'no' ? 'Yields the minimum mass.' : ''}${p.period > 365.25 * 15 ? ' Needs >15 yr of monitoring.' : ''}`;
      add({ name: 'Ground radial velocity', sub: inst, technique: 'Doppler wobble', status: 'Operating', sc: 'op', verdict: v, detail: d });
    }
    // ---- Gaia
    {
      const thr4 = 40 * Math.max(1, Math.pow(10, 0.2 * (ph.G - 12)));
      const thr5 = 25 * Math.max(1, Math.pow(10, 0.2 * (ph.G - 12)));
      let v = 'no', d;
      const PyR = p.period / 365.25;
      if (ph.G < 3) d = 'Host too bright for Gaia astrometry.';
      else if (astro >= thr4 && PyR < 6.6) { v = 'yes'; d = `Astrometric wobble ${fmt(astro)} µas — detectable in DR4 (Dec 2026, 5.5-yr baseline).`; }
      else if (astro >= thr5 && PyR < 12) { v = 'maybe'; d = `Wobble ${fmt(astro)} µas — within reach of DR5 (10.5-yr baseline, ~2030).`; }
      else d = `Wobble ${fmt(astro)} µas${PyR > 12 ? ` with a ${fmt(PyR)}-yr orbit` : ''} is below Gaia's ~${fmt(thr5)} µas reach at G = ${fmt(ph.G)}.`;
      add({ name: 'Gaia DR4 / DR5', technique: 'Astrometry', status: 'DR4 due Dec 2026', sc: 'op', verdict: v, detail: d, refs: ['GAIA', 'LW25'] });
    }
    // ---- JWST transmission
    {
      const sp = EXO.spectrum(sys, 'transmission', distLy);
      const best = sp.mols[0];
      let v, d = `TSM = ${fmt(TSM)} (Kempton threshold ${tsmThresh}) ${transitNote}. `;
      if (!p.hasAtm) {
        v = TSM >= tsmThresh && !sp.saturated ? 'yes' : TSM >= 0.5 * tsmThresh ? 'maybe' : 'no';
        d += 'No atmosphere: a flat spectrum would rule out thick atmospheres and test the cosmic shoreline.';
      } else {
        v = best && best.amp >= 2 * sp.noise ? 'yes' : best && best.amp >= sp.noise ? 'maybe' : 'no';
        d += best ? `Strongest feature: ${best.mol} at ${fmt(best.at)} µm, ${fmt(best.amp)} ppm vs ~${fmt(sp.noise)} ppm noise (${sp.nObs} transit${sp.nObs > 1 ? 's' : ''}).` : 'No strong features.';
        if (p.atm && p.atm.Hkm) d += ` Scale height ${fmt(p.atm.Hkm)} km.`;
      }
      if (sp.saturated) { v = v === 'yes' ? 'maybe' : v; d += ' Host is so bright it saturates standard time-series modes.'; }
      if (sp.nPossible < 3) d += ` Only ~${sp.nPossible} transit${sp.nPossible > 1 ? 's' : ''} observable in 5 years.`;
      add({ name: 'JWST — transmission', technique: 'Transit spectroscopy', status: 'Operating', sc: 'op', verdict: v, detail: d, refs: ['K18'] });
    }
    // ---- JWST emission
    {
      const sp = EXO.spectrum(sys, 'emission', distLy);
      let mx = 0, at = 0;
      sp.lam.forEach((l, i) => { if (l <= 16 && sp.y[i] > mx) { mx = sp.y[i]; at = l; } });
      let v = mx >= 3 * sp.noise ? 'yes' : mx >= 1.5 * sp.noise ? 'maybe' : 'no';
      if (sp.saturated && v === 'yes') v = 'maybe';
      const d = `Eclipse depth up to ${fmt(mx)} ppm (at ${fmt(at)} µm) vs ~${fmt(sp.noise)} ppm noise; ESM = ${fmt(ESM)}. ${r < 1.8 && v !== 'no' ? 'A 15 µm MIRI eclipse (as in the Rocky Worlds programme) could test for a CO₂ atmosphere.' : 'Eclipses and phase curves map dayside temperature and heat transport.'} Requires an eclipsing geometry.`;
      add({ name: 'JWST — eclipse & phase curve', technique: 'Thermal emission', status: 'Operating', sc: 'op', verdict: v, detail: d, refs: ['K18', 'RW'] });
    }
    // ---- JWST coronagraphy
    {
      let v = 'no', d;
      if (sep < 0.4) d = `Separation ${fmt(sepMas)} mas is inside the coronagraphs' inner working angle (~0.4–0.6″).`;
      else {
        const need = sep > 1 ? 1e-6 : 1e-5;
        v = c44 >= need ? 'yes' : c44 >= need / 5 ? 'maybe' : 'no';
        d = `Separation ${fmt(sep)}″; 4.4 µm contrast ${fmtC(c44)} vs ~${fmtC(need)} needed.${p.Tint > p.Teq ? ' Its internal heat makes it bright in the infrared.' : ''}`;
      }
      add({ name: 'JWST — coronagraphic imaging', technique: 'Direct imaging (IR)', status: 'Operating', sc: 'op', verdict: v, detail: d });
    }
    // ---- Roman CGI
    {
      let v = 'no', d;
      if (sep < 0.15) d = `Separation ${fmt(sepMas)} mas is inside the ~150 mas inner working angle.`;
      else if (sep > 1.4) d = 'Beyond the coronagraph field of view.';
      else if (ph.V > 8) d = `Host (V = ${fmt(ph.V)}) too faint for the coronagraph's wavefront control.`;
      else { v = cRefl >= 1e-7 ? 'yes' : cRefl >= 1e-8 ? 'maybe' : 'no'; d = `Reflected-light contrast ${fmtC(cRefl)} (design ≥10⁻⁷, hoped 10⁻⁸–10⁻⁹); planet V ≈ ${fmt(Vp)}.`; }
      add({ name: 'Roman Coronagraph', technique: 'Direct imaging (visible)', status: 'Launched 30 Aug 2026 · obs. from 2027', sc: 'soon', verdict: v, detail: d, refs: ['ROMAN'] });
    }
    // ---- PLATO
    {
      let v = 'no', d;
      if (s.teff < 3900 || s.isWD) d = 'PLATO targets Sun-like (F–K) stars; M dwarfs are secondary.';
      else {
        const sig = Math.max(10, 34 * Math.pow(10, 0.2 * (ph.V - 11)));
        const ntr = Math.floor(730 / p.period);
        const snr = depth * 1e6 / sig * Math.sqrt(Math.max(ntr, 1) * durH);
        if (ph.V > 13) d = `Host (V = ${fmt(ph.V)}) fainter than PLATO's core sample.`;
        else if (ntr >= 2 && snr >= 7.3) { v = 'yes'; d = `S/N ≈ ${fmt(snr)} over ${ntr} transits in a 2-yr field ${transitNote}. PLATO is built to find exactly such long-period planets around bright Sun-like stars.`; }
        else if (snr >= 5) { v = 'maybe'; d = `S/N ≈ ${fmt(snr)} ${ntr < 2 ? '(fewer than 2 transits per 2-yr field)' : ''} ${transitNote}.`; }
        else d = `Transit S/N ≈ ${fmt(snr)} — too shallow or too few transits.`;
      }
      add({ name: 'PLATO', technique: 'Transit photometry', status: 'Launch planned 2027', sc: 'soon', verdict: v, detail: d });
    }
    // ---- Ariel
    {
      let v = 'no', d;
      const T = p.Teq;
      if (T < 350) d = `Ariel focuses on warm and hot planets (T > ~350 K); this one is ≈${Math.round(T)} K.`;
      else if (TSM >= 150 || (r > 3 && TSM >= 90)) { v = 'yes'; d = `TSM = ${fmt(TSM)}: a good survey target ${transitNote}.`; }
      else if (TSM >= 40) { v = 'maybe'; d = `TSM = ${fmt(TSM)}: needs many stacked transits.`; }
      else d = `TSM = ${fmt(TSM)} is too low for Ariel's 1-m-class aperture.`;
      add({ name: 'Ariel', technique: 'Transit spectroscopy', status: 'Launch planned 2029', sc: 'soon', verdict: v, detail: d, refs: ['ARIEL'] });
    }
    // ---- VLT RISTRETTO
    {
      let v = 'no', d;
      if (sep < 0.035) d = `Separation ${fmt(sepMas)} mas is below ~2 λ/D at the VLT.`;
      else if (ph.I > 10) d = `Host too faint (I = ${fmt(ph.I)}) for the extreme-AO + high-resolution technique.`;
      else { v = cRefl >= 1e-7 ? 'yes' : cRefl >= 3e-8 ? 'maybe' : 'no'; d = `Reflected-light contrast ${fmtC(cRefl)} at ${fmt(sepMas)} mas (Proxima b, the design case, is ~10⁻⁷).`; }
      add({ name: 'VLT / RISTRETTO', technique: 'High-contrast + high-res spectroscopy', status: 'In development (late 2020s)', sc: 'soon', verdict: v, detail: d });
    }
    // ---- ELT METIS
    {
      let v = 'no', d;
      const okN = sep >= 0.1, okL = sep >= 0.04;
      if (!okL) d = `Separation ${fmt(sepMas)} mas is inside METIS's inner working angle.`;
      else {
        const yesN = okN && c10 >= 3e-7 && ph.K < 7, mayN = okN && c10 >= 1e-7 && ph.K < 8;
        const yesL = c38 >= 1e-6, mayL = c38 >= 2e-7;
        v = yesN || yesL ? 'yes' : mayN || mayL ? 'maybe' : 'no';
        d = `Thermal contrast ${fmtC(c10)} at 10 µm${okN ? '' : ' (inside N-band IWA)'}, ${fmtC(c38)} at 3.8 µm, separation ${fmt(sepMas)} mas.`;
      }
      add({ name: 'ELT / METIS', technique: 'Mid-IR imaging', status: 'ELT first light ~2029; science ~2030', sc: 'future', verdict: v, detail: d, refs: ['ELT'] });
    }
    // ---- ELT ANDES
    {
      let v = 'no', d;
      if (sep < 0.012) d = `Separation ${fmt(sepMas)} mas is too small even for the 39-m ELT.`;
      else if (ph.I > 11) d = `Host too faint (I = ${fmt(ph.I)}).`;
      else { v = cRefl >= 5e-8 ? 'yes' : cRefl >= 1e-8 ? 'maybe' : 'no'; d = `Reflected-light contrast ${fmtC(cRefl)} at ${fmt(sepMas)} mas; ANDES aims at a "golden sample" of nearby temperate rocky planets (tens of nights each).`; }
      if (v === 'no' && transitProb > 0 && p.hasAtm && TSM > 5 && ph.J < 11) { v = 'maybe'; d += ` Alternatively, high-resolution transmission spectroscopy ${transitNote}.`; }
      add({ name: 'ELT / ANDES', technique: 'High-res reflected light', status: 'Planned (early 2030s)', sc: 'future', verdict: v, detail: d, refs: ['ANDES'] });
    }
    // ---- ELT PCS
    {
      let v = 'no', d;
      if (sep < 0.012) d = `Separation ${fmt(sepMas)} mas is too small.`;
      else { v = cRefl >= 1e-9 ? 'yes' : cRefl >= 3e-10 ? 'maybe' : 'no'; d = `Needs ~10⁻⁹ contrast at 10–20 mas; this planet: ${fmtC(cRefl)} at ${fmt(sepMas)} mas.`; }
      add({ name: 'ELT / PCS', technique: 'Extreme-AO imaging', status: 'Concept (late 2030s)', sc: 'future', verdict: v, detail: d });
    }
    // ---- HWO
    {
      let v = 'no', d;
      if (sep < 0.055) d = `Separation ${fmt(sepMas)} mas is inside the ~55 mas inner working angle (3 λ/D at 0.5 µm, 6 m).`;
      else if (sep > 1.5) d = 'Wider than the coronagraph dark hole, but imageable with other modes.';
      else if (Vp > 31.5) d = `Planet too faint (V ≈ ${fmt(Vp)}).`;
      else { v = cRefl >= 1e-10 ? 'yes' : cRefl >= 3e-11 ? 'maybe' : 'no'; d = `Contrast ${fmtC(cRefl)}, planet V ≈ ${fmt(Vp)}. HWO's goal: image and take spectra of Earth twins (10⁻¹⁰) to search for O₂, O₃, H₂O and CH₄.`; }
      add({ name: 'Habitable Worlds Observatory', technique: 'UV–optical–NIR coronagraphy', status: 'In development (launch 2040s)', sc: 'future', verdict: v, detail: d, refs: ['HWO'] });
    }
    // ---- LIFE
    {
      let v = 'no', d;
      if (dpc > 25) d = 'Beyond LIFE’s ~20 pc survey volume.';
      else if (sep < 0.008) d = `Separation ${fmt(sepMas)} mas is too small for the interferometer baselines.`;
      else { v = flux10uJy >= 0.1 ? 'yes' : flux10uJy >= 0.03 ? 'maybe' : 'no'; d = `Thermal flux ≈ ${fmt(flux10uJy)} µJy at 10 µm (an Earth twin at 10 pc gives ~0.2 µJy). Mid-IR spectra would probe CO₂, H₂O, O₃ and surface temperature.`; }
      add({ name: 'LIFE', technique: 'Mid-IR nulling interferometry', status: 'Proposed concept', sc: 'concept', verdict: v, detail: d, refs: ['LIFE'] });
    }
    // ---- Radio
    {
      const m = p.magnetic;
      let v = 'no', d;
      if (!m.present || !m.cyclotronMHz) d = 'No magnetic field → no auroral radio emission.';
      else if (m.cyclotronMHz < 10) d = `Cyclotron cut-off ≈ ${fmt(m.cyclotronMHz)} MHz is below Earth's ~10 MHz ionospheric limit.`;
      else {
        const strongDrive = p.a < 0.1 || m.B > 20;
        v = dpc < 20 && strongDrive ? 'maybe' : 'no';
        d = `Auroral emission up to ≈${fmt(m.cyclotronMHz)} MHz${v === 'maybe' ? ' — a possible LOFAR / NenuFAR / SKA-Low target (no exoplanet confirmed yet)' : '; probably too faint at this distance'}. A detection would measure the field directly.`;
      }
      add({ name: 'Radio arrays', sub: 'LOFAR, NenuFAR, SKA-Low', technique: 'Auroral radio emission', status: 'Operating / SKA under construction', sc: 'op', verdict: v, detail: d, refs: ['Z07'] });
    }
    return { basics, instruments: out };
  };
  EXO.photometry = photometry;
})(typeof window !== 'undefined' ? window : globalThis);
