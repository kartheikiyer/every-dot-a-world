// Sanity tests for the physical model: run with `node tools/test-model.js`
const path = require('path');
for (const f of ['rng', 'data', 'model', 'visual', 'observe', 'spectrum', 'surface']) {
  try { require(path.join(__dirname, '..', 'js', f + '.js')); } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; }
}
const EXO = globalThis.EXO;
const fmt = EXO.fmt.num;

function checkFinite(obj, pathStr, bad) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'number') { if (Number.isNaN(obj)) bad.push(pathStr); return; }
  if (Array.isArray(obj)) { obj.forEach((x, i) => checkFinite(x, pathStr + '[' + i + ']', bad)); return; }
  if (typeof obj === 'object') for (const k of Object.keys(obj)) { if (k === 'notes' || k === 'init') continue; checkFinite(obj[k], pathStr + '.' + k, bad); }
}

// ---------- reference worlds
const sun = { mass: 1, age: 4.57, feh: 0, tMS: 10 };
const earth = EXO.customSystem(sun, { kind: 'small', P: 365.25, coreMass: 1.0, cmf: 0.32, wmf: 2.3e-4, fEnv0: 0, e: 0.017, prot0: 12 }, 'earth');
const venus = EXO.customSystem(sun, { kind: 'small', P: 224.7, coreMass: 0.815, cmf: 0.32, wmf: 1e-5, fEnv0: 0, e: 0.007, prot0: 12 }, 'venus');
const mars = EXO.customSystem(sun, { kind: 'small', P: 687, coreMass: 0.107, cmf: 0.25, wmf: 1e-5, fEnv0: 0, e: 0.09, prot0: 24 }, 'mars');
const jup = EXO.customSystem(sun, { kind: 'giant', a: 5.2, mass: 317.8, e: 0.048, prot0: 10 }, 'jup');
const hj = EXO.customSystem({ mass: 0.9, age: 5, feh: 0.1 }, { kind: 'giant', P: 2.2, mass: 360, e: 0, prot0: 10 }, 'hj');
const trap = EXO.customSystem({ mass: 0.09, age: 7.6, feh: 0.04 }, { kind: 'small', P: 1.51, coreMass: 1.37, cmf: 0.3, wmf: 1e-4, fEnv0: 0 }, 'trapb');
const proxb = EXO.customSystem({ mass: 0.122, age: 4.8, feh: 0.2 }, { kind: 'small', P: 11.19, coreMass: 1.07, cmf: 0.32, wmf: 3e-4, fEnv0: 0 }, 'proxb');
const k218 = EXO.customSystem({ mass: 0.5, age: 2.4, feh: 0.1 }, { kind: 'small', P: 33, coreMass: 8, cmf: 0.3, wmf: 0.3, fEnv0: 0.03 }, 'k218');
for (const [nm, s] of [['Earth', earth], ['Venus', venus], ['Mars', mars], ['Jupiter', jup], ['Hot Jupiter', hj], ['TRAPPIST-1b-like', trap], ['Proxima b-like', proxb], ['K2-18b-like', k218]]) {
  const p = s.planet;
  console.log(`${nm.padEnd(18)} state=${p.state.padEnd(15)} R=${fmt(p.radius)} M=${fmt(p.mass)} S=${fmt(p.S)} Teq=${Math.round(p.Teq)} Ts=${p.Tsurf ? Math.round(p.Tsurf) : '-'} P=${p.Psurf ? fmt(p.Psurf) : '-'} locked=${p.locked} B=${fmt(p.magnetic.B)}G hab=${p.habitability.index} ESI=${p.habitability.esi.toFixed(2)} pAtm=${p.shoreline ? p.shoreline.pAtm.toFixed(2) : '-'}`);
  console.log(`${''.padEnd(18)} star ${s.star.spt} Teff=${Math.round(s.star.teff)} L=${fmt(s.star.lum)} R=${fmt(s.star.radius)}; analogs: ${EXO.findAnalogs(p, s.star).map((x) => x.an.name + ' ' + x.sim + '%').join(', ')}`);
}

// ---------- population runs
for (const mode of ['realistic', 'interesting']) {
  const counts = {}, bad = [];
  let nHab = 0;
  const radii = [];
  const t0 = Date.now();
  const N = mode === 'realistic' ? 3000 : 400;
  for (let i = 0; i < N; i++) {
    const seed = 'T' + i;
    let sys;
    try { sys = EXO.generate(seed, mode); } catch (e) { console.error('ERROR seed', seed, e); process.exit(1); }
    const b = [];
    checkFinite(sys.planet, 'planet', b); checkFinite(sys.star, 'star', b);
    if (b.length) bad.push([seed, b.slice(0, 5)]);
    counts[sys.planet.state] = (counts[sys.planet.state] || 0) + 1;
    if (sys.planet.habitability.index >= 55) nHab++;
    if (sys.planet.kind === 'small' && sys.planet.period < 100 && sys.planet.radius < 4 && (sys.star.cls === 'G' || sys.star.cls === 'K' || sys.star.cls === 'F')) radii.push(sys.planet.radius);
    if (EXO.observe) EXO.observe(sys, 10);
    if (EXO.spectrum) EXO.spectrum(sys, 'transmission');
  }
  console.log(`\n== ${mode}: ${N} planets in ${Date.now() - t0} ms; potentially habitable: ${nHab}`);
  console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
  if (bad.length) { console.log('NaN fields:', JSON.stringify(bad.slice(0, 8))); }
  if (radii.length) {
    const bins = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4];
    const h = new Array(bins.length - 1).fill(0);
    for (const r of radii) for (let j = 0; j < bins.length - 1; j++) if (r >= bins[j] && r < bins[j + 1]) h[j]++;
    console.log('FGK P<100d radius histogram (radius valley check):');
    h.forEach((c, j) => console.log(`  ${bins[j].toFixed(2)}-${bins[j + 1].toFixed(2)} ${'#'.repeat(Math.round(c / Math.max(...h) * 40))} ${c}`));
  }
}
