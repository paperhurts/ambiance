// Forest Waterfall, built as a place and then looked at.
//
// The storm (storm3d.js) is worked out afresh every frame, because all of it moves. Almost
// nothing here does: you stand still in a ravine, and the rock and the trees stay where they
// are. So the place is worked out once, slowly and at the screen's full sharpness (the
// "survey"), and what's kept is not a picture but what a picture is made from: for every pixel
// its colour in shade, the colour the sun would add, how far away it is, and whether there's
// water there. Then thirty times a second a much lighter pass makes a picture out of that, and
// that pass is where everything that moves lives: the water going down, the sun coming and going
// through the leaves, the pool's ripples and what's mirrored in them, the mist, the leaves
// stirring.
//
// The place, after the East Hampton falls in summer: a stream comes down a staircase of slate,
// spreads across the rounded back of one great slab, pours off its front edge into a pool, and
// runs out past you between boulders. Slate lies in flat beds, so every ledge here, in the
// stream and up the banks, sits at a whole number of beds: the land is shaped smooth and then
// snapped to them. The sun is high and behind the falls, so the canopy glows and the rock faces
// you look at are in shade, lit from above where the leaves let the sun through.

import { World, clamp, lerp, rand, norm, cross, f, query, VS, NOISE_GLSL } from './world.js';

const SUN = norm([0.16, 0.8, 0.58]); // where the sun is: high, behind the falls, a little to the right
const GLOW = norm([0.13, 0.52, 0.84]); // the brightest part of the sky that shows through the leaves
const FAR = 120; // nothing is kept further off than this (metres)

// Trees: where each stands (x, z), how thick, how it leans, and its bark (0 smooth and grey, 1 dark
// and furrowed). Nearest first.
const TREES = [
  [-6.4, 7.6, 0.36, 0.07, 0.0, 0.7],
  [6.7, 9.2, 0.25, -0.09, 0.02, 0.2],
  [-8.8, 13.0, 0.3, 0.03, 0.02, 0.9],
  [9.2, 14.6, 0.31, -0.04, 0.0, 0.5],
  [-5.4, 18.6, 0.22, 0.05, -0.02, 0.1],
  [5.0, 19.8, 0.25, -0.02, 0.03, 0.8],
  [-9.6, 22.0, 0.31, 0.02, 0.0, 0.4],
  [7.7, 24.6, 0.27, -0.05, 0.0, 0.15],
  [-3.4, 27.2, 0.2, 0.03, 0.02, 0.6],
  [2.7, 29.0, 0.24, -0.02, 0.0, 0.3],
  [10.8, 30.0, 0.3, -0.03, 0.01, 0.9],
  [-12.2, 30.5, 0.31, 0.04, 0.0, 0.5],
  [-6.2, 36.0, 0.25, 0.0, 0.0, 0.2],
  [0.9, 38.0, 0.22, 0.02, 0.0, 0.7],
  [5.2, 41.0, 0.26, -0.02, 0.0, 0.4],
  [-10.5, 44.0, 0.3, 0.02, 0.0, 0.1],
  [12.4, 46.0, 0.3, -0.02, 0.0, 0.6],
  [-2.6, 50.0, 0.25, 0.0, 0.0, 0.3],
];
// Sheets of leaves hung across the view, nearest first: how far off, how big a leaf (further off
// a "leaf" is a spray of them), how low the canopy comes at the middle, how much it stirs.
const SHEETS = [
  [6.6, 0.095, 4.4, 1.0],
  [9.2, 0.11, 5.3, 0.8],
  [12.8, 0.125, 6.3, 0.6],
  [17.2, 0.14, 7.1, 0.45],
  [23.5, 0.16, 7.4, 0.3],
  [30.5, 0.19, 7.9, 0.2],
  [40.0, 0.23, 8.3, 0.12],
  [54.0, 0.29, 8.8, 0.08],
];
// Boulders in the pool: centre (x, z), half-size (x, z), how high it stands out of the water, how
// it's turned, and how its top tips
const STONES = [
  [-4.5, 6.5, 1.7, 1.15, 0.62, 0.35, 0.25],
  [4.4, 6.1, 1.5, 1.05, 0.7, -0.4, -0.2],
  [-6.7, 8.7, 2.3, 1.5, 0.95, 0.15, 0.15],
  [6.6, 8.1, 2.1, 1.4, 0.85, -0.2, -0.15],
  [0.7, 8.4, 0.62, 0.45, 0.2, 0.5, 0.3],
  [-2.4, 10.7, 0.85, 0.6, 0.26, 0.2, -0.3],
  [2.9, 10.0, 0.95, 0.62, 0.3, -0.3, 0.2],
  [-1.2, 6.9, 0.38, 0.3, 0.1, 0.9, 0.2],
  [1.9, 7.3, 0.33, 0.27, 0.08, -0.6, -0.2],
];
const NTREE = TREES.length;
const NSHEET = SHEETS.length;
const sheetOf = (z) => {
  let k = 0;
  while (k < NSHEET - 1 && SHEETS[k + 1][0] <= z) k++;
  return k;
};
// leaves and trees in the order a ray meets them: [0, sheet] or [1, tree]
const ITEMS = [];
SHEETS.forEach((_, k) => {
  ITEMS.push([0, k]);
  TREES.forEach((t, i) => sheetOf(t[1]) === k && ITEMS.push([1, i]));
});
const vec = (a) => `vec${a.length}(${a.map(f).join(',')})`;
const list = (type, rows) => `${type}[${rows.length}](${rows.join(',')})`;

// What both passes need to agree on: the lie of the stream, and where the sun gets through
const SHARED = `
const float BED=0.65;                 // the thickness of one bed of slate (metres)
const float LIP=14.0;                 // how far off the great slab's front edge is
const float FANTOP=17.3;              // and its back, where the staircase begins
const float FAR=${f(FAR)};
const vec3 SUN=${vec(SUN)};
const vec3 GLOW=${vec(GLOW)};
// the middle of the water, and half its width, at a distance z
float cxAt(float z){return z<FANTOP?-0.35*(1.0-clamp((z-LIP)/(FANTOP-LIP),0.0,1.0)):0.30*sin((z-FANTOP)*0.75)*smoothstep(FANTOP,FANTOP+1.5,z);}
float hwAt(float z){float s=clamp((z-LIP)/(FANTOP-LIP),0.0,1.0);return z<FANTOP?mix(3.4,0.95,pow(s,0.75)):mix(0.95,0.55,clamp((z-FANTOP)/5.5,0.0,1.0));}
// 1 where the sun gets down through the leaves to a place, 0 in their shade. o: the leaves stirring.
float sunMask(vec3 p,vec2 o){
  vec2 q=p.xz-SUN.xz*(p.y/SUN.y);    // slide down the sunbeam to the ground
  float c=nv(q*0.37+o)*0.55+nv(q*1.15+o*3.0+7.0)*0.45;
  vec2 e=(q-vec2(-0.5,13.9))/vec2(3.0,2.6);                 // the canopy is thinnest over the falls themselves
  return smoothstep(0.52,0.62,c+0.15*exp(-dot(e,e)));
}
`;

