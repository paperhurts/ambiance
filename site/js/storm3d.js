// Storm at Sea, drawn as a place rather than a picture.
//
// The other scenes are paintings: shapes laid down on a 2D canvas. This one is a small world,
// worked out afresh for every pixel, thirty times a second, on the graphics chip. A ray leaves a
// point a few metres above the water and is followed until it meets the sea, the buoy or the
// weather:
//
//   sea     nine trains of waves, each with its own heading, length and speed (long waves run
//           faster, as they do), the small ones bunching on the crests of the big ones. Foam where
//           the crests break and drawn out in rows down the wind; light through the thin tops.
//   sky     a deck of cloud with depth to it, a moon above it silvering the thin places, haze
//           and curtains of rain closing off the horizon.
//   storm   lightning is a light inside the cloud, at the distance the thunder says it is, so a
//           far strike glows on the horizon and a near one lights the whole sea. Near strikes
//           show the stroke itself. All of it fires when the engine says the flash happens.
//   buoy    rides the same waves the picture is made of (the wave table below is written out
//           twice, once for the shader and once for this file), rocks, rings, and blinks.
//
// The world is drawn small and enlarged to fit the screen; how small is decided by how well the
// device is keeping up (Pacer). Where WebGL is missing, or can't keep up at any size, the painting
// this replaced takes over.

import { store } from './store.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rand = (a, b) => a + Math.random() * (b - a);
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Noise: one 256 x 256 table of random values. Each texel also carries its three neighbours, so
// a single lookup gives a smooth value (and its slope). The shader and this file read the same
// table, which is how this file knows where the gaps in the cloud are.
const NT = 256;
const packed = new Uint8Array(NT * NT * 4);
{
  const r = rng(20261126);
  const b = new Uint8Array(NT * NT);
  for (let i = 0; i < b.length; i++) b[i] = (r() * 256) | 0;
  for (let j = 0; j < NT; j++) {
    for (let i = 0; i < NT; i++) {
      const i1 = (i + 1) & 255;
      const j1 = (j + 1) & 255;
      const k = (j * NT + i) * 4;
      packed[k] = b[j * NT + i];
      packed[k + 1] = b[j * NT + i1];
      packed[k + 2] = b[j1 * NT + i];
      packed[k + 3] = b[j1 * NT + i1];
    }
  }
}
function nzv(x, y) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;
  const k = ((((fy % NT) + NT) % NT) * NT + (((fx % NT) + NT) % NT)) * 4;
  const a = packed[k] / 255;
  const b = packed[k + 1] / 255;
  const c = packed[k + 2] / 255;
  const d = packed[k + 3] / 255;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ---------------------------------------------------------------------------------------------
// The sea. One table, written out twice: as shader code, and as seaAt() below.
const WIND = (() => {
  const l = Math.hypot(0.5, -0.866);
  return [0.5 / l, -0.866 / l]; // the gale blows toward us and to the right (x, z)
})();
const WAVES = [
  // th: degrees off the wind · len: crest to crest, m · a: half its height, m · e: how peaked
  { th: 0, len: 71, a: 1.55, e: 2 },
  { th: 19, len: 47, a: 0.85, e: 1.5 },
  { th: -24, len: 29, a: 0.55, e: 1.5 },
  { th: 41, len: 18, a: 0.34, e: 1.5 },
  { th: -9, len: 11, a: 0.21, e: 1.5 },
  // from here down they only roughen the surface; the rays aren't made to climb over them
  { th: 58, len: 6.8, a: 0.125, e: 1.5 },
  { th: -37, len: 4.2, a: 0.075, e: 1.5 },
  { th: 12, len: 2.6, a: 0.046, e: 1 },
  { th: -66, len: 1.6, a: 0.028, e: 1 },
];
const NW = WAVES.length;
const NM = 5; // how many the rays march against
{
  const r = rng(77031);
  for (const W of WAVES) {
    const a = (W.th * Math.PI) / 180;
    W.dx = WIND[0] * Math.cos(a) - WIND[1] * Math.sin(a);
    W.dz = WIND[0] * Math.sin(a) + WIND[1] * Math.cos(a);
    W.k = TAU / W.len;
    W.w = Math.sqrt(9.81 * W.k); // deep water: a wave's speed follows from its length
    W.p0 = r() * TAU;
    W.g = 0.7 * W.a; // how far it drags the water (and the smaller waves on it) to and fro
    // the profile 2·s^e spends longer low than high; c is its average, so the sea stays level
    let sum = 0;
    for (let i = 0; i < 720; i++) sum += 2 * Math.pow(0.5 + 0.5 * Math.cos((i / 720) * TAU), W.e);
    W.c = sum / 720;
  }
}
const TOPH = WAVES.slice(0, NM).reduce((s, W) => s + W.a * (2 - W.c), 0); // no crest stands taller
const shape = (s, e) => (e === 2 ? s * s : e === 1.5 ? s * Math.sqrt(s) : s);

// height of the first n wave trains at (x, z), for a sea of full strength; ph holds each one's phase
function seaAt(x, z, ph, n) {
  let qx = x;
  let qz = z;
  let h = 0;
  for (let i = 0; i < n; i++) {
    const W = WAVES[i];
    const p = (qx * W.dx + qz * W.dz) * W.k + ph[i];
    const sp = shape(0.5 + 0.5 * Math.cos(p), W.e);
    h += W.a * (2 * sp - W.c);
    const g = Math.sin(p) * sp * W.g;
    qx += W.dx * g;
    qz += W.dz * g;
  }
  return h;
}
const f = (x) => {
  const s = Number(x).toFixed(6);
  return s.includes('.') ? s : s + '.0';
};
// the same sum as shader code; weight(W, i) gives an expression that fades a wave out, or null
function seaSrc(n, weight) {
  let s = 'vec2 q=p;float h=0.0,ph,sp,w;\n';
  for (let i = 0; i < n; i++) {
    const W = WAVES[i];
    const w = weight(W, i);
    const sh = W.e === 2 ? 'sp*=sp;' : W.e === 1.5 ? 'sp*=sqrt(sp);' : '';
    const body = `ph=dot(q,vec2(${f(W.dx * W.k)},${f(W.dz * W.k)}))+uPh[${i}];sp=0.5+0.5*cos(ph);${sh}h+=w*${f(W.a)}*(2.0*sp-${f(W.c)});q+=vec2(${f(W.dx * W.g)},${f(W.dz * W.g)})*(w*sin(ph)*sp);`;
    s += w ? `w=${w};if(w>0.0){${body}}\n` : `w=1.0;${body}\n`;
  }
  return s + 'return h*uAmp;';
}

// ---------------------------------------------------------------------------------------------
// The weather's dimensions (metres), shared with the shader
const CB = 650; // cloud base
const CT = 2300; // cloud tops
const COVF = 0.00034; // the size of the cloud masses
const CAM_H = 3.9; // eye height above a flat sea
const FL = 2.3; // lens: the short side of the screen spans about 47 degrees
const BUOY_DIST = 32;
const LAMP_Y = 3.18; // where the lantern's lens is, up from the waterline

const VS = 'attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.0,1.0);}';

const NOISE_GLSL = `
uniform sampler2D uN;
vec4 tx(vec2 p){return TX(p);}
float nv(vec2 x){vec2 p=floor(x),f=x-p;vec4 t=tx(p);vec2 u=f*f*(3.0-2.0*f);
  return t.x+(t.y-t.x)*u.x+(t.z-t.x)*u.y+(t.x-t.y-t.z+t.w)*u.x*u.y;}
vec3 nz(vec2 x){vec2 p=floor(x),f=x-p;vec4 t=tx(p);vec2 u=f*f*(3.0-2.0*f);vec2 du=6.0*f*(1.0-f);
  float k1=t.y-t.x,k2=t.z-t.x,k4=t.x-t.y-t.z+t.w;
  return vec3(t.x+k1*u.x+k2*u.y+k4*u.x*u.y,du*vec2(k1+k4*u.y,k2+k4*u.x));}
`;

