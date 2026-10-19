/* Shared URL state and system building, used by the guide (main.js) and the
 * flowchart page (flow.js) so both always show exactly the same planet.
 * Hash format: #seed=…&mode=interesting|realistic&d=…&view=key&p=s.mass:0.42,i.P:12.5 */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});

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

  function readHash(hash) {
    const q = new URLSearchParams((hash || '').replace(/^#/, ''));
    return {
      seed: q.get('seed'),
      mode: q.get('mode') === 'realistic' ? 'realistic' : 'interesting',
      d: Math.min(100, Math.max(1, parseFloat(q.get('d')) || 10)),
      view: q.get('view') === 'key' ? 'key' : 'guide',
      over: parseOverrides(q.get('p'))
    };
  }
  function hashOf(state, withView) {
    let h = `#seed=${encodeURIComponent(state.seed)}&mode=${state.mode}&d=${+(+state.d).toFixed(2)}`;
    if (withView && state.view === 'key') h += '&view=key';
    if (hasOverrides(state.over)) h += `&p=${formatOverrides(state.over)}`;
    return h;
  }

  // The seed's draw, optionally re-derived from edited inputs. Returns { base, sys, custom }.
  function build(seed, mode, over) {
    const base = EXO.generate(seed, mode);
    if (!hasOverrides(over)) return { base, sys: base, custom: false };
    const s = base.star;
    let spec;
    if (s.isWD) spec = Object.assign({}, s);
    else {
      spec = { mass: s.mass, age: s.age, feh: s.feh, cls: s.cls, tMS: s.tMS };
      Object.assign(spec, over.star);
      if ('mass' in over.star) { delete spec.cls; spec.tMS = 10 * Math.pow(spec.mass, -2.5); }
    }
    spec.name = s.name;
    const init = Object.assign({}, base.planet.init, over.init, { name: base.planet.name });
    const c = EXO.customSystem(spec, init, `${seed}#${base.index}`);
    return { base, sys: Object.assign(c, { seed, mode, considered: base.considered, index: base.index }), custom: true };
  }

  EXO.state = { parseOverrides, formatOverrides, hasOverrides, readHash, hashOf, build };
})(typeof window !== 'undefined' ? window : globalThis);