// ---------------------------------------------------------------------------------------------
// The survey: everything about the place that doesn't change, for one pixel.
const FS_SURVEY = `varying vec2 vP;
uniform vec3 uCam,uR,uU,uF;
uniform vec2 uAsp;
uniform float uFl,uPix;
uniform int uZ;                       // always 0. Added to every loop's count, so the compiler can't know the count and doesn't try to unroll the loop: this shader builds several times faster for it
${NOISE_GLSL}
${SHARED}
const mat2 RJ=mat2(0.9563,0.2924,-0.2924,0.9563);            // which way the joints in the slate run
const vec3 SUNC=vec3(3.15,2.80,2.15);                         // sunlight: warm
const vec3 SKYC=vec3(0.21,0.30,0.30);                         // the light in the shade: green off the leaves, blue off the sky
const vec3 GNDC=vec3(0.035,0.050,0.030);                      // what comes back up off the ground
const vec4 STONE_A[${STONES.length}]=${list('vec4', STONES.map((s) => vec(s.slice(0, 4))))};
const vec4 STONE_B[${STONES.length}]=${list('vec4', STONES.map((s) => vec([s[4], Math.cos(s[5]), Math.sin(s[5]), s[6]])))};     // height, turn (cos, sin), tip
const vec4 TREE_A[${NTREE}]=${list('vec4', TREES.map((t) => vec([t[0], t[1], t[2], t[5]])))};       // x, z, girth, bark
const vec2 TREE_B[${NTREE}]=${list('vec2', TREES.map((t) => vec([t[3], t[4]])))};                    // lean
const ivec2 ITEM[${ITEMS.length}]=${list('ivec2', ITEMS.map((it) => `ivec2(${it[0]},${it[1]})`))};          // what a ray meets, in order: (0, sheet of leaves) or (1, tree)
const vec4 SHEET[${NSHEET}]=${list('vec4', SHEETS.map(vec))};
const vec2 NEAR[8]=vec2[8](vec2(0.0),vec2(1.0,0.0),vec2(0.0,1.0),vec2(0.0,0.30),vec2(0.38,0.0),vec2(-0.38,0.0),vec2(0.0,0.38),vec2(0.0,-0.38));

// ---------------- the ground
float blk(vec2 p,vec2 sz,float seed){              // slate breaks into blocks: one random height to each
  vec2 q=p/sz;q.x+=0.5*mod(floor(q.y),2.0);        // laid like brickwork, so no joint runs on forever
  return tx(floor(q)+seed).x-0.5;
}
float joint(vec2 p,vec2 sz){                       // how near a joint between two blocks (metres)
  vec2 q=p/sz;q.x+=0.5*mod(floor(q.y),2.0);
  vec2 e=(0.5-abs(fract(q)-0.5))*sz;
  return min(e.x,e.y);
}
float terr(float g){                               // snap a height to the beds: flat treads, sudden risers
  float v=g/BED,fl=floor(v),fr=v-fl;
  return BED*(fl+0.05*fr+0.95*smoothstep(0.86,0.99,fr));
}
float course(float z){                             // the long profile of the stream
  if(z<LIP)return -0.28-0.6*smoothstep(3.0,12.5,z);                                   // the pool's bed, deepest under the falls
  if(z<FANTOP){float s=(z-LIP)/(FANTOP-LIP);return 1.45+1.80*sqrt(max(1.0-(1.0-s)*(1.0-s),0.0));}   // the slab's rounded back
  return 3.25+(z-FANTOP)*0.47;                                                         // and a steady climb, which the beds turn into steps
}
float floorHalf(float z){                          // half the width of what the water has: the pool, then its own rock
  float rock=hwAt(z)+mix(0.9,1.8,smoothstep(FANTOP-0.6,FANTOP+1.2,z));
  return mix(mix(4.8,7.4,smoothstep(2.0,10.0,z)),rock,smoothstep(LIP-0.9,LIP-0.1,z));
}
// the tallest boulder at (x, z), or far below if there's none. Each is flattish on top the way slate
// breaks, rounded at the shoulder, squarer than a circle and rounder than a box, and no two sides alike.
float stones(vec2 p){
  if(p.y>13.0)return -9.0;
  vec2 wv=0.13*nz(p*0.85).yz;                      // (one set of unevenness serves them all: they're in different places)
  float wr=1.0+0.24*(nv(p*1.6)-0.5),wb=0.20*(nv(p*2.1)-0.5);
  float h=-9.0;
  for(int i=0;i<${STONES.length}+uZ;i++){
    vec4 a=STONE_A[i],b=STONE_B[i];
    vec2 d=p-a.xy;d=vec2(b.y*d.x+b.z*d.y,-b.z*d.x+b.y*d.y)/a.zw+wv;
    vec2 e=abs(d);e=e*e*sqrt(e);
    float r=pow(e.x+e.y,0.4)*wr,k=max(r-0.45,0.0);
    h=max(h,r<1.0?b.x*sqrt(max(1.0-k*k*3.306,0.0))*(1.0+b.w*d.x+wb):-(r-1.0)*3.0*min(a.z,a.w));
  }
  return h;
}
vec2 jointed(vec2 p){return RJ*p+1.6*nz(p*0.23+9.0).yz+0.5*nz(p*0.71+2.0).yz;}        // the joints wander
float ground(vec2 p){                              // the height of the ravine itself at (x, z)
  float cx=cxAt(p.y),c=course(p.y);
  float up=max(abs(p.x-cx)-floorHalf(p.y),0.0);    // how far up the bank
  float bank=smoothstep(0.2,1.6,up);
  float g=c+up*0.60*(1.0-0.22*smoothstep(4.0,13.0,up))+smoothstep(0.0,3.0,up)*1.5*(nv(p*0.105+3.7)-0.5);
  vec2 j=jointed(p);
  g+=bank*(1.25*blk(j,vec2(6.3,4.3),5.0)+0.55*blk(j,vec2(2.6,1.8),11.0)+0.20*blk(j*mat2(0.8,0.6,-0.6,0.8),vec2(0.9,0.65),47.0));
  g+=bank*(0.17*(nv(p*1.7+2.0)-0.5)+0.07*(nv(p*4.9)-0.5));                             // edges broken off, not ruled
  float dip=(0.065*p.x+0.030*p.y)*smoothstep(0.3,1.5,g);                               // the beds aren't quite level
  float h=g<0.0?g:terr(g-dip)+dip;
  float fz=smoothstep(LIP-0.02,LIP+0.02,p.y)*(1.0-smoothstep(FANTOP+0.1,FANTOP+0.5,p.y));
  if(fz>0.0){                                      // the great slab: one rounded back, not stepped
    float e=abs(p.x-cx)/(hwAt(p.y)+0.9);
    h=mix(h,c-0.30*e*e-0.04+0.05*(nv(p*1.7)-0.5),fz*(1.0-smoothstep(0.92,1.02,e)));
  }
  return h;
}
float land(vec2 p){return max(ground(p),stones(p));}      // the height of whatever's underfoot at (x, z)
float rough(vec2 p){return 0.030*(nv(p*3.7)-0.5)+0.012*(nv(p*11.0+4.0)-0.5);}        // no flat is quite flat
// follow a ray over the ground; how far it gets before going in, or -1
float march(vec3 ro,vec3 rd,float tmax){
  float t=0.05,lo=0.05,hi=0.0;
  int closing=0;                                   // once it has gone in: halving our way to where, this many times
  for(int i=0;i<348+uZ;i++){
    float tt=closing>0?0.5*(lo+hi):t;
    vec3 p=ro+rd*tt;
    float h=p.y-land(p.xz);
    if(closing>0){
      if(h<0.0)hi=tt;else lo=tt;
      if(++closing>7)return lo;
    }else{
      if(rd.y>0.0&&p.y>16.0)break;
      if(h<0.0){hi=t;closing=1;continue;}
      lo=t;
      t+=clamp(h*0.5,0.006+0.0016*t,0.5);
      if(t>tmax)break;
    }
  }
  return closing>0?lo:-1.0;
}

// ---------------- far off, and the air between
vec3 bg(vec3 rd){                                  // behind everything: leaves too far off to be leaves, and the glare of the sky
  float gd=max(dot(rd,GLOW),0.0);
  vec3 c=mix(vec3(0.030,0.075,0.022),vec3(0.20,0.42,0.07),clamp(rd.y*1.4+0.25,0.0,1.0));
  c=mix(c,vec3(0.62,0.85,0.22),pow(gd,5.0)*0.9);
  c=mix(c,mix(vec3(0.70,1.02,1.60),vec3(2.0,1.84,1.08),pow(gd,70.0)),pow(gd,22.0));     // the bright sky in the gap: blue, whitening toward the sun
  c+=vec3(3.0,2.8,2.0)*pow(gd,120.0);
  vec2 q=rd.xy/(0.6+rd.z);
  float n2=nv(q*23.0+5.0);
  c*=0.55+0.9*(nv(q*9.0)*0.6+n2*0.4);
  // and here and there, away from the glare, a scrap of blue sky
  float sky=smoothstep(0.54,0.72,nv(q*4.3+11.0)*0.65+n2*0.35)*smoothstep(0.05,0.45,rd.y)*(1.0-pow(gd,4.0));
  return mix(c,vec3(0.40,0.76,1.55),sky);
}
vec3 hazed(vec3 c,float t,vec3 rd){                // summer air: things further off sink into green light
  float gd=max(dot(rd,GLOW),0.0);
  vec3 hz=mix(vec3(0.070,0.160,0.150),vec3(0.68,0.70,0.30),pow(gd,3.0));     // blue with distance, gold toward the sun
  return mix(hz,c,exp(-t*0.0068));
}

// ---------------- trees
// a tree is a leaning column; how much of this pixel it covers, how far off, and which way its bark faces
float tree(vec3 ro,vec3 rd,int i,float px,out float t,out vec3 n,out vec3 hp){
  t=0.0;n=vec3(0.0,0.0,-1.0);hp=vec3(0.0);
  vec4 a=TREE_A[i];
  vec3 ax=normalize(vec3(TREE_B[i].x,1.0,TREE_B[i].y));
  vec3 oc=ro-vec3(a.x,0.0,a.y);
  float dv=dot(rd,ax);
  vec3 dp=rd-ax*dv,op=oc-ax*dot(oc,ax);
  float qa=dot(dp,dp),qb=dot(dp,op);
  if(qa<1.0e-6)return 0.0;
  float tc=-qb/qa;                                 // where the ray passes nearest the middle of it
  if(tc<0.2)return 0.0;
  float r=a.z*clamp(1.0-0.022*(ro.y+rd.y*tc),0.45,1.15);      // thinner higher up
  float dm=sqrt(max(dot(op,op)-qb*qb/qa,0.0));
  float cov=smoothstep(r+px*tc,r-px*tc,dm);
  if(cov<=0.0)return 0.0;
  float hh=qb*qb-qa*(dot(op,op)-r*r);
  t=hh>0.0?(-qb-sqrt(hh))/qa:tc;
  hp=ro+rd*t;
  vec3 rel=hp-vec3(a.x,0.0,a.y);
  n=normalize(rel-ax*dot(rel,ax)+1.0e-5);
  return cov;
}

// ---------------- leaves
// are there leaves at a spot on a sheet? q: across and up. gnd: how high the ground is there.
float leafy(vec2 q,int k,float gnd,vec3 cam){
  vec4 s=SHEET[k];
  float fk=float(k);
  float m=nv(q*0.31+fk*17.3)*0.6+nv(q*0.9+fk*7.1+3.0)*0.4;
  float yb=s.z-0.20*abs(q.x)*(k<2?1.7:1.0)+1.6*(nv(vec2(q.x*0.21+fk*5.0,fk))-0.5);       // the canopy hangs lower at the sides
  float can=smoothstep(0.40,0.60,m)*smoothstep(yb-0.5,yb+1.3,q.y);
  vec3 dir=normalize(vec3(q.x,q.y,s.x)-cam);
  can*=1.0-0.9*smoothstep(0.955,0.992,dot(dir,GLOW));                                       // a hole where the light pours in
  // and things growing out of the ledges: saplings, bushes, never in the water
  float hg=q.y-gnd;
  float low=smoothstep(0.03,0.22,hg)*(1.0-smoothstep(0.55,1.5+1.2*nv(vec2(q.x*0.7,fk*3.0)),hg))
      *smoothstep(0.45,0.62,nv(vec2(q.x*0.50+fk*11.0,fk*2.0+0.3*q.y)))*step(hwAt(s.x)+0.7,abs(q.x-cxAt(s.x)))*step(0.02,gnd);
  return max(can,low*0.95);
}
// one sheet of leaves where a ray meets it. Colour (already multiplied by how much of the pixel) and cover.
vec4 sheet(vec2 q,int k,float px,float gnd,vec3 cam){
  vec4 s=SHEET[k];
  float c=s.y,fk=float(k);
  // nothing grows in the open air between the undergrowth and the canopy
  if(q.y<s.z-0.20*abs(q.x)*(k<2?1.7:1.0)-1.6&&q.y>gnd+3.0)return vec4(0.0);
  vec2 id0=floor(q/c);
  // leaves come in sprays: whether there are any is asked once for each patch of 3 x 3 of them
  vec2 b0=floor((id0-1.0)/3.0),b1=floor((id0+1.0)/3.0);
  // (the four patches a pixel's neighbours can fall in, then the spot itself, then a little way toward the sun)
  float dn[6];
  for(int i=0;i<6+uZ;i++){
    vec2 at=i==4?q:i==5?q+vec2(SUN.x,SUN.y)*1.3:(vec2(i%2==0?b0.x:b1.x,i<2?b0.y:b1.y)+0.5)*3.0*c;
    dn[i]=leafy(at,k,i==5?gnd+9.0:gnd,cam);
  }
  float d00=dn[0],d10=dn[1],d01=dn[2],d11=dn[3];
  float body=smoothstep(0.62,0.98,dn[4])*0.86;                   // deep in a mass of leaves there is no seeing through it
  if(max(max(d00,d10),max(d01,d11))<=0.02&&body<=0.0)return vec4(0.0);
  float dark=mix(0.42,1.0,clamp(fk/4.0,0.0,1.0));                 // the nearest leaves are under the canopy's own shade
  float open=1.0-dn[5];                                           // how much sun gets to the leaves here: more where there is little above them
  vec4 acc=vec4(vec3(0.030,0.085,0.020)*(SKYC*1.5+GNDC)*dark+vec3(0.10,0.20,0.015)*SUNC*0.10*open,body);
  // the twig this spray hangs from
  vec2 bq=floor(id0/3.0);
  float tw=(tx(bq+fk*53.0).x*2.0-1.0)*1.3;
  vec2 td=q-(bq+0.5)*3.0*c;td=vec2(cos(tw)*td.x+sin(tw)*td.y,-sin(tw)*td.x+cos(tw)*td.y);
  float dq=bq.x==b0.x?(bq.y==b0.y?d00:d01):(bq.y==b0.y?d10:d11);
  float twig=smoothstep(px,-px,abs(td.y)-0.004-0.02*c)*step(abs(td.x),1.4*c)*step(0.25,dq)*step(fk,4.5);
  acc=vec4(mix(acc.rgb,vec3(0.030,0.022,0.014)*dark,twig),max(acc.a,twig*0.9));
  for(int n=0;n<18+uZ;n++){                                          // two leaves to each of the nine cells round about
    int j=n/2,m=n%2;
    vec2 id=id0+vec2(float(j%3)-1.0,float(j/3)-1.0);
    vec2 bi=floor(id/3.0);
    float den=bi.x==b0.x?(bi.y==b0.y?d00:d01):(bi.y==b0.y?d10:d11);
    if(den<=0.02)continue;
    vec4 spr=tx(bi+fk*53.0);                                       // this spray's own numbers
    float lean=(spr.x*2.0-1.0)*1.3;                                // leaves on one twig lie much the same way
    float kind=smoothstep(0.15,0.85,spr.y);                        // and are one kind of leaf: from the blue-green of hemlock to the yellow-green of birch
    {
      vec4 r=tx(id+fk*31.0+float(m)*97.0);                         // this leaf's own numbers
      if(r.z>=den)continue;
      vec2 d=q-(id+0.5+(r.xy-0.5)*1.1)*c;
      float an=lean+(r.w*2.0-1.0)*0.95+(m==0?0.6:-0.6);
      float ca=cos(an),sa=sin(an);
      d=vec2(ca*d.x+sa*d.y,-sa*d.x+ca*d.y);
      float l=c*(0.62+0.45*fract(r.w*7.0)),w=l*0.44;
      float a=smoothstep(px,-px,abs(d.y)-w*(1.0-d.x*d.x/(l*l)))*step(abs(d.x),l);     // a leaf: two arcs meeting at points
      if(a<=0.0)continue;
      float hue=fract(r.z*13.0);
      vec3 alb=mix(mix(vec3(0.016,0.090,0.050),vec3(0.080,0.150,0.016),kind),mix(vec3(0.060,0.235,0.090),vec3(0.215,0.350,0.035),kind),hue);
      vec3 thru=mix(mix(vec3(0.12,0.48,0.11),vec3(0.31,0.55,0.04),kind),mix(vec3(0.29,0.74,0.17),vec3(0.54,0.77,0.08),kind),hue);     // sunlight that has come through a leaf
      float turned=step(mix(0.985,0.60,step(0.965,spr.z)),fract(r.w*17.0));          // a few have turned early; now and then, half a spray
      alb=mix(alb,vec3(0.40,0.25,0.03),turned);thru=mix(thru,vec3(1.05,0.60,0.05),turned);
      vec3 col=alb*(SKYC*1.5+GNDC)*dark+thru*SUNC*0.40*open*(0.25+0.75*r.x)*mix(0.45,1.0,dark);
      col+=vec3(0.46,0.57,0.56)*step(0.88,r.x)*open*0.45*dark;     // some lie flat to the light and shine
      col*=1.0-0.28*(1.0-smoothstep(0.0,0.10*w+px,abs(d.y)));      // the midrib
      acc=vec4(mix(acc.rgb,col,a),max(acc.a,a));
    }
  }
  return vec4(acc.rgb*acc.a,acc.a);
}

void main(){
  vec2 uv=vP*uAsp;
  vec3 ro=uCam,rd=normalize(uv.x*uR+uv.y*uU+uFl*uF);
  vec3 A=vec3(0.0),S=vec3(0.0),RF=vec3(0.0);
  float depth=1.0,Fm=0.0,Pm=0.0,Kc=0.0,sway=0.0,shaft=0.0;
  for(int pass=0;pass<2+uZ;pass++){
    // ---- where the ray ends: on rock, in the pool, or nowhere
    float tw=rd.y<-1.0e-4?-ro.y/rd.y:1.0e9;
    float t=march(ro,rd,min(tw,90.0));
    float lw=tw<90.0?land(ro.xz+rd.xz*tw):1.0;     // the ground where the ray meets the pool's level: under water?
    vec3 oa,os=vec3(0.0);                          // what's there, lit by the sky; and what the sun would add
    float tEnd=1.0e4,water=0.0,fm=0.0,kc=0.0;
    if(t>0.0){
      tEnd=t;
      vec3 p=ro+rd*t;
      // the ground's height here and round about, all asked for in one place: for which way it faces,
      // for whether there's a drop just upstream, and for how hemmed in it is
      float e=max(0.012,0.0016*t);
      float hs[8];
      for(int i=0;i<8+uZ;i++){
        vec2 o=NEAR[i]*(i<3?e:1.0);
        hs[i]=land(p.xz+o)+(i<3?rough(p.xz+o):0.0);
      }
      vec3 n=normalize(vec3(hs[0]-hs[1],e,hs[0]-hs[2]));
      float cx=cxAt(p.z),hw=hwAt(p.z);
      float off=abs(p.x-cx)/hw;                    // 0 in the middle of the water, 1 at its edge
      float m1=nv(p.xz*0.9),m2=nv(p.xz*3.3+5.0),m3=nv(p.xz*9.0+1.0);
      // the water's own course: it frays at its edges, and thins as it spreads over the slab
      float inz=step(LIP-0.06,p.z)*(1.0-smoothstep(25.0,27.0,p.z));
      fm=inz*(1.0-smoothstep(0.72,1.02,off+(nv(vec2(p.x*3.0,p.z*0.6))-0.5)*0.34));
      float steep=1.0-smoothstep(0.30,0.80,n.y);
      float churn=smoothstep(0.22,0.50,hs[3]-p.y)*(1.0-steep);                          // at the foot of a drop
      kc=mix(steep*0.5,1.0,churn);
      float onS=p.z<13.5?step(p.y-0.04,stones(p.xz)):0.0;              // on one of the boulders in the pool
      float wet=max(fm,1.0-smoothstep(0.04,mix(0.55,0.17,onS),p.y))*step(p.z,27.0);
      wet=max(wet,inz*(1.0-smoothstep(1.0,1.5,off)));
      // slate: grey-blue, in layers. On a face the layers show as dark seams with a lit lip over each.
      float lay=p.y/0.115+1.7*nv(vec2(p.y*2.1,0.5))+0.30*(m2-0.5)+0.10*p.x;
      float lf=fract(lay),lk=tx(vec2(floor(lay),3.0)).y;
      float show=smoothstep(2.5,8.0,0.10/(uPix*t));                    // (not where they'd be only a pixel or two apart)
      float sm=(1.0-smoothstep(0.0,0.16,lf))*(0.22+0.78*lk*lk)*show;   // 1 in the parting between two layers: some deep, most slight
      float lip=smoothstep(0.16,0.22,lf)*(1.0-smoothstep(0.22,0.45,lf))*lk*show;
      float face=1.0-smoothstep(0.35,0.75,n.y);
      vec2 jp=jointed(p.xz);                                           // the same blocks the land is built of
      float tone=mix(0.5+0.60*blk(jp,vec2(2.6,1.8),11.0)+0.40*blk(jp*mat2(0.8,0.6,-0.6,0.8),vec2(0.9,0.65),47.0),0.30+0.55*m1,onS);
      vec3 alb=mix(vec3(0.096,0.116,0.150),vec3(0.268,0.284,0.308),clamp(tone*0.6+tx(vec2(floor(lay),3.0)).x*0.2+m1*0.2,0.0,1.0));
      alb*=mix(vec3(1.0),vec3(1.17,0.93,1.06),smoothstep(0.50,0.75,nv(vec2(p.y*1.1+0.4*m1,7.5)))*(1.0-0.6*onS));     // some beds are plum-coloured, not blue
      alb=mix(alb,vec3(0.24,0.19,0.13),0.30*m2);                       // weathered browner here and there
      // and there's iron in it: rust, in stains on the flats and run down the faces in streaks
      float rust=smoothstep(0.36,0.62,1.0-m1)*smoothstep(0.42,0.72,mix(m2,nv(vec2(jp.x*3.1+jp.y*2.3,p.y*0.55+7.0)),face))*(1.0-0.6*onS);
      alb=mix(alb,vec3(0.38,0.190,0.068),rust*0.7);
      float crack=1.0-smoothstep(0.0,0.035,min(joint(jp,vec2(2.6,1.8)),joint(jp*mat2(0.8,0.6,-0.6,0.8),vec2(0.9,0.65))+0.012));
      alb*=1.0-0.42*crack*smoothstep(2.0,6.0,0.035/(uPix*t))*(1.0-onS);
      alb*=(1.0-0.52*sm*face)*(1.0+0.22*lip*face);
      // lichen in pale rosettes where it's dry, moss where it's flat and damp, last year's leaves on the high ground
      float lich=smoothstep(0.66,0.72,nv(p.xz*5.3+p.y*6.1)*0.6+m3*0.4)*(1.0-wet);
      lich=max(lich,onS*smoothstep(0.57,0.63,nv(p.xz*3.7+p.y*2.0+11.0)*0.62+m3*0.38)*(1.0-wet));     // boulders wear more of it
      alb=mix(alb,mix(vec3(0.42,0.48,0.40),vec3(0.46,0.31,0.10),smoothstep(0.64,0.70,m2)),lich*0.75);     // most of it pale, some the orange kind
      float moss=smoothstep(0.58,0.70,m1*0.55+m2*0.45+0.05*(1.0-face))*smoothstep(0.55,0.90,n.y)*(1.0-fm)*step(0.04,p.y);
      moss=max(moss,smoothstep(0.60,0.78,m2)*face*0.35*(1.0-fm)*step(0.05,p.y));        // and a little spilling down the faces
      moss*=1.0-0.45*onS;
      alb=mix(alb,mix(vec3(0.028,0.105,0.024),vec3(0.140,0.240,0.026),m3),moss);
      float high=smoothstep(7.0,10.0,p.y-0.3*abs(p.x))*smoothstep(0.7,0.9,n.y);
      alb=mix(alb,mix(vec3(0.25,0.125,0.040),vec3(0.07,0.14,0.03),m2),high);
      alb*=mix(1.0,0.50,wet*(1.0-moss));                               // wet rock is dark
      // light from above, less of it in corners
      float ao=1.0/(1.0+1.7*(max(hs[4]-p.y-0.06,0.0)+max(hs[5]-p.y-0.06,0.0)+max(hs[6]-p.y-0.06,0.0)+max(hs[7]-p.y-0.06,0.0)));
      oa=alb*(vec3(0.24,0.29,0.31)*(0.45+0.55*n.y)*1.25+GNDC*(1.0-n.y)*2.0)*ao;
      oa+=wet*(1.0-moss)*SKYC*0.10*pow(1.0-max(dot(n,-rd),0.0),3.0);    // and wet rock shines
      // sunlight, where the land itself isn't in the way
      float nl=max(dot(n,SUN),0.0),sh=1.0;
      if(nl>0.0){
        float ts=0.06;
        for(int i=0;i<26+uZ;i++){
          vec3 q=p+SUN*ts;
          float hs=q.y-land(q.xz);
          sh=min(sh,10.0*hs/ts);
          if(sh<0.02||q.y>15.0)break;
          ts+=clamp(hs,0.05,0.7);
        }
        sh=clamp(sh,0.0,1.0);
      }
      os=alb*SUNC*nl*sh+moss*vec3(0.10,0.18,0.02)*SUNC*0.10*sh;         // moss glows a little with the sun in it
      oa=hazed(oa,t,rd);os*=exp(-t*0.0068);
    }else if(lw<0.0){
      // ---- the pool: what's seen through it, on its bed
      tEnd=tw;water=1.0;
      vec3 pw=ro+rd*tw;
      vec3 rr=refract(rd,vec3(0.0,1.0,0.0),0.752);
      float dep=-lw;
      vec3 pb=pw+rr*(dep/max(-rr.y,0.2));
      dep=max(mix(dep,-land(pb.xz),0.6),0.03);
      float cob=nv(pb.xz*3.1)*0.6+nv(pb.xz*8.3+2.0)*0.4;
      vec3 alb=mix(vec3(0.060,0.047,0.024),vec3(0.200,0.155,0.072),cob)*(0.6+0.4*smoothstep(0.35,0.5,cob));     // its bed is brown: stones, old leaves
      vec3 dim=exp(-(dep+0.15)*vec3(1.7,0.70,1.05));                   // the water takes the red out first, then the blue: amber in the shallows, green-blue in the deep
      oa=alb*vec3(0.26,0.30,0.25)*0.60*dim+vec3(0.003,0.034,0.030)*(1.0-dim.g);
      os=alb*SUNC*0.16*dim;
      oa=hazed(oa,tw,rd);os*=exp(-tw*0.0068);
    }else oa=bg(rd);

    // ---- what stands in front of that: leaves and trees, nearest first
    vec4 acc=vec4(0.0);
    float sw=0.0;
    for(int it=0;it<${ITEMS.length}+uZ;it++){
      if(acc.a>0.995)break;
      int k=ITEM[it].y;
      float tk=ITEM[it].x==0?(SHEET[k].x-ro.z)/rd.z:-1.0;
      if(tk>0.0&&tk<tEnd){
        vec3 pk=ro+rd*tk;
        vec4 lf=sheet(pk.xy,k,uPix*tk*0.75,land(vec2(pk.x,SHEET[k].x)),uCam);
        if(lf.a>0.0){
          lf.rgb=hazed(lf.rgb/lf.a,tk,rd)*lf.a;
          acc+=(1.0-acc.a)*lf;
          sw=max(sw,lf.a*SHEET[k].w);
        }
      }
      if(ITEM[it].x==1){
        int i=k;
        float tt;vec3 n,hp;
        float cov=tree(ro,rd,i,uPix*0.75,tt,n,hp);
        if(cov<=0.0||tt>tEnd)continue;
        float gy=land(hp.xz);
        if(hp.y<gy-0.05)continue;                                   // below ground
        float bk=TREE_A[i].w;
        float az=atan(n.x,n.z);
        float fur=nv(vec2(az*(5.0+9.0*bk),hp.y*(0.9+0.8*bk)+bk*40.0))*0.6+nv(vec2(az*23.0,hp.y*4.0))*0.4;
        vec3 alb=mix(vec3(0.215,0.205,0.185),vec3(0.105,0.062,0.036),bk)*(0.55+0.9*fur);
        float ms=smoothstep(0.50,0.68,nv(vec2(az*2.0+bk*9.0,hp.y*0.7)))*(1.0-smoothstep(1.2,4.5,hp.y-gy));
        alb=mix(alb,vec3(0.085,0.19,0.03),ms*0.85);                 // moss up from the foot
        vec3 col=alb*(SKYC*(0.75+0.25*n.y)+GNDC)*1.3*(0.55+0.45*smoothstep(0.0,2.5,hp.y-gy));
        // the sun is behind them: it catches their edges
        col+=alb*SUNC*max(dot(n,SUN),0.0)*sunMask(hp,vec2(0.0))*0.9;
        col+=vec3(0.9,0.95,0.6)*0.10*pow(1.0-abs(dot(n,rd)),4.0)*max(dot(rd,GLOW),0.0);
        col=hazed(col,tt,rd);
        acc+=(1.0-acc.a)*vec4(col*cov,cov);
      }
    }
    float T=1.0-acc.a;
    if(pass==0){
      A=acc.rgb+T*oa;S=T*os;
      depth=clamp(min(tEnd,FAR)/FAR,0.0,1.0);
      Fm=fm*T;Pm=water*T;Kc=kc;sway=sw;
      // how much sunlit air the eye looks through on the way: shafts
      float lim=min(tEnd,34.0),ds=lim/14.0,sum=0.0;
      for(int i=0;i<14+uZ;i++){
        vec3 q=ro+rd*(ds*(float(i)+0.5));
        vec2 e=(q.xz-vec2(-0.3,13.5))/vec2(4.5,3.0);
        sum+=sunMask(q,vec2(0.0))*(0.07+1.5*exp(-dot(e,e))*exp(-max(q.y,0.0)*0.45))*ds;     // thicker in the spray off the falls
      }
      shaft=1.0-exp(-sum*0.030);
      if(water<0.5)break;
      ro=ro+rd*tw;ro.y=0.0;rd=reflect(rd,vec3(0.0,1.0,0.0));       // and once more, for what the pool mirrors
    }else{
      vec3 pe=ro+rd*min(tEnd,60.0);
      float vs=sunMask(pe,vec2(0.0));
      oa=mix(oa+os*vs,vec3(0.40,0.54,0.60)*0.75+vec3(1.62,1.48,1.18)*0.7*vs,fm*mix(0.25,0.72,clamp(kc*2.0,0.0,1.0)));
      RF=acc.rgb+T*oa;
    }
  }
  // kept as square roots, so the dark end has room; the picture is put back together in real light
  float dq=depth*255.0;
  o0=vec4(sqrt(clamp(A*0.25,0.0,1.0)),sway);
  o1=vec4(sqrt(clamp(S*0.25,0.0,1.0)),Kc);
  o2=vec4(floor(dq)/255.0,fract(dq),Fm,Pm);
  o3=vec4(sqrt(clamp(RF*0.25,0.0,1.0)),shaft);
}`;

