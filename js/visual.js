/* Maps a physical planet to shader parameters (surface mode, palette, clouds,
 * atmosphere glow, thermal emission, rings, spin). Colours are sRGB 0..1. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // inverse normal CDF (Acklam's approximation)
  function probit(p) {
    p = clamp(p, 1e-4, 1 - 1e-4);
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const q = p < 0.5 ? p : 1 - p;
    let x;
    if (q < 0.02425) {
      const r = Math.sqrt(-2 * Math.log(q));
      x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
    } else {
      const r = q - 0.5, s = r * r;
      x = (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
      return p < 0.5 ? x : -x;
    }
    return p < 0.5 ? -x : x;
  }
  const mix = (u, v, t) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t];
  const scale = (u, s) => [u[0] * s, u[1] * s, u[2] * s];

  function pickPal(roll, pals) { return pals[Math.min(pals.length - 1, Math.floor(roll * pals.length))]; }

  EXO.makeVisual = function (p, star) {
    const init = p.init, roll = init.paletteRoll;
    const v = {
      mode: 0, c: [[0.4, 0.4, 0.4], [0.5, 0.5, 0.5], [0.6, 0.6, 0.6], [0.7, 0.7, 0.7], [0.9, 0.9, 0.9]],
      oceanLevel: -2, lockedIce: 0, iceThr: 2, cloudCover: 0, cloudCol: [1, 1, 1],
      atmCol: [0.35, 0.55, 1.0], atmThick: 0, bandFreq: 8, bandContrast: 0.5, turb: 0.5,
      glowCol: [1, 0.4, 0.1], glowAmt: 0, glowDay: 1, hasRing: false, ringIn: 1.3, ringOut: 2.2,
      ringCol: [0.85, 0.8, 0.7], ringOpacity: 0.7, seed: init.visSeed, crater: 0,
      spot: [0, 0, 0, 0], spotCol: [0.7, 0.35, 0.2], haze: 0, hazeCol: [0.8, 0.6, 0.3]
    };
    v.starCol = EXO.blackbodyRGB(star.teff);
    const s = p.state;
    const T = p.Tsurf || p.Tday || p.Teq;

    switch (s) {
      case 'airless':
      case 'hot-rock': {
        v.mode = 0;
        const pal = pickPal(roll, [
          [[0.30, 0.29, 0.28], [0.55, 0.53, 0.50]],
          [[0.22, 0.21, 0.20], [0.40, 0.37, 0.34]],
          [[0.42, 0.31, 0.24], [0.62, 0.50, 0.40]],
          [[0.35, 0.33, 0.30], [0.66, 0.62, 0.56]]
        ]);
        if (p.cmf > 0.5) pal[0] = scale(pal[0], 0.7);
        v.c[0] = pal[0]; v.c[1] = pal[1]; v.c[2] = mix(pal[0], pal[1], 0.5);
        v.crater = 1;
        break;
      }
      case 'lava':
      case 'chthonian': {
        v.mode = 1;
        v.c[0] = [0.07, 0.055, 0.05]; v.c[1] = [0.2, 0.15, 0.13];
        break;
      }
      case 'temperate': {
        v.mode = 2;
        v.c[0] = [0.03, 0.1, 0.27];
        v.c[1] = pickPal(roll, [[0.45, 0.38, 0.28], [0.42, 0.40, 0.37], [0.55, 0.36, 0.23], [0.5, 0.44, 0.33]]);
        v.c[2] = mix(v.c[1], [0.6, 0.55, 0.5], 0.5);
        v.c[3] = [0.62, 0.6, 0.58];
        v.c[4] = [0.93, 0.96, 1.0];
        v.oceanLevel = 0.27 * probit(clamp(p.oceanCover, 0.02, 0.98));
        v.cloudCover = clamp(0.33 + (T - 280) * 0.005, 0.22, 0.65);
        v.atmThick = clamp(0.35 + 0.15 * Math.log10(p.Psurf || 1), 0.15, 0.9);
        v.atmCol = [0.35, 0.55, 1.0];
        if (p.lockedClimate) { v.lockedIce = 1; v.iceThr = p.lockedClimate === 'eyeball' ? clamp(0.12 + (T - 250) * 0.008, 0.08, 0.45) : 0.75; }
        else v.iceThr = clamp(0.85 + (T - 288) * 0.012, 0.35, 1.05);
        break;
      }
      case 'ocean': {
        v.mode = 7;
        v.c[0] = [0.02, 0.07, 0.21]; v.c[1] = [0.04, 0.16, 0.32]; v.c[4] = [0.92, 0.95, 1.0];
        v.cloudCover = clamp(0.5 + (T - 280) * 0.006, 0.4, 0.85);
        v.atmThick = clamp(0.4 + 0.15 * Math.log10(p.Psurf || 1), 0.2, 0.9);
        if (p.locked) { v.lockedIce = 1; v.iceThr = clamp(0.2 + (T - 260) * 0.01, 0.1, 0.8); }
        else v.iceThr = clamp(0.85 + (T - 288) * 0.012, 0.35, 1.05);
        break;
      }
      case 'hycean': {
        v.mode = 7;
        v.c[0] = [0.03, 0.14, 0.26]; v.c[1] = [0.06, 0.24, 0.36]; v.c[4] = [0.9, 0.95, 1.0];
        v.cloudCover = 0.3; v.iceThr = 1.1;
        v.haze = 0.55; v.hazeCol = [0.55, 0.78, 0.88];
        v.atmThick = 0.9; v.atmCol = [0.45, 0.75, 1.0];
        break;
      }
      case 'desert': {
        v.mode = 3;
        const pal = pickPal(roll, [
          [[0.62, 0.35, 0.2], [0.42, 0.24, 0.15], [0.76, 0.56, 0.4]],
          [[0.5, 0.45, 0.38], [0.34, 0.31, 0.27], [0.66, 0.6, 0.52]],
          [[0.78, 0.72, 0.6], [0.58, 0.5, 0.4], [0.88, 0.85, 0.78]],
          [[0.55, 0.42, 0.3], [0.38, 0.28, 0.2], [0.7, 0.6, 0.48]]
        ]);
        v.c[0] = pal[0]; v.c[1] = pal[1]; v.c[2] = pal[2]; v.c[4] = [0.95, 0.95, 0.97];
        v.iceThr = T < 250 ? 0.82 : T < 270 ? 0.92 : 1.1;
        v.cloudCover = 0.06;
        v.atmThick = clamp(0.25 + 0.2 * Math.log10((p.Psurf || 0.01) * 10), 0.05, 0.7);
        v.atmCol = (p.Psurf || 0) < 0.05 ? [0.9, 0.62, 0.45] : [0.5, 0.6, 0.95];
        break;
      }
      case 'snowball':
      case 'ice-world': {
        v.mode = 4;
        const pal = pickPal(roll, [
          [[0.86, 0.9, 0.95], [0.7, 0.78, 0.88], [0.55, 0.38, 0.28]],
          [[0.9, 0.92, 0.94], [0.78, 0.82, 0.86], [0.42, 0.55, 0.7]],
          [[0.82, 0.86, 0.9], [0.62, 0.7, 0.8], [0.5, 0.42, 0.38]]
        ]);
        v.c[0] = pal[0]; v.c[1] = pal[1]; v.c[2] = pal[2];
        v.atmThick = p.hasAtm ? clamp(0.25 + 0.15 * Math.log10(p.Psurf || 0.1), 0.05, 0.6) : 0;
        v.atmCol = [0.45, 0.62, 1.0];
        if (p.atm && p.atm.type === 'h2-thin') { v.haze = 0.4; v.hazeCol = [0.65, 0.8, 0.9]; v.atmThick = 0.8; }
        break;
      }
      case 'venus': {
        v.mode = 5;
        v.c[0] = [0.93, 0.86, 0.66]; v.c[1] = [0.8, 0.69, 0.48];
        v.atmThick = 1.0; v.atmCol = [0.98, 0.88, 0.62];
        v.turb = 0.6;
        break;
      }
      case 'venus-hot': {
        v.mode = 5;
        v.c[0] = [0.45, 0.36, 0.3]; v.c[1] = [0.32, 0.25, 0.21];
        v.atmThick = 0.9; v.atmCol = [0.9, 0.7, 0.5];
        break;
      }
      case 'steam': {
        v.mode = 5;
        v.c[0] = [0.9, 0.91, 0.93]; v.c[1] = [0.74, 0.78, 0.83];
        v.atmThick = 1.0; v.atmCol = [0.75, 0.85, 1.0];
        v.turb = 0.8;
        break;
      }
      case 'titan': {
        v.mode = 8;
        v.c[0] = [0.8, 0.53, 0.22]; v.c[1] = [0.62, 0.39, 0.16];
        v.atmThick = 1.0; v.atmCol = [0.9, 0.6, 0.3];
        v.haze = 1; v.hazeCol = [0.85, 0.58, 0.28];
        break;
      }
      default: {
        // banded envelopes: giants, neptunes, sub-Neptunes, super-puffs
        v.mode = 6;
        v.atmThick = 0.6;
        v.bandFreq = p.regime === 'giant' ? 6 + Math.round(roll * 8) : 3 + Math.round(roll * 4);
        v.turb = 0.35 + 0.5 * init.spotRoll;
        let pal, spotCol = null;
        const Tp = p.Teff || p.Teq;
        switch (s) {
          case 'giant-ammonia':
            pal = roll < 0.55
              ? [[0.88, 0.82, 0.7], [0.74, 0.58, 0.42], [0.55, 0.38, 0.25], [0.95, 0.93, 0.88]]
              : [[0.88, 0.8, 0.6], [0.8, 0.7, 0.5], [0.7, 0.6, 0.42], [0.93, 0.87, 0.7]];
            v.bandContrast = 0.75; spotCol = [0.75, 0.38, 0.22]; v.atmCol = [0.7, 0.75, 1.0];
            break;
          case 'giant-water':
            pal = [[0.95, 0.95, 0.97], [0.84, 0.86, 0.9], [0.76, 0.79, 0.86], [0.99, 0.99, 1.0]];
            v.bandContrast = 0.35; spotCol = [0.7, 0.75, 0.85]; v.atmCol = [0.7, 0.82, 1.0];
            break;
          case 'giant-clear':
            pal = [[0.3, 0.5, 0.86], [0.24, 0.41, 0.76], [0.38, 0.58, 0.92], [0.46, 0.66, 0.96]];
            v.bandContrast = 0.35; spotCol = [0.18, 0.3, 0.6]; v.atmCol = [0.4, 0.6, 1.0];
            break;
          case 'giant-alkali':
            pal = roll < 0.5
              ? [[0.15, 0.25, 0.55], [0.11, 0.18, 0.42], [0.2, 0.32, 0.62], [0.25, 0.36, 0.66]]
              : [[0.2, 0.2, 0.28], [0.15, 0.15, 0.22], [0.26, 0.25, 0.33], [0.32, 0.3, 0.38]];
            v.bandContrast = 0.3; v.atmCol = [0.35, 0.5, 0.9];
            break;
          case 'giant-silicate':
            pal = [[0.55, 0.48, 0.45], [0.43, 0.36, 0.33], [0.65, 0.57, 0.52], [0.7, 0.62, 0.55]];
            v.bandContrast = 0.45; v.atmCol = [0.8, 0.6, 0.45];
            break;
          case 'giant-ultrahot':
            pal = [[0.32, 0.18, 0.1], [0.25, 0.13, 0.07], [0.4, 0.24, 0.13], [0.46, 0.3, 0.18]];
            v.bandContrast = 0.3; v.atmCol = [1.0, 0.6, 0.35];
            break;
          case 'ice-giant':
            pal = roll < 0.5
              ? [[0.62, 0.86, 0.9], [0.55, 0.8, 0.86], [0.7, 0.9, 0.94], [0.75, 0.93, 0.96]]
              : [[0.28, 0.45, 0.85], [0.22, 0.38, 0.75], [0.4, 0.58, 0.92], [0.85, 0.9, 1.0]];
            v.bandContrast = 0.2; spotCol = [0.12, 0.2, 0.45]; v.atmCol = [0.5, 0.8, 1.0];
            break;
          case 'warm-neptune':
            pal = [[0.55, 0.62, 0.64], [0.45, 0.53, 0.56], [0.65, 0.7, 0.7], [0.72, 0.76, 0.75]];
            v.bandContrast = 0.25; v.atmCol = [0.55, 0.7, 0.9];
            break;
          case 'hot-neptune':
            pal = [[0.3, 0.27, 0.3], [0.24, 0.21, 0.25], [0.38, 0.33, 0.36], [0.45, 0.4, 0.42]];
            v.bandContrast = 0.25; v.atmCol = [0.7, 0.55, 0.6];
            break;
          case 'super-puff':
            pal = [[0.82, 0.68, 0.5], [0.72, 0.58, 0.42], [0.9, 0.78, 0.6], [0.95, 0.85, 0.7]];
            v.bandContrast = 0.2; v.haze = 0.6; v.hazeCol = [0.85, 0.7, 0.5]; v.atmThick = 1.0; v.atmCol = [0.95, 0.8, 0.6];
            break;
          default: // sub-neptune
            if (Tp < 380) pal = [[0.62, 0.72, 0.82], [0.54, 0.64, 0.77], [0.7, 0.78, 0.86], [0.78, 0.84, 0.9]];
            else if (Tp < 900) pal = [[0.75, 0.68, 0.55], [0.64, 0.57, 0.46], [0.82, 0.76, 0.64], [0.86, 0.8, 0.7]];
            else pal = [[0.35, 0.32, 0.38], [0.28, 0.25, 0.31], [0.42, 0.38, 0.44], [0.5, 0.45, 0.5]];
            v.bandContrast = 0.22; v.haze = 0.35 + 0.4 * ((p.atm && p.atm.haze) || 0);
            v.hazeCol = mix(pal[0], [0.9, 0.85, 0.75], 0.4); v.atmCol = Tp < 380 ? [0.5, 0.75, 1.0] : [0.85, 0.75, 0.6];
        }
        v.c[0] = pal[0]; v.c[1] = pal[1]; v.c[2] = pal[2]; v.c[3] = pal[3];
        if (spotCol && init.spotRoll < 0.6) {
          v.spot = [(init.spotRoll - 0.3) * 1.4, init.paletteRoll * 6.28, 0.12 + 0.1 * init.spotRoll, 1];
          v.spotCol = spotCol;
        }
        if (s === 'chthonian') { v.mode = 1; }
      }
    }

    // thermal glow from hot surfaces/atmospheres
    const Thot = Math.max(p.Tday || 0, p.Teff || 0);
    if (s === 'lava' || s === 'chthonian') {
      const Tm = Math.max(1300, p.Tsubstellar || p.Tday || 1500);
      v.glowCol = EXO.blackbodyRGB(Math.min(Tm, 2600));
      v.glowAmt = clamp(0.6 + (Tm - 1300) / 1200, 0.6, 2.0);
      v.glowDay = p.locked ? 1 : 0.2;
    } else if (Thot > 800) {
      v.glowCol = EXO.blackbodyRGB(Math.min(Thot, 3500));
      v.glowAmt = clamp(Math.pow((Thot - 800) / 1600, 1.5), 0, 1.1);
      v.glowDay = p.locked ? 0.92 : (p.regime === 'giant' ? 0.5 : 0.2);
    }
    if (s === 'venus-hot' && Thot < 800) { v.glowCol = EXO.blackbodyRGB(1000); v.glowAmt = 0.05; v.glowDay = 0; }
    if (p.Tint && p.Tint > 600 && p.Tint > p.Teq && p.regime === 'giant') { v.glowCol = EXO.blackbodyRGB(Math.min(p.Teff, 3000)); v.glowAmt = Math.max(v.glowAmt, clamp((p.Teff - 600) / 1500, 0.1, 1.5)); v.glowDay = 0; }

    // rings: icy material beyond the frost line, mostly around giants
    const ringChance = (p.regime === 'giant' || p.kind === 'neptune') ? (p.a > p.frostLine ? 0.4 : 0.06) : (p.regime === 'envelope' ? 0.04 : 0.01);
    if (init.ringRoll < ringChance) {
      v.hasRing = true;
      const icy = p.a > p.frostLine;
      v.ringIn = 1.25 + 0.3 * init.spotRoll;
      v.ringOut = v.ringIn + 0.6 + 0.9 * init.paletteRoll;
      v.ringCol = icy ? [0.88, 0.84, 0.76] : [0.45, 0.4, 0.36];
      v.ringOpacity = icy ? 0.75 : 0.35;
    }

    // spin rendering: real period mapped to a watchable rate
    v.tiltDeg = p.obliquity;
    v.locked = p.locked && p.spinState === 'synchronous';
    const realH = v.locked ? p.period * 24 : Math.abs(p.protDays) * 24;
    v.spinPeriodVis = clamp(28 * Math.pow(realH / 24, 0.28), 14, 110);
    if (v.locked) v.spinPeriodVis = clamp(36 * Math.pow(p.period / 10, 0.2), 22, 90);
    return v;
  };
})(typeof window !== 'undefined' ? window : globalThis);
