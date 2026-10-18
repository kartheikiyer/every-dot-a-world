/* Simulated low-resolution spectra.
 * Transmission: analytic effective altitude z(λ) = H ln(σ(λ) n₀ √(2πR_pH) / τ_eq)
 *   (Lecavelier des Etangs et al. 2008), with clouds/surface as a floor.
 * Emission: brightness temperature of the τ=1 level on a parametric T–P profile,
 *   plus reflected light. Noise follows rough JWST NIRSpec/MIRI precisions. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const { C } = EXO;

  function xsec(mol, lam) {
    const bands = EXO.MOLBANDS[mol];
    if (!bands) return 0;
    let s = 0;
    for (const b of bands) {
      const x = Math.log(lam / b[0]) / b[1];
      if (Math.abs(x) < 6) s += Math.pow(10, b[2]) * Math.exp(-0.5 * x * x);
    }
    return s;
  }

  function sigmaTot(lam, vmr, Pref, haze, ultraHot, skip) {
    let s = 0, ray = 0;
    for (const m in vmr) {
      if (m === skip) continue;
      const x = vmr[m];
      s += x * xsec(m, lam);
      ray += x * (EXO.RAYLEIGH[m] !== undefined ? EXO.RAYLEIGH[m] : 0.8);
    }
    s += 5.0e-27 * ray * Math.pow(0.55 / lam, 4);
    const h2 = vmr.H2 || 0;
    if (h2 > 0.1) {
      const cia = Math.exp(-0.5 * Math.pow(Math.log(lam / 2.35) / 0.18, 2)) + 0.6 * Math.exp(-0.5 * Math.pow(Math.log(lam / 1.2) / 0.12, 2)) + 0.12;
      s += h2 * h2 * Math.min(Pref, 10) * 4e-26 * cia;
    }
    if ((vmr.N2 || 0) > 0.3 && Pref > 0.3) s += (vmr.N2 * vmr.N2) * Math.min(Pref, 100) * 3e-27 * Math.exp(-0.5 * Math.pow(Math.log(lam / 4.3) / 0.03, 2));
    if (haze > 0) s += haze * 4e-25 * Math.pow(0.55 / lam, 1.6);
    if (ultraHot) s += 2e-24; // H⁻ bound–free/free–free continuum
    return s + 1e-32;
  }

  const NPTS = 420, LMIN = 0.5, LMAX = 16;
  const LAM = [];
  for (let i = 0; i < NPTS; i++) LAM.push(LMIN * Math.pow(LMAX / LMIN, i / (NPTS - 1)));
  EXO.SPEC_LAM = LAM;

  function transmissionCurve(sys, skip) {
    const s = sys.star, p = sys.planet, atm = p.atm;
    const Rs = s.radius * C.Rsun, Rp = p.radius * C.Re;
    const base = Math.pow(Rp / Rs, 2) * 1e6;
    if (!atm || atm.type === 'none' || !atm.H) return LAM.map(() => base);
    const H = atm.H;
    const solid = p.regime === 'solid' || p.regime === 'thinH2';
    const Pref = solid ? Math.max(atm.P || 1e-3, 1e-6) : 1;
    const nref = Pref * 1e6 / (C.kB * atm.Tup);
    const geo = nref * Math.sqrt(2 * Math.PI * Rp * H) / 0.56;
    const zFloor = solid ? 0 : -H * Math.log(10);
    const zCloud = atm.cloudTopP ? H * Math.log(Pref / atm.cloudTopP) : -Infinity;
    const ultraHot = p.state === 'giant-ultrahot';
    return LAM.map((lam) => {
      const sig = sigmaTot(lam, atm.vmr, Pref, atm.haze || 0, ultraHot, skip);
      let z = H * Math.log(sig * geo);
      z = Math.max(z, zFloor, zCloud);
      z = Math.min(z, 25 * H);
      return Math.pow((Rp + z) / Rs, 2) * 1e6;
    });
  }

  function emissionCurve(sys, skip) {
    const s = sys.star, p = sys.planet, atm = p.atm;
    const Rs = s.radius * C.Rsun, Rp = p.radius * C.Re, aCm = p.a * C.AU;
    const area = Math.pow(Rp / Rs, 2);
    const Ag = Math.max(0.03, Math.min(0.8, 1.15 * p.albedo + 0.03));
    const refl = Ag * Math.pow(Rp / aCm, 2) * 1e6;
    const Tday = Math.max(p.Tday || p.Teq, 30);
    const solid = p.regime === 'solid' || p.regime === 'thinH2';
    const B = EXO.planck;
    if (!atm || atm.type === 'none' || !atm.H) {
      return LAM.map((lam) => area * B(lam, Tday) / B(lam, s.teff) * 1e6 + refl);
    }
    const g = 981 * p.gravity;
    const inv = !!atm.inversion;
    const Psurf = solid ? Math.max(atm.P || 1e-3, 1e-6) : 100;
    const Pbot = solid ? Psurf : 10;
    const Ttop = inv ? 1.35 * Tday : 0.72 * Tday;
    const Tbot = solid ? (p.Tsurf ? Math.max(p.Tsurf, Tday * 0.9) : Tday) : 1.25 * Tday;
    const Ptop = 1e-4;
    const ultraHot = p.state === 'giant-ultrahot';
    const zc = atm.cloudTopP || null;
    return LAM.map((lam) => {
      const sig = sigmaTot(lam, atm.vmr, Math.min(Pbot, 1), atm.haze || 0, ultraHot, skip);
      let Pph = atm.mu * C.mH * g / sig / 1e6; // bar
      if (zc) Pph = Math.min(Pph, zc);
      Pph = Math.min(Pph, Pbot);
      const t = Math.max(0, Math.min(1, Math.log10(Pph / Ptop) / Math.log10(Pbot / Ptop)));
      const Tb = Ttop + (Tbot - Ttop) * t;
      return area * B(lam, Tb) / B(lam, s.teff) * 1e6 + refl;
    });
  }

  EXO.spectrum = function (sys, mode, distLy) {
    distLy = distLy || 10;
    const p = sys.planet, s = sys.star;
    const dpc = distLy / 3.26156;
    const ph = EXO.photometry(s, dpc);
    const isT = mode !== 'emission';
    const curve = isT ? transmissionCurve : emissionCurve;
    const full = curve(sys, null);
    const smallTemperate = p.radius < 2 && p.Teq < 500;
    // events observable in ~5 years (JWST can see a target ~1/3 of the time)
    const nPossible = Math.max(1, Math.floor(5 * 365.25 / p.period * 0.33));
    const nObs = Math.min(smallTemperate ? 10 : 4, nPossible);
    const mag = isT ? ph.J : ph.K;
    const saturated = mag < 4.5;
    const sig1 = isT ? Math.max(15, 60 * Math.pow(10, 0.2 * (mag - 9))) : Math.max(15, 45 * Math.pow(10, 0.2 * (mag - 8.5)));
    const noise = sig1 / Math.sqrt(nObs);
    const mols = [];
    if (p.atm && p.atm.vmr) {
      for (const m of Object.keys(p.atm.vmr)) {
        if (!EXO.MOLBANDS[m]) continue;
        const without = curve(sys, m);
        let amp = 0, at = 0;
        const diffs = LAM.map((_, i) => (isT ? full[i] - without[i] : Math.abs(full[i] - without[i])));
        for (let i = 0; i < LAM.length; i++) if (diffs[i] > amp) { amp = diffs[i]; at = LAM[i]; }
        // label the band where the feature itself peaks
        let best = -Infinity;
        for (let i = 0; i < LAM.length; i++) if (diffs[i] >= 0.7 * amp && full[i] > best) { best = full[i]; at = LAM[i]; }
        if (amp > 0.05) mols.push({ mol: m, vmr: p.atm.vmr[m], amp, at, verdict: amp >= 2 * noise ? 'yes' : amp >= noise ? 'maybe' : 'no', inJWST: at <= 12 || (at > 14 && at < 16) });
      }
    }
    mols.sort((a, b) => b.amp - a.amp);
    const yLabel = isT ? 'Transit depth (ppm)' : 'Planet / star flux (ppm)';
    return { lam: LAM, y: full, noise, nObs, nPossible, saturated, mols, yLabel, mode: isT ? 'transmission' : 'emission', mag };
  };
})(typeof window !== 'undefined' ? window : globalThis);