// ---------------------------------------------------------------------------------------------
// The picture, thirty times a second: the survey, with everything that moves put back.
const FS_SHOW = `varying vec2 vP;
uniform sampler2D uT0,uT1,uT2,uT3;
uniform vec3 uCam,uR,uU,uF;
uniform vec2 uAsp;
uniform float uFl,uT,uJit,uSunK,uWind,uFlowK,uExp,uDbg;
uniform vec2 uSunO;
uniform vec4 uFlow,uRip;
uniform vec2 uGrade;
uniform float uRing;
${NOISE_GLSL}
${SHARED}
vec3 dec(vec3 c){return c*c*4.0;}
void main(){
  vec2 uv=vP*0.5+0.5;
  // leaves stir: nearer ones more, and in gusts that cross the view
  float sw=texture2D(uT0,uv).a;
  if(sw>0.004){
    float gust=0.30+0.70*nv(vec2(uv.x*2.2-uT*0.13,uv.y*1.6+uT*0.04));
    vec2 wob=vec2(sin(uT*1.7+uv.y*23.0+uv.x*7.0)+0.6*sin(uT*2.9+uv.x*31.0+uv.y*5.0),0.6*cos(uT*1.3+uv.x*19.0));
    uv+=wob*sw*gust*uWind*0.0017/uAsp;
  }
  vec4 t0=texture2D(uT0,uv),t1=texture2D(uT1,uv),t2=texture2D(uT2,uv),t3=texture2D(uT3,uv);
  vec2 sp=(uv*2.0-1.0)*uAsp;
  vec3 rd=normalize(sp.x*uR+sp.y*uU+uFl*uF);
  float dist=(t2.r+t2.g/255.0)*FAR;
  vec3 p=uCam+rd*dist;
  float V=sunMask(p,uSunO)*uSunK;                               // the sun here, now
  vec3 col=dec(t0.rgb)+dec(t1.rgb)*V;

  // ---- the water coming down
  float F=t2.b;
  if(F>0.004){
    float l=(p.x-cxAt(p.z))/hwAt(p.z);                          // across the water
    float s=p.z+1.6*p.y;                                        // along it: this falls as the water does
    float fall=clamp(t1.a*2.0,0.0,1.0),churn=clamp(t1.a*2.0-1.0,0.0,1.0);
    // falling: white, ribbed along its length, the ribs going down with it
    float a1=nv(vec2(l*26.0,s*1.1+uFlow.x))*0.45+nv(vec2(l*61.0+3.0,s*2.3+uFlow.y))*0.33+nv(vec2(l*143.0+7.0,s*3.1+uFlow.y*2.0))*0.22;
    // running over a flat: glass, with lines of light sliding along it
    float a2=nv(vec2(l*14.0,s*2.2+uFlow.z))*0.6+nv(vec2(l*37.0,s*5.0+uFlow.w))*0.4;
    float white=mix(smoothstep(0.56,0.82,a2)*0.40,0.16+0.84*smoothstep(0.30,0.66,a1),fall);
    white=mix(white,0.72+0.28*nv(p.xz*9.0+uRip.xy*5.0),churn);
    white*=mix(1.0,0.55+0.45*uFlowK,0.6);
    vec3 wc=vec3(0.40,0.54,0.60)*(0.45+0.55*a1)+vec3(1.62,1.48,1.18)*V*(0.40+0.60*a1);      // blue where it's in shade, warm where the sun's on it
    col=mix(col,wc,F*clamp(white,0.0,1.0));
  }

  // ---- the pool
  float P=t2.a;
  if(P>0.004){
    float dz=max(LIP-p.z,0.0);
    // rings spreading from where the curtain lands, and the stir of the current coming toward us
    vec2 g=nz(p.xz*1.3+uRip.xy).yz*0.30+nz(p.xz*3.9+uRip.zw).yz*0.30+nz(p.xz*vec2(7.0,11.0)+uRip.zw*3.0).yz*0.22;
    float ring=sin(dz*7.0-uRing)*exp(-dz*0.25);
    vec2 tilt=g*0.10+vec2(0.0,-0.08)*ring;
    vec3 n=normalize(vec3(tilt.x,1.0,tilt.y));
    vec2 off=tilt*vec2(1.0,2.2)/max(dist,2.0);                  // ripples bend what's seen in the water, less far off
    vec2 uvb=uv+off*0.28,uvr=uv+off*0.75;
    float okb=step(0.5,texture2D(uT2,uvb).a),okr=step(0.5,texture2D(uT2,uvr).a);       // (never reach outside the pool)
    uvb=mix(uv,uvb,okb);uvr=mix(uv,uvr,okr);
    vec3 caus=vec3(0.7+1.3*smoothstep(0.55,0.95,1.0-abs(nv(p.xz*2.1+uRip.xy*2.0)-nv(p.xz*2.7+uRip.zw+4.0))*5.0));
    vec3 bed=dec(texture2D(uT0,uvb).rgb)+dec(texture2D(uT1,uvb).rgb)*V*caus;
    vec3 refl=dec(texture2D(uT3,uvr).rgb);
    float fr=0.03+0.97*pow(1.0-max(dot(n,-rd),0.0),4.0);       // (ruffled water mirrors more than still)
    vec3 pool=mix(bed,refl,fr);
    // the sun on the water, where it reaches it
    vec3 r=reflect(rd,n);
    pool+=vec3(3.3,3.05,2.4)*V*(pow(max(dot(r,SUN),0.0),320.0)*7.0+pow(max(dot(r,SUN),0.0),18.0)*0.05);
    // foam where the curtain lands, thinning into flecks that drift out toward us
    float fl=nv(p.xz*vec2(5.5,1.9)+uRip.zw*2.0)*0.55+nv(p.xz*vec2(13.0,6.0)+uRip.zw*5.0)*0.45;      // drawn out along the current
    float foam=smoothstep(0.58,0.80,fl+0.95*exp(-dz*1.9)-0.20*smoothstep(0.8,5.0,dz))*exp(-dz*0.34);
    foam=max(foam,(1.0-smoothstep(0.0,0.45,dz))*step(abs(p.x-cxAt(LIP)),3.7));
    pool=mix(pool,vec3(0.36,0.47,0.51)+vec3(1.56,1.43,1.15)*V,foam*0.85);
    col=mix(col,pool,P);
  }

  // ---- the air: spray hanging over the foot of the falls, and the sun slanting through it
  vec3 pm=uCam+rd*min(dist,13.2);
  vec2 em=(pm.xy-vec2(-0.3,0.9))/vec2(4.4,1.8);
  float mist=exp(-dot(em,em))*smoothstep(8.0,13.0,dist)*(0.07+0.13*nv(vec2(pm.x*0.7+uRip.x,pm.y*0.9-uT*0.11)))*uFlowK;
  col=mix(col,vec3(0.31,0.41,0.43)+vec3(1.35,1.18,0.85)*uSunK*0.25,mist);
  float beam=t3.a*(0.80+0.20*nv(vec2(sp.x*3.0+uT*0.05,sp.y*2.0-uT*0.03)));
  col+=vec3(1.0,0.83,0.46)*beam*uSunK*0.40;

  // (for looking into the survey: one of its layers on its own)
  if(uDbg>0.5)col=uDbg<1.5?dec(t0.rgb):uDbg<2.5?dec(t1.rgb):uDbg<3.5?dec(t3.rgb):uDbg<4.5?vec3(fract(dist*0.5),dist/40.0,t3.a):vec3(t2.b,t2.a,t1.a);
  col*=uExp;
  // the grade: fuller colour, and a little more between dark and light
  col=max(mix(vec3(dot(col,vec3(0.2126,0.7152,0.0722))),col,uGrade.x),0.0);
  col=col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);
  col=pow(clamp(col,0.0,1.0),vec3(0.4545));
  col=mix(col,col*col*(3.0-2.0*col),uGrade.y);
  col*=1.0-0.16*dot(vP,vP);
  col+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715)))+uJit)-0.5)*(1.6/255.0);
  gl_FragColor=vec4(col,1.0);
}`;