const FS_SCENE = `varying vec2 vP;
uniform vec3 uCam,uR,uU,uF;
uniform vec2 uAsp;
uniform float uFl,uJit,uPix,uTw,uExp;
uniform float uPh[${NW}];
uniform float uAmp,uRain,uCov,uWindK,uFoam,uFogD,uShaft;
uniform vec2 uCo[4];
uniform vec2 uSo[4];
uniform vec3 uMoonDir,uMoonCol;
uniform float uMoonGap;
uniform vec3 uFlashPos,uFlashDir,uFlashCol,uFlashSea;
uniform float uFlashAmb,uFlashFog,uFlashR;
uniform vec3 uBuoy,uBuoyUp,uBuoyX,uBuoyZ,uLampPos;
uniform float uLamp,uBoltD;
${NOISE_GLSL}
const float CB=${f(CB)};
const float CT=${f(CT)};
const float SCUD=380.0;
const float FOGB=1.0/90.0;       // the haze thins out with height
const float TMAX=900.0;
const float TOPH=${f(TOPH)};
const vec2 WD=vec2(${f(WIND[0])},${f(WIND[1])});
const vec2 WP=vec2(${f(-WIND[1])},${f(WIND[0])});
const vec3 AMB=vec3(0.0100,0.0210,0.0300);       // what a night like this leaves to see by
const vec3 CLOUDAMB=vec3(0.0050,0.0140,0.0215);
const vec3 FOGC=vec3(0.0100,0.0225,0.0310);
const vec3 BAND=vec3(0.036,0.058,0.066);         // the last light, low along the horizon
const vec3 SEAC=vec3(0.0016,0.0078,0.0115);
const vec3 LAMP=vec3(1.0,0.17,0.08);
const mat2 R1=mat2(0.8,0.6,-0.6,0.8);            // turns, so stacked layers of noise don't line up
const mat2 R2=mat2(0.384615,0.923077,-0.923077,0.384615);

// ---------------- the sea's shape
float seaM(vec2 p,float t){          // what the rays climb over: the big waves, fewer far away
${seaSrc(NM, (_, i) => (i === 3 ? '1.0-smoothstep(220.0,380.0,t)' : i === 4 ? '1.0-smoothstep(110.0,200.0,t)' : null))}
}
float seaD(vec2 p,float fp){         // every wave, each fading out once a pixel is wider than it
${seaSrc(NW, (W) => `1.0-smoothstep(${f(W.len * 0.3)},${f(W.len * 0.9)},fp)`)}
}

// ---------------- haze and rain
float fogOD(float y0,float dy,float t){
  float k=FOGB*dy;
  float fl=abs(k)<1.0e-5?t:(1.0-exp(-k*t))/k;
  return uFogD*exp(-FOGB*y0)*fl;
}
vec3 fogCol(vec3 rd){
  float ay=abs(rd.y);
  vec3 c=FOGC*(1.0+uFlashAmb*7.0)+BAND*exp(-ay*10.0);
  float md=max(dot(rd,uMoonDir),0.0);
  c+=uMoonCol*(0.05*pow(md,5.0)+0.10*pow(md,40.0))*(0.35+0.65*uMoonGap);
  float fd=max(dot(rd,uFlashDir),0.0);
  c+=uFlashCol*uFlashFog*(0.04+0.96*pow(fd,10.0));
  // curtains of heavier rain hang under the cloud, leaning with the wind
  float az=atan(rd.x,rd.z);
  float sh=nv(vec2(az*5.0+rd.y*3.0+uShaft,2.5))*0.65+nv(vec2(az*13.0+rd.y*8.0+uShaft*2.0,9.5))*0.35;
  return c*(1.0-0.30*uRain*smoothstep(0.35,0.80,sh)*(1.0-smoothstep(0.0,0.45,ay)));
}

// ---------------- the sky
float stars(vec3 rd){
  vec3 a=abs(rd);vec2 uv;
  if(a.y>=a.x&&a.y>=a.z)uv=rd.xz/a.y;
  else if(a.x>=a.z)uv=rd.zy/a.x+vec2(3.0,0.0);
  else uv=rd.xy/a.z+vec2(0.0,5.0);
  uv*=70.0;
  vec2 id=floor(uv),fr=uv-id-0.5;
  vec4 r=tx(id);
  float d=length(fr-(r.yz-0.5)*0.5);
  return step(0.86,r.x)*(1.0-smoothstep(0.03,0.22,d))*(0.3+1.1*r.w*r.w)*(0.72+0.28*sin(uTw*(1.5+r.w*4.0)+r.y*40.0));
}
float cov2(vec2 xz){                 // how much cloud stands over a spot: 0 a gap, 1 the thick of it
  vec2 q=xz*${f(COVF)};
  float c=nv(q+uCo[0])*0.52+nv(q*2.7+uCo[1])*0.30+nv(q*6.3+uCo[2])*0.18;
  return smoothstep(1.0-uCov,1.24-uCov,c);
}
vec3 flashIn(vec3 p){                // the stroke's light, from where it is
  float d2=dot(p-uFlashPos,p-uFlashPos)*uFlashR;
  return uFlashCol/(1.0+d2*(1.0+0.4*d2))+uFlashCol*uFlashAmb*0.06;
}
vec4 clouds(vec3 ro,vec3 rd,float dith){
  if(rd.y<0.025)return vec4(0.0);
  float ta=(CB-ro.y)/rd.y,tb=(CT-ro.y)/rd.y;
  if(ta>32000.0)return vec4(0.0);
  tb=min(tb,ta+5200.0);
  float dt=(tb-ta)/15.0;
  float t=ta+dt*(0.1+0.9*dith);
  vec4 acc=vec4(0.0);
  float md=max(dot(rd,uMoonDir),0.0);
  float ph=1.0+2.6*pow(md,6.0)+7.0*pow(md,60.0);          // the silver lining, toward the moon
  float glow=1.5*pow(md,20.0)+9.0*pow(md,260.0);          // and the bright place in the cloud that gives the moon away
  for(int i=0;i<15;i++){
    vec3 p=ro+rd*t;
    float b=cov2(p.xz);
    if(b>0.01){
      float base=CB+520.0*(1.0-b)*(1.0-b);
      float top=CB+(CT-CB)*(0.30+0.70*b);
      float er=nv(p.xz*0.0031+vec2(p.y*0.0023,-p.y*0.0017)+uCo[3]);   // torn, wind-ragged undersides
      float d=b*smoothstep(base,base+260.0,p.y+er*220.0)*(1.0-smoothstep(top-340.0,top,p.y))*(0.55+0.9*er);
      if(d>0.004){
        float tau=b*max(top-p.y,0.0)*0.0026;              // how much cloud the moonlight came down through
        vec3 L=uMoonCol*(ph*(exp(-tau)+0.035)+glow*(0.2+exp(-tau*0.6)))
              +CLOUDAMB*(0.55+0.5*er)*(1.2-0.65*b)*(1.0+uFlashAmb*5.0)+flashIn(p);
        float a=1.0-exp(-d*dt*0.0065);
        acc+=(1.0-acc.a)*vec4(L*a,a);
        if(acc.a>0.97)break;
      }
    }
    t+=dt;
  }
  // scud: low, dark, ragged, racing under the deck
  vec3 sp=ro+rd*((SCUD-ro.y)/rd.y);
  vec2 sq=sp.xz*0.0031+uCo[3];
  float sa=smoothstep(0.50,0.80,nv(sq)*0.62+nv(sq*3.0+7.0)*0.38)*0.8*smoothstep(0.03,0.13,rd.y);
  vec3 sc=CLOUDAMB*0.5*(1.0+uFlashAmb*5.0)+uMoonCol*glow*0.05+flashIn(sp)*0.55;
  return vec4(sc*sa+acc.rgb*(1.0-sa),sa+acc.a*(1.0-sa));
}
vec3 sky(vec3 ro,vec3 rd,float dith){
  vec4 cl=clouds(ro,rd,dith);
  vec3 c=cl.rgb;
  if(cl.a<0.985){                    // through the gaps: the night itself
    vec3 b=mix(vec3(0.0100,0.0180,0.0340),vec3(0.0018,0.0036,0.0100),pow(max(rd.y,0.0),0.45));
    float md=dot(rd,uMoonDir);
    b+=uMoonCol*(14.0*smoothstep(0.99992,0.99997,md)+0.9*pow(max(md,0.0),900.0)+0.10*pow(max(md,0.0),50.0));
    b+=vec3(0.75,0.85,1.0)*stars(rd)*0.5*smoothstep(0.03,0.25,rd.y);
    c+=b*(1.0-cl.a);
  }
  return mix(fogCol(rd),c,exp(-fogOD(ro.y,rd.y,6.0e4)));
}
vec3 skyRefl(vec3 r){                // what the water mirrors: the underside of the weather, cheaply
  vec3 p=vec3(uCam.x+r.x*((CB+300.0)/r.y),CB+300.0,uCam.z+r.z*((CB+300.0)/r.y));
  float b=cov2(p.xz)*smoothstep(0.02,0.14,r.y);
  float md=max(dot(r,uMoonDir),0.0);
  vec3 c=uMoonCol*(1.0+2.6*pow(md,6.0))*(exp(-b*b*3.2)+0.035)*mix(0.30,1.0,b)+CLOUDAMB*(1.0+uFlashAmb*5.0)+flashIn(p)*b;
  return mix(fogCol(r),c,exp(-uFogD*exp(-FOGB*uCam.y)/(FOGB*r.y)));
}

// ---------------- the water
vec3 shadeSea(vec3 ro,vec3 rd,float t){
  vec3 p=ro+rd*t;
  float fp=t*uPix*1.6/max(-rd.y,0.04);                    // how much water one pixel takes in
  float e=max(0.035,0.35*fp);
  float h0=seaD(p.xz,fp),hx=seaD(p.xz+vec2(e,0.0),fp),hz=seaD(p.xz+vec2(0.0,e),fp);
  // wind chop, and the pocking of the rain
  vec3 c0=nz(p.xz*0.83+uSo[0]);
  vec2 g=c0.yz*0.20*(1.0-smoothstep(0.5,2.5,fp))
        +nz(R2*p.xz*0.21+uSo[0].yx).yz*0.16*(1.0-smoothstep(3.0,14.0,fp))
        +nz(R1*p.xz*0.062+uSo[2]).yz*0.10*(1.0-smoothstep(12.0,60.0,fp))
        +nz(p.xz*2.9+uSo[1]).yz*0.11*(1.0-smoothstep(0.15,0.8,fp))
        +nz(R1*p.xz*vec2(6.5,9.5)+uSo[1].yx*3.0).yz*0.085*(0.4+0.6*uWindK)*(1.0-smoothstep(0.05,0.3,fp))
        +nz(p.xz*11.0+floor(uTw*14.0)*vec2(7.3,3.1)).yz*0.09*uRain*(1.0-smoothstep(0.03,0.22,fp));
  vec3 n=normalize(vec3(h0-hx-g.x*e,e,h0-hz-g.y*e));
  float rough=smoothstep(0.4,40.0,fp);                    // waves too far off to see still scatter the light
  float fr=(0.02+0.98*pow(1.0-max(dot(n,-rd),0.0),5.0))*(1.0-0.35*rough);
  vec3 r=reflect(rd,n);r.y=abs(r.y)+0.012;r=normalize(r);
  vec3 refl=skyRefl(r);
  float hgt=p.y/uAmp;                                     // metres above the mean, whatever the storm
  vec3 body=SEAC*(0.6+0.4*n.y)*(1.0+uFlashAmb*6.0);
  // light gets through the thin top of a crest: from the moon's side, and from the stroke's
  float thin=smoothstep(0.5,2.9,hgt);
  float mdh=max(dot(rd,normalize(vec3(uMoonDir.x,0.0,uMoonDir.z))),0.0);
  float fdh=max(dot(rd,normalize(vec3(uFlashDir.x,0.0,uFlashDir.z)+1.0e-4)),0.0);
  body+=vec3(0.035,0.40,0.34)*thin*(0.020+uMoonCol.g*(0.25+0.75*uMoonGap)*1.3*mdh*mdh+uFlashSea.g*(0.20+0.80*fdh*fdh));
  vec3 col=mix(body,refl,fr);
  // glitter: the moon when it finds a gap, the stroke, the buoy's lamp
  col+=uMoonCol*uMoonGap*pow(max(dot(r,uMoonDir),0.0),mix(260.0,26.0,rough))*mix(9.0,1.2,rough);
  col+=uFlashSea*pow(max(dot(r,uFlashDir),0.0),mix(60.0,10.0,rough))*0.9;
  vec3 lv=uLampPos-p;float l2=dot(lv,lv);vec3 ld=lv*inversesqrt(l2);
  float ls=max(dot(r,ld),0.0);
  col+=LAMP*uLamp*((pow(ls,90.0)*9.0+pow(ls,10.0)*0.42)/(1.0+l2*0.012)+0.012/(1.0+l2*0.05));
  // foam: on the breaking crests, and drawn out in rows down the gale.
  // 'much' says how foamy a place is; the froth itself is a texture that fills in as that rises, so
  // thin foam is lace with water showing through and thick foam is solid.
  vec2 fq=p.xz+c0.yz*1.4;                           // stirred by the chop, so it marbles
  float lace=nv(fq*0.42+uSo[2])*0.6+nv(R1*fq*0.93+uSo[2].yx*2.0)*0.4;
  float fine=nv(R2*fq*1.9+uSo[3]);
  float row=nv(vec2(dot(p.xz,WD)*0.035,dot(p.xz,WP)*0.55)+uSo[2].yx);
  float cap=smoothstep(1.35,2.9,hgt+(lace-0.5)*1.9);
  float streak=smoothstep(0.50,0.78,row*0.62+lace*0.38)*(0.25+0.75*uWindK)*0.62;
  float much=clamp(cap*1.15+streak,0.0,1.0)*uFoam;
  much=max(much,(1.0-smoothstep(1.1,3.2,length(p.xz-uBuoy.xz)+(lace-0.5)*1.6))*0.62); // the wash round the buoy
  float k1=1.0-smoothstep(0.08,0.45,fp),k2=1.0-smoothstep(0.02,0.14,fp);              // froth too small to see from far off
  float froth=fine*0.50+mix(0.5,nv(R1*p.xz*6.1+uSo[3].yx*3.0),k1)*0.32+mix(0.5,nv(p.xz*17.0+uSo[3]*9.0),k2)*0.18;
  float foam=smoothstep(froth-0.16,froth+0.14,much*1.18-0.06);
  vec3 foamC=(AMB*(6.0+uFlashAmb*20.0)*(0.62+0.38*n.y*n.y)+uMoonCol*(0.10+0.55*uMoonGap)*(0.4+0.6*max(dot(n,uMoonDir),0.0))
      +uFlashSea*(0.30+0.5*max(dot(n,uFlashDir),0.0))+LAMP*uLamp*2.2*max(dot(n,ld),0.0)/(1.0+l2*0.03))*(0.45+0.75*froth);
  return mix(col,foamC,clamp(foam,0.0,1.0));
}

// ---------------- the bell buoy: a float, a cage of four legs with the bell hung inside, a lantern on top
float box2(vec2 p,vec2 c,vec2 b){vec2 d=abs(p-c)-b;return length(max(d,0.0))+min(max(d.x,d.y),0.0);}
vec3 buoyL(vec3 p){vec3 d=p-uBuoy;return vec3(dot(d,uBuoyX),dot(d,uBuoyUp),dot(d,uBuoyZ));}     // into its own frame
// distance to it from a point in its frame (y up the middle), and what's nearest: 0 paint, 1 iron, 2 the bell
vec2 buoyDM(vec3 q){
  float r=length(q.xz);
  vec2 a=vec2(r,q.y);
  float red=box2(a,vec2(0.0,-0.05),vec2(1.10,0.34))-0.13;                              // the float
  vec3 s=vec3(abs(q.x),q.y,abs(q.z))-vec3(0.62,0.30,0.62);
  const vec3 ba=vec3(-0.43,2.56,-0.43);
  red=min(red,length(s-ba*clamp(dot(s,ba)/6.9234,0.0,1.0))-0.06);                     // four legs, leaning in
  red=min(red,min(length(a-vec2(0.68,1.15)),length(a-vec2(0.46,2.05)))-0.04);         // hoops round them
  red=min(red,box2(a,vec2(0.0,3.43),vec2(0.17,0.03)));                                 // the lantern's cap
  float iron=min(box2(a,vec2(0.0,2.88),vec2(0.33,0.04)),box2(a,vec2(0.0,3.16),vec2(0.11,0.24)));
  iron=min(iron,max(r-0.022,abs(q.y-2.4)-0.48));                                       // what the bell hangs by
  float bell=max(r-(0.11+0.21*pow(clamp((1.95-q.y)/0.55,0.0,1.0),1.7)),abs(q.y-1.675)-0.275)*0.8;
  float d=min(red,min(iron,bell));
  return vec2(d,d==bell?2.0:d==iron?1.0:0.0);
}
float buoyHit(vec3 ro,vec3 rd){
  vec3 oc=ro-(uBuoy+uBuoyUp*1.55);
  float b=dot(oc,rd),h=b*b-(dot(oc,oc)-6.5);
  if(h<0.0)return -1.0;
  h=sqrt(h);
  float t=max(-b-h,0.0),t1=-b+h;
  for(int i=0;i<48;i++){
    float d=buoyDM(buoyL(ro+rd*t)).x;
    if(d<0.002+0.0006*t)return t;
    t+=d*0.9;
    if(t>t1)break;
  }
  return -1.0;
}
vec3 shadeBuoy(vec3 p,vec3 rd){
  vec3 q=buoyL(p);
  float r=length(q.xz),y=q.y;
  vec2 dm=buoyDM(q);
  vec2 e=vec2(0.012,0.0);
  vec3 gl=normalize(vec3(buoyDM(q+e.xyy).x,buoyDM(q+e.yxy).x,buoyDM(q+e.yyx).x)-dm.x+1.0e-6);
  vec3 n=normalize(uBuoyX*gl.x+uBuoyUp*gl.y+uBuoyZ*gl.z);
  float az=atan(q.x,q.z);
  float wear=nv(vec2(az*3.0,y*0.9+3.0))*0.6+nv(vec2(az*9.0,y*5.0))*0.4;
  vec3 alb=vec3(0.36,0.034,0.026)*(0.55+0.75*wear);                                    // red, as a port-hand buoy is
  alb=mix(alb,vec3(0.030,0.034,0.038)*(0.7+0.6*wear),step(0.5,dm.y));                  // iron
  alb=mix(alb,vec3(0.20,0.125,0.045)*(0.6+0.8*wear),step(1.5,dm.y));                   // the bell, bronze gone dull
  alb=mix(alb,vec3(0.012,0.028,0.020),(1.0-smoothstep(-0.05,0.30,y+wear*0.25))*0.85);  // weed and tar at the waterline
  vec3 lv=uLampPos-p;float l2=dot(lv,lv);
  vec3 lin=AMB*(1.3+0.9*n.y)*(1.0+uFlashAmb*9.0)
      +uMoonCol*(0.25+0.75*uMoonGap)*1.4*max(dot(n,uMoonDir),0.0)
      +uFlashSea*0.55*max(dot(n,uFlashDir),0.0)
      +LAMP*uLamp*2.2*max(dot(n,lv*inversesqrt(l2)),0.0)/(0.25+l2);
  vec3 col=alb*lin;
  vec3 rf=reflect(rd,n);                                  // everything out here is wet, and shines a little
  float fr=0.04+0.96*pow(1.0-max(dot(n,-rd),0.0),5.0);
  float gloss=dm.y>1.5?2.2:1.0;
  col+=fr*0.35*gloss*fogCol(vec3(rf.x,abs(rf.y),rf.z));
  col+=uFlashSea*0.5*gloss*pow(max(dot(rf,uFlashDir),0.0),30.0);
  col+=uMoonCol*uMoonGap*3.0*gloss*pow(max(dot(rf,uMoonDir),0.0),40.0);
  float lens=step(0.5,dm.y)*(1.0-step(1.5,dm.y))*smoothstep(2.97,3.01,y)*(1.0-smoothstep(3.33,3.37,y))*step(r,0.17);
  return mix(col,vec3(0.10,0.008,0.006)+LAMP*uLamp*5.0,lens);
}

void main(){
  vec2 uv=vP*uAsp;
  vec3 rd=normalize(uv.x*uR+uv.y*uU+uFl*uF);
  vec3 ro=uCam;
  // where along its first step each ray starts: spread evenly between neighbouring pixels (so the
  // enlargement smooths it away) and different every frame
  float dith=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy)+floor(uJit*64.0)*5.588238,vec2(0.06711056,0.00583715))));
  // climb the ray over the waves. Nothing stands above 'top', so a ray starts where it dips under that.
  float top=TOPH*uAmp;
  float t=-1.0,t0=0.0;
  bool go=true;
  if(ro.y>top){if(rd.y>-1.0e-4)go=false;else t0=(ro.y-top)/(-rd.y);}
  if(go){
    if(t0<TMAX){
      float tt=t0+0.02,tp=t0,hp=0.0,h=1.0;
      bool hit=false;
      for(int i=0;i<84;i++){
        vec3 p=ro+rd*tt;
        if(rd.y>0.0&&p.y>top)break;
        h=p.y-seaM(p.xz,tt);
        if(h<0.0){hit=true;break;}
        tp=tt;hp=h;
        tt+=max(h*0.72/(0.5+max(-rd.y,0.0)),0.012*tt)+0.02;
        if(tt>TMAX)break;
      }
      if(hit){                       // it went under between the last two steps: close in on where
        float a=tp,b=tt,ha=hp,hb=h;
        for(int j=0;j<4;j++){
          float m=a+(b-a)*ha/(ha-hb);
          float hm=ro.y+rd.y*m-seaM(ro.xz+rd.xz*m,m);
          if(hm<0.0){b=m;hb=hm;}else{a=m;ha=hm;}
        }
        t=a+(b-a)*ha/(ha-hb);
      }else if(rd.y<-1.0e-4)t=max(tt,ro.y/(-rd.y));      // far out, lost in the rain: call it flat
    }else t=ro.y/(-rd.y);
  }
  vec3 col;
  float mask=0.0;
  float tb=buoyHit(ro,rd);
  if(tb>0.0&&(t<0.0||tb<t)){
    col=shadeBuoy(ro+rd*tb,rd);
    col=mix(fogCol(rd),col,exp(-fogOD(ro.y,rd.y,tb)));
  }else if(t>0.0){
    col=shadeSea(ro,rd,t);
    col=mix(fogCol(rd),col,exp(-fogOD(ro.y,rd.y,t)));
  }else{
    col=sky(ro,rd,dith);
    // how much of a stroke out at uBoltD would get through the rain along this ray (none through the sea)
    mask=exp(-fogOD(ro.y,rd.y,uBoltD))*(1.0-smoothstep(CB-80.0,CB+140.0,ro.y+rd.y*uBoltD));
  }
  col*=uExp;
  col=col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);
  col=pow(clamp(col,0.0,1.0),vec3(0.4545));
  gl_FragColor=vec4(col,mask);
}`;

