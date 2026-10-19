/* Seeded random number generation.
 * Every planet is fully determined by its seed string, so a URL like
 * #seed=K7QF2M9A reproduces exactly the same star, planet and image. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});

  // String hash -> 32-bit state (xmur3), then a small fast PRNG (mulberry32).
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RNG {
    constructor(seed) {
      this.seed = String(seed);
      this._next = mulberry32(xmur3(this.seed)());
      // burn a few values so similar seeds decorrelate
      for (let i = 0; i < 4; i++) this._next();
    }
    random() { return this._next(); }
    uniform(a, b) { return a + (b - a) * this._next(); }
    int(a, b) { return Math.floor(this.uniform(a, b + 1)); }
    normal(mu = 0, s = 1) {
      let u = 0;
      while (u === 0) u = this._next();
      const v = this._next();
      return mu + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    logUniform(a, b) { return Math.exp(this.uniform(Math.log(a), Math.log(b))); }
    logNormal10(mu10, s10) { return Math.pow(10, this.normal(mu10, s10)); }
    chance(p) { return this._next() < p; }
    pick(arr) { return arr[Math.floor(this._next() * arr.length)]; }
    // weights: {key: weight}
    weighted(weights) {
      const keys = Object.keys(weights);
      let tot = 0;
      for (const k of keys) tot += weights[k];
      let r = this._next() * tot;
      for (const k of keys) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return keys[keys.length - 1];
    }
    gamma(k) {
      // Marsaglia & Tsang
      if (k < 1) return this.gamma(k + 1) * Math.pow(this._next(), 1 / k);
      const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        let x, v;
        do { x = this.normal(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = this._next();
        if (u < 1 - 0.0331 * x * x * x * x) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
      }
    }
    beta(a, b) {
      const x = this.gamma(a), y = this.gamma(b);
      return x / (x + y);
    }
    rayleigh(sigma) {
      return sigma * Math.sqrt(-2 * Math.log(1 - this._next()));
    }
    fork(label) { return new RNG(this.seed + '|' + label); }
  }

  const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomSeed() {
    let s = '';
    const buf = new Uint32Array(8);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(buf);
    else for (let i = 0; i < 8; i++) buf[i] = Math.floor(Math.random() * 4294967296);
    for (let i = 0; i < 8; i++) s += SEED_CHARS[buf[i] % SEED_CHARS.length];
    return s;
  }

  EXO.RNG = RNG;
  EXO.randomSeed = randomSeed;
  EXO.hashSeed = (s) => xmur3(String(s))(); // first 32-bit state, as RNG uses it
})(typeof window !== 'undefined' ? window : globalThis);