export class Waterfall3D extends World {
  constructor(stage, engine, makeFallback) {
    const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    super(stage, engine, makeFallback, { needs2: true, maxPixels: coarse ? 1300000 : 2600000 });
    this.t = rand(0, 500);
    this.tune = {}; // hold a value still, for tests and screenshots: { sun, wind, flow, exposure }; layer: 1..5 shows one layer of the survey
    this.live = false; // is there a survey to make pictures from?
    this.want = null; // a size waiting to be surveyed
    this.job = null; // a survey under way
    this.sunO = [rand(0, 50), rand(0, 50)];
    this.flow = [0, 0, 0, 0];
    this.rip = [0, 0, 0, 0];
    this.cover = null; // the painting, shown while the first survey is made if that takes a while
    this.scale = 1; // the picture's size, as a share of the screen's: less on a device that can't keep up
    this.pace = { buf: [], slow: 0, was: 0, off: false };
    this.born = performance.now();
    this.boot();
  }

  // ---- the painting stands in while the place is first surveyed (building the shader for it can
  // take some seconds the first time a browser meets it), and then gives way to it
  resize() {
    super.resize();
    this.cover?.resize();
  }
  start() {
    super.start();
    this.cover?.start();
  }
  stop() {
    super.stop();
    this.cover?.stop();
  }
  uncover() {
    if (!this.cover) return this.reveal();
    const st = this.stage.style;
    this.cv.style.transition = 'none'; // the picture is whole underneath; the painting fades off it
    this.reveal();
    st.transition = 'opacity 1.5s ease';
    st.opacity = '0';
    this.later(() => this.dropCover(), 1600);
  }
  dropCover() {
    if (!this.cover) return;
    this.cover.stop();
    this.cover = null;
    this.stage.width = this.stage.height = 2;
    this.stage.style.transition = '';
    this.stage.style.opacity = '';
  }
  dispose() {
    this.dropCover();
    super.dispose();
  }
  giveUp() {
    if (this.gone) return;
    if (!this.cover) return super.giveUp();
    // the painting is already up: let it stay
    this.stage.style.transition = '';
    this.stage.style.opacity = '';
    this.fallback = this.cover;
    this.cover = null;
    this.running = false;
    cancelAnimationFrame(this.raf);
    super.dispose();
  }