const NB = 22; // points along a stroke: 17 down the main channel, 5 down a fork
const FS_FINAL = `varying vec2 vP;
uniform sampler2D uS;
uniform vec2 uSc,uTx,uAsp;
uniform float uT,uJit,uRain,uSlant,uPxS;
uniform vec3 uRainCol,uLampCol,uLampS;
uniform vec2 uBolt[${NB}];
uniform float uBoltI,uForkI;
${NOISE_GLSL}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/max(dot(ba,ba),1.0e-9),0.0,1.0));}
// one sheet of falling rain: columns of streaks, each with its own pace, leaning with the wind
float streaks(vec2 p,float sc,float sp,float seed,float len,float dens){
  float x=(p.x+p.y*uSlant)*sc;
  float col=floor(x);
  vec4 r=tx(vec2(col,seed));
  float y=p.y*sc*0.11+uT*sp*sc*0.11*(0.75+0.5*r.x)+r.y*37.0;
  float row=floor(y);
  vec4 d=tx(vec2(col*3.0+row*7.0+seed,row+seed*5.0));
  float fy=y-row;
  float fx=x-col-0.5-(d.x-0.5)*0.7;
  return step(1.0-dens,d.y)*smoothstep(0.0,0.12,fy)*(1.0-smoothstep(len*0.35,len,fy))*(1.0-smoothstep(0.0,0.11,abs(fx)))*(0.4+0.6*d.z);
}
void main(){
  vec2 uv=vP*0.5+0.5;
  // the world was drawn small; enlarge it with a Catmull-Rom filter (9 taps), smoother than plain bilinear
  vec2 lo=uTx*0.5,hi=uSc-uTx*0.5;
  vec2 s=uv*uSc/uTx;
  vec2 tc=floor(s-0.5)+0.5;vec2 fr=s-tc;
  vec2 w0=fr*(-0.5+fr*(1.0-0.5*fr));
  vec2 w1=1.0+fr*fr*(-2.5+1.5*fr);
  vec2 w2=fr*(0.5+fr*(2.0-1.5*fr));
  vec2 w3=fr*fr*(-0.5+0.5*fr);
  vec2 w12=w1+w2;
  vec2 t0=clamp((tc-1.0)*uTx,lo,hi),t3=clamp((tc+2.0)*uTx,lo,hi),t12=clamp((tc+w2/w12)*uTx,lo,hi);
  vec3 c=(texture2D(uS,vec2(t0.x,t0.y)).rgb*w0.x+texture2D(uS,vec2(t12.x,t0.y)).rgb*w12.x+texture2D(uS,vec2(t3.x,t0.y)).rgb*w3.x)*w0.y
        +(texture2D(uS,vec2(t0.x,t12.y)).rgb*w0.x+texture2D(uS,vec2(t12.x,t12.y)).rgb*w12.x+texture2D(uS,vec2(t3.x,t12.y)).rgb*w3.x)*w12.y
        +(texture2D(uS,vec2(t0.x,t3.y)).rgb*w0.x+texture2D(uS,vec2(t12.x,t3.y)).rgb*w12.x+texture2D(uS,vec2(t3.x,t3.y)).rgb*w3.x)*w3.y;
  c=clamp(c,0.0,1.0);
  vec2 pa=vP*uAsp;
  // the stroke: drawn here, at the screen's full sharpness, wherever the rain lets it through
  if(uBoltI>0.002){
    float m=texture2D(uS,clamp(uv*uSc,lo,hi)).a;
    float dm=1.0e3,df=1.0e3;
    for(int i=0;i<16;i++)dm=min(dm,seg(pa,uBolt[i],uBolt[i+1]));
    for(int i=17;i<21;i++)df=min(df,seg(pa,uBolt[i],uBolt[i+1]));
    float w=uPxS*1.4;
    float b=(1.0-smoothstep(0.0,w,dm))*1.7+exp(-dm*dm/(w*w*40.0))*0.55+0.010/(dm*dm*700.0+0.02);
    b+=uForkI*((1.0-smoothstep(0.0,w*0.8,df))*0.9+exp(-df*df/(w*w*24.0))*0.3);
    c+=vec3(0.80,0.88,1.0)*b*uBoltI*m;
  }
  // the lamp: a hard point where it clears the waves, and its glow in the wet air
  float ld=length(pa-uLampS.xy);
  c+=uLampCol*(exp(-ld*ld/(uPxS*uPxS*7.0))*1.5*uLampS.z+(exp(-ld*30.0)*0.50+0.045/(1.0+ld*ld*160.0))*(0.3+0.7*uLampS.z)*(0.6+0.7*uRain));
  // rain between here and there, four sheets deep
  float r=streaks(pa,26.0,7.5,11.0,0.55,0.34*uRain)*0.90
         +streaks(pa,44.0,5.2,37.0,0.50,0.42*uRain)*0.65
         +streaks(pa,76.0,3.6,71.0,0.45,0.50*uRain)*0.45
         +streaks(pa,130.0,2.5,113.0,0.40,0.55*uRain)*0.30;
  c+=(uRainCol+uLampCol*0.5*exp(-ld*7.0))*r;
  c*=1.0-0.20*dot(vP,vP);
  c+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715)))+uJit)-0.5)*(1.6/255.0);
  gl_FragColor=vec4(c,1.0);
}`;

