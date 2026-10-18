/* Procedural planet renderer: a single full-screen fragment shader that
 * ray-traces a sphere (plus ring plane and atmosphere shell) and textures it
 * with 3-D simplex noise. No external libraries; WebGL 1. */
(function (root) {
  const EXO = (root.EXO = root.EXO || {});

  const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform mat3 uRot; uniform vec3 uLight; uniform vec3 uAxis;
uniform float uMode; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform float uOcean; uniform float uIceThr; uniform float uLockedIce; uniform float uLocked; uniform float uCloudCover;
uniform vec3 uCloudCol; uniform vec3 uAtmCol; uniform float uAtmThick;
uniform float uBandFreq; uniform float uBandContrast; uniform float uTurb;
uniform vec3 uGlowCol; uniform float uGlowAmt; uniform float uGlowDay;
uniform float uHasRing; uniform float uRingIn; uniform float uRingOut; uniform float uRingOpacity; uniform vec3 uRingCol;
uniform vec3 uSeed; uniform vec3 uStarCol; uniform float uCrater; uniform vec4 uSpot; uniform vec3 uSpotCol;
uniform float uHaze; uniform vec3 uHazeCol; uniform float uZoom; uniform float uCloudSpin;

vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm4(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm6(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*snoise(p); p=p*2.01+vec3(5.3,1.1,7.7); a*=0.5; } return s; }
vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453123); }
float hash1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

float craterField(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); float res = 0.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g = vec3(float(x),float(y),float(z));
    vec3 h = hash3(i+g);
    vec3 o = g + h - f;
    float r = 0.22 + 0.33*h.x;
    float d = length(o)/r;
    if (h.y < 0.6 && d < 1.4) {
      res += -smoothstep(1.0, 0.0, d)*0.55 + exp(-pow((d-1.0)*5.0, 2.0))*0.45;
    }
  }
  return res;
}

mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }

// surface height used for relief shading (modes with solid surfaces)
float heightAt(vec3 q){
  if (uMode < 0.5) return fbm4(q*2.2+uSeed)*0.35 + uCrater*(craterField(q*5.0+uSeed)*0.12 + craterField(q*11.0+uSeed*1.3)*0.06);
  if (uMode < 1.5) return fbm4(q*3.0+uSeed)*0.4;
  if (uMode < 3.5) return fbm6(q*1.6+uSeed) + 0.18*fbm4(q*6.0+uSeed*1.7);
  if (uMode < 4.5) return fbm4(q*2.0+uSeed)*0.2;
  return 0.0;
}

float ringDensity(float r){
  float x = (r - uRingIn)/(uRingOut - uRingIn);
  if (x < 0.0 || x > 1.0) return 0.0;
  float d = 0.55 + 0.25*sin(x*47.0 + uSeed.x) + 0.2*sin(x*131.0 + uSeed.y);
  d *= 0.75 + 0.25*snoise(vec3(r*35.0, uSeed.z, 0.0));
  d *= smoothstep(0.0, 0.025, abs(x - 0.63));
  d *= smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.92, x);
  return clamp(d, 0.0, 1.0);
}