  setup() {
    const gl = this.gl;
    this.pSurvey = this.compile(VS, FS_SURVEY, { outs: 4 }); // a long shader: it's built in the background
    this.pShow = this.program(VS, FS_SHOW);
    this.noiseTex = this.noiseTexture();
    this.tri = this.screenTriangle();
    this.fbo = gl.createFramebuffer();
    this.tex = [0, 1, 2, 3].map(() => gl.createTexture());
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.live = false;
    this.job = null;
    // a stopwatch on the chip, where the browser offers one: how long the survey really took (chipMs)
    this.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.watches = [];
    this.chipMs = 0;
    if (this.size) this.want = { w: this.size[0], h: this.size[1], at: 0 }; // the context came back: survey again
  }

  // a new size: survey the place again for it, once the size has stopped changing. Until that's
  // done the last picture stays up (stretched to fit), so nothing goes black.
  sized(w, h) {
    this.full = [w, h];
    const k = this.scale;
    this.want = { w: Math.max(2, Math.round(w * k)), h: Math.max(2, Math.round(h * k)), at: this.size ? performance.now() + 220 : 0 };
  }

  // where you stand and where you look, for this shape of screen
  view(w, h) {
    const asp = w >= h ? [w / h, 1] : [1, h / w];
    const tall = clamp(asp[1] - 1, 0, 1);
    const fl = lerp(2.3, 3.2, tall); // an upright screen takes a longer lens, to keep the falls the subject
    const cam = [lerp(0.35, 0.15, tall), lerp(1.9, 2.0, tall), lerp(3.4, 2.6, tall)];
    const to = [-0.15, lerp(2.7, 3.1, tall), 16];
    const o = this.tune.view || {}; // (tests look closer: tune.view = { fl, cam, to }, then again())
    const c = o.cam || cam;
    const a = o.to || to;
    const F = norm([a[0] - c[0], a[1] - c[1], a[2] - c[2]]);
    const R = norm(cross([0, 1, 0], F));
    const U = cross(F, R);
    return { asp, fl: o.fl || fl, cam: c, F, R, U };
  }
  again() {
    if (this.full) this.want = { w: Math.max(2, Math.round(this.full[0] * this.scale)), h: Math.max(2, Math.round(this.full[1] * this.scale)), at: 0 };
  }
  // Are frames arriving on time? If not, try a smaller picture, twice; if a smaller picture is no
  // quicker the lateness isn't ours (a browser saving power draws slowly whatever it's asked), so go
  // back to full size and leave it. If it's still too slow at half size, paint it instead.
  keepUp(ms) {
    const pc = this.pace;
    if (pc.off || ms > 400) return;
    pc.buf.push(ms);
    if (pc.buf.length < 24) return;
    const med = pc.buf.sort((a, b) => a - b)[12];
    pc.buf = [];
    if (pc.was && med > pc.was * 0.9) {
      this.scale = 1;
      pc.off = true;
      return this.again();
    }
    pc.was = 0;
    if (med < 45) {
      pc.slow = 0;
      return;
    }
    if (++pc.slow < 3) return;
    pc.slow = 0;
    if (this.scale < 0.55) return this.giveUp();
    pc.was = med;
    this.scale *= 0.7;
    this.again();
  }
  aim(u, v) {
    const gl = this.gl;
    gl.uniform3fv(u.uCam, v.cam);
    gl.uniform3fv(u.uR, v.R);
    gl.uniform3fv(u.uU, v.U);
    gl.uniform3fv(u.uF, v.F);
    gl.uniform2fv(u.uAsp, v.asp);
    gl.uniform1f(u.uFl, v.fl);
  }