// ---------------------------------------------------------------------------------------------
// How many pixels of world to work out each frame.
//
// Where the browser will say how long the graphics chip spent on a frame, that is the measure:
// the size is steered to keep the chip working about a third of the time, which holds 30 frames
// a second with room to spare and doesn't cook a phone left running all evening.
//
// Elsewhere (iPhones, mostly) all there is to go on is whether frames arrive on time. The size
// grows while they do and shrinks when they don't, and after a stumble it waits before growing
// again, longer each time, so a device settles instead of hunting. Late frames aren't always our
// doing, though (a browser that is saving power draws slowly whatever is asked of it), so if
// shrinking doesn't bring them back on time the size is put back and left alone.
class Pacer {
  constructor(P, settled) {
    this.P = P;
    this.min = 40000;
    this.max = 1600000;
    this.buf = [];
    this.gbuf = [];
    this.ok = 0;
    this.stuck = 0; // how long it has been too slow at the smallest size
    this.hold = 0;
    this.deaf = 0;
    this.wait = 20000;
    this.from = null; // where a run of late frames began: { P, med }
    this.timed = false;
    this.fast = !settled; // first time on this device: climb quickly while the picture fades in
  }
  get size() {
    return clamp(this.P, this.min, this.max);
  }
  // the chip's time on one frame, in ms. Returns true when the size changed.
  gpu(ms) {
    if (!(ms > 0.05)) return false; // some drivers answer 0: no use
    this.timed = true;
    this.gbuf.push(ms);
    if (this.gbuf.length < 9) return false;
    const a = this.gbuf.sort((x, y) => x - y);
    const med = a[a.length >> 1];
    this.gbuf = [];
    this.ms = med; // the last reading, for the curious
    const before = this.size;
    if (med > 14.5) this.P = before * clamp(11 / med, 0.55, 0.92);
    else if (med < 8) this.P = before * Math.min(this.fast ? 1.6 : 1.25, 10.5 / med);
    else this.fast = false;
    this.P = clamp(this.P, this.min, this.max);
    this.stuck = med > 30 && before <= this.min * 1.01 ? this.stuck + 1 : 0;
    return Math.abs(this.P - before) > 1;
  }
  // ms since the last frame drawn (they're drawn at most every 33). Returns true when the size changed.
  frame(ms, now) {
    if (this.timed) return false;
    if (ms > 400 || now < this.deaf) {
      this.buf.length = 0; // a hiccup or a hidden tab, not a measurement
      return false;
    }
    this.buf.push(ms);
    if (this.buf.length < 16) return false;
    const a = this.buf.sort((x, y) => x - y);
    const med = a[a.length >> 1];
    this.buf = [];
    const before = this.size;
    if (med > 41) {
      this.ok = 0;
      this.fast = false;
      if (!this.from) this.from = { P: before, med };
      else if (before <= this.from.P * 0.62 && med > this.from.med * 0.9) {
        // much smaller and no quicker: the lateness isn't ours. Put it back and stop listening a while.
        this.P = this.from.P;
        this.from = null;
        this.stuck = 0;
        this.deaf = now + 120000;
        return true;
      }
      this.stuck = before <= this.min * 1.01 ? this.stuck + 1 : 0;
      this.P = Math.max(this.min, before * (med > 60 ? 0.7 : 0.84));
      this.hold = now + this.wait;
      this.wait = Math.min(this.wait * 2, 480000);
    } else if (med < 36.5) {
      this.stuck = 0;
      this.from = null;
      if (++this.ok >= (this.fast ? 1 : 3) && now > this.hold && before < this.max) {
        this.ok = 0;
        this.P = Math.min(this.max, before * (this.fast ? 1.3 : 1.12));
      }
    }
    return Math.abs(this.P - before) > 1;
  }
}