vec3 shadePlanet(vec3 n, vec3 rd){
  vec3 q = uRot * n;
  vec3 Lp = uRot * uLight;
  float ndl = dot(n, uLight);
  float day = clamp(ndl, 0.0, 1.0);
  float subst = dot(q, Lp);
  vec3 alb = vec3(0.5); float specMask = 0.0; float cloud = 0.0; vec3 emis = vec3(0.0);
  float relief = 0.0;
  bool solid = uMode < 4.5 || (uMode > 6.5 && uMode < 7.5);

  // relief: derivative of height along the projected light direction
  if (uMode < 4.5) {
    vec3 Lt = normalize(Lp - q*dot(Lp,q) + vec3(1e-5));
    float h0 = heightAt(q);
    float h1 = heightAt(normalize(q + Lt*0.012));
    relief = clamp((h1 - h0)*14.0, -0.8, 0.8);
  }

  if (uMode < 0.5) {               // airless rock
    float h = fbm4(q*2.2+uSeed);
    alb = mix(uC0, uC1, smoothstep(-0.25, 0.35, h));
    float cr = uCrater*(craterField(q*5.0+uSeed) + 0.6*craterField(q*11.0+uSeed*1.3));
    alb *= 1.0 + 0.3*cr;
    alb = mix(alb, uC2, 0.25*smoothstep(0.2, 0.6, snoise(q*20.0+uSeed)));
  } else if (uMode < 1.5) {        // lava world
    float h = fbm4(q*3.0+uSeed);
    alb = mix(uC0, uC1, smoothstep(-0.3, 0.4, h));
    float c1 = 1.0 - smoothstep(0.0, 0.07, abs(snoise(q*4.5+uSeed*0.7)));
    float c2 = 1.0 - smoothstep(0.0, 0.05, abs(snoise(q*10.0+uSeed*1.9)));
    float heat = mix(1.0, smoothstep(0.0, 0.8, subst), uGlowDay);
    float pools = smoothstep(-0.05, -0.35, h) * smoothstep(0.1, 0.6, subst*uGlowDay + (1.0-uGlowDay));
    float flick = 0.85 + 0.15*snoise(q*8.0 + vec3(0.0, uTime*0.2, 0.0));
    float e = clamp(max(c1*0.9, c2*0.6)*heat + pools*1.2, 0.0, 1.5);
    emis = uGlowCol*uGlowAmt*e*flick;
    alb *= 1.0 - 0.7*clamp(e, 0.0, 1.0);
  } else if (uMode < 2.5 || (uMode > 6.5 && uMode < 7.5)) {   // temperate / ocean worlds
    float h = (uMode > 6.5) ? -9.0 : fbm6(q*1.6+uSeed) + 0.18*fbm4(q*6.0+uSeed*1.7);
    if (h < uOcean) {
      float depth = uOcean - h;
      float waves = 0.04*fbm4(q*12.0 + uSeed + vec3(uTime*0.01));
      vec3 shallow = (uMode > 6.5) ? uC1 : uC0*2.3 + vec3(0.0, 0.02, 0.03);
      alb = mix(shallow, uC0, smoothstep(0.0, 0.18, depth + waves));
      specMask = 1.0;
      relief = 0.0;
    } else {
      float t = (h - uOcean)/0.5;
      alb = mix(uC1, uC2, smoothstep(0.0, 0.4, t + 0.15*snoise(q*9.0+uSeed)));
      alb = mix(alb, uC3, smoothstep(0.45, 0.75, t));
      alb *= 0.9 + 0.2*snoise(q*25.0+uSeed);
    }
    float m = uLockedIce > 0.5 ? (1.0 - subst)*0.5 : abs(q.y);
    float iceN = m + 0.07*fbm4(q*4.0+uSeed*0.5);
    float ice = smoothstep(uIceThr - 0.03, uIceThr + 0.03, iceN);
    alb = mix(alb, uC4, ice);
    specMask *= 1.0 - ice;
  } else if (uMode < 3.5) {        // desert
    float h = fbm6(q*1.6+uSeed);
    alb = mix(uC1, uC0, smoothstep(-0.3, 0.25, h));
    alb = mix(alb, uC2, smoothstep(0.25, 0.6, h + 0.2*snoise(q*7.0+uSeed)));
    float dunes = 0.5 + 0.5*sin(dot(q, vec3(40.0, 13.0, 27.0)) + 6.0*snoise(q*3.0+uSeed));
    alb *= 0.93 + 0.08*dunes;
    float iceN = abs(q.y) + 0.05*snoise(q*5.0+uSeed);
    alb = mix(alb, uC4, smoothstep(uIceThr - 0.02, uIceThr + 0.02, iceN));
  } else if (uMode < 4.5) {        // ice shell
    float h = fbm4(q*2.0+uSeed);
    alb = mix(uC1, uC0, smoothstep(-0.3, 0.3, h));
    float l1 = 1.0 - smoothstep(0.0, 0.025, abs(snoise(q*2.6+uSeed)));
    float l2 = 1.0 - smoothstep(0.0, 0.02, abs(snoise(q*6.5+uSeed*1.3)));
    float chaos = smoothstep(0.35, 0.6, fbm4(q*5.0+uSeed*2.1));
    alb = mix(alb, uC2, max(l1*0.75, l2*0.5));
    alb = mix(alb, uC2*1.15, chaos*0.5);
    specMask = 0.15;
  } else if (uMode < 5.5) {        // global cloud deck (Venus, steam)
    float w = fbm4(q*2.0 + uSeed*0.3 + vec3(0.0, 0.0, uTime*0.004));
    float v = fbm6(vec3(q.x*1.3, q.y*3.0, q.z*1.3) + uSeed + 0.8*w);
    v += 0.25*uTurb*sin(q.y*7.0 + v*4.0);
    alb = mix(uC1, uC0, smoothstep(-0.45, 0.45, v));
  } else if (uMode < 6.5) {        // banded envelopes
    float lat = q.y;
    vec3 q2 = rotY(uTime*0.035*sin(lat*uBandFreq*1.7 + uSeed.x)) * q;
    float warp = fbm4(q2*vec3(2.0, 5.5, 2.0) + uSeed) * uTurb;
    float band = sin((lat + warp*0.13)*uBandFreq*3.14159);
    float fine = fbm4(q2*vec3(3.0, 16.0, 3.0) + uSeed*1.3);
    float t = band*0.5 + 0.5;
    vec3 c = mix(uC0, uC1, smoothstep(0.2, 0.8, t));
    c = mix(c, uC2, smoothstep(0.5, 1.0, fine + 0.45*band));
    c = mix(c, uC3, smoothstep(0.55, 0.95, t + 0.6*fine)*0.55);
    vec3 mean = (uC0 + uC1 + uC2 + uC3)*0.25;
    alb = mix(mean, c, clamp(uBandContrast*1.3, 0.0, 1.0));
    if (uSpot.w > 0.0) {
      float latA = asin(clamp(q2.y, -1.0, 1.0));
      float lon = atan(q2.z, q2.x);
      float dl = mod(lon - uSpot.y + 3.14159, 6.28318) - 3.14159;
      float dd = length(vec2(dl*cos(latA)*0.75, (latA - uSpot.x)*1.6))/uSpot.z;
      float sw = snoise(vec3(dl*6.0, latA*6.0, uSeed.y))*0.15;
      alb = mix(alb, uSpotCol, smoothstep(1.0, 0.55, dd + sw)*0.85);
    }
  } else {                          // Titan-like haze
    float v = fbm4(q*vec3(1.0, 4.0, 1.0) + uSeed)*0.25 + q.y*0.12;
    alb = mix(uC1, uC0, clamp(0.65 + v, 0.0, 1.0));
    alb = mix(alb, uC1*0.8, smoothstep(0.75, 0.95, q.y));
  }

  // clouds for worlds with weather
  bool hasClouds = (uMode > 1.5 && uMode < 3.5) || (uMode > 6.5 && uMode < 7.5);
  if (hasClouds && uCloudCover > 0.01) {
    vec3 qc = rotY(uCloudSpin) * q;
    float sw = fbm4(qc*2.2 + uSeed*0.7);
    float cv = fbm6(qc*2.6 + uSeed*1.1 + 0.7*sw) * 0.5 + 0.5;
    float th = 0.5 - 0.32*(uCloudCover - 0.5) - uLocked*0.12*subst;
    cloud = smoothstep(th - 0.04, th + 0.09, cv);
    cloud *= 0.6 + 0.4*smoothstep(0.0, 0.25, abs(abs(q.y) - 0.3));
  }

  if (uHaze > 0.0) { alb = mix(alb, uHazeCol, uHaze*0.6); cloud *= 1.0 - uHaze*0.5; }
  // ring shadow
  float rs = 1.0;
  if (uHasRing > 0.5) {
    float dn = dot(uLight, uAxis);
    if (abs(dn) > 1e-3) {
      float t2 = -dot(n, uAxis)/dn;
      if (t2 > 0.0) { float r2 = length(n + uLight*t2); rs = 1.0 - ringDensity(r2)*uRingOpacity*0.85; }
    }
  }

  float diff = solid ? day*(1.0 + relief*0.6) : pow(day, 0.85);
  diff = max(diff, 0.0) * rs;
  vec3 col = alb * uStarCol * diff * 1.15 + alb * 0.012;
  if (specMask > 0.0) {
    vec3 hv = normalize(uLight - rd);
    float sp = pow(max(dot(n, hv), 0.0), 70.0) * 0.7 * day * (1.0 - cloud);
    col += uStarCol * sp * specMask * rs;
  }
  if (hasClouds) {
    vec3 cl = uCloudCol * uStarCol * (pow(day, 0.9)*1.1*rs) + uCloudCol*0.012;
    col = mix(col, cl, cloud*0.93);
  }
  // thermal emission (self-luminous hot surfaces / atmospheres)
  if (uGlowAmt > 0.0 && uMode > 1.5) {
    float heat = mix(1.0, smoothstep(-0.25, 0.85, subst), uGlowDay);
    float pat = 0.75 + 0.25*fbm4(q*3.0 + uSeed + vec3(0.0, uTime*0.01, 0.0));
    emis += uGlowCol * uGlowAmt * heat * pat * 0.35;
  }
  col += emis;
  // atmosphere: limb scattering and overall veil
  float mu = max(dot(n, -rd), 0.0);
  float rim = pow(1.0 - mu, 2.6);
  float sl = smoothstep(-0.3, 0.55, ndl);
  col = mix(col, uAtmCol * uStarCol * sl * 1.25, clamp(rim * uAtmThick * 1.15, 0.0, 0.85));
  col += uAtmCol * uStarCol * day * uAtmThick * 0.035;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / (0.5*min(uRes.x, uRes.y));
  vec3 ro = vec3(0.0, 0.0, 4.0);
  vec3 rd = normalize(vec3(uv * 0.31 * uZoom, -1.0));

  // background: deep space + stars
  vec3 col = vec3(0.004, 0.006, 0.014) + vec3(0.004, 0.003, 0.010) * (1.0 - length(uv)*0.4);
  vec2 g = gl_FragCoord.xy / 2.5;
  vec2 cell = floor(g);
  float hs = hash1(cell);
  if (hs > 0.9965) {
    vec2 c = cell + vec2(hash1(cell + 7.1), hash1(cell + 3.7));
    float d = length(g - c);
    float tw = 0.75 + 0.25*sin(uTime*1.5 + hs*80.0);
    col += vec3(0.75, 0.8, 1.0) * smoothstep(0.9, 0.0, d) * (hs - 0.9965) * 200.0 * tw;
  }

  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float h = b*b - c;
  float tP = 1e9;
  if (h > 0.0) tP = -b - sqrt(h);

  float hAtm = 0.025 + 0.07*uAtmThick;
  if (tP < 1e8) {
    vec3 pos = ro + rd*tP;
    col = shadePlanet(normalize(pos), rd);
  } else if (uAtmThick > 0.0) {
    vec3 pc = ro + rd*(-b);
    float d = length(pc);
    if (d < 1.0 + hAtm*1.5) {
      float x = (d - 1.0)/hAtm;
      float glow = exp(-x*3.2);
      float lit = smoothstep(-0.35, 0.6, dot(normalize(pc), uLight)) + 0.7*pow(max(dot(rd, uLight), 0.0), 5.0);
      col += uAtmCol * uStarCol * glow * lit * uAtmThick * 0.85;
    }
  }

  if (uHasRing > 0.5) {
    float dn = dot(rd, uAxis);
    if (abs(dn) > 1e-4) {
      float tR = -dot(ro, uAxis)/dn;
      if (tR > 0.0 && tR < tP) {
        vec3 pR = ro + rd*tR;
        float r = length(pR);
        float dens = ringDensity(r);
        if (dens > 0.0) {
          float bb = dot(pR, uLight); float cc = dot(pR, pR) - 1.0; float hh = bb*bb - cc;
          float sh = (hh > 0.0 && (-bb - sqrt(hh)) > 0.0) ? 0.06 : 1.0;
          float lit = 0.25 + 0.75*abs(dot(uAxis, uLight)) + 0.5*pow(max(dot(rd, uLight), 0.0), 4.0);
          vec3 rc = uRingCol * uStarCol * lit * sh;
          col = mix(col, rc, dens*uRingOpacity);
        }
      }
    }
  }

  col = vec3(1.0) - exp(-col*1.45);
  col = pow(col, vec3(1.0/2.2));
  gl_FragColor = vec4(col, 1.0);
}`;

  // ---------- matrix helpers (row-major 3×3)
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  function mul(A, B) {
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return o;
  }
  const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const lin = (c) => c.map((x) => Math.pow(Math.max(0, x), 2.2));

  class PlanetView {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl');
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
      this.prog = prog;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      const names = ['uRes', 'uTime', 'uRot', 'uLight', 'uAxis', 'uMode', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4', 'uOcean', 'uIceThr', 'uLockedIce', 'uLocked', 'uCloudCover', 'uCloudCol', 'uAtmCol', 'uAtmThick', 'uBandFreq', 'uBandContrast', 'uTurb', 'uGlowCol', 'uGlowAmt', 'uGlowDay', 'uHasRing', 'uRingIn', 'uRingOut', 'uRingOpacity', 'uRingCol', 'uSeed', 'uStarCol', 'uCrater', 'uSpot', 'uSpotCol', 'uHaze', 'uHazeCol', 'uZoom', 'uCloudSpin'];
      for (const n of names) this.u[n] = gl.getUniformLocation(prog, n);
      this.yaw = 0; this.pitch = 0; this.t0 = performance.now(); this.scale = Math.min(window.devicePixelRatio || 1, 1.5);
      this._bindPointer();
      this._raf = this._raf.bind(this);
      this.running = false;
      this.slowFrames = 0;
    }
    _bindPointer() {
      const c = this.canvas;
      let drag = null;
      c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
        this.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.006));
      });
      const end = () => { drag = null; };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      c.addEventListener('dblclick', () => { this.yaw = 0; this.pitch = 0; });
    }
    setPlanet(v) {
      this.v = v;
      const gl = this.gl, u = this.u;
      gl.uniform1f(u.uMode, v.mode);
      ['uC0', 'uC1', 'uC2', 'uC3', 'uC4'].forEach((k, i) => gl.uniform3fv(u[k], lin(v.c[i])));
      gl.uniform1f(u.uOcean, v.oceanLevel);
      gl.uniform1f(u.uIceThr, v.iceThr);
      gl.uniform1f(u.uLockedIce, v.lockedIce);
      gl.uniform1f(u.uLocked, v.locked ? 1 : 0);
      gl.uniform1f(u.uCloudCover, v.cloudCover);
      gl.uniform3fv(u.uCloudCol, lin(v.cloudCol));
      gl.uniform3fv(u.uAtmCol, lin(v.atmCol));
      gl.uniform1f(u.uAtmThick, v.atmThick);
      gl.uniform1f(u.uBandFreq, v.bandFreq);
      gl.uniform1f(u.uBandContrast, v.bandContrast);
      gl.uniform1f(u.uTurb, v.turb);
      gl.uniform3fv(u.uGlowCol, lin(v.glowCol));
      gl.uniform1f(u.uGlowAmt, v.glowAmt);
      gl.uniform1f(u.uGlowDay, v.glowDay);
      gl.uniform1f(u.uHasRing, v.hasRing ? 1 : 0);
      gl.uniform1f(u.uRingIn, v.ringIn);
      gl.uniform1f(u.uRingOut, v.ringOut);
      gl.uniform1f(u.uRingOpacity, v.ringOpacity);
      gl.uniform3fv(u.uRingCol, lin(v.ringCol));
      gl.uniform3fv(u.uSeed, v.seed);
      // normalise star colour so the brightest channel is ~1
      const sc = v.starCol, m = Math.max(sc[0], sc[1], sc[2]);
      gl.uniform3fv(u.uStarCol, lin(sc.map((x) => x / m)));
      gl.uniform1f(u.uCrater, v.crater);
      gl.uniform4fv(u.uSpot, v.spot);
      gl.uniform3fv(u.uSpotCol, lin(v.spotCol));
      gl.uniform1f(u.uHaze, v.haze);
      gl.uniform3fv(u.uHazeCol, lin(v.hazeCol));
      gl.uniform1f(u.uZoom, v.hasRing ? Math.max(1.05, v.ringOut * 0.92) : 1.0);
      this.t0 = performance.now();
      this.yaw = 0; this.pitch = 0;
      this.start();
    }
    start() { if (!this.running) { this.running = true; requestAnimationFrame(this._raf); } }
    stop() { this.running = false; }
    _resize() {
      const c = this.canvas;
      const w = Math.max(1, Math.round(c.clientWidth * this.scale)), h = Math.max(1, Math.round(c.clientHeight * this.scale));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }
    _raf(now) {
      if (!this.running) return;
      if (document.hidden) { requestAnimationFrame(this._raf); return; }
      const t0 = performance.now();
      this.render(now);
      const dt = performance.now() - t0;
      if (dt > 30 && this.scale > 0.6) { this.slowFrames++; if (this.slowFrames > 20) { this.scale *= 0.8; this.slowFrames = 0; } }
      requestAnimationFrame(this._raf);
    }
    render(now) {
      const gl = this.gl, u = this.u, v = this.v;
      if (!v) return;
      this._resize();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const t = (now - this.t0) / 1000;
      const theta = 2 * Math.PI * t / v.spinPeriodVis;
      const cam = mul(Rx(0.32 + this.pitch), Ry(this.yaw));
      const tilt = Rz(-v.tiltDeg * Math.PI / 180);
      const Mpw = mul(cam, mul(tilt, Ry(theta)));
      const L0 = norm([-0.94, 0.16, 0.18]);
      const L = v.locked ? mv(mul(cam, Ry(theta)), L0) : mv(cam, L0);
      const axis = [Mpw[1], Mpw[4], Mpw[7]];
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, t);
      gl.uniformMatrix3fv(u.uRot, false, new Float32Array(Mpw)); // row-major Mpw == column-major Mpwᵀ
      gl.uniform3fv(u.uLight, norm(L));
      gl.uniform3fv(u.uAxis, norm(axis));
      gl.uniform1f(u.uCloudSpin, t * 0.02);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
  EXO.PlanetView = PlanetView;
})(typeof window !== 'undefined' ? window : globalThis);
