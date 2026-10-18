/* "View from the surface": an artist's-impression scene built from the model.
 * Sky colour comes from Rayleigh scattering of the host star's spectrum by the
 * planet's actual atmosphere (column ∝ P/(μg)), or from haze/cloud decks;
 * the star is drawn at its true angular size; terrain follows the climate state. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lin = (c) => c.map((x) => Math.pow(Math.max(0, x), 2.2));
  const toS = (c) => c.map((x) => Math.pow(Math.max(0, x), 1 / 2.2));
  const mul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const normMax = (a, m) => { const k = Math.max(a[0], a[1], a[2], 1e-6); return scl(a, m / k); };
  const deg = Math.PI / 180;

  // ------------------------------------------------------------ scene parameters
  EXO.makeSurfaceScene = function (p, star) {
    const v = p.vis, s = p.state;
    const fmt = EXO.fmt.num;
    const starL = lin(normMax(EXO.blackbodyRGB(star.teff), 1));
    const W = [1.0, 1.52, 2.96]; // Rayleigh ∝ λ⁻⁴ at 610/550/465 nm, normalised to red
    const sc = {
      mode: 0, zen: [0, 0, 0], hor: [0, 0, 0], sunCol: starL, sunVis: 1, sunBright: 7, fog: 0.004, cloud: 0,
      cloudCol: [1, 1, 1], g: [v.c[0], v.c[1], v.c[2], v.c[3]], glowCol: v.glowCol, glowAmt: 0, mtn: 1,
      ring: v.hasRing, ringIn: v.ringIn, ringOut: v.ringOut, ringCol: v.ringCol, ringOp: v.ringOpacity,
      seed: v.seed, camH: 1.6, stars: 0
    };
    const envelope = !(p.regime === 'solid' || p.regime === 'thinH2');
    const atm = p.atm || { type: 'none', vmr: {} };
    // ---- Rayleigh sky
    let P = envelope ? 1 : (p.Psurf || 0);
    if (!p.hasAtm) P = 0;
    let polar = 0, tot = 0;
    for (const k in atm.vmr || {}) { polar += atm.vmr[k] * (EXO.RAYLEIGH[k] !== undefined ? EXO.RAYLEIGH[k] : 0.8); tot += atm.vmr[k]; }
    polar = tot ? polar / tot : 1;
    const mu = atm.mu || 29;
    const tauB = 0.3 * P * polar * (29 / mu) / Math.max(p.gravity, 0.05);
    const zen = [0, 1, 2].map((i) => starL[i] * (1 - Math.exp(-tauB * W[i] / W[2])));
    const hor = [0, 1, 2].map((i) => starL[i] * (1 - Math.exp(-tauB * W[i] / W[2] * 12)));
    const bright = clamp(tauB * 3, 0, 1);
    sc.zen = normMax(zen, 0.55 * bright);
    sc.hor = normMax(hor, (envelope ? 0.6 : 0.9) * Math.sqrt(bright));
    if (envelope) sc.zen = scl(sc.zen, 0.75);
    sc.fog = 0.0015 + 0.004 * Math.min(P, 5);
    let skyWords;
    if (P < 1e-3) skyWords = 'The sky is black even at noon, scattered with stars';
    else if (tauB < 0.01) skyWords = 'A thin atmosphere leaves the sky dark and star-flecked';
    else if (tauB < 0.08) skyWords = `The thin air scatters little light, leaving a deep, dark ${star.teff < 4200 ? 'violet-grey' : 'blue'} sky`;
    else if (tauB > 4) skyWords = 'The thick air turns the whole sky a pale, glaring white';
    else skyWords = `Rayleigh scattering of ${star.teff < 4200 ? 'the reddish starlight' : star.teff > 7000 ? 'the blue-white starlight' : 'the starlight'} gives a ${skyHue(sc.zen)} sky`;

    // ---- sun geometry
    const angDiam = 2 * star.radius * 0.00465 / p.a; // radians
    sc.sunSize = clamp(angDiam / 2, 0.0035, 0.5);
    let elev = 22, az = 22;
    const locked = p.locked && p.spinState === 'synchronous';
    if (locked) elev = (s === 'lava' || s === 'hot-rock' || p.Teq > 900) ? 50 : (p.surfaceLiquid ? 32 : 14);
    if (envelope) elev = 16;
    // square frame, ~76° field of view; tilt the camera up just enough to keep the star in view
    sc.k = Math.tan(38 * deg);
    sc.pitch = Math.max(7, elev - 21) * deg;
    sc.label = locked ? (elev > 40 ? 'eternal noon' : 'endless afternoon') : 'afternoon';
    sc.sunDir = [Math.sin(az * deg) * Math.cos(elev * deg), Math.sin(elev * deg), Math.cos(az * deg) * Math.cos(elev * deg)];

    // ---- per-state ground and special skies
    let groundWords = '';
    switch (s) {
      case 'airless': case 'hot-rock':
        sc.mode = 0; groundWords = 'Over grey, cratered regolith, shadows are razor-sharp with no air to soften them.'; break;
      case 'lava': case 'chthonian':
        sc.mode = 1; sc.glowAmt = Math.max(0.8, v.glowAmt); sc.g = [[0.06, 0.05, 0.045], [0.15, 0.12, 0.1], [0.25, 0.2, 0.17], [0.3, 0.25, 0.2]];
        groundWords = 'Fissures of molten rock glow through a crust of cooling basalt.';
        if (p.hasAtm && P > 0.5) { sc.fog = 0.02; sc.hor = normMax(mul(starL, [1, 0.6, 0.4]), 0.5); sc.zen = scl(sc.hor, 0.5); }
        break;
      case 'temperate':
        sc.mode = 2; sc.cloud = v.cloudCover; sc.g = [v.c[0], v.c[1], v.c[2], v.c[3]];
        groundWords = 'A rocky shore meets open sea; the land is bare rock and regolith, since this model does not invent life.'; break;
      case 'ocean': case 'hycean':
        sc.mode = 5; sc.cloud = v.cloudCover; sc.mtn = 0;
        groundWords = s === 'hycean' ? 'A warm ocean stretches under a hydrogen sky; nothing but water reaches the horizon.' : 'A global ocean runs unbroken to the horizon; there is no land anywhere on this world.';
        break;
      case 'desert':
        sc.mode = 3; sc.cloud = 0.04; groundWords = 'Wind-sculpted dunes and dry bedrock; any water is locked in the ground or the poles.';
        if (P < 0.1 && P > 1e-3) { const dust = mul(starL, lin([0.78, 0.58, 0.4])); sc.zen = normMax(dust, 0.22); sc.hor = normMax(dust, 0.5); skyWords = 'Suspended dust stains the thin sky butterscotch, as on Mars'; }
        break;
      case 'snowball': case 'ice-world':
        sc.mode = 4; sc.cloud = p.hasAtm ? 0.15 : 0; groundWords = 'A plain of fractured ice reflects the light back at the sky.'; break;
      case 'venus': case 'venus-hot':
        sc.mode = 0; sc.g = [[0.3, 0.22, 0.16], [0.42, 0.32, 0.22], [0.36, 0.28, 0.2], [0.5, 0.4, 0.3]];
        sc.zen = normMax(mul(starL, lin([0.85, 0.58, 0.28])), s === 'venus' ? 0.22 : 0.3); sc.hor = normMax(mul(starL, lin([0.95, 0.7, 0.4])), 0.4);
        sc.sunVis = 0; sc.fog = 0.03; sc.mtn = 1;
        skyWords = `Under ~${fmt(P)} bar of CO₂ the star is invisible; diffuse, dim orange light filters through the clouds`;
        groundWords = `Scorched basalt at ${Math.round(p.Tsurf)} K, hot enough to glow faintly in the dark.`; break;
      case 'steam':
        sc.mode = 6; sc.g = [[0.85, 0.87, 0.9], [0.75, 0.78, 0.83], [0.92, 0.93, 0.95], [0.8, 0.82, 0.86]];
        sc.zen = normMax(starL, 0.45); sc.hor = normMax(starL, 0.75); sc.sunVis = 0.15; sc.fog = 0.02; sc.mtn = 0;
        skyWords = 'Supercritical steam blurs sky and sea into one luminous fog'; groundWords = 'There is no clear surface, only ever-denser hot vapour below.'; break;
      case 'titan':
        sc.mode = 7; sc.g = [[0.35, 0.22, 0.1], [0.48, 0.32, 0.16], [0.2, 0.14, 0.08], [0.55, 0.4, 0.22]];
        sc.zen = normMax(mul(starL, lin([0.8, 0.5, 0.22])), 0.25); sc.hor = normMax(mul(starL, lin([0.9, 0.62, 0.3])), 0.45);
        sc.sunVis = 0.2; sc.fog = 0.012;
        skyWords = 'An orange photochemical haze hides the star as a pale smudge'; groundWords = `Methane lakes lie dark and still on ground at ${Math.round(p.Tsurf)} K.`; break;
      default: {
        sc.mode = 6; sc.mtn = 0; sc.cloud = 0.15;
        sc.g = [v.c[0], v.c[1], v.c[2], v.c[3]];
        sc.camH = 3;
        sc.fog = 0.0018;
        if (v.haze > 0.3) { const hz = mul(starL, lin(v.hazeCol)); sc.hor = normMax(hz, 0.6); sc.zen = normMax(hz, 0.3); skyWords = 'A photochemical haze washes out the sky'; }
        if (p.Teq > 1500) { sc.glowAmt = v.glowAmt * 0.6; sc.zen = scl(sc.zen, 0.5); }
        groundWords = 'There is no solid surface: this is the view across the cloud tops near the 1-bar level.';
      }
    }
    if (!p.hasAtm) { sc.zen = [0, 0, 0]; sc.hor = [0, 0, 0]; sc.fog = 0; sc.cloud = 0; }
    sc.stars = clamp(1 - Math.max(...sc.zen) * 5, 0, 1);
    if (sc.sunVis > 0.5 && !p.hasAtm) sc.sunBright = 9;

    // ---- caption
    const sizeRel = angDiam / 0.00930;
    const timeWord = locked ? `The star hangs motionless ${Math.round(elev)}° above the horizon — on a tidally locked world it never rises or sets` : `Afternoon on ${p.name}`;
    const starWords = sc.sunVis < 0.3 ? '' : ` The ${star.spt} star spans ${fmt(angDiam / deg)}°, ${sizeRel >= 1 ? fmt(sizeRel) + '×' : 'only ' + fmt(sizeRel) + '×'} the Sun's size in Earth's sky, and delivers ${fmt(p.S)}× Earth's sunlight.`;
    const ringWords = v.hasRing ? ' Its rings arc across the sky from horizon to horizon.' : '';
    sc.caption = `${timeWord}.${starWords} ${skyWords}. ${groundWords}${ringWords}`;
    return sc;
  };
  function skyHue(c) {
    const [r, g, b] = toS(c);
    if (b > r * 1.25 && b > g * 1.05) return b > 0.35 ? 'blue' : 'deep blue';
    if (r > b * 1.2) return r > g * 1.15 ? 'salmon-tinted' : 'pale yellow';
    return 'pale, washed-out';
  }

  // ------------------------------------------------------------ shader
  const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uMode;
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uSunSize; uniform float uSunBright; uniform float uSunVis; uniform float uStars; uniform float uFog; uniform float uCloud;
uniform vec3 uCloudCol; uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3;
uniform vec3 uGlowCol; uniform float uGlowAmt; uniform float uMtn; uniform vec3 uSeed; uniform float uCamH;
uniform float uPitch; uniform float uK;
uniform float uHasRing; uniform float uRingIn; uniform float uRingOut; uniform float uRingOp; uniform vec3 uRingCol;

vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z); vec4 x_ = floor(j*ns.z); vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy; vec4 y = y_*ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm4(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm6(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*snoise(p); p=p*2.01+vec3(5.3,1.1,7.7); a*=0.5; } return s; }
float hash1(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

vec3 skyCol(vec3 rd){
  float h = max(rd.y, 0.0);
  vec3 col = mix(uHor, uZen, pow(h, 0.45));
  float mu = dot(rd, uSunDir);
  float m = max(mu, 0.0);
  float haze = length(uHor);
  col += uSunCol * (pow(m, 6.0)*0.25*haze + pow(m, 60.0)*0.6*haze) * (0.4 + uSunVis);
  float ang = acos(clamp(mu, -1.0, 1.0));
  float disk = smoothstep(uSunSize, uSunSize*0.86, ang);
  float limb = 1.0 - 0.4*(1.0 - sqrt(max(0.0, 1.0 - pow(ang/uSunSize, 2.0))));
  col += uSunCol * disk * limb * uSunBright * uSunVis;
  col += uSunCol * exp(-ang/(uSunSize*2.5 + 0.006)) * (0.15 + 0.55*min(haze*3.0, 1.0)) * uSunVis;
  return col;
}

float ridge(float az, float f, float amp, float off){
  return amp*(0.45 + 0.55*fbm4(vec3(az*f, off, uSeed.x*0.1)));
}

vec3 groundLit(vec3 alb, vec3 n){
  float d = max(dot(n, uSunDir), 0.0);
  vec3 amb = (uZen*0.9 + uHor*0.4) + 0.012;
  return alb * (uSunCol * d * (0.25 + 0.75*uSunVis) * 1.1 + amb);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 rd = normalize(vec3(0.0, sp, cp) + (vec3(uv.x, 0.0, 0.0) + uv.y*vec3(0.0, cp, -sp)) * 2.0 * uK);
  vec3 col;
  float az = atan(rd.x, rd.z);

  if (rd.y >= 0.0) {
    col = skyCol(rd);
    // stars
    if (uStars > 0.01) {
      vec2 g = gl_FragCoord.xy / 2.2; vec2 cell = floor(g); float hs = hash1(cell + uSeed.xy);
      if (hs > 0.993) { vec2 c = cell + vec2(hash1(cell+7.1), hash1(cell+3.3)); col += vec3(0.8,0.85,1.0)*smoothstep(0.9,0.0,length(g-c))*(hs-0.993)*140.0*uStars; }
    }
    // rings seen from latitude ~30°: observer at origin, planet centre one radius below
    if (uHasRing > 0.5) {
      vec3 A = normalize(vec3(0.0, 0.5, -0.866));
      vec3 Cc = vec3(0.0, -1.0, 0.0);
      float dn = dot(rd, A);
      if (abs(dn) > 1e-4) {
        float t = dot(Cc, A)/dn;
        if (t > 0.0) {
          float r = length(rd*t - Cc);
          float x = (r - uRingIn)/(uRingOut - uRingIn);
          if (x > 0.0 && x < 1.0) {
            float d = 0.55 + 0.25*sin(x*47.0 + uSeed.x) + 0.2*sin(x*131.0 + uSeed.y);
            d *= smoothstep(0.0, 0.025, abs(x - 0.63)) * smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.92, x);
            vec3 rc = uRingCol * uSunCol * (0.7 + 0.8*abs(dot(A, uSunDir)));
            col = mix(col, rc, clamp(d*uRingOp*1.2, 0.0, 0.92) * (0.5 + 0.5*smoothstep(0.0, 0.1, rd.y)));
          }
        }
      }
    }
    // overhead clouds
    if (uCloud > 0.01 && rd.y > 0.005) {
      vec2 cp = rd.xz/rd.y*1.2 + vec2(uTime*0.015, 0.0);
      float c = fbm6(vec3(cp*0.55, uSeed.y))*0.5 + 0.5;
      float th = 0.62 - 0.35*uCloud;
      float cov = smoothstep(th, th + 0.16, c);
      float sunside = pow(max(dot(rd, uSunDir), 0.0), 3.0);
      vec3 cc = uCloudCol * (uSunCol*(0.55 + 0.6*sunside)*(0.3 + 0.7*uSunVis) + uZen*0.5 + 0.02);
      cc *= 0.75 + 0.25*smoothstep(0.3, 0.8, c);
      col = mix(col, cc, cov * smoothstep(0.0, 0.08, rd.y) * 0.95);
    }
  } else {
    float t = uCamH / (-rd.y);
    vec2 p = rd.xz * t + uSeed.xy;
    float fade = exp(-t*0.02);
    vec3 alb = vec3(0.5); vec3 n = vec3(0.0, 1.0, 0.0); vec3 emis = vec3(0.0); bool water = false;
    if (uMode < 0.5) {               // rocky regolith
      float h = fbm6(vec3(p*0.15, 1.0));
      alb = mix(uG0, uG1, smoothstep(-0.3, 0.4, h));
      float rocks = smoothstep(0.55, 0.75, snoise(vec3(p*1.3, 3.0)))*fade;
      alb *= 1.0 - 0.5*rocks;
      float e = 0.05;
      float hx = fbm4(vec3((p+vec2(e,0.0))*0.15, 1.0)) - fbm4(vec3(p*0.15, 1.0));
      float hz = fbm4(vec3((p+vec2(0.0,e))*0.15, 1.0)) - fbm4(vec3(p*0.15, 1.0));
      n = normalize(vec3(-hx*6.0*fade, 1.0, -hz*6.0*fade));
      if (uMtn > 0.5 && uSunVis < 0.1) emis = vec3(0.35, 0.08, 0.02) * 0.05;
    } else if (uMode < 1.5) {        // lava
      float h = fbm4(vec3(p*0.12, 2.0));
      alb = mix(uG0, uG1, smoothstep(-0.3, 0.4, h));
      float c1 = 1.0 - smoothstep(0.0, 0.05, abs(snoise(vec3(p*0.2, 1.0))));
      float c2 = 1.0 - smoothstep(0.0, 0.04, abs(snoise(vec3(p*0.55, 4.0))));
      float pool = smoothstep(-0.2, -0.45, h);
      float fl = 0.85 + 0.15*snoise(vec3(p*0.3, uTime*0.3));
      emis = uGlowCol * uGlowAmt * (c1*0.9 + c2*0.5*fade + pool*1.4) * fl;
      alb *= 1.0 - clamp(c1 + pool, 0.0, 1.0)*0.8;
    } else if (uMode < 2.5) {        // temperate shore
      float land = fbm4(vec3(p*0.012, 5.0)) + 0.12;
      if (land > 0.0) {
        float h = fbm6(vec3(p*0.18, 6.0));
        alb = mix(uG1, uG2, smoothstep(-0.2, 0.4, h));
        alb = mix(alb, uG3, smoothstep(0.35, 0.6, h)*0.5);
        alb = mix(alb, vec3(0.62,0.58,0.48), smoothstep(0.04, 0.0, land)*0.6);
      } else water = true;
    } else if (uMode < 3.5) {        // dunes
      float w = fbm4(vec3(p*0.05, 7.0));
      float dune = sin(p.x*0.35 + p.y*0.12 + w*5.0);
      alb = mix(uG1, uG0, 0.5 + 0.5*dune);
      alb = mix(alb, uG2, smoothstep(0.3, 0.7, fbm4(vec3(p*0.08, 8.0))));
      n = normalize(vec3(-cos(p.x*0.35 + p.y*0.12 + w*5.0)*0.35*fade, 1.0, -0.1*fade));
    } else if (uMode < 4.5) {        // ice
      float h = fbm4(vec3(p*0.1, 9.0));
      alb = mix(uG1, uG0, smoothstep(-0.3, 0.3, h));
      float cr = 1.0 - smoothstep(0.0, 0.03, abs(snoise(vec3(p*0.15, 2.0))));
      alb = mix(alb, uG2, cr*0.7*fade);
      n = normalize(vec3(snoise(vec3(p*2.0, 1.0))*0.08*fade, 1.0, snoise(vec3(p*2.0, 4.0))*0.08*fade));
    } else if (uMode < 5.5) {        // open ocean
      water = true;
    } else if (uMode < 6.5) {        // cloud sea
      vec2 q = p*0.02 + vec2(uTime*0.01, 0.0);
      float c = fbm6(vec3(q, 3.0));
      float bil = 1.0 - abs(fbm4(vec3(q*3.0, 5.0)));
      float band = sin(p.y*0.006 + c*3.0);
      alb = mix(uG1, uG0, 0.5 + 0.5*band);
      alb = mix(alb, uG3, smoothstep(0.55, 0.9, bil)*0.8);
      alb = mix(alb, uG2*0.8, smoothstep(0.2, 0.6, -c)*0.7);
      float e = 0.01;
      float hx = fbm4(vec3((q + vec2(e,0.0))*3.0, 5.0)) - fbm4(vec3(q*3.0, 5.0));
      float hz = fbm4(vec3((q + vec2(0.0,e))*3.0, 5.0)) - fbm4(vec3(q*3.0, 5.0));
      n = normalize(vec3(-hx*25.0*fade, 1.0, -hz*25.0*fade));
      emis = uGlowCol * uGlowAmt * 0.25 * (0.6 + 0.4*c);
    } else {                          // titan: haze-dimmed ground with methane lakes
      float h = fbm6(vec3(p*0.06, 11.0));
      if (h < -0.15) water = true;
      else { alb = mix(uG0, uG1, smoothstep(-0.1, 0.4, h)); alb = mix(alb, uG3, smoothstep(0.4, 0.7, h)*0.4); }
    }
    if (water) {
      float k = 0.6;
      float e = 0.08;
      vec3 wq = vec3(p*k, uTime*0.4);
      float h0 = fbm4(wq);
      float hx = fbm4(wq + vec3(e, 0.0, 0.0)) - h0;
      float hz = fbm4(wq + vec3(0.0, e, 0.0)) - h0;
      n = normalize(vec3(-hx*3.0*fade, 1.0, -hz*3.0*fade));
      vec3 refl = reflect(rd, n); refl.y = abs(refl.y);
      float fres = 0.02 + 0.98*pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
      vec3 deep = (uMode > 6.5 ? vec3(0.03, 0.02, 0.01) : uG0) * (uZen + uSunCol*0.25*uSunVis + 0.02);
      col = mix(deep, skyCol(refl), fres);
    } else {
      col = groundLit(alb, n);
    }
    float f = 1.0 - exp(-t*uFog);
    col = mix(col, uHor + 0.003, f);
    col += emis * (1.0 - f*0.6);
  }

  // mountain silhouettes on the horizon
  if (uMtn > 0.5 && rd.y > -0.002) {
    float farR = ridge(az, 2.0, 0.13, 3.0) - 0.02;
    float nearR = ridge(az, 3.6, 0.09, 9.0) - 0.03;
    vec3 rock = (uMode > 3.5 && uMode < 4.5) ? uG0 : (uMode > 0.5 && uMode < 1.5 ? uG1 : uG1*0.8);
    float shade = 0.55 + 0.45*clamp(snoise(vec3(az*30.0, rd.y*40.0, 1.0))*0.5 + 0.5 + uSunDir.x*sign(sin(az*9.0))*0.2, 0.0, 1.0);
    vec3 lit = groundLit(rock*shade, normalize(vec3(sin(az*7.0)*0.5, 0.8, 0.0)));
    if (rd.y < farR) col = mix(lit, uHor, 0.55 + 0.35*min(1.0, uFog*120.0));
    if (rd.y < nearR) col = mix(lit, uHor, 0.2 + 0.3*min(1.0, uFog*120.0));
  }

  col = vec3(1.0) - exp(-col*1.5);
  col = pow(col, vec3(1.0/2.2));
  // gentle vignette
  col *= 1.0 - 0.25*dot(uv, uv);
  gl_FragColor = vec4(col, 1.0);
}`;

  class SurfaceView {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL not available');
      this.gl = gl;
      const prog = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        gl.attachShader(prog, sh);
      }
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const nme of ['uRes', 'uTime', 'uMode', 'uZen', 'uHor', 'uSunDir', 'uSunCol', 'uSunSize', 'uSunBright', 'uSunVis', 'uStars', 'uFog', 'uCloud', 'uCloudCol', 'uG0', 'uG1', 'uG2', 'uG3', 'uGlowCol', 'uGlowAmt', 'uMtn', 'uSeed', 'uCamH', 'uPitch', 'uK', 'uHasRing', 'uRingIn', 'uRingOut', 'uRingOp', 'uRingCol'])
        this.u[nme] = gl.getUniformLocation(prog, nme);
      this.visible = true; this.running = false; this.last = 0;
      this.scale = Math.min(window.devicePixelRatio || 1, 1.25);
      if ('IntersectionObserver' in window) new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }).observe(canvas);
      this._raf = this._raf.bind(this);
      this.t0 = performance.now();
    }
    setScene(sc) {
      const gl = this.gl, u = this.u;
      this.sc = sc;
      gl.uniform1f(u.uMode, sc.mode);
      gl.uniform3fv(u.uZen, sc.zen); gl.uniform3fv(u.uHor, sc.hor);   // already linear
      gl.uniform3fv(u.uSunDir, sc.sunDir); gl.uniform3fv(u.uSunCol, sc.sunCol);
      gl.uniform1f(u.uSunSize, sc.sunSize); gl.uniform1f(u.uSunBright, sc.sunBright); gl.uniform1f(u.uSunVis, sc.sunVis);
      gl.uniform1f(u.uStars, sc.stars); gl.uniform1f(u.uFog, sc.fog); gl.uniform1f(u.uCloud, sc.cloud);
      gl.uniform3fv(u.uCloudCol, lin(sc.cloudCol));
      ['uG0', 'uG1', 'uG2', 'uG3'].forEach((k, i) => gl.uniform3fv(u[k], lin(sc.g[i])));
      gl.uniform3fv(u.uGlowCol, lin(sc.glowCol)); gl.uniform1f(u.uGlowAmt, sc.glowAmt);
      gl.uniform1f(u.uMtn, sc.mtn); gl.uniform3fv(u.uSeed, sc.seed); gl.uniform1f(u.uCamH, sc.camH); gl.uniform1f(u.uPitch, sc.pitch); gl.uniform1f(u.uK, sc.k);
      gl.uniform1f(u.uHasRing, sc.ring ? 1 : 0); gl.uniform1f(u.uRingIn, sc.ringIn); gl.uniform1f(u.uRingOut, sc.ringOut);
      gl.uniform1f(u.uRingOp, sc.ringOp); gl.uniform3fv(u.uRingCol, lin(sc.ringCol));
      this.t0 = performance.now();
      this.render(performance.now());
      if (!this.running) { this.running = true; requestAnimationFrame(this._raf); }
    }
    stop() { this.running = false; }
    _raf(now) {
      if (!this.running) return;
      // ~12 fps is plenty for drifting clouds and waves
      if (this.visible && !document.hidden && now - this.last > 80) { this.last = now; this.render(now); }
      requestAnimationFrame(this._raf);
    }
    // render once at a fixed square size (for saving images); the next frame restores the display size
    renderSize(px, now) {
      const gl = this.gl, c = this.canvas;
      c.width = px; c.height = px;
      gl.viewport(0, 0, px, px);
      gl.uniform2f(this.u.uRes, px, px);
      gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    render(now) {
      const gl = this.gl, c = this.canvas;
      const w = Math.max(1, Math.round(c.clientWidth * this.scale)), h = Math.max(1, Math.round(c.clientHeight * this.scale));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(this.u.uRes, w, h);
      gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  EXO.SurfaceView = SurfaceView;
})(typeof window !== 'undefined' ? window : globalThis);