const query = new URLSearchParams(location.search);

export class Storm3D {
  // null where this can't be done (no WebGL, or only a software one), so the caller can paint instead.
  // ?gl=off in the address asks for the painting; ?gl=soft lets a software renderer try (for tests).
  static create(stage, engine, makeFallback) {
    if (query.get('gl') === 'off') return null;
    try {
      return new Storm3D(stage, engine, makeFallback);
    } catch (e) {
      console.warn('Storm at Sea: painting it instead.', e.message || e);
      return null;
    }
  }

  constructor(stage, engine, makeFallback) {
    this.stage = stage;
    this.engine = engine;
    this.makeFallback = makeFallback;
    this.fallback = null;
    this.running = false;
    this.t = rand(0, 900); // a different sea every visit
    this.flashes = [];
    this.timers = new Set();
    this.tune = {}; // hold a value still: { storm, rain, wind, surf }, each 0..1 (tests, screenshots)
    this.s = null; // the mix and the storm, eased
    this.ph = new Float64Array(NW);
    this.ph32 = new Float32Array(NW);
    this.co = new Float64Array(8);
    this.so = new Float64Array(8);
    this.shaft = rand(0, 200);
    this.bolt = new Float32Array(NB * 2);
    this.tilt = [0, 0];
    this.tiltV = [0, 0];
    this.lamp = 0;
    this.moonGap = 0.3;
    this.lastDraw = 0;

    const cv = document.createElement('canvas');
    cv.className = 'stage-gl';
    cv.setAttribute('aria-hidden', 'true');
    this.cv = cv;
    this.onLost = (e) => {
      e.preventDefault();
      this.lost = true;
      // phones take the graphics context away now and then; if it isn't handed back, paint instead
      this.later(() => this.lost && this.giveUp(), 2500);
    };
    this.onRestored = () => {
      try {
        this.initGL();
        this.lost = false;
        this.cw = 0;
        this.resize();
      } catch {
        this.giveUp();
      }
    };
    cv.addEventListener('webglcontextlost', this.onLost);
    cv.addEventListener('webglcontextrestored', this.onRestored);
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: query.get('gl') !== 'soft' };
    const gl = (query.get('gl') === '1' ? null : cv.getContext('webgl2', opts)) || cv.getContext('webgl', opts);
    if (!gl) throw new Error('no WebGL here');
    this.gl = gl;
    try {
      this.initGL(); // throws if the shaders won't build on this device
    } catch (e) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw e;
    }

    const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    this.coarse = coarse;
    const saved = Number(store.get('storm3d:px', 0)) || 0;
    this.pacer = new Pacer(saved > 40000 ? saved : coarse ? 170000 : 300000, saved > 40000);

    // the 2D stage stays on top (it takes the taps), cleared so this shows through from beneath it
    stage.width = stage.height = 2;
    stage.parentNode.insertBefore(cv, stage);
    this.resize();
  }

  get drivers() {
    return this.engine.scene?.drivers || {};
  }

  // ---- GL
  initGL() {
    const gl = this.gl;
    const GL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const lodExt = !GL2 && gl.getExtension('EXT_shader_texture_lod');
    const TX = GL2
      ? '#define TX(p) texelFetch(uN,ivec2(p)&255,0)\n'
      : lodExt
        ? '#define TX(p) texture2DLodEXT(uN,(mod(p,256.0)+0.5)/256.0,0.0)\n'
        : '#define TX(p) texture2D(uN,(mod(p,256.0)+0.5)/256.0)\n';
    const vsrc = (s) => (GL2 ? '#version 300 es\n#define attribute in\n#define varying out\n' + s : s);
    const fsrc = (s) =>
      GL2
        ? '#version 300 es\nprecision highp float;\nprecision highp int;\n#define varying in\n#define texture2D texture\nout vec4 fragColor;\n#define gl_FragColor fragColor\n' + TX + s
        : (lodExt ? '#extension GL_EXT_shader_texture_lod : enable\n' : '') + 'precision highp float;\n' + TX + s;
    const prog = (vs, fs) => {
      const p = gl.createProgram();
      for (const [type, src] of [
        [gl.VERTEX_SHADER, vsrc(vs)],
        [gl.FRAGMENT_SHADER, fsrc(fs)],
      ]) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
        gl.attachShader(p, sh);
      }
      gl.bindAttribLocation(p, 0, 'aP');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const name = gl.getActiveUniform(p, i).name;
        u[name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, name);
      }
      return { p, u };
    };
    this.pScene = prog(VS, FS_SCENE);
    this.pFinal = prog(VS, FS_FINAL);

    this.noiseTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NT, NT, 0, gl.RGBA, gl.UNSIGNED_BYTE, packed);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    this.tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.fbo = gl.createFramebuffer();
    this.sceneTex = gl.createTexture();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    // a stopwatch on the chip itself, where the browser offers one
    this.timer = GL2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this.query = null;
    this.timing = false;
  }
  // read the stopwatch started a few frames back, if its answer is in; true when the size changed
  clockChip() {
    const gl = this.gl;
    if (!this.timer || !this.query || this.timing) return false;
    if (!gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)) return false;
    const spoiled = gl.getParameter(this.timer.GPU_DISJOINT_EXT);
    const ms = gl.getQueryParameter(this.query, gl.QUERY_RESULT) / 1e6;
    gl.deleteQuery(this.query);
    this.query = null;
    return spoiled ? false : this.pacer.gpu(ms);
  }

  // ---- size
  resize() {
    if (this.fallback) return this.fallback.resize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(this.stage.clientWidth * dpr));
    let h = Math.max(2, Math.round(this.stage.clientHeight * dpr));
    const k = Math.sqrt(Math.min(1, 3200000 / (w * h)));
    w = Math.round(w * k);
    h = Math.round(h * k);
    if (w === this.cw && h === this.ch) return;
    this.cw = this.cv.width = w;
    this.ch = this.cv.height = h;
    this.asp = w >= h ? [w / h, 1] : [1, h / w];
    const pc = this.pacer;
    pc.max = Math.min(this.coarse ? 600000 : 1600000, w * h);
    pc.min = Math.min(40000, pc.max);
    // the small picture's canvas is as big as it will ever be asked to be; less of it is used when slow
    const s = Math.sqrt(pc.max / (w * h));
    this.texW = Math.ceil(w * s) + 2;
    this.texH = Math.ceil(h * s) + 2;
    if (!this.lost) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.texW, this.texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.layout();
    this.compose();
    this.draw(0);
  }
  layout() {
    const k = Math.sqrt(this.pacer.size / (this.cw * this.ch));
    this.rw = clamp(Math.round(this.cw * k), 16, this.texW);
    this.rh = clamp(Math.round(this.ch * k), 16, this.texH);
  }
  // where things stand for this shape of screen: the horizon a little below the middle, the moon
  // up and to the left, the buoy left of centre where its bell is heard from
  compose() {
    const tall = clamp(this.asp[1] - 1, 0, 1);
    const horizon = lerp(0.56, 0.52, tall); // down the screen
    this.pitch = Math.atan(((2 * horizon - 1) * this.asp[1]) / FL);
    const hfov = Math.atan(this.asp[0] / FL);
    const el = lerp(17, 27, tall) * (Math.PI / 180);
    const az = -hfov * lerp(0.44, 0.36, tall);
    this.moonDir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const ba = -hfov * 0.3;
    this.buoy = [Math.sin(ba) * BUOY_DIST, 0, Math.cos(ba) * BUOY_DIST];
    this.hfov = hfov;
  }

  // ---- the clock
  start() {
    if (this.fallback) return this.fallback.start();
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    this.pacer.deaf = Math.max(this.pacer.deaf, last + 1500); // the first frames are slow for reasons of their own
    const loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      if (dt < 1 / 31) return; // 30 frames a second is plenty, and kinder to a battery
      last = now;
      if (document.hidden || this.lost) return;
      if (this.pacer.frame(dt * 1000, now) | this.clockChip()) {
        this.layout();
        store.set('storm3d:px', Math.round(this.pacer.size));
      }
      if (this.pacer.stuck >= 4) return this.giveUp(); // can't keep up however small: paint it instead
      this.t += Math.min(dt, 0.1);
      this.draw(Math.min(dt, 0.1));
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    if (this.fallback) return this.fallback.stop();
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  // done with: called when the player moves on to another scene, or closes
  destroy() {
    this.stop();
    this.fallback = null;
    this.dispose();
  }
  dispose() {
    if (this.gone) return;
    this.gone = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    this.cv.removeEventListener('webglcontextlost', this.onLost);
    this.cv.removeEventListener('webglcontextrestored', this.onRestored);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.cv.remove();
  }
  giveUp() {
    if (this.gone) return;
    const was = this.running;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.dispose();
    this.fallback = this.makeFallback();
    if (was) this.fallback.start();
  }
  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.gone) fn();
    }, ms);
    this.timers.add(id);
  }

  // ---- what the engine tells us
  event(e) {
    if (this.fallback) return this.fallback.event(e);
    const wait = () => Math.max(0, this.engine.delayUntil(e.at) * 1000);
    if (e.type === 'lightning') this.later(() => this.strike(e.km, e.strength), wait());
    // the bell rings because the buoy lurched: lurch it
    else if (e.type === 'shot' && e.layer === 'buoy') this.later(() => this.lurch(), wait());
  }
  lurch() {
    const a = rand(0, TAU);
    this.tiltV[0] += Math.cos(a) * 0.5;
    this.tiltV[1] += Math.sin(a) * 0.5;
  }
  // lightning, km away. Near ones come down in front of us; far ones stay up in the cloud.
  strike(km = 3, strength = 0.8) {
    const near = km < 4.2;
    const az = rand(-1, 1) * this.hfov * (near ? 0.78 : 1.3);
    const d = clamp(km * 1000, 1400, 16000);
    const dir = [Math.sin(az), 0, Math.cos(az)];
    const fl = { t0: this.t, km, dir, pos: [dir[0] * d, near ? CB + 380 : rand(1000, 1700), dir[2] * d], pulses: [], bolt: null };
    // a stroke is rarely one stroke: the channel re-lights two, three, four times
    const n = strength > 0.5 ? Math.round(rand(2, 4)) : Math.random() < 0.4 ? 2 : 1;
    let t = 0;
    for (let i = 0; i < n; i++) {
      fl.pulses.push({ t, life: rand(0.05, 0.16), k: (i ? rand(0.45, 1) : 1) * lerp(0.55, 1, strength) });
      t += rand(0.07, 0.22);
    }
    fl.end = t + 0.7;
    if (near) fl.bolt = this.channel(dir, d);
    this.flashes.push(fl);
  }
  // the path a stroke takes from the cloud to the sea: start straight, then kink every half
  channel(dir, d) {
    const lat = [dir[2], 0, -dir[0]]; // across our line of sight
    const top = CB + 60;
    const n = 16;
    const kink = (amp) => {
      const a = new Float32Array(n + 1);
      a[n] = rand(-1, 1) * amp * 1.6;
      for (let step = n; step > 1; step >>= 1) {
        for (let i = 0; i < n; i += step) a[i + step / 2] = (a[i] + a[i + step]) / 2 + rand(-1, 1) * amp;
        amp *= 0.56;
      }
      return a;
    };
    const off = kink(top * 0.1);
    const dep = kink(top * 0.07);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([dir[0] * d + lat[0] * off[i] + dir[0] * dep[i], top * (1 - i / n), dir[2] * d + lat[2] * off[i] + dir[2] * dep[i]]);
    // a fork that sets off sideways partway down and gives out in mid-air
    const j = 4 + Math.floor(Math.random() * 6);
    const side = Math.random() < 0.5 ? -1 : 1;
    const len = top * rand(0.2, 0.38);
    let p = pts[j];
    for (let i = 0; i < 5; i++) {
      pts.push(p);
      const s = side * len * 0.25 * rand(0.4, 1.3);
      p = [p[0] + lat[0] * s, p[1] - len * 0.25 * rand(0.6, 1.2), p[2] + lat[2] * s];
    }
    return { pts, fork: Math.random() < 0.75 };
  }

  // the storm and the mix, each 0..1, eased so nothing jumps when a slider moves
  mood(dt) {
    const layers = this.engine.scene?.layers;
    const lv = (id, d) => layers?.get(id)?.level ?? d;
    const storm = this.tune.storm ?? clamp(((this.drivers.storm ?? 0.7) - 0.35) / 0.65, 0, 1);
    const want = {
      storm,
      rain: this.tune.rain ?? clamp(lv('rain', 0.8) / 0.8, 0, 1.2) * lerp(0.45, 1, storm),
      wind: this.tune.wind ?? clamp(lv('wind', 0.55) / 0.55, 0, 1.4) * lerp(0.5, 1, storm),
      surf: this.tune.surf ?? clamp(lv('surf', 0.82) / 0.82, 0, 1.2),
    };
    if (!this.s) this.s = want;
    const k = 1 - Math.exp(-dt / 3.5);
    for (const key of Object.keys(want)) this.s[key] += (want[key] - this.s[key]) * k;
    return this.s;
  }

  cover(x, z, cov) {
    const o = this.co;
    const qx = x * COVF;
    const qz = z * COVF;
    const c = nzv(qx + o[0], qz + o[1]) * 0.52 + nzv(qx * 2.7 + o[2], qz * 2.7 + o[3]) * 0.3 + nzv(qx * 6.3 + o[4], qz * 6.3 + o[5]) * 0.18;
    return sstep(1 - cov, 1.24 - cov, c);
  }

  draw(dt) {
    if (this.fallback || this.lost || this.gone || !this.cw) return;
    const gl = this.gl;
    const t = this.t;
    const m = this.mood(dt);
    const amp = lerp(0.62, 1, m.storm) * lerp(0.55, 1, clamp(m.surf, 0, 1.1));
    const cov = 0.5 + 0.2 * m.storm;

    // every wave's phase, kept wrapped so hours in it's as exact as the first second
    for (let i = 0; i < NW; i++) {
      const p = (WAVES[i].p0 - WAVES[i].w * t) % TAU;
      this.ph[i] = p;
      this.ph32[i] = p;
    }
    const sea = (x, z, n = NM) => seaAt(x, z, this.ph, n) * amp;

    // the weather drifts down the wind: each layer of the noise at its own pace, so the clouds
    // change as they go rather than sliding past as one sheet
    const wk = 0.5 + 0.5 * m.wind;
    const drift = (arr, i, freq, speed, cross = 0, turn = null) => {
      let vx = WIND[0] * speed - WIND[1] * cross;
      let vz = WIND[1] * speed + WIND[0] * cross;
      if (turn) [vx, vz] = [turn[0] * vx - turn[1] * vz, turn[1] * vx + turn[0] * vz]; // a layer the shader turns
      arr[i] = (((arr[i] - vx * freq * dt) % 256) + 256) % 256;
      arr[i + 1] = (((arr[i + 1] - vz * freq * dt) % 256) + 256) % 256;
    };
    drift(this.co, 0, COVF, 20 * wk);
    drift(this.co, 2, COVF * 2.7, 24 * wk, 2);
    drift(this.co, 4, COVF * 6.3, 29 * wk, -3);
    drift(this.co, 6, 0.0031, 34 * wk, 4);
    drift(this.so, 0, 0.83, 1.6);
    drift(this.so, 2, 2.9, 1.1, 0.3);
    drift(this.so, 4, 0.42, 0.7 * wk);
    drift(this.so, 6, 1.9, 0.9 * wk, 0.1, [0.384615, 0.923077]);
    this.shaft = (this.shaft + dt * 0.035 * wk) % 256;

    // the eye: riding the swell, leaning a little with it, wandering a little
    const yaw = (nzv(t * 0.021, 5.5) - 0.5) * 0.1;
    const sx = (sea(1.5, 0, 2) - sea(-1.5, 0, 2)) / 3;
    const sz = (sea(0, 1.5, 2) - sea(0, -1.5, 2)) / 3;
    const pitch = this.pitch + Math.atan(sz) * 0.22;
    const roll = -Math.atan(sx) * 0.3;
    const cam = [0, CAM_H + 0.8 * sea(0, 0, 3), 0];
    const F = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const R0 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const U0 = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const R = [R0[0] * cr + U0[0] * sr, R0[1] * cr + U0[1] * sr, R0[2] * cr + U0[2] * sr];
    const U = [U0[0] * cr - R0[0] * sr, U0[1] * cr - R0[1] * sr, U0[2] * cr - R0[2] * sr];
    // where a point in the world lands on the screen, in the shader's own units (or null, behind us)
    const project = (p) => {
      const d = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
      const z = dot(d, F);
      return z > 1 ? [(dot(d, R) * FL) / z, (dot(d, U) * FL) / z] : null;
    };

    // the buoy: up and down with the water under it, and rocking after the slope like a weighted thing
    const [bx, , bz] = this.buoy;
    const by = sea(bx, bz) * 0.96;
    const tx = -((sea(bx + 0.8, bz) - sea(bx - 0.8, bz)) / 1.6) * 0.9;
    const tz = -((sea(bx, bz + 0.8) - sea(bx, bz - 0.8)) / 1.6) * 0.9;
    if (dt > 0) {
      for (const [i, target] of [
        [0, tx],
        [1, tz],
      ]) {
        this.tiltV[i] += ((target - this.tilt[i]) * 4.8 - this.tiltV[i] * 1.1) * dt;
        this.tilt[i] = clamp(this.tilt[i] + this.tiltV[i] * dt, -0.7, 0.7);
      }
    } else this.tilt = [tx, tz];
    const up = norm([this.tilt[0], 1, this.tilt[1]]);
    // it also swings a little on its mooring, this way and that
    const swing = 0.5 * Math.sin(t * 0.11) + 0.3 * Math.sin(t * 0.047 + 1.3);
    const x0 = [Math.cos(swing), 0, -Math.sin(swing)];
    const k0 = dot(x0, up);
    const bX = norm([x0[0] - up[0] * k0, x0[1] - up[1] * k0, x0[2] - up[2] * k0]);
    const bZ = [bX[1] * up[2] - bX[2] * up[1], bX[2] * up[0] - bX[0] * up[2], bX[0] * up[1] - bX[1] * up[0]];
    const buoy = [bx, by, bz];
    const lampPos = [bx + up[0] * LAMP_Y, by + up[1] * LAMP_Y, bz + up[2] * LAMP_Y];
    // one red flash every four seconds; a filament takes a moment to light and longer to die
    const lit = t % 4 < 0.35;
    this.lamp += ((lit ? 1 : 0) - this.lamp) * (1 - Math.exp(-dt / (lit ? 0.03 : 0.09)));
    // is there a wave between us and the lamp?
    let clear = 9;
    for (let i = 1; i < 20; i++) {
      const k = i / 20;
      clear = Math.min(clear, lerp(cam[1], lampPos[1], k) - sea(lerp(cam[0], lampPos[0], k), lerp(cam[2], lampPos[2], k)));
    }
    const lampS = project(lampPos) || [9, 9];

    // the moon finds a gap now and then
    const ms = (CB + 500) / this.moonDir[1];
    const gap = 1 - this.cover(this.moonDir[0] * ms, this.moonDir[2] * ms, cov);
    this.moonGap += (gap - this.moonGap) * (dt > 0 ? 1 - Math.exp(-dt / 1.5) : 1);

    // lightning: the brightest stroke going decides where the light is
    let I = 0;
    let boltI = 0;
    let forkI = 0;
    let fl = null;
    this.flashes = this.flashes.filter((x) => t - x.t0 < x.end);
    for (const x of this.flashes) {
      const age = t - x.t0;
      let v = 0; // the light it throws: flickering while the channel is lit, then dying away
      let bv = 0; // the channel itself: gone almost at once
      for (const p of x.pulses) {
        const a = age - p.t;
        if (a < 0) continue;
        v = Math.max(v, a < p.life ? p.k * rand(0.7, 1) : p.k * Math.max(0, 1 - (a - p.life) / 0.26) ** 2);
        bv = Math.max(bv, a < p.life ? p.k : p.k * Math.max(0, 1 - (a - p.life) / 0.07));
      }
      if (v > I) {
        I = v;
        fl = x;
      }
      if (x.bolt && bv > boltI) {
        const pts = x.bolt.pts.map(project);
        if (!pts.every(Boolean)) continue;
        pts.forEach((p, i) => this.bolt.set(p, i * 2));
        boltI = bv;
        // the fork shows on the first stroke only; the re-strikes keep to the main channel
        forkI = x.bolt.fork && age < x.pulses[0].life + 0.07 ? 1 : 0;
        this.boltD = Math.hypot(x.pos[0], x.pos[2]);
      }
    }
    const km = fl ? fl.km : 5;
    const FC = [0.62, 0.76, 1.0];
    const flashCol = FC.map((c) => c * I * 3.2);
    const seaAtt = (I * 0.8) / (1 + (km / 2.4) ** 2);
    const flashSea = FC.map((c) => c * seaAtt);
    const flashAmb = I * clamp(1.1 / (0.5 + km), 0.05, 1) * 0.1;
    const flashFog = clamp(1.4 / (0.6 + km * 0.9), 0.03, 1) * 0.02;

    if (this.timer && !this.query && dt > 0) {
      this.query = gl.createQuery();
      gl.beginQuery(this.timer.TIME_ELAPSED_EXT, this.query);
      this.timing = true;
    }

    // ---- the world, small
    const ps = this.pScene;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.rw, this.rh);
    gl.useProgram(ps.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    let u = ps.u;
    gl.uniform1i(u.uN, 0);
    gl.uniform3fv(u.uCam, cam);
    gl.uniform3fv(u.uR, R);
    gl.uniform3fv(u.uU, U);
    gl.uniform3fv(u.uF, F);
    gl.uniform2fv(u.uAsp, this.asp);
    gl.uniform1f(u.uFl, FL);
    gl.uniform1f(u.uJit, Math.random());
    gl.uniform1f(u.uPix, (2 * this.asp[1]) / (this.rh * FL));
    gl.uniform1f(u.uTw, t % 1000);
    gl.uniform1f(u.uExp, this.tune.exposure ?? 1.35);
    gl.uniform1fv(u.uPh, this.ph32);
    gl.uniform1f(u.uAmp, amp);
    gl.uniform1f(u.uRain, clamp(m.rain, 0, 1.2));
    gl.uniform1f(u.uCov, cov);
    gl.uniform1f(u.uWindK, clamp(m.wind, 0, 1.4));
    gl.uniform1f(u.uFoam, lerp(0.5, 1, m.storm) * lerp(0.6, 1, clamp(m.surf, 0, 1)));
    gl.uniform1f(u.uFogD, 0.002 * (0.65 + 0.85 * clamp(m.rain, 0, 1.2)));
    gl.uniform1f(u.uShaft, this.shaft);
    gl.uniform2fv(u.uCo, Float32Array.from(this.co));
    gl.uniform2fv(u.uSo, Float32Array.from(this.so));
    gl.uniform3fv(u.uMoonDir, this.moonDir);
    gl.uniform3f(u.uMoonCol, 0.14, 0.17, 0.21);
    gl.uniform1f(u.uMoonGap, this.moonGap);
    gl.uniform3fv(u.uFlashPos, fl ? fl.pos : [0, 1200, 9000]);
    gl.uniform3fv(u.uFlashDir, fl ? norm(fl.pos) : [0, 0.3, 0.95]);
    gl.uniform3fv(u.uFlashCol, flashCol);
    gl.uniform3fv(u.uFlashSea, flashSea);
    gl.uniform1f(u.uFlashAmb, flashAmb);
    gl.uniform1f(u.uFlashFog, flashFog);
    gl.uniform1f(u.uFlashR, 1 / (800 * 800));
    gl.uniform3fv(u.uBuoy, buoy);
    gl.uniform3fv(u.uBuoyUp, up);
    gl.uniform3fv(u.uBuoyX, bX);
    gl.uniform3fv(u.uBuoyZ, bZ);
    gl.uniform3fv(u.uLampPos, lampPos);
    gl.uniform1f(u.uLamp, this.lamp);
    gl.uniform1f(u.uBoltD, this.boltD || 3000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- enlarged to the screen, with what belongs to the screen: the stroke, the lamp, the rain
    const pf = this.pFinal;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.cw, this.ch);
    gl.useProgram(pf.p);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    u = pf.u;
    gl.uniform1i(u.uN, 0);
    gl.uniform1i(u.uS, 1);
    gl.uniform2f(u.uSc, this.rw / this.texW, this.rh / this.texH);
    gl.uniform2f(u.uTx, 1 / this.texW, 1 / this.texH);
    gl.uniform2fv(u.uAsp, this.asp);
    gl.uniform1f(u.uT, t % 600);
    gl.uniform1f(u.uJit, Math.random());
    gl.uniform1f(u.uRain, clamp(m.rain, 0, 1.2));
    gl.uniform1f(u.uSlant, 0.2 + 0.36 * clamp(m.wind, 0, 1.4));
    gl.uniform1f(u.uPxS, (2 * this.asp[1]) / this.ch);
    const rc = 0.085 + flashAmb * 1.2 + seaAtt * 0.14;
    gl.uniform3f(u.uRainCol, rc * 0.82, rc * 0.92, rc);
    gl.uniform3f(u.uLampCol, this.lamp, this.lamp * 0.2, this.lamp * 0.11);
    gl.uniform3f(u.uLampS, lampS[0], lampS[1], sstep(-0.2, 0.3, clear));
    gl.uniform2fv(u.uBolt, this.bolt);
    gl.uniform1f(u.uBoltI, boltI);
    gl.uniform1f(u.uForkI, forkI);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.timing) {
      gl.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.timing = false;
    }

    if (!this.shown) {
      this.shown = true;
      this.cv.classList.add('on'); // fade up from black
    }
  }
}