  // ---- the survey, a strip at a time so the chip is never asked for more than it can do in a frame
  survey(now) {
    const gl = this.gl;
    if (!this.pSurvey.done()) return; // still being built
    if (this.want && now >= this.want.at && !this.job) {
      const { w, h } = this.want;
      this.want = null;
      this.live = false;
      this.tex.forEach((tex, i) => {
        gl.activeTexture(gl.TEXTURE1 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      this.tex.forEach((tex, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // (first an empty order, to learn how long this browser takes to say that anything at all is done)
      this.job = { w, h, row: 0, rows: Math.max(8, Math.ceil(h / 4)), out: [], lag: 0, probe: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), calm: 0, began: now, v: this.view(w, h) };
      gl.flush();
    }
    const job = this.job;
    if (!job) return;
    const over = (sync) => {
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) return false;
      gl.deleteSync(sync);
      return true;
    };
    if (job.probe) {
      job.lag++;
      if (!over(job.probe)) return;
      job.probe = null;
    }
    while (job.out.length && over(job.out[0])) job.out.shift();
    if (job.row >= job.h) {
      if (job.out.length) return; // the last strips are still being worked out
      // done: this is the size the picture is now
      this.job = null;
      this.size = [job.w, job.h];
      this.v = job.v;
      this.cv.width = job.w;
      this.cv.height = job.h;
      this.live = true;
      this.took = now - job.began;
      this.pace.buf = [];
      return;
    }
    // More strips out than the browser's own lag accounts for means the chip is behind: wait, and
    // ask for less at a time. Keeping up two frames running means it could take more.
    if (job.out.length > job.lag) {
      job.rows = Math.max(4, Math.round(job.rows * 0.6));
      job.calm = 0;
      return;
    }
    if (++job.calm >= 2) job.rows = Math.min(job.h, job.rows * 2);
    const n = Math.min(job.rows, job.h - job.row);
    const u = this.pSurvey.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);
    gl.viewport(0, 0, job.w, job.h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, job.row, job.w, n);
    gl.useProgram(this.pSurvey.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(u.uN, 0);
    this.aim(u, job.v);
    gl.uniform1f(u.uPix, (2 * job.v.asp[1]) / (job.h * job.v.fl));
    gl.uniform1i(u.uZ, 0);
    const watch = this.timer ? gl.createQuery() : null;
    if (watch) gl.beginQuery(this.timer.TIME_ELAPSED_EXT, watch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (watch) {
      gl.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.watches.push(watch);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    job.row += n;
    job.out.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
    gl.flush();
  }

  step(dt, now, ms) {
    try {
      this.survey(now);
    } catch (e) {
      console.warn('Forest Waterfall: painting it instead.', e.message || e);
      return this.giveUp();
    }
    if (this.live) {
      this.draw(dt);
      this.keepUp(ms);
    } else if (!this.size && !this.cover && now - this.born > (query.get('gl') === 'cover' ? 0 : 900)) {
      this.cover = this.makeFallback();
      this.cover.start();
    }
    while (this.watches.length && this.gl.getQueryParameter(this.watches[0], this.gl.QUERY_RESULT_AVAILABLE)) {
      const q = this.watches.shift();
      this.chipMs += this.gl.getQueryParameter(q, this.gl.QUERY_RESULT) / 1e6;
      this.gl.deleteQuery(q);
    }
  }

  draw(dt) {
    if (this.fallback || this.lost || this.gone || !this.live) return;
    const gl = this.gl;
    const t = this.t;
    const u = this.pShow.u;
    // the mix: how much the leaves stir, how hard the water comes down
    const wind = this.tune.wind ?? clamp(this.level('leaves', 0.35) / 0.35, 0, 1.6);
    const falls = Math.max(this.level('east-hampton', 0.78), this.level('french-falls', 0));
    const flowK = this.tune.flow ?? clamp(0.45 + 0.7 * (falls / 0.78), 0.45, 1.25);
    // a cloud crosses the sun now and then
    const sunK = this.tune.sun ?? 0.72 + 0.38 * (0.5 + 0.5 * Math.sin(t * 0.021 + 1.7 * Math.sin(t * 0.0083)));
    const wrap = (v) => ((v % 256) + 256) % 256;
    this.sunO[0] = wrap(this.sunO[0] + dt * 0.012 * (0.4 + wind));
    this.sunO[1] = wrap(this.sunO[1] + dt * 0.007 * (0.4 + wind));
    [2.9, 7.6, 2.0, 6.2].forEach((s, i) => (this.flow[i] = wrap(this.flow[i] + dt * s * (0.75 + 0.25 * flowK))));
    [0.02, 0.33, -0.05, 0.9].forEach((s, i) => (this.rip[i] = wrap(this.rip[i] + dt * s)));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.size[0], this.size[1]);
    gl.useProgram(this.pShow.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.noiseTex);
    gl.uniform1i(u.uN, 0);
    this.tex.forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u['uT' + i], 1 + i);
    });
    this.aim(u, this.v);
    gl.uniform1f(u.uT, t % 1000);
    gl.uniform1f(u.uJit, Math.random());
    gl.uniform1f(u.uSunK, sunK);
    gl.uniform1f(u.uWind, wind);
    gl.uniform1f(u.uFlowK, flowK);
    gl.uniform1f(u.uExp, this.tune.exposure ?? 1.0);
    gl.uniform2f(u.uGrade, this.tune.colour ?? 1.3, this.tune.contrast ?? 0.42);
    gl.uniform1f(u.uDbg, this.tune.layer ?? 0);
    gl.uniform2fv(u.uSunO, this.sunO);
    gl.uniform4fv(u.uFlow, this.flow);
    gl.uniform4fv(u.uRip, this.rip);
    gl.uniform1f(u.uRing, (t * 3.4) % (Math.PI * 2));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!this.shown) this.uncover();
  }
}
