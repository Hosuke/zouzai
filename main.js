import * as THREE from 'three';

/* ============================================================
   黔行星球 · 贵州微缩漫游  （精细化版）
   球形地表 + 低多边形绘本风 + 8 个贵州地标打卡
   ============================================================ */

const R = 30;
const UP = new THREE.Vector3(0, 1, 0);
const params = new URLSearchParams(location.search);
const tmpV1 = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/* ---------- 渲染器 / 场景 ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9dfc4, 95, 260);

const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.1, 900);

/* ---------- 天空穹顶 + 太阳光晕 ---------- */
{
  const skyGeo = new THREE.SphereGeometry(420, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      top:     { value: new THREE.Color(0x5488c2) },
      mid:     { value: new THREE.Color(0x9dc3dd) },
      horizon: { value: new THREE.Color(0xf4ecd8) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h))
                          : mix(horizon, mid, smoothstep(-0.08, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // 太阳光晕 sprite
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const cx = cv.getContext('2d');
  const grad = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,220,1)');
  grad.addColorStop(0.18, 'rgba(255,226,160,0.85)');
  grad.addColorStop(0.5, 'rgba(255,205,120,0.28)');
  grad.addColorStop(1, 'rgba(255,200,110,0)');
  cx.fillStyle = grad; cx.fillRect(0, 0, 256, 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sunSprite.position.set(60, 80, 30).normalize().multiplyScalar(390);
  sunSprite.scale.setScalar(150);
  scene.add(sunSprite);
}

/* ---------- 光照（暖金晨光） ---------- */
const hemi = new THREE.HemisphereLight(0xf4ecd8, 0x45524a, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b0, 1.9);
sun.position.set(60, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 280;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x8098b0, 0.4));

/* ============================================================
   地形：噪声起伏 + 地标处整平
   ============================================================ */
function baseNoise(d) {
  return 0.85 * Math.sin(d.x * 3.1 + 1.3) * Math.sin(d.y * 2.7 - 0.7) * Math.sin(d.z * 3.4 + 2.1)
       + 0.42 * Math.sin(d.x * 6.7 - 0.4) * Math.sin(d.y * 6.1 + 1.9) * Math.sin(d.z * 6.9 + 0.8);
}
function dirFromLatLon(lat, lon) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)).normalize();
}

const LANDMARKS = [
  { id: 'huangguoshu', name: '黄果树瀑布', en: 'Huangguoshu Waterfall', lat: 42,  lon: 10,  flat: 0.36, markerH: 10.5, interactR: 11,
    desc: '亚洲第一大瀑布，宽 101 米、高 77.8 米。丰水期声如奔雷，水雾腾空；瀑布背后还藏着一条可以穿行其中的水帘洞——徐霞客当年走遍山水，也为它写下盛赞。' },
  { id: 'xijiang', name: '西江千户苗寨', en: 'Xijiang Qianhu Miao Village', lat: 10, lon: 95, flat: 0.34, markerH: 7.5, interactR: 9,
    desc: '全世界最大的苗族聚居村寨，千余户吊脚楼顺山势层层叠叠。入夜后万家灯火一齐点亮，整座山谷像一条坠落的星河。' },
  { id: 'fanjing', name: '梵净山', en: 'Fanjingshan', lat: -8, lon: 175, flat: 0.30, markerH: 11.5, interactR: 10,
    desc: '世界自然遗产、武陵山脉主峰。红云金顶一柱擎天，晨间常被云海托起；山里还住着比大熊猫更稀有的黔金丝猴。' },
  { id: 'xiaoqikong', name: '荔波小七孔', en: 'Xiaoqikong, Libo', lat: -46, lon: 125, flat: 0.32, markerH: 5.5, interactR: 9,
    desc: '"地球腰带上的绿宝石"。一座清代七孔古桥静卧碧水，水上森林、68 级跌水瀑布沿溪铺开，绿得像一块通透的翡翠。' },
  { id: 'zhenyuan', name: '镇远古城', en: 'Zhenyuan Ancient Town', lat: -52, lon: 40,  flat: 0.32, markerH: 6.5, interactR: 9,
    desc: '两千多年历史的"太极古城"——舞阳河以一道 S 形穿城而过，北岸府城、南岸卫城，古巷、码头与青龙洞悬阁诉说旧事。' },
  { id: 'wanfenglin', name: '万峰林', en: 'Wanfenglin', lat: -18, lon: -60, flat: 0.36, markerH: 7, interactR: 10,
    desc: '徐霞客叹"天下山峰何其多，唯有此处峰成林"。两万多座锥状喀斯特峰林绵延起伏，峰林间散落着田园与布依族村寨。' },
  { id: 'zhaoxing', name: '肇兴侗寨', en: 'Zhaoxing Dong Village', lat: 22,  lon: -125, flat: 0.32, markerH: 9.5, interactR: 9,
    desc: '"侗乡第一寨"，五座鼓楼巍然矗立，花桥流水穿行其间。这里的侗族大歌无指挥、无伴奏，被誉为"清泉般的音乐"。' },
  { id: 'fast', name: '中国天眼 FAST', en: 'FAST Telescope', lat: 62,  lon: -85, flat: 0.42, markerH: 9, interactR: 12,
    desc: '世界最大单口径射电望远镜，500 米口径的"大锅"静卧平塘群山洼地，日夜聆听来自宇宙深处的脉冲星信号。' },
  { id: 'zunyi', name: '遵义会议会址', en: 'Site of the Zunyi Conference', lat: 35, lon: -40, flat: 0.28, markerH: 6.5, interactR: 9,
    desc: '1935 年 1 月，中共中央政治局在这栋砖木结构的两层小楼里召开了遵义会议，在最危急的关头挽救了党、挽救了红军、挽救了中国革命——这里被称为"伟大转折"的发生地。' },
  { id: 'loushanguan', name: '娄山关', en: 'Loushanguan Pass', lat: -35, lon: -130, flat: 0.32, markerH: 8, interactR: 10,
    desc: '黔北第一险关。1935 年红军在此激战，取得长征以来的首次大捷。毛泽东写下"雄关漫道真如铁，而今迈步从头越"，说的正是这座山口。' },
  { id: 'chishui', name: '四渡赤水渡口', en: 'Chishui River Crossing', lat: 55, lon: -30, flat: 0.30, markerH: 7, interactR: 10,
    desc: '赤水河畔的土城渡口。1935 年红军在此一渡赤水，四渡赤水被称为长征的"神来之笔"。如今河湾竹林葱郁，丹霞赤壁倒映水中，红色记忆与青山绿水同在这条河谷里。' },
  { id: 'cunchao', name: '榕江村超', en: 'Rongjiang Village Super League', lat: -15, lon: 140, flat: 0.30, markerH: 6, interactR: 9,
    desc: '从田间地头踢出来的现象级赛事——榕江"村超"出圈以来吸引上千万人次观赛，球场边的酸汤粉、糯米饭和侗族大歌一起，把流量变成了留量。' },
  { id: 'zhijindong', name: '织金洞', en: 'Zhijin Cave', lat: 15, lon: -72, flat: 0.30, markerH: 6.5, interactR: 9,
    desc: '"中国溶洞之王"，洞内石笋、石幔、石花千姿百态，"银雨树""霸王盔"举世罕见。黄山归来不看岳，织金洞外无洞天。' },
];
const TAGS = {
  huangguoshu: '山水奇观', xijiang: '民族风情', fanjing: '山水奇观', xiaoqikong: '山水奇观',
  zhenyuan: '古镇人文', wanfenglin: '山水奇观', zhaoxing: '民族风情', fast: '大国重器',
  zunyi: '红色印记', loushanguan: '红色印记', chishui: '红色印记', cunchao: '民族风情',
  zhijindong: '山水奇观',
};
/* 每站风物：非遗 + 美食 */
const CULTURE = {
  huangguoshu: ['安顺地戏面具', '安顺裹卷'],
  xijiang: ['苗绣 · 苗族银饰', '酸汤鱼'],
  fanjing: ['土家摆手舞', '社饭 · 梵净翠峰茶'],
  xiaoqikong: ['瑶族猴鼓舞', '荔波酸肉'],
  zhenyuan: ['镇远元宵龙灯会', '陈年道菜扣肉'],
  wanfenglin: ['布依八音坐唱', '布依八大碗'],
  zhaoxing: ['侗族大歌', '腌鱼配糯米饭'],
  fast: ['平塘牙舟陶', '平塘坛子鱼'],
  zunyi: ['黔北剪纸', '遵义羊肉粉'],
  loushanguan: ['黔北花灯戏', '娄山黄焖鸡'],
  chishui: ['赤水独竹漂', '赤水晒醋 · 竹筒饭'],
  cunchao: ['侗族琵琶歌', '榕江牛瘪火锅'],
  zhijindong: ['织金苗族蜡染', '宫保鸡丁（丁宝桢故里）· 织金竹荪'],
};
for (const l of LANDMARKS) { const c = CULTURE[l.id]; if (c) { l.heritage = c[0]; l.food = c[1]; } }
/* 纯装饰区（只参与整平）：梯田 */
const DECOR = [{ id: 'terraces', lat: -30, lon: -18, flat: 0.24 }];

for (const l of LANDMARKS) l.tag = TAGS[l.id];
for (const l of [...LANDMARKS, ...DECOR]) l.dir = dirFromLatLon(l.lat, l.lon);

function heightAt(d) {
  let h = baseNoise(d);
  for (const l of [...LANDMARKS, ...DECOR]) {
    const ang = d.angleTo(l.dir);
    h *= THREE.MathUtils.smoothstep(ang, l.flat * 0.5, l.flat);
  }
  return h;
}
function groundPos(dir, lift = 0) { return dir.clone().multiplyScalar(R + heightAt(dir) + lift); }
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92, metalness: 0, ...opts });
}
function placeOnSphere(obj, dir, lift = 0) {
  obj.position.copy(groundPos(dir, lift));
  obj.quaternion.setFromUnitVectors(UP, dir);
  return obj;
}
function mulberry(seed) {
  let a = seed;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- 星球本体 ---------- */
{
  let geo = new THREE.IcosahedronGeometry(R, 22).toNonIndexed();
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const h = heightAt(v);
    v.multiplyScalar(R + h);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const colors = new Float32Array(p.count * 3);
  const cLow = new THREE.Color(0x49713a), cMid = new THREE.Color(0x64914a),
        cHigh = new THREE.Color(0x8b9070), tmp = new THREE.Color();
  const face = new THREE.Vector3();
  for (let f = 0; f < p.count / 3; f++) {
    face.set(0, 0, 0);
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, f * 3 + k); face.add(v); }
    face.normalize();
    const h = heightAt(face);
    const j = (Math.sin(face.x * 91.7 + face.y * 57.3 + face.z * 73.1) * 0.5 + 0.5) * 0.35;
    if (h > 0.45) tmp.copy(cMid).lerp(cHigh, Math.min(1, (h - 0.45) * 1.6));
    else if (h < -0.35) tmp.copy(cLow);
    else tmp.copy(cLow).lerp(cMid, (h + 0.35) / 0.8);
    tmp.offsetHSL((j - 0.17) * 0.02, 0, j * 0.14 - 0.05);
    for (let k = 0; k < 3; k++) {
      colors[(f * 3 + k) * 3] = tmp.r; colors[(f * 3 + k) * 3 + 1] = tmp.g; colors[(f * 3 + k) * 3 + 2] = tmp.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const planet = new THREE.Mesh(geo, mat(0xffffff, { vertexColors: true }));
  planet.receiveShadow = true;
  scene.add(planet);
}

/* ---------- 散布：树木 / 岩石 / 花草 ---------- */
function randomDirFarFromLandmarks(margin = 0.06) {
  for (let tries = 0; tries < 50; tries++) {
    const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    let ok = true;
    for (const l of [...LANDMARKS, ...DECOR]) if (d.angleTo(l.dir) < l.flat + margin) { ok = false; break; }
    if (ok) return d;
  }
  return null;
}
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();

  // 移动端降密度：触屏设备植被/散布减半
  const LOW = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const DENS = LOW ? 0.55 : 1;

  const treeN = Math.round(160 * DENS);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 5), mat(0x6b4a2f), treeN);
  const cans = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.5, 6), mat(0x3f6b34), treeN);
  trunks.castShadow = cans.castShadow = true;
  let ti = 0;
  for (let i = 0; i < treeN; i++) {
    const d = randomDirFarFromLandmarks(); if (!d) continue;
    const sc = 0.7 + Math.random() * 0.9;
    q.setFromUnitVectors(UP, d);
    pos.copy(groundPos(d, 0.2 * sc));
    m4.compose(pos, q, s.set(sc, sc, sc)); trunks.setMatrixAt(ti, m4);
    pos.copy(groundPos(d, 1.2 * sc));
    m4.compose(pos, q, s.set(sc, sc, sc)); cans.setMatrixAt(ti, m4);
    ti++;
  }
  trunks.count = cans.count = ti;

  const rockN = Math.round(46 * DENS);
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0x8f8d80), rockN);
  rocks.castShadow = true;
  let ri = 0;
  for (let i = 0; i < rockN; i++) {
    const d = randomDirFarFromLandmarks(); if (!d) continue;
    const sc = 0.5 + Math.random() * 1.1;
    q.setFromUnitVectors(UP, d);
    pos.copy(groundPos(d, 0.1 * sc));
    m4.compose(pos, q, s.set(sc, sc * 0.75, sc));
    rocks.setMatrixAt(ri++, m4);
  }
  rocks.count = ri;

  // 花丛（粉/黄/白三色）
  const flowerColors = [0xe88ca0, 0xe8c454, 0xf2ede0];
  const flowerN = Math.round(90 * DENS);
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.14, 0), mat(0xffffff), flowerN);
  const fc = new THREE.Color();
  let fi = 0;
  for (let i = 0; i < flowerN; i++) {
    const d = randomDirFarFromLandmarks(0.02); if (!d) continue;
    q.setFromUnitVectors(UP, d);
    pos.copy(groundPos(d, 0.12));
    const sc = 0.8 + Math.random() * 0.8;
    m4.compose(pos, q, s.set(sc, sc, sc));
    flowers.setMatrixAt(fi, m4);
    flowers.setColorAt(fi, fc.setHex(flowerColors[i % 3]));
    fi++;
  }
  flowers.count = fi;

  // 草丛
  const grassN = Math.round(140 * DENS);
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.42, 4), mat(0x557f3d), grassN);
  let gi = 0;
  for (let i = 0; i < grassN; i++) {
    const d = randomDirFarFromLandmarks(0.02); if (!d) continue;
    q.setFromUnitVectors(UP, d);
    pos.copy(groundPos(d, 0.2));
    const sc = 0.8 + Math.random();
    m4.compose(pos, q, s.set(sc, sc, sc));
    grass.setMatrixAt(gi++, m4);
  }
  grass.count = gi;

  scene.add(trunks, cans, rocks, flowers, grass);
}

/* ---------- 云 ---------- */
const cloudGroup = new THREE.Group();
{
  const cm = mat(0xffffff, { roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random() * 1.6, 0), cm);
      s.position.set(k * 2.2 - n, Math.random() * 0.8, Math.random() * 1.6 - 0.8);
      s.scale.y = 0.55;
      cloud.add(s);
    }
    const d = randomDirFarFromLandmarks(0) || new THREE.Vector3(0, 1, 0);
    cloud.position.copy(d).multiplyScalar(R + 16 + Math.random() * 9);
    cloud.quaternion.setFromUnitVectors(UP, d.normalize());
    cloudGroup.add(cloud);
  }
  scene.add(cloudGroup);
}

/* ---------- 金色浮尘（氛围粒子） ---------- */
{
  const n = 110, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    d.multiplyScalar(R + 1.2 + Math.random() * 5.5);
    arr.set([d.x, d.y, d.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const motes = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xf0d78a, size: 0.16, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  motes.name = 'motes';
  scene.add(motes);
}

/* ---------- 飞鸟 ---------- */
const birds = [];
{
  const birdM = mat(0x3a3730, { side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const bird = new THREE.Group();
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.28), birdM);
    const wingR = wingL.clone();
    wingL.position.x = -0.34; wingR.position.x = 0.34;
    bird.add(wingL, wingR);
    const center = randomDirFarFromLandmarks(0) || new THREE.Vector3(0, 1, 0);
    bird.userData = { center, phase: i * 2.1, radius: 4 + i * 1.5, wingL, wingR };
    birds.push(bird);
    scene.add(bird);
  }
}

/* ---------- 装饰：梯田山丘 ---------- */
{
  const g = new THREE.Group();
  const greens = [0x6f9a4a, 0x8fae4f, 0x5d8740];
  for (let i = 0; i < 6; i++) {
    const r = 4.4 - i * 0.62;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, 0.5, 18), mat(greens[i % 3]));
    disc.position.y = 0.25 + i * 0.5;
    disc.castShadow = disc.receiveShadow = true;
    g.add(disc);
    if (i % 2 === 0) {   // 水田镜面
      const water = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.06, 18),
        mat(0x8fd0c5, { roughness: 0.25, emissive: 0x8fd0c5, emissiveIntensity: 0.3 }));
      water.position.y = 0.53 + i * 0.5;
      g.add(water);
    }
  }
  placeOnSphere(g, DECOR[0].dir);
  scene.add(g);
}

/* ============================================================
   通用小件：涟漪 / 村民 / 火塘
   ============================================================ */
const animated = [];

function addRipples(g, x, z, baseR, color = 0xffffff) {
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.14, z);
    g.add(ring); rings.push(ring);
  }
  animated.push((dt, t) => {
    rings.forEach((r, i) => {
      const p = ((t * 0.4) + i * 0.5) % 1;
      r.scale.setScalar(baseR * (0.35 + p));
      r.material.opacity = 0.45 * (1 - p);
    });
  });
}

/* 村民：miao 苗族银角 / dong 侗族包头 / plain 斗笠 */
function villager(style = 'plain') {
  const v = new THREE.Group();
  const cloth = style === 'miao' ? 0x32405e : style === 'dong' ? 0x2b3448 : 0x5a4a38;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.62, 7), mat(cloth));
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7), mat(0xf2d7b6));
  head.position.y = 1.0;
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 5), mat(cloth));
  const armR = armL.clone();
  armL.position.set(-0.26, 0.62, 0); armL.rotation.z = 0.25;
  armR.position.set(0.26, 0.62, 0); armR.rotation.z = -0.25;
  v.add(body, head, armL, armR);
  if (style === 'miao') {   // 银角头饰
    const silver = mat(0xdfe4ea, { metalness: 0.55, roughness: 0.35 });
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 5), silver);
    const hornR = hornL.clone();
    hornL.position.set(-0.15, 1.22, 0); hornL.rotation.z = 0.5;
    hornR.position.set(0.15, 1.22, 0); hornR.rotation.z = -0.5;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), silver);
    disc.position.y = 1.14;
    v.add(hornL, hornR, disc);
  } else if (style === 'dong') {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.16, 8), mat(0x1f2733));
    wrap.position.y = 1.12;
    v.add(wrap);
  } else {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.16, 7), mat(0xc9b27a));
    hat.position.y = 1.14;
    v.add(hat);
  }
  v.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return v;
}
/* 安置村民：待机摇摆或绕圈走动 */
function placeVillager(g, style, x, z, rotY = 0, walkRadius = 0) {
  const v = villager(style);
  v.position.set(x, 0, z);
  v.rotation.y = rotY;
  g.add(v);
  const phase = Math.random() * Math.PI * 2;
  if (walkRadius > 0) {
    animated.push((dt, t) => {
      const a = t * 0.35 + phase;
      v.position.set(x + Math.cos(a) * walkRadius, Math.abs(Math.sin(t * 6 + phase)) * 0.05, z + Math.sin(a) * walkRadius);
      v.rotation.y = -a;
    });
  } else {
    animated.push((dt, t) => {
      v.position.y = Math.abs(Math.sin(t * 2 + phase)) * 0.04;
      v.rotation.y = rotY + Math.sin(t * 0.8 + phase) * 0.25;
    });
  }
  return v;
}

/* 火塘：火焰脉动 + 火星上升 + 点光源 */
function addBonfire(g, x, z) {
  const bf = new THREE.Group();
  for (let i = 0; i < 3; i++) {   // 柴堆
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 5), mat(0x54381f));
    log.rotation.z = Math.PI / 2; log.rotation.y = i * 1.05;
    log.position.y = 0.12;
    bf.add(log);
  }
  const flameM = mat(0xff8c2e, { emissive: 0xff6a12, emissiveIntensity: 2.2 });
  const flameM2 = mat(0xffd23e, { emissive: 0xffb62e, emissiveIntensity: 2.4 });
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 6), flameM);
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), flameM2);
  f1.position.y = 0.55; f2.position.y = 0.6;
  bf.add(f1, f2);
  const light = new THREE.PointLight(0xff9040, 6, 11, 1.6);
  light.position.y = 1;
  bf.add(light);
  const embers = [];
  for (let i = 0; i < 7; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true }));
    e.userData.ph = i / 7;
    embers.push(e); bf.add(e);
  }
  bf.position.set(x, 0, z);
  g.add(bf);
  animated.push((dt, t) => {
    const p = 1 + Math.sin(t * 9) * 0.12;
    f1.scale.set(p, 1 + Math.sin(t * 7.3) * 0.18, p);
    f2.scale.set(2 - p, 1 + Math.cos(t * 8.1) * 0.22, 2 - p);
    light.intensity = 5.2 + Math.sin(t * 9) * 1.2;
    for (const e of embers) {
      const k = (t * 0.45 + e.userData.ph) % 1;
      e.position.set(Math.sin(k * 12 + e.userData.ph * 9) * 0.3, 0.5 + k * 1.8, Math.cos(k * 10) * 0.3);
      e.material.opacity = 0.9 * (1 - k);
    }
  });
}

/* ============================================================
   8 个贵州地标（精细化）
   ============================================================ */

/* ---- 1. 黄果树瀑布：三层崖壁 + 宽幅瀑流 + 水雾 + 彩虹 ---- */
function buildHuangguoshu(g) {
  const rockM = mat(0x84896f), rockM2 = mat(0x767b62), vegM = mat(0x557f3d);
  const layers = [
    [8.2, 4.2, 3.0, 0, 2.1, -2.0, 0.10, rockM],
    [5.6, 3.2, 2.6, -2.4, 5.2, -2.4, -0.18, rockM2],
    [3.6, 2.6, 2.2, 2.2, 4.6, -2.6, 0.22, rockM],
  ];
  for (const [w, h, d, x, y, z, ry, m] of layers) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.rotation.y = ry;
    b.castShadow = b.receiveShadow = true;
    g.add(b);
    const veg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, d * 0.9), vegM);  // 崖顶植被
    veg.position.set(x, y + h / 2 + 0.12, z); veg.rotation.y = ry;
    g.add(veg);
  }

  // 瀑布条纹纹理（主瀑 + 两侧细瀑）
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#cfeef8'; cx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 60; i++) {
    cx.strokeStyle = `rgba(255,255,255,${0.45 + Math.random() * 0.55})`;
    cx.lineWidth = 1 + Math.random() * 3.5;
    const x = Math.random() * 128;
    cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + Math.random() * 10 - 5, 256); cx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const fallM = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.96 });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 5.6), fallM);
  fall.position.set(0.2, 2.8, -0.35); fall.rotation.x = 0.06;
  const fallL = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.6), fallM);
  fallL.position.set(-3.0, 3.4, -0.9); fallL.rotation.x = 0.05;
  const fallR = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 3.1), fallM);
  fallR.position.set(3.1, 3.0, -1.1); fallR.rotation.x = 0.05;
  g.add(fall, fallL, fallR);
  animated.push((dt) => { tex.offset.y -= dt * 1.5; });

  // 犀牛潭 + 泡沫 + 涟漪
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.4, 26),
    mat(0x5cc4c0, { roughness: 0.28, emissive: 0x5cc4c0, emissiveIntensity: 0.3 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.2, 0.07, 2.2);
  pool.receiveShadow = true;
  g.add(pool);
  const foam = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.35, 8, 26),
    mat(0xffffff, { roughness: 0.6 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0.2, 0.1, 0.7);
  foam.scale.z = 0.5;
  g.add(foam);
  addRipples(g, 0.2, 3.0, 2.2, 0xdff7f5);

  // 水雾
  const mistM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false });
  const mists = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + (i % 3) * 0.25, 0), mistM);
    m.position.set(0.2 + (i - 2) * 1.2, 0.8 + (i % 2) * 0.5, 0.5);
    mists.push(m); g.add(m);
  }
  animated.push((dt, t) => {
    mists.forEach((m, i) => {
      const s = 1 + 0.3 * Math.sin(t * 2 + i * 2.1);
      m.scale.setScalar(s);
      m.position.y = 0.8 + (i % 2) * 0.5 + Math.sin(t * 1.3 + i) * 0.15;
    });
  });

  // 彩虹（弧形渐变面片）
  const rcv = document.createElement('canvas'); rcv.width = 256; rcv.height = 128;
  const rcx = rcv.getContext('2d');
  const rainbowCols = ['#ff5a5a', '#ffb64a', '#f4e04a', '#6fd66f', '#5aa8ff', '#9a6aff'];
  rcx.lineWidth = 5;
  rainbowCols.forEach((c, i) => {
    rcx.strokeStyle = c; rcx.globalAlpha = 0.85;
    rcx.beginPath(); rcx.arc(128, 128, 110 - i * 6, Math.PI, 2 * Math.PI); rcx.stroke();
  });
  const rainbow = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 3.75),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rcv), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  rainbow.position.set(0.4, 2.4, 3.4);
  rainbow.rotation.x = -0.12;
  g.add(rainbow);
  animated.push((dt, t) => { rainbow.material.opacity = 0.4 + Math.sin(t * 0.9) * 0.12; });

  // 崖顶树
  for (const [x, z] of [[-3.4, -2.2], [3.4, -2.4]]) {
    const tr = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 6), vegM);
    tr.position.set(x, 6.9, z); tr.castShadow = true;
    g.add(tr);
  }
}

/* ---- 2. 西江千户苗寨：吊脚楼群 + 灯笼串 + 炊烟 + 风雨桥 ---- */
function miaoHouse(w = 1.0, h = 0.85, d = 0.95) {
  const house = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0x6e4b2e));
  body.position.y = h / 2 + 0.28;
  const stilt = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, d * 0.9), mat(0x54381f));
  stilt.position.y = 0.15;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, h * 0.75, 4), mat(0x3c3638));
  roof.position.y = h + 0.28 + h * 0.36; roof.rotation.y = Math.PI / 4;
  // 窗（暖光）
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.3, h * 0.35),
    mat(0xffc966, { emissive: 0xffa63e, emissiveIntensity: 1.2 }));
  win.position.set(0, h / 2 + 0.28, d / 2 + 0.01);
  house.add(body, stilt, roof, win);
  house.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return house;
}
function buildXijiang(g) {
  const rng = mulberry(7);
  const smokeCols = [];
  for (let row = 0; row < 4; row++) {
    const n = 4 - Math.floor(row / 2);
    for (let i = 0; i < n; i++) {
      const h = miaoHouse(0.85 + rng() * 0.2);
      h.position.set((i - (n - 1) / 2) * 1.75 + (rng() - 0.5) * 0.25, row * 0.72, -row * 2.1 + (rng() - 0.5) * 0.3);
      h.rotation.y = (rng() - 0.5) * 0.35;
      g.add(h);
      if (rng() > 0.55) smokeCols.push([h.position.x, h.position.y + 1.6, h.position.z]);
    }
  }
  // 灯笼串（两行，暖光闪烁）
  const lampM = mat(0xffb347, { emissive: 0xff9a2e, emissiveIntensity: 1.6 });
  const lamps = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), lampM.clone());
      lamp.position.set(-3.2 + i * 1.6, 1.5 + Math.sin(i * 1.2) * 0.15, 1.6 - row * 2.2);
      lamps.push(lamp); g.add(lamp);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 4), mat(0x4a3524));
      pole.position.set(lamp.position.x, 0.75, lamp.position.z);
      g.add(pole);
    }
  }
  animated.push((dt, t) => {
    lamps.forEach((l, i) => { l.material.emissiveIntensity = 1.3 + Math.sin(t * 3 + i * 1.7) * 0.5; });
  });
  // 炊烟
  const smokeM = new THREE.MeshBasicMaterial({ color: 0xd8d4c8, transparent: true, opacity: 0.3, depthWrite: false });
  for (const [sx, sy, sz] of smokeCols) {
    const puffs = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), smokeM);
      s.userData.ph = i / 3;
      puffs.push(s); g.add(s);
    }
    animated.push((dt, t) => {
      for (const s of puffs) {
        const k = (t * 0.25 + s.userData.ph) % 1;
        s.position.set(sx + Math.sin(k * 5) * 0.2, sy + k * 1.6, sz);
        s.scale.setScalar(0.6 + k * 1.4);
        s.material.opacity = 0.3 * (1 - k);
      }
    });
  }
  // 小溪 + 风雨桥
  const creek = new THREE.Mesh(new THREE.CircleGeometry(2.0, 20),
    mat(0x63b8c4, { roughness: 0.3, emissive: 0x63b8c4, emissiveIntensity: 0.25 }));
  creek.rotation.x = -Math.PI / 2; creek.position.set(0.4, 0.06, 2.6);
  g.add(creek);
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.8), mat(0x6e4b2e));
  deck.position.y = 0.5;
  const broof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 4), mat(0x3c3638));
  broof.rotation.y = Math.PI / 4; broof.position.y = 1.35; broof.scale.set(1.3, 1, 0.55);
  for (const px of [-1, 1]) for (const pz of [-0.3, 0.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 4), mat(0x54381f));
    post.position.set(px, 0.9, pz);
    bridge.add(post);
  }
  bridge.add(deck, broof);
  bridge.position.set(0.4, 0, 2.6);
  bridge.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(bridge);
  addRipples(g, 0.4, 2.6, 1.2, 0xdff7f5);
  // 苗族村民
  placeVillager(g, 'miao', -1.6, 1.4, 0.6, 0.7);
  placeVillager(g, 'miao', 1.8, 0.9, -0.8);
  placeVillager(g, 'miao', -0.2, 2.0, 2.4);
}

/* ---- 3. 梵净山：红云金顶 + 云海 ---- */
function buildFanjing(g) {
  const stoneM = mat(0x9b968a), stoneD = mat(0x87827a);
  const base = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.6, 7), mat(0x6f8560));
  base.position.y = 1.3; base.castShadow = true;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.15, 5.4, 7), stoneM);
  pillar.position.set(0.3, 5.0, 0);
  const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 3.4, 7), stoneD);
  pillar2.position.set(-1.5, 3.9, 0.8);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 7, 5), stoneD);
  cap.scale.set(1.2, 0.55, 1); cap.position.set(0.3, 7.9, 0);
  const temple = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.55), mat(0xa3402f));
  const tr = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.4, 4), mat(0xd9a437));
  tr.rotation.y = Math.PI / 4; tr.position.y = 0.4;
  temple.add(tb, tr);
  temple.position.set(0.3, 8.55, 0);
  g.add(base, pillar, pillar2, cap, temple);
  // 山脚树 + 经幡
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 6), mat(0x3f6b34));
    const a = i * 1.7 + 0.4;
    t.position.set(Math.cos(a) * 3.0, 0.6, Math.sin(a) * 3.0);
    t.castShadow = true;
    g.add(t);
  }
  const flagCols = [0xd64545, 0xe8c454, 0x4a90d9, 0xffffff, 0x55a06a];
  for (let i = 0; i < 5; i++) {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), mat(flagCols[i], { side: THREE.DoubleSide }));
    flag.position.set(-0.9 + i * 0.35, 7.3 - i * 0.08, 0.35);
    g.add(flag);
    animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 3 + i) * 0.4; });
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // 云海环
  const seaM = new THREE.MeshBasicMaterial({ color: 0xeef0ea, transparent: true, opacity: 0.3, depthWrite: false });
  const seaG = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + (i % 3) * 0.18, 0), seaM);
    puff.position.set(Math.cos(a) * 3.9, 2.6 + Math.sin(i * 2.4) * 0.2, Math.sin(a) * 3.9);
    puff.scale.y = 0.4;
    seaG.add(puff);
  }
  g.add(seaG);
  animated.push((dt, t) => {
    seaG.rotation.y += dt * 0.12;
    seaG.position.y = Math.sin(t * 0.6) * 0.12;
  });
}

/* ---- 4. 荔波小七孔：七孔桥 + 碧水 + 水上森林 ---- */
function buildXiaoqikong(g) {
  const stoneM = mat(0xb5ad9c);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.34, 1.3), stoneM);
  deck.position.y = 1.15;
  g.add(deck);
  for (let i = 0; i < 8; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.0, 1.1), stoneM);
    pier.position.set(-2.63 + i * 0.75, 0.5, 0);
    g.add(pier);
  }
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.2, 0.1), mat(0x9d9585));
    rail.position.set(0, 1.45, s * 0.6);
    g.add(rail);
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), mat(0x9d9585));
      post.position.set(-2.7 + i * 0.9, 1.32, s * 0.6);
      g.add(post);
    }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // 水上森林
  const rng = mulberry(12);
  for (let i = 0; i < 9; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.38 + rng() * 0.2, 1.0 + rng() * 0.6, 5), mat(0x55a06a));
    t.position.set(-4.2 + i * 1.05, 0.5, 2.1 + (i % 3) * 0.75);
    t.castShadow = true;
    g.add(t);
  }
  addRipples(g, -1.5, 1.6, 1.6);
  addRipples(g, 2.2, 2.4, 1.3);
  placeVillager(g, 'plain', 2.9, -0.4, -1.8, 0.5);
}

/* ---- 5. 镇远古城：长墙 + 双门楼 + 灯笼排 + 舞阳河扁舟 ---- */
function buildZhenyuan(g) {
  const wallM = mat(0x8d8578), roofM = mat(0x46505c);
  for (let s = 0; s < 4; s++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.05, 0.55), wallM);
    seg.position.set(-3.6 + s * 2.45, 0.52, -1.4 + Math.sin(s * 1.3) * 0.5);
    seg.rotation.y = (s - 1.5) * 0.18;
    seg.castShadow = seg.receiveShadow = true;
    g.add(seg);
    for (let c = 0; c < 5; c++) {
      const mer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.55), wallM);
      mer.position.set(seg.position.x - 1 + c * 0.5, 1.18, seg.position.z);
      mer.rotation.y = seg.rotation.y;
      g.add(mer);
    }
  }
  const tower = (x, z, ry) => {
    const t = new THREE.Group();
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.1), mat(0x7a4a34));
    t1.position.y = 0.55;
    const r1 = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.6, 4), roofM);
    r1.rotation.y = Math.PI / 4; r1.position.y = 1.4;
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), mat(0x7a4a34));
    t2.position.y = 1.9;
    const r2 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.5, 4), roofM);
    r2.rotation.y = Math.PI / 4; r2.position.y = 2.45;
    t.add(t1, r1, t2, r2);
    t.position.set(x, 0, z); t.rotation.y = ry;
    t.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return t;
  };
  g.add(tower(1.2, 0.6, 0.2), tower(-2.6, 0.3, -0.3));
  // 舞阳河 S 弯
  for (const [rx, rz, rot, arc] of [[-0.5, 2.4, 0.6, 1.1], [1.8, 3.4, 3.4, 0.9]]) {
    const river = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.8, 8, 26, Math.PI * arc),
      mat(0x55b3c2, { roughness: 0.28, emissive: 0x55b3c2, emissiveIntensity: 0.25 }));
    river.rotation.x = -Math.PI / 2; river.rotation.z = rot;
    river.position.set(rx, 0.05, rz);
    g.add(river);
  }
  // 红灯笼排（闪烁）
  const lampM = mat(0xe0453a, { emissive: 0xd03a2e, emissiveIntensity: 1.5 });
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lampM.clone());
    lamp.position.set(-2.8 + i * 1.15, 1.25, 1.15 + Math.sin(i) * 0.2);
    lamps.push(lamp); g.add(lamp);
  }
  animated.push((dt, t) => {
    lamps.forEach((l, i) => { l.material.emissiveIntensity = 1.2 + Math.sin(t * 2.5 + i * 2.2) * 0.5; });
  });
  // 扁舟
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, 1.5, 6), mat(0x54381f));
  hull.rotation.z = Math.PI / 2;
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 6, 1, true, 0, Math.PI), mat(0xc9b27a, { side: THREE.DoubleSide }));
  canopy.rotation.z = Math.PI / 2; canopy.rotation.y = Math.PI / 2;
  canopy.position.y = 0.2;
  boat.add(hull, canopy);
  boat.position.set(-0.8, 0.12, 2.6);
  boat.rotation.y = 0.5;
  g.add(boat);
  animated.push((dt, t) => {
    boat.position.y = 0.12 + Math.sin(t * 1.6) * 0.05;
    boat.rotation.z = Math.sin(t * 1.2) * 0.06;
  });
  placeVillager(g, 'plain', 2.4, 1.4, -2.2);
}

/* ---- 6. 万峰林：峰丛 + 田园拼布 + 布依村寨 ---- */
function buildWanfenglin(g) {
  const rng = mulberry(21);
  for (let i = 0; i < 24; i++) {
    const h = 1.2 + rng() * 2.6, r = 0.5 + rng() * 0.8;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6),
      mat(new THREE.Color(0x557a4e).lerp(new THREE.Color(0x9aa372), rng()).getHex()));
    const a = rng() * Math.PI * 2, d = 0.6 + rng() * 4.2;
    peak.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d * 0.75 - 0.6);
    peak.castShadow = true;
    g.add(peak);
  }
  // 田园拼布
  const patchCols = [0xc9b458, 0x8fae4f, 0xa8bf5a, 0x7d9a48];
  [[0.6, 3.4, 1.9], [2.8, 2.6, 1.2], [-1.6, 3.2, 1.4], [1.4, 4.6, 1.1]].forEach(([x, z, r], i) => {
    const f = new THREE.Mesh(new THREE.CircleGeometry(r, 16), mat(patchCols[i % 4]));
    f.rotation.x = -Math.PI / 2; f.position.set(x, 0.05 + i * 0.012, z);
    f.receiveShadow = true;
    g.add(f);
  });
  for (const [x, z] of [[0.2, 3.0], [1.6, 3.8], [-0.9, 3.9]]) {
    const h = miaoHouse(0.7, 0.6, 0.65);
    h.position.set(x, 0, z); h.rotation.y = rng() * 2;
    g.add(h);
  }
}

/* ---- 7. 肇兴侗寨：大鼓楼 + 火塘晚会 + 花桥 ---- */
function drumTower(tiers, base) {
  const tower = new THREE.Group();
  const woodM = mat(0x4d3a2c), eaveM = mat(0x332c28);
  let y = 0, size = base;
  for (let i = 0; i < tiers; i++) {
    const core = new THREE.Mesh(new THREE.BoxGeometry(size * 0.62, 0.62, size * 0.62), woodM);
    core.position.y = y + 0.31;
    const eave = new THREE.Mesh(new THREE.ConeGeometry(size, 0.5, 4), eaveM);
    eave.rotation.y = Math.PI / 4; eave.position.y = y + 0.82;
    tower.add(core, eave);
    y += 0.88; size *= 0.78;
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xd9a437, { emissive: 0xb98a1e, emissiveIntensity: 0.6 }));
  finial.position.y = y + 0.35;
  tower.add(finial);
  tower.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return tower;
}
function buildZhaoxing(g) {
  const main = drumTower(6, 2.0);
  g.add(main);
  const t2 = drumTower(4, 1.3); t2.position.set(-2.8, 0, -1.2);
  const t3 = drumTower(3, 1.1); t3.position.set(2.7, 0, -1.5);
  g.add(t2, t3);
  const h1 = miaoHouse(1.1, 0.9, 1.0); h1.position.set(-2.4, 0, 1.4); h1.rotation.y = 0.5;
  const h2 = miaoHouse(1.0, 0.85, 0.9); h2.position.set(2.3, 0, 1.5); h2.rotation.y = -0.4;
  g.add(h1, h2);
  // 广场 + 火塘 + 侗族村民围圈
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(2.0, 18), mat(0xa79a7e));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.04, 3.4);
  plaza.receiveShadow = true;
  g.add(plaza);
  addBonfire(g, 0, 3.4);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.5;
    placeVillager(g, 'dong', Math.cos(a) * 1.3, 3.4 + Math.sin(a) * 1.3, -a + Math.PI / 2);
  }
  // 花桥 + 溪
  const creek = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.6, 8, 22, Math.PI * 0.8),
    mat(0x63b8c4, { roughness: 0.3, emissive: 0x63b8c4, emissiveIntensity: 0.22 }));
  creek.rotation.x = -Math.PI / 2; creek.rotation.z = 2.4;
  creek.position.set(-2.2, 0.05, 4.0);
  g.add(creek);
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.7), mat(0x6e4b2e));
  deck.position.y = 0.45;
  const broof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 4), mat(0x332c28));
  broof.rotation.y = Math.PI / 4; broof.position.y = 1.2; broof.scale.set(1.25, 1, 0.5);
  bridge.add(deck, broof);
  bridge.position.set(-3.4, 0, 2.6); bridge.rotation.y = 0.7;
  bridge.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(bridge);
}

/* ---- 8. 中国天眼 FAST：大锅 + 六塔缆索 + 环山 ---- */
function buildFAST(g) {
  const dishR = 6.5, capA = 0.62;
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(dishR, 32, 12, 0, Math.PI * 2, 0, capA),
    mat(0xf0ede4, { side: THREE.DoubleSide, roughness: 0.5 })
  );
  dish.scale.y = -1;
  dish.position.y = dishR;
  dish.receiveShadow = true;
  g.add(dish);
  // 面板分块线（纬向环）
  for (const f of [0.35, 0.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(dishR * Math.sin(capA * f), 0.045, 5, 32),
      mat(0xd0ccbe));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = dishR * (1 - Math.cos(capA * f)) + 0.06;
    g.add(ring);
  }
  const rimR = dishR * Math.sin(capA);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.16, 6, 36), mat(0xd8d4c6));
  rim.rotation.x = Math.PI / 2; rim.position.y = dishR * (1 - Math.cos(capA)) + 0.0;
  g.add(rim);
  // 馈源舱（红色航行灯闪烁）+ 六塔六索
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat(0xffffff));
  cabin.position.y = 4.6; cabin.castShadow = true;
  g.add(cabin);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(0xff3b30, { emissive: 0xff3b30, emissiveIntensity: 2 }));
  beacon.position.y = 5.1;
  g.add(beacon);
  animated.push((dt, t) => { beacon.material.emissiveIntensity = (Math.sin(t * 4) > 0 ? 2.2 : 0.15); });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const tx = Math.cos(a) * rimR, tz = Math.sin(a) * rimR;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.8, 5), mat(0xc9c5b8));
    tower.position.set(tx, 2.4, tz);
    tower.castShadow = true;
    g.add(tower);
    const p1 = new THREE.Vector3(tx, 4.8, tz), p2 = new THREE.Vector3(0, 4.65, 0);
    const dirC = p2.clone().sub(p1), len = dirC.length();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 4), mat(0x8a8778));
    cable.position.copy(p1).addScaledVector(dirC, 0.5);
    cable.quaternion.setFromUnitVectors(UP, dirC.normalize());
    g.add(cable);
  }
  // 环山 + 机房
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + 0.3;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.0 + (i % 3) * 0.7, 6), mat(0x557a4e));
    peak.position.set(Math.cos(a) * (rimR + 2.2), 1.0, Math.sin(a) * (rimR + 2.2));
    peak.castShadow = true;
    g.add(peak);
  }
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), mat(0xd8d4c6));
  hub.position.set(rimR + 1.2, 0.3, 0);
  hub.castShadow = true;
  g.add(hub);
}

/* ---- 红色小件：飘扬的红旗 ---- */
function addWavingFlag(g, x, y, z, scale = 1) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6 * scale, 5), mat(0x8a8778));
  pole.position.set(x, y + 1.3 * scale, z);
  pole.castShadow = true;
  const geo = new THREE.PlaneGeometry(1.5 * scale, 0.9 * scale, 10, 6);
  geo.translate(0.78 * scale, 0, 0);
  const flag = new THREE.Mesh(geo, mat(0xc5281f, { side: THREE.DoubleSide, emissive: 0x8a1610, emissiveIntensity: 0.4 }));
  flag.position.set(x, y + 2.25 * scale, z);
  flag.castShadow = true;
  g.add(pole, flag);
  const base = geo.attributes.position.array.slice();
  animated.push((dt, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3];
      p.setZ(i, Math.sin(bx * 2.4 / scale - t * 5.5) * 0.14 * (bx / scale));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
}
/* 红星面片 */
function redStar(size = 0.5) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#e8c454';
  cx.translate(64, 64);
  cx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
    cx.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
  }
  cx.closePath(); cx.fill();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide }));
  return m;
}

/* ---- 9. 遵义会议会址 ---- */
function buildZunyi(g) {
  const brickM = mat(0x9a8f80), woodM = mat(0x6e4b2e), roofM = mat(0x3c3638);
  // 主楼（两层砖木小楼）
  const lower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 2.3), brickM);
  lower.position.y = 0.75;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 2.0), woodM);
  upper.position.y = 2.15;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 4), roofM);
  roof.rotation.y = Math.PI / 4; roof.position.y = 3.25; roof.scale.set(1.15, 1, 0.9);
  g.add(lower, upper, roof);
  // 二层回廊
  const balcony = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 0.5), woodM);
  balcony.position.set(0, 1.55, 1.35);
  g.add(balcony);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), woodM);
    post.position.set(-1.3 + i * 0.52, 1.85, 1.55);
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 0.08), woodM);
  rail.position.set(0, 2.1, 1.55);
  g.add(rail);
  // 门楣匾额
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#241d16'; cx.fillRect(0, 0, 256, 64);
  cx.strokeStyle = '#c9a227'; cx.lineWidth = 3; cx.strokeRect(4, 4, 248, 56);
  cx.fillStyle = '#e8c454'; cx.font = '700 34px "Noto Serif SC", serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('遵义会议会址', 128, 34);
  const plaqueTex = new THREE.CanvasTexture(cv);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42),
    new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaque.position.set(0, 1.15, 1.16);
  g.add(plaque);
  // 门
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), mat(0x3a2c1e));
  door.position.set(0, 0.5, 1.16);
  g.add(door);
  // 院墙 + 松柏 + 红旗
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.25), brickM);
    wall.position.set(s * 2.6, 0.35, 1.0);
    wall.rotation.y = -s * 0.35;
    wall.castShadow = true;
    g.add(wall);
    const cypress = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 6), mat(0x2e5230));
    cypress.position.set(s * 2.2, 1.1, -0.6);
    cypress.castShadow = true;
    g.add(cypress);
  }
  const star = redStar(0.55);
  star.position.set(0, 3.85, 0.4);
  g.add(star);
  addWavingFlag(g, 2.0, 0, 1.6, 0.9);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

/* ---- 10. 娄山关 ---- */
function buildLoushanguan(g) {
  const rockM = mat(0x6f7a68), rockD = mat(0x5d6758);
  const peakL = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.8, 6), rockM);
  peakL.position.set(-2.6, 2.4, -0.4);
  const peakR = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.1, 6), rockD);
  peakR.position.set(2.5, 2.05, -0.2);
  g.add(peakL, peakR);
  // 关口城墙 + 门洞两侧墩台
  const wallM = mat(0x8d8578);
  for (const s of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.9), wallM);
    pier.position.set(s * 1.05, 0.85, 0);
    g.add(pier);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 0.9), wallM);
  lintel.position.set(0, 1.9, 0);
  g.add(lintel);
  for (let i = 0; i < 6; i++) {
    const mer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.9), wallM);
    mer.position.set(-1.4 + i * 0.56, 2.26, 0);
    g.add(mer);
  }
  // 上山石阶
  for (let i = 0; i < 5; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.5), mat(0x9d9585));
    step.position.set(0, 0.07 + i * 0.14, 1.4 - i * 0.42);
    g.add(step);
  }
  // 纪念碑（红星碑）
  const stele = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.4, 0.32), mat(0xd9d2c0));
  stele.position.set(-1.7, 1.2, 1.5);
  g.add(stele);
  const star = redStar(0.55);
  star.position.set(-1.7, 2.0, 1.67);
  g.add(star);
  const sbase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.7), mat(0xb5ad9c));
  sbase.position.set(-1.7, 0.2, 1.5);
  g.add(sbase);
  // 关上红旗（大旗）
  addWavingFlag(g, 0.6, 2.1, -0.1, 1.15);
  addWavingFlag(g, 1.9, 0, 1.8, 0.8);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

/* ---- 11. 四渡赤水渡口（赤水河湾 + 红军渡桥 + 竹林 + 小船） ---- */
function buildChishui(g) {
  const waterM = mat(0x3f8f8a, { roughness: 0.55 });
  // 河湾（椭圆水面，一道 S 弯的感觉）
  const river = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), waterM);
  river.rotation.x = -Math.PI / 2; river.scale.set(1.5, 1, 1);
  river.position.set(0, 0.04, 0.4);
  river.receiveShadow = true;
  g.add(river);
  // 河岸石滩
  const shoreM = mat(0xcabf9e);
  for (const s of [-1, 1]) {
    const shore = new THREE.Mesh(new THREE.CircleGeometry(1.4, 12), shoreM);
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(s * 2.4, 0.05, 0.4);
    g.add(shore);
  }
  // 红军渡桥：两岸墩柱 + 下垂木板 + 两侧绳索
  const woodM = mat(0x6e4b2e), ropeM = mat(0x8a6f4a);
  for (const s of [-1, 1]) {
    for (const z of [-0.5, 0.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 5), woodM);
      post.position.set(s * 2.35, 0.65, 0.4 + z);
      post.castShadow = true;
      g.add(post);
    }
  }
  const NP = 11;
  for (let i = 0; i < NP; i++) {
    const f = i / (NP - 1);
    const x = -2.35 + f * 4.7;
    const sag = 0.35 - Math.sin(f * Math.PI) * 0.28;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.9), woodM);
    plank.position.set(x, 0.9 + sag, 0.4);
    plank.rotation.z = Math.cos(f * Math.PI) * 0.12;
    plank.castShadow = true;
    g.add(plank);
  }
  for (const z of [-0.48, 0.48]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-2.35, 1.3, 0.4 + z),
      new THREE.Vector3(0, 0.85, 0.4 + z),
      new THREE.Vector3(2.35, 1.3, 0.4 + z));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 5), ropeM);
    g.add(rope);
  }
  // 渡口小船
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 0.5), mat(0x7d5a38));
  hull.position.set(1.3, 0.2, 1.7); hull.rotation.y = 0.5;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4), mat(0x7d5a38));
  bow.rotation.z = -Math.PI / 2; bow.rotation.y = 0.5;
  bow.position.set(1.95, 0.2, 1.42);
  g.add(hull, bow);
  // 纪念碑 + 红星 + 红旗
  const stele = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.3), mat(0xd9d2c0));
  stele.position.set(-2.2, 1.0, 2.2);
  const sbase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.6), mat(0xb5ad9c));
  sbase.position.set(-2.2, 0.18, 2.2);
  const star = redStar(0.5); star.position.set(-2.2, 1.65, 2.36);
  g.add(stele, sbase, star);
  addWavingFlag(g, -1.2, 0, 2.6, 0.85);
  // 赤水竹林
  const bambooM = mat(0x4d7d3a), leafM = mat(0x5d9440);
  const rnd = mulberry(41);
  for (let i = 0; i < 7; i++) {
    const bx = -3 + rnd() * 6, bz = -2.6 + rnd() * 1.6;
    const bh = 1.6 + rnd() * 1.0;
    const culm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, bh, 5), bambooM);
    culm.position.set(bx, bh / 2, bz);
    culm.rotation.z = (rnd() - 0.5) * 0.14;
    culm.castShadow = true;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 5), leafM);
    tuft.position.set(bx + culm.rotation.z * bh * 0.5, bh + 0.2, bz);
    g.add(culm, tuft);
  }
  // 渡口木牌
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#4a3a26'; cx.fillRect(0, 0, 256, 64);
  cx.fillStyle = '#f2e4c0'; cx.font = '700 30px "Noto Serif SC", serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('土城 · 红军渡口', 128, 34);
  const signTex = new THREE.CanvasTexture(cv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.33), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(-2.2, 0.62, 2.38);
  g.add(sign);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

/* ---- 12. 榕江村超（球场 + 看台人海 + 四角灯柱 + 足球） ---- */
function buildCunchao(g) {
  // 球场草坪纹理（含白色标线）
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#3e7d3a'; cx.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#468a40' : '#3e7d3a'; cx.fillRect(i * 64, 0, 64, 320); }
  cx.strokeStyle = '#f2f2e8'; cx.lineWidth = 5;
  cx.strokeRect(16, 12, 480, 296);
  cx.beginPath(); cx.moveTo(256, 12); cx.lineTo(256, 308); cx.stroke();
  cx.beginPath(); cx.arc(256, 160, 42, 0, Math.PI * 2); cx.stroke();
  cx.strokeRect(16, 90, 62, 140); cx.strokeRect(434, 90, 62, 140);
  const pitchTex = new THREE.CanvasTexture(cv); pitchTex.colorSpace = THREE.SRGBColorSpace;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.5),
    new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.9 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.06;
  pitch.receiveShadow = true;
  g.add(pitch);
  // 球门
  const goalM = mat(0xf2f2e8);
  for (const s of [-1, 1]) {
    for (const z of [-0.5, 0.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 5), goalM);
      post.position.set(s * 2.62, 0.31, z);
      g.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.08, 5), goalM);
    bar.rotation.x = Math.PI / 2; bar.position.set(s * 2.62, 0.62, 0);
    g.add(bar);
  }
  // 足球（canvas 画黑色斑块）
  const bv = document.createElement('canvas'); bv.width = bv.height = 64;
  const bx = bv.getContext('2d');
  bx.fillStyle = '#f4f4f0'; bx.fillRect(0, 0, 64, 64);
  bx.fillStyle = '#26262a';
  for (const [px, py] of [[32, 20], [12, 44], [52, 44], [12, 12], [52, 12]]) {
    bx.beginPath(); bx.arc(px, py, 7, 0, Math.PI * 2); bx.fill();
  }
  const ballTex = new THREE.CanvasTexture(bv); ballTex.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6 }));
  ball.position.set(0.4, 0.23, 0.3);
  ball.castShadow = true;
  g.add(ball);
  animated.push((dt, t) => { ball.position.y = 0.23 + Math.abs(Math.sin(t * 2.2)) * 0.12; ball.rotation.y += dt * 1.5; });
  // 两侧看台人海（彩色小方块，起伏欢呼）
  const crowdM = mat(0xffffff);
  const crowd = [];
  const rnd = mulberry(97);
  const crowdCols = [0xe05a4e, 0xe8c454, 0x5aa8ff, 0x7fc98f, 0xf2ede0, 0xe88ca0];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), crowdM.clone());
      c.material.color.setHex(crowdCols[Math.floor(rnd() * crowdCols.length)]);
      c.position.set(-2.7 + i * 0.36, 0.28, s * 2.15);
      c.castShadow = true;
      g.add(c); crowd.push({ m: c, ph: rnd() * 6 });
    }
  }
  animated.push((dt, t) => {
    for (const c of crowd) c.m.position.y = 0.28 + Math.abs(Math.sin(t * 3 + c.ph)) * 0.16;
  });
  // 四角灯柱（夜赛氛围）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 5), mat(0x5a5648));
    pole.position.set(sx * 3.1, 1.3, sz * 2.3);
    pole.castShadow = true;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      mat(0xffe9a8, { emissive: 0xffd977, emissiveIntensity: 1.2 }));
    lamp.position.set(sx * 3.1, 2.7, sz * 2.3);
    g.add(pole, lamp);
  }
  addWavingFlag(g, 3.4, 0, -1.6, 0.9);
  addWavingFlag(g, -3.4, 0, 1.6, 0.9);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

/* ---- 13. 织金洞（喀斯特石山 + 发光溶洞洞口 + 钟乳石） ---- */
function buildZhijindong(g) {
  const rockM = mat(0x7d8471), rockD = mat(0x66705c);
  const hill = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.4, 7), rockM);
  hill.position.set(0, 2.2, -0.8);
  const hill2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.0, 6), rockD);
  hill2.position.set(2.2, 1.5, -1.6);
  g.add(hill, hill2);
  // 洞口（黑洞 + 石拱）
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.95, 18),
    new THREE.MeshBasicMaterial({ color: 0x101c1a }));
  mouth.position.set(0, 0.85, 1.42); mouth.rotation.x = -0.28;
  g.add(mouth);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.22, 6, 12, Math.PI), rockD);
  arch.position.set(0, 0.82, 1.4); arch.rotation.x = -0.28;
  arch.castShadow = true;
  g.add(arch);
  // 洞内发光的钟乳石（垂下 + 向上石笋）
  const stalM1 = mat(0x9fd8c8, { emissive: 0x3f8f7a, emissiveIntensity: 0.55 });
  const stalM2 = mat(0xe8d9a8, { emissive: 0xc9a227, emissiveIntensity: 0.45 });
  const rnd = mulberry(73);
  for (let i = 0; i < 5; i++) {
    const sx = -0.6 + i * 0.3, sd = 0.35 + rnd() * 0.35;
    const hang = new THREE.Mesh(new THREE.ConeGeometry(0.09, sd, 5), i % 2 ? stalM1 : stalM2);
    hang.rotation.x = Math.PI;
    hang.position.set(sx, 1.35 - sd / 2, 1.35 - Math.abs(sx) * 0.25);
    g.add(hang);
    const up = new THREE.Mesh(new THREE.ConeGeometry(0.1, sd * 0.8, 5), i % 2 ? stalM2 : stalM1);
    up.position.set(sx + 0.12, sd * 0.4, 1.6 - Math.abs(sx) * 0.2);
    g.add(up);
  }
  // 洞口冷光
  const glow = new THREE.PointLight(0x7fd4c8, 6, 7);
  glow.position.set(0, 1.0, 1.8);
  g.add(glow);
  animated.push((dt, t) => { glow.intensity = 6 + Math.sin(t * 1.6) * 1.5; });
  // 前景石笋一对 + 小径灯
  for (const s of [-1, 1]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), rockD);
    sp.position.set(s * 1.5, 0.55, 2.2);
    sp.castShadow = true;
    g.add(sp);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
      mat(0xffe9a8, { emissive: 0xffd977, emissiveIntensity: 1.1 }));
    lamp.position.set(s * 0.8, 0.5, 2.9);
    const lpole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5), mat(0x4a4538));
    lpole.position.set(s * 0.8, 0.25, 2.9);
    g.add(lamp, lpole);
  }
  // 石碑
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#3c3638'; cx.fillRect(0, 0, 192, 64);
  cx.fillStyle = '#e8c454'; cx.font = '700 30px "Noto Serif SC", serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('织金洞', 96, 34);
  const stTex = new THREE.CanvasTexture(cv); stTex.colorSpace = THREE.SRGBColorSpace;
  const stone = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.18), mat(0x8f8d80));
  stone.position.set(-1.7, 0.35, 2.6);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: stTex }));
  face.position.set(-1.7, 0.38, 2.7);
  g.add(stone, face);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
}

const BUILDERS = {
  huangguoshu: buildHuangguoshu, xijiang: buildXijiang, fanjing: buildFanjing,
  xiaoqikong: buildXiaoqikong, zhenyuan: buildZhenyuan, wanfenglin: buildWanfenglin,
  zhaoxing: buildZhaoxing, fast: buildFAST,
  zunyi: buildZunyi, loushanguan: buildLoushanguan,
  chishui: buildChishui, cunchao: buildCunchao, zhijindong: buildZhijindong,
};

/* 小七孔的大碧水深潭 */
{
  const l = LANDMARKS.find(x => x.id === 'xiaoqikong');
  const pond = new THREE.Mesh(new THREE.CircleGeometry(5.4, 30),
    mat(0x3fbfa8, { roughness: 0.28, emissive: 0x3fbfa8, emissiveIntensity: 0.28 }));
  placeOnSphere(pond, l.dir, 0.05);
  pond.receiveShadow = true;
  scene.add(pond);
}

/* ============================================================
   地标名牌 + 浮标 + 组装
   ============================================================ */
function makeLabel(text) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const cx = cv.getContext('2d');
  const w = 60 + text.length * 56, x0 = (512 - w) / 2;
  cx.fillStyle = 'rgba(42,37,32,0.85)';
  cx.strokeStyle = 'rgba(232,196,84,0.9)'; cx.lineWidth = 3;
  cx.beginPath(); cx.roundRect(x0, 26, w, 76, 38); cx.fill(); cx.stroke();
  cx.fillStyle = '#e8c454';
  cx.beginPath(); cx.arc(x0 + 36, 64, 9, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = '#f4ecd8';
  cx.font = '700 46px "Noto Sans SC", "PingFang SC", sans-serif';
  cx.textBaseline = 'middle';
  cx.fillText(text, x0 + 58, 66);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(5.4, 1.35, 1);
  return sp;
}

const markerM = mat(0xe8c454, { emissive: 0xc9a227, emissiveIntensity: 0.65 });
const markerDoneM = mat(0x7fc98f, { emissive: 0x3f8f5a, emissiveIntensity: 0.5 });
for (const l of LANDMARKS) {
  const g = new THREE.Group();
  BUILDERS[l.id](g);
  placeOnSphere(g, l.dir);
  scene.add(g);
  l.group = g;
  l.center = groundPos(l.dir);
  l.visited = false;

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), markerM.clone());
  marker.castShadow = true;
  scene.add(marker);
  l.marker = marker;
  const label = makeLabel(l.name);
  scene.add(label);
  l.label = label;

  let spin = Math.random() * Math.PI * 2;
  animated.push((dt, t) => {
    spin += dt * (l.visited ? 0.5 : 1.8);
    const bob = Math.sin(t * 2 + l.lon) * 0.3;
    marker.position.copy(groundPos(l.dir, l.markerH + bob));
    tmpQ.setFromUnitVectors(UP, l.dir)
        .multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
    marker.quaternion.copy(tmpQ);
    label.position.copy(groundPos(l.dir, l.markerH + 1.6 + bob * 0.5));
  });
}

/* ============================================================
   旅行者角色
   ============================================================ */
const player = new THREE.Group();
const limbs = {};
{
  const jacketM = mat(0x3f5d43), pantsM = mat(0x3a3730), skinM = mat(0xf2d7b6),
        packM = mat(0xc9a227), hatM = mat(0x8a3f2e);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 4, 8), jacketM);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skinM);
  head.position.y = 1.65;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.28, 8), hatM);
  hat.position.y = 1.88;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.2), packM);
  pack.position.set(0, 1.05, -0.33);
  limbs.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.55, 6), pantsM);
  limbs.legR = limbs.legL.clone();
  limbs.legL.position.set(-0.15, 0.28, 0); limbs.legR.position.set(0.15, 0.28, 0);
  limbs.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.5, 6), jacketM);
  limbs.armR = limbs.armL.clone();
  limbs.armL.position.set(-0.44, 1.05, 0); limbs.armR.position.set(0.44, 1.05, 0);
  player.add(body, head, hat, pack, limbs.legL, limbs.legR, limbs.armL, limbs.armR);
  player.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(player);
}
for (const k of ['legL', 'legR', 'armL', 'armR']) {
  const m = limbs[k];
  m.geometry = m.geometry.clone();
  m.geometry.translate(0, k.startsWith('leg') ? -0.22 : -0.2, 0);
  if (k.startsWith('leg')) m.position.y = 0.55; else m.position.y = 1.3;
}

/* 指路小箭 */
const guideArrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 5), mat(0xe8c454, { emissive: 0xc9a227, emissiveIntensity: 0.8 }));
guideArrow.geometry.rotateX(Math.PI / 2);
scene.add(guideArrow);

/* ============================================================
   球面移动 + 跟随相机
   ============================================================ */
const state = {
  dir: dirFromLatLon(0, 40),
  heading: dirFromLatLon(0, 130),
  speed: 7.5,
  camYaw: 0, camPitch: 0,
  started: false, paused: false,
  walkT: 0, moving: false,
  curSpeed: 0, jumpY: 0, vy: 0,
};

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && interaction && !state.paused) doInteraction();
});
addEventListener('keyup', e => keys[e.code] = false);

/* 触屏摇杆 */
const joyVec = new THREE.Vector2();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
{
  const joy = document.getElementById('joy'), stick = document.getElementById('joy-stick');
  let pid = null;
  const setStick = (dx, dy) => { stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
  joy.addEventListener('pointerdown', e => { pid = e.pointerId; joy.setPointerCapture(pid); });
  joy.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy), max = 40;
    if (len > max) { dx *= max / len; dy *= max / len; }
    setStick(dx, dy);
    joyVec.set(dx / max, dy / max);
  });
  const end = e => { if (e.pointerId === pid) { pid = null; setStick(0, 0); joyVec.set(0, 0); } };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
}

/* 拖动旋转视角 */
{
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    state.camYaw -= (e.clientX - lx) * 0.005;
    state.camPitch = THREE.MathUtils.clamp(state.camPitch + (e.clientY - ly) * 0.004, -0.15, 0.85);
    lx = e.clientX; ly = e.clientY;
  });
  addEventListener('pointerup', () => dragging = false);
}

function updatePlayer(dt) {
  const up = tmpV1.copy(state.dir).normalize();

  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joyVec.x;
  let iz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - joyVec.y;
  const hasInput = !state.paused && (ix !== 0 || iz !== 0);
  state.moving = hasInput;
  state.curSpeed = THREE.MathUtils.damp(state.curSpeed, hasInput ? state.speed : 0, 9, dt);
  if (state.curSpeed > 0.2) {
    const camF = camera.getWorldDirection(new THREE.Vector3());
    const tF = camF.sub(tmpV3.copy(up).multiplyScalar(camF.dot(up))).normalize();
    const tR = new THREE.Vector3().crossVectors(tF, up);
    const move = new THREE.Vector3().addScaledVector(tF, iz).addScaledVector(tR, ix);
    if (move.lengthSq() < 0.01) move.copy(state.heading); else move.normalize();
    const axis = new THREE.Vector3().crossVectors(up, move).normalize();
    state.dir.applyAxisAngle(axis, state.curSpeed * dt / R).normalize();
    state.heading.lerp(move, 1 - Math.exp(-dt * 10)).normalize();
    state.heading.sub(up.clone().multiplyScalar(state.heading.dot(up))).normalize();
    if (hasInput) state.camYaw *= Math.exp(-dt * 2.2);
  }

  // 跳跃
  if (!state.paused && keys.Space && state.jumpY === 0) state.vy = 4.4;
  if (state.jumpY > 0 || state.vy > 0) {
    state.jumpY += state.vy * dt;
    state.vy -= 11.5 * dt;
    if (state.jumpY <= 0) { state.jumpY = 0; state.vy = 0; }
  }

  const groundY = R + heightAt(state.dir) + state.jumpY;
  player.position.copy(state.dir).multiplyScalar(groundY);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), tmpV2.copy(state.heading).negate(), up);
  player.quaternion.setFromRotationMatrix(m);

  if (state.moving) state.walkT += dt * 11;
  const sw = state.moving ? Math.sin(state.walkT) * 0.65 : 0;
  limbs.legL.rotation.x = sw; limbs.legR.rotation.x = -sw;
  limbs.armL.rotation.x = -sw * 0.8; limbs.armR.rotation.x = sw * 0.8;
  player.position.addScaledVector(up, state.moving ? Math.abs(Math.sin(state.walkT)) * 0.08 : 0);

  // 相机：跟随 + 偏航/俯仰 + 阻尼；靠近大地标时微微拉远
  let extraDist = 0;
  if (nearLandmark) extraDist = Math.max(0, (nearLandmark.interactR - 7.5)) * 0.35;
  const back = tmpV2.copy(state.heading).applyAxisAngle(up, state.camYaw).negate();
  const dist = 8.6 + extraDist - state.camPitch * 2.2, height = 4.0 + extraDist * 0.6 + state.camPitch * 5;
  const desired = tmpV3.copy(player.position).addScaledVector(back, dist).addScaledVector(up, height);
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.5));
  camera.up.lerp(up, 1 - Math.exp(-dt * 6)).normalize();
  camera.lookAt(tmpV2.copy(player.position).addScaledVector(up, 1.2));

  let target = null;
  if (quest.carrying && quest.idx < LETTERS.length) {
    target = LANDMARKS.find(l => l.id === LETTERS[quest.idx].to);
  } else {
    target = nearestLandmark(true);
    if (!target && quest.idx < LETTERS.length)
      target = LANDMARKS.find(l => l.id === LETTERS[quest.idx].from);
  }
  if (target && state.started) {
    guideArrow.visible = true;
    const toL = tmpV2.copy(target.center).sub(player.position);
    toL.sub(tmpV3.copy(up).multiplyScalar(toL.dot(up)));
    if (toL.lengthSq() > 4) {
      toL.normalize();
      guideArrow.position.copy(player.position).addScaledVector(up, 2.7);
      const gm = new THREE.Matrix4().lookAt(new THREE.Vector3(), tmpV3.copy(toL).negate(), up);
      guideArrow.quaternion.setFromRotationMatrix(gm);
    } else guideArrow.visible = false;
  } else guideArrow.visible = false;
}

/* ============================================================
   交互与 UI
   ============================================================ */
const dotsEl = document.getElementById('dots');
for (let i = 0; i < LANDMARKS.length; i++) { const d = document.createElement('div'); d.className = 'dot'; dotsEl.appendChild(d); }

let nearLandmark = null;
const promptEl = document.getElementById('prompt');
const promptName = document.getElementById('prompt-name');
const actBtn = document.getElementById('act');

function nearestLandmark(unvisitedOnly = false) {
  let best = null, bd = Infinity;
  for (const l of LANDMARKS) {
    if (unvisitedOnly && l.visited) continue;
    const d = player.position.distanceTo(l.center);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

let audioCtx = null;
function chime() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    [880, 1174.7, 1568].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.09);
      g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.6);
    });
  } catch (e) {}
}

let visitSeq = 0;
const cardOverlay = document.getElementById('card');
function openCard(l) {
  state.paused = true;
  if (!l.visited) {
    l.visited = true;
    l.visitOrder = ++visitSeq;
    l.marker.material = markerDoneM.clone();
    chime();
    dotsEl.children[LANDMARKS.indexOf(l)].classList.add('done');
    saveGame();
    applyLiveliness();
  }
  const idx = LANDMARKS.indexOf(l);
  document.getElementById('card-no').textContent =
    'POSTCARD ' + String(idx + 1).padStart(2, '0') + ' · ' + l.tag;
  document.getElementById('card-title').textContent = l.name;
  document.getElementById('card-en').textContent = l.en;
  document.getElementById('card-body').textContent = l.desc;
  const cultEl = document.getElementById('card-culture');
  if (l.heritage) {
    cultEl.innerHTML = `<span class="cc"><i>非遗</i>${l.heritage}</span><span class="cc food"><i>美食</i>${l.food}</span>`;
    cultEl.style.display = 'flex';
  } else cultEl.style.display = 'none';
  const done = LANDMARKS.filter(x => x.visited).length;
  document.getElementById('card-count').textContent = `已收集 ${done} / ${LANDMARKS.length} 张明信片`;
  cardOverlay.classList.remove('hidden');
}
document.getElementById('card-close').addEventListener('click', () => {
  cardOverlay.classList.add('hidden');
  state.paused = false;
  if (LANDMARKS.every(l => l.visited)) {
    document.getElementById('done').classList.remove('hidden');
  }
});
document.getElementById('done-close').addEventListener('click', () => {
  document.getElementById('done').classList.add('hidden');
  openPlan();
});

/* ---------- 我的贵州环线（环线行程单 2.0，演示数据） ---------- */
const HUB = '贵阳';
/* 按真实地理位置串联：贵阳集散，西南进、东北出，不走回头路 */
const LOOP = ['huangguoshu', 'wanfenglin', 'fast', 'xiaoqikong', 'cunchao', 'zhaoxing',
              'xijiang', 'zhenyuan', 'fanjing', 'loushanguan', 'zunyi', 'chishui', 'zhijindong'];
/* 分段车程 [拼车小时, 自助换乘小时]；SEGS[0]=贵阳→首站，SEGS[13]=末站→贵阳 */
const SEGS = [
  [1.5, 3],    // 贵阳 → 黄果树
  [2.5, 5],    // 黄果树 → 万峰林
  [3.5, 6.5],  // 万峰林 → 中国天眼
  [1.5, 3.5],  // 天眼 → 荔波小七孔
  [1.5, 3],    // 小七孔 → 榕江村超
  [1, 1.5],    // 村超 → 肇兴侗寨
  [2, 4],      // 侗寨 → 西江苗寨
  [2.5, 4.5],  // 苗寨 → 镇远古城
  [2.5, 5],    // 镇远 → 梵净山
  [3.5, 6],    // 梵净山 → 娄山关
  [1, 1.5],    // 娄山关 → 遵义会址
  [2, 3.5],    // 遵义 → 四渡赤水渡口
  [4, 6.5],    // 赤水 → 织金洞
  [2, 3.5],    // 织金洞 → 贵阳
];
/* 各主线站点的顺路二级站点（只进行程单，不上星球） */
const NEARBY = {
  huangguoshu: [['龙宫', '溶洞暗河']],
  wanfenglin: [['马岭河峡谷', '地球最美伤疤']],
  fast: [['平塘天坑群', '地质奇观']],
  xiaoqikong: [['茂兰', '喀斯特森林']],
  cunchao: [['三宝侗寨', '侗族大歌发源地之一']],
  zhaoxing: [['黎平会议会址', '红军入黔第一会', 'red'], ['堂安梯田', '徒步栈道']],
  xijiang: [['台江村BA', '现象级篮球赛事']],
  zhenyuan: [['高过河', '漂流']],
  fanjing: [['云舍村', '土家第一村']],
  loushanguan: [['海龙屯', '世界文化遗产']],
  zunyi: [['苟坝会议会址', '马灯照亮的夜晚', 'red']],
  chishui: [['赤水丹霞大瀑布', '世界自然遗产'], ['丙安古镇', '红军渡口', 'red']],
  zhijindong: [['织金古城', '财神庙'], ['百里杜鹃', '3–5 月花海']],
};
/* 红色印记专线（不进星球的沿线红色站点） */
const REDLINE = [
  ['黎平会议会址', '红军入黔第一会，与肇兴侗寨同线'],
  ['苟坝会议会址', '一盏马灯照亮转折之夜'],
  ['猴场会议会址', '伟大转折的前夜'],
  ['息烽集中营', '爱国主义教育示范基地'],
  ['红飘带数字艺术馆', '数字化长征史诗 · 贵阳'],
];
function legSum(fromIdx, toIdx) {
  // LOOP 索引 fromIdx 到 toIdx 之间的车程合计（不含 fromIdx 自身段）
  let d = 0, s = 0;
  for (let i = fromIdx + 1; i <= toIdx; i++) { d += SEGS[i][0]; s += SEGS[i][1]; }
  return [d, s];
}

const planOverlay = document.getElementById('plan');
let planTag = '';
function renderPlan() {
  const list = document.getElementById('plan-list');
  // 主题筛选 + 保持环线顺序
  const items = LOOP.map(id => LANDMARKS.find(l => l.id === id))
    .filter(l => !planTag || l.tag === planTag);
  if (items.length === 0) {
    list.innerHTML = '<div class="plan-empty">这个主题下暂无目的地</div>';
    return;
  }
  const idxs = items.map(l => LOOP.indexOf(l.id));
  let html = `<div class="plan-item"><span class="n"><span>始</span></span><span class="nm">${HUB}（集散）</span><span class="tg">出发地</span></div>`;
  let totalD = 0, totalS = 0;
  const [fd, fs] = legSum(-1, idxs[0]);   // 贵阳 → 首站
  totalD += fd; totalS += fs;
  html += `<div class="plan-leg"><span class="arrow">↓</span>拼车约 ${fd}h <span class="save">自助换乘约 ${fs}h</span></div>`;
  items.forEach((l, k) => {
    if (k > 0) {
      const [d, s] = legSum(idxs[k - 1], idxs[k]);
      totalD += d; totalS += s;
      html += `<div class="plan-leg"><span class="arrow">↓</span>拼车约 ${d}h <span class="save">自助换乘约 ${s}h</span></div>`;
    }
    html += `<div class="plan-item${l.visited ? '' : ' dim'}">
      <span class="n"><span>${k + 1}</span></span><span class="nm">${l.name}</span>
      <span class="tg${l.tag === '红色印记' ? ' red' : ''}">${l.tag}${l.visited ? ' · 已解锁' : ' · 待探索'}</span></div>`;
    const nb = NEARBY[l.id];
    if (nb && (!planTag || planTag === '' || l.tag === planTag)) {
      html += `<div class="plan-near">顺路可加：${nb.map(x =>
        `<span class="${x[2] === 'red' ? 'red' : ''}">${x[0]}<i>${x[1]}</i></span>`).join('')}</div>`;
    }
  });
  const [rd, rs] = legSum(idxs[idxs.length - 1], LOOP.length);
  totalD += rd; totalS += rs;
  html += `<div class="plan-leg"><span class="arrow">↓</span>拼车约 ${rd}h <span class="save">自助换乘约 ${rs}h</span></div>`;
  html += `<div class="plan-item"><span class="n"><span>终</span></span><span class="nm">返回${HUB}</span><span class="tg">环线闭合</span></div>`;
  list.innerHTML = html;

  const saved = Math.round((totalS - totalD) * 10) / 10;
  const visitedN = LANDMARKS.filter(l => l.visited).length;
  document.getElementById('plan-summary').innerHTML =
    `本线 ${items.length} 站 · 拼车全程约 <b>${totalD}h</b>（自助换乘约 ${totalS}h）<br>` +
    `帮你省下约 <b>${saved} 小时</b> 车程 —— 多出一整天的贵州<br>` +
    `<span class="small">已集风物 ${visitedN * 2} / ${LANDMARKS.length * 2} 件（非遗 + 美食） · 演示数据，正式版接入实时路况与在线预订</span>`;
  const n = items.length;
  const days = n <= 3 ? '2~3' : n <= 6 ? '4~5' : n <= 8 ? '5~6' : n <= 11 ? '7~8' : '9~10';
  document.getElementById('plan-days').textContent = `拼车环线 · 建议 ${days} 天 · 行李直达下一站酒店`;
  // 红色印记专线（主题筛选为红色或全部时展示）
  const rl = document.getElementById('plan-redline');
  if (planTag === '' || planTag === '红色印记') {
    rl.innerHTML = '<div class="rl-head">红色印记专线 · 沿线可加</div>' +
      REDLINE.map(r => `<div class="rl-item"><span class="dot"></span><b>${r[0]}</b><span class="rl-note">${r[1]}</span></div>`).join('');
    rl.style.display = 'block';
  } else rl.style.display = 'none';
}
function openPlan() {
  state.paused = true;
  const visited = LANDMARKS.filter(l => l.visited);
  document.getElementById('plan-count').textContent = visited.length;
  document.getElementById('plan-total').textContent = LANDMARKS.length;
  renderPlan();
  planOverlay.classList.remove('hidden');
}
document.getElementById('plan-themes').addEventListener('click', e => {
  const th = e.target.closest('.th');
  if (!th) return;
  document.querySelectorAll('#plan-themes .th').forEach(x => x.classList.remove('on'));
  th.classList.add('on');
  planTag = th.dataset.tag;
  renderPlan();
});
document.getElementById('plan-close').addEventListener('click', () => {
  planOverlay.classList.add('hidden');
  state.paused = false;
});
document.getElementById('plan-btn').addEventListener('click', () => {
  if (state.started && !state.paused) openPlan();
});

/* ---------- 分享卡片：Canvas 生成"我的贵州环线"图，可直接保存去私域传播 ---------- */
function makeShareCard() {
  const W = 900, H = 1280;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  // 纸面 + 边框（animal-island 配色）
  cx.fillStyle = '#F7F3E1'; cx.fillRect(0, 0, W, H);
  cx.strokeStyle = '#19C8B9'; cx.lineWidth = 6; cx.strokeRect(26, 26, W - 52, H - 52);
  cx.lineWidth = 2; cx.strokeStyle = '#A79A7E'; cx.strokeRect(42, 42, W - 84, H - 84);
  // 顶部：印章 + 标题
  cx.fillStyle = '#FAD12B';
  cx.beginPath(); cx.roundRect(72, 84, 84, 84, 22); cx.fill();
  cx.fillStyle = '#4C3C33'; cx.font = '52px "ZCOOL KuaiLe","Noto Sans SC",sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('黔', 114, 132);
  cx.fillStyle = '#A79A7E'; cx.font = '700 22px sans-serif'; cx.textAlign = 'left';
  cx.fillText('GUIZHOU · MINI PLANET', 186, 102);
  cx.fillStyle = '#4C3C33'; cx.font = '56px "ZCOOL KuaiLe","Noto Sans SC",sans-serif';
  cx.fillText('我的贵州环线', 186, 154);
  // 进度行
  const visitedN = LANDMARKS.filter(l => l.visited).length;
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  cx.fillStyle = '#827157'; cx.font = '500 24px sans-serif';
  cx.fillText(`${dateStr} · 已解锁 ${visitedN} / ${LANDMARKS.length} 站 · 送信 ${Math.min(quest.idx, QUEST_LETTERS.length)} / ${QUEST_LETTERS.length} 封`, 72, 224);
  cx.strokeStyle = '#19C8B9'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(72, 252); cx.lineTo(W - 72, 252); cx.stroke();
  // 站点印章格（2 列）
  let totalD = 0, totalS = 0;
  for (const seg of SEGS) { totalD += seg[0]; totalS += seg[1]; }
  const colW = (W - 144 - 24) / 2, rowH = 74;
  LOOP.forEach((id, i) => {
    const l = LANDMARKS.find(x => x.id === id);
    const col = i % 2, row = Math.floor(i / 2);
    const x = 72 + col * (colW + 24), y = 286 + row * rowH;
    if (l.visited) {
      cx.fillStyle = '#FFFDF4'; cx.strokeStyle = '#19C8B9'; cx.lineWidth = 2.5;
      cx.beginPath(); cx.roundRect(x, y, colW, rowH - 14, 14); cx.fill(); cx.stroke();
      cx.fillStyle = '#4C3C33'; cx.font = '700 26px "Noto Sans SC",sans-serif'; cx.textAlign = 'left';
      cx.fillText(`${String(i + 1).padStart(2, '0')} · ${l.name}`, x + 18, y + 32);
      cx.fillStyle = '#0EA096'; cx.font = '700 20px sans-serif'; cx.textAlign = 'right';
      cx.fillText(l.tag + ' ✓', x + colW - 16, y + 32);
    } else {
      cx.strokeStyle = '#C9BC9C'; cx.lineWidth = 2; cx.setLineDash([7, 6]);
      cx.beginPath(); cx.roundRect(x, y, colW, rowH - 14, 14); cx.stroke(); cx.setLineDash([]);
      cx.fillStyle = '#A79A7E'; cx.font = '500 25px "Noto Sans SC",sans-serif'; cx.textAlign = 'left';
      cx.fillText(`${String(i + 1).padStart(2, '0')} · ${l.name}`, x + 18, y + 32);
      cx.font = '500 19px sans-serif'; cx.textAlign = 'right';
      cx.fillText('待探索', x + colW - 16, y + 32);
    }
  });
  // 统计带
  const statY = 286 + Math.ceil(LOOP.length / 2) * rowH + 26;
  cx.fillStyle = '#19C8B9';
  cx.beginPath(); cx.roundRect(72, statY, W - 144, 108, 20); cx.fill();
  cx.fillStyle = '#FFFFFF'; cx.font = '30px "ZCOOL KuaiLe","Noto Sans SC",sans-serif'; cx.textAlign = 'center';
  cx.fillText(`${LOOP.length} 站环线 · 拼车全程约 ${totalD}h`, W / 2, statY + 42);
  cx.fillStyle = '#FAD12B'; cx.font = '700 23px sans-serif';
  cx.fillText(`比自助换乘省下约 ${Math.round((totalS - totalD) * 10) / 10} 小时 —— 多出一整天的贵州`, W / 2, statY + 80);
  // 底部：小星球涂鸦 + 口号
  const py = statY + 200;
  cx.strokeStyle = '#4C3C33'; cx.lineWidth = 4;
  cx.beginPath(); cx.arc(W / 2, py, 44, 0, Math.PI * 2); cx.stroke();
  cx.strokeStyle = '#E68E6D'; cx.beginPath();
  cx.ellipse(W / 2, py, 66, 18, -0.3, 0, Math.PI * 2); cx.stroke();
  cx.fillStyle = '#4C3C33'; cx.font = '30px "ZCOOL KuaiLe","Noto Sans SC",sans-serif';
  cx.fillText('十三个目的地 · 一条环线', W / 2, py + 100);
  cx.fillStyle = '#A79A7E'; cx.font = '500 21px sans-serif';
  cx.fillText('黔行星球 · 拼团组游 / AI 定制行程 / 航拍美食 · 小程序即将上线', W / 2, py + 142);
  // 导出下载
  cv.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '我的贵州环线.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    showToast('分享卡片已生成并保存，可以发到朋友圈或微信群召集拼友了。', 4000);
  }, 'image/png');
}
for (const id of ['share-btn', 'share-btn-2']) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', makeShareCard);
}
promptEl.addEventListener('click', () => { if (interaction) doInteraction(); });
actBtn.addEventListener('click', () => { if (interaction) doInteraction(); });

const hud = document.getElementById('hud');
function begin() {
  document.getElementById('start').classList.add('hidden');
  hud.classList.add('on');
  state.started = true;
  initAudio();
}
document.getElementById('start-btn').addEventListener('click', begin);

/* ============================================================
   信件任务链（沿环线传递，跑完一圈 = 环线跑通）
   ============================================================ */
const LETTERS = [
  { from: 'huangguoshu', to: 'wanfenglin',
    text: '瀑布边的老船工托你把一包新晒的刺梨干捎给万峰林的布依阿妈——"客人坐车辛苦，到了先吃点甜的。"' },
  { from: 'wanfenglin', to: 'fast',
    text: '布依阿妈装了一袋新米请你带给天眼的工程师——"看星星的人，也要吃热饭。"' },
  { from: 'fast', to: 'xiaoqikong',
    text: '工程师把一张新拍的星空照片送给小七孔的护林员——"宇宙和碧水，都值得被守着。"' },
  { from: 'xiaoqikong', to: 'cunchao',
    text: '护林员把一只补好的旧足球带给村超的守门员——"山里的孩子，也值得一场满座的比赛。"' },
  { from: 'cunchao', to: 'zhaoxing',
    text: '守门员把一件签满名字的球衣带给侗寨的歌师——"进球后的欢呼，也该写成大歌。"' },
  { from: 'zhaoxing', to: 'xijiang',
    text: '歌师把一段新谱的侗歌带给苗寨的绣娘——"山水和针线，都是贵州的语言。"' },
  { from: 'xijiang', to: 'zhenyuan',
    text: '绣娘把一方蜡染头巾捎给镇远的老船工——"河上的风大，别着凉。"' },
  { from: 'zhenyuan', to: 'fanjing',
    text: '老船工把一包陈年毛尖带给梵净山的守山人——"云海里值班，泡壶热的。"' },
  { from: 'fanjing', to: 'loushanguan',
    text: '守山人把一朵云雾干花带给娄山关的讲解员——"雄关的风里，也该有点香气。"' },
  { from: 'loushanguan', to: 'zunyi',
    text: '讲解员把一枚擦亮的五角星带给会址的管理员——"放在窗台上，太阳出来会反光。"' },
  { from: 'zunyi', to: 'chishui',
    text: '管理员把一本翻旧的会议记录复刻本带给赤水渡口的老船工——"四渡赤水的故事，要从河上讲起。"' },
  { from: 'chishui', to: 'zhijindong',
    text: '老船工把一坛赤水晒醋捎给织金洞的守洞人——"洞里的岁月长，慢慢品。"' },
  { from: 'zhijindong', to: 'huangguoshu',
    text: '守洞人把一枚小小的石笋标本寄回瀑布边的老船工——"环线跑通了，常来。"' },
];
/* 任务链 = 环线顺序，首尾相接 */
const QUEST_CHAIN = LOOP;
const QUEST_LETTERS = QUEST_CHAIN.map((from, i) => {
  const to = QUEST_CHAIN[(i + 1) % QUEST_CHAIN.length];
  const found = LETTERS.find(L => L.from === from && L.to === to);
  return { from, to, text: found ? found.text : '' };
});

/* NPC 服务角色与拼车/服务告示（商业流程的叙事化身） */
const NPC_META = {
  huangguoshu: ['拼车师傅 · 老杨', '老杨的拼车告示：明早 7:30 黄果树 → 万峰林，7 座商务车还差 2 人成团，¥138/人，行李直达下一站酒店。'],
  wanfenglin: ['航拍小哥 · 小韦', '小韦的航拍摊：峰林日落场今天 17:50 起飞，跟拍 15 分钟出 9 张精修，现场传图。'],
  fast: ['驻站工程师 · 小杜', '天眼驿站：今晚 20:00 观星科普拼团，讲解 + 星空摄影，还差 3 人。'],
  xiaoqikong: ['护林员 · 蒙姐', '拼车点：小七孔东门 → 榕江，12 座小巴整点发车，车上备了晕车贴和矿泉水。'],
  cunchao: ['守门员 · 阿果', '村超志愿者站：今晚球场有友谊赛，场边酸汤粉摊 22 点才收摊——看完球正好住侗寨。'],
  zhaoxing: ['歌师 · 吴奶', '侗寨向导：鼓楼对歌每晚 19:30，篝火旁给你留了位置。'],
  xijiang: ['绣娘 · 阿仰', '美食向导：银饰体验 + 长桌宴拼桌，酸汤鱼现杀，4 人开席，还差 2 位。'],
  zhenyuan: ['老船工 · 周伯', '拼车点：镇远 → 梵净山早班 8:00；舞阳河夜游拼船还差 4 人。'],
  fanjing: ['守山人 · 老雷', '安全提示：明晨索道 7:00 首班，红云金顶限流，拼车含门票代订与保险。'],
  loushanguan: ['讲解员 · 小娄', '红色专线：娄山关 + 遵义会址一日拼车，讲解全程跟，¥168/人。'],
  zunyi: ['管理员 · 张伯', '遵义驿站：会址讲解整点拼团；巷口羊肉粉老店，本地人拼餐 12:00 开桌。'],
  chishui: ['渡口船工 · 何伯', '赤水河谷拼车：土城 → 丹霞大瀑布 → 茅台镇，7 座车，还送晒醋伴手礼。'],
  zhijindong: ['守洞人 · 金师傅', '末班拼车：织金洞 → 贵阳 17:30 发车，车上有宫保鸡丁便当——丁宝桢就是织金人。'],
};

const quest = { idx: 0, carrying: false };
const NPC_STYLE = { xijiang: 'miao', zhaoxing: 'dong' };

/* 信封 sprite 纹理 */
const envTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#c9a227';
  cx.beginPath(); cx.roundRect(14, 34, 100, 64, 10); cx.fill();
  cx.strokeStyle = '#f4ecd8'; cx.lineWidth = 6;
  cx.beginPath(); cx.moveTo(20, 44); cx.lineTo(64, 76); cx.lineTo(108, 44); cx.stroke();
  cx.fillStyle = '#e8c454';
  cx.beginPath(); cx.arc(64, 66, 12, 0, Math.PI * 2); cx.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

/* 每个地标安置一位任务 NPC + 信封浮标 */
for (const l of LANDMARKS) {
  const tang = Math.abs(l.dir.y) < 0.9
    ? new THREE.Vector3(0, 1, 0).cross(l.dir).normalize()
    : new THREE.Vector3(1, 0, 0);
  const nd = l.dir.clone().addScaledVector(tang, 0.11).normalize();
  const npc = villager(NPC_STYLE[l.id] || 'plain');
  placeOnSphere(npc, nd);
  npc.rotateY(Math.PI * (0.3 + Math.random()));
  scene.add(npc);
  l.npc = npc; l.npcDir = nd;
  const phase = Math.random() * 6;
  animated.push((dt, t) => { npc.position.copy(groundPos(nd, Math.abs(Math.sin(t * 2 + phase)) * 0.04)); });

  const env = new THREE.Sprite(new THREE.SpriteMaterial({ map: envTex, transparent: true, depthWrite: false }));
  env.scale.set(1.0, 1.0, 1);
  env.visible = false;
  scene.add(env);
  l.env = env;
  animated.push((dt, t) => {
    env.position.copy(groundPos(nd, 2.3 + Math.sin(t * 2.4 + phase) * 0.18));
  });
}

/* 任务提示气泡 */
let toastTimer = null;
const toastEl = document.getElementById('toast');
function showToast(html, ms = 6000) {
  toastEl.innerHTML = html;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
const letterChip = document.getElementById('letter-chip');
function updateLetterChip() {
  if (quest.carrying && quest.idx < QUEST_LETTERS.length) {
    const to = LANDMARKS.find(l => l.id === QUEST_LETTERS[quest.idx].to);
    letterChip.innerHTML = `✉ 送信 · 寄往 <b>${to.name}</b>`;
    letterChip.classList.add('show');
  } else {
    letterChip.classList.remove('show');
  }
}

/* 交互分派 */
let interaction = null;
function computeInteraction() {
  const n = nearestLandmark();
  nearLandmark = (n && player.position.distanceTo(n.center) < n.interactR) ? n : null;
  interaction = null;
  const cur = quest.idx < QUEST_LETTERS.length ? QUEST_LETTERS[quest.idx] : null;
  const targetL = cur ? LANDMARKS.find(l => l.id === cur.to) : null;
  const giverL = cur ? LANDMARKS.find(l => l.id === cur.from) : null;

  if (quest.carrying && targetL && player.position.distanceTo(targetL.center) < targetL.interactR) {
    interaction = { type: 'deliver', target: targetL };
    promptEl.innerHTML = `<span class="key">E</span>送信到 <b>${targetL.name}</b>`;
    actBtn.textContent = '送信';
  } else if (!quest.carrying && giverL && giverL.npc && player.position.distanceTo(giverL.npc.position) < 4.5) {
    interaction = { type: 'letter', target: giverL };
    promptEl.innerHTML = `<span class="key">E</span>接信 · 寄往 <b>${targetL.name}</b>`;
    actBtn.textContent = '接信';
  } else if (nearLandmark) {
    interaction = { type: 'card', target: nearLandmark };
    promptEl.innerHTML = `<span class="key">E</span>打卡 <b>${nearLandmark.name}${nearLandmark.visited ? '（回顾）' : ''}</b>`;
    actBtn.textContent = '打卡';
  }
  if (interaction) { promptEl.classList.add('show'); actBtn.classList.add('show'); }
  else { promptEl.classList.remove('show'); actBtn.classList.remove('show'); }
}
function doInteraction() {
  if (!interaction) return;
  if (interaction.type === 'card') { openCard(interaction.target); return; }
  if (interaction.type === 'letter') {
    quest.carrying = true;
    updateLetterChip();
    const meta = NPC_META[interaction.target.id];
    showToast(`<b>${meta ? meta[0] : '村民'}</b> 把信交给你。<br>跟着头顶的金色小箭头，把它送到收件人手里。`, 3800);
    chime();
    return;
  }
  if (interaction.type === 'deliver') {
    const letter = QUEST_LETTERS[quest.idx];
    const arrivedId = letter.to;
    quest.carrying = false;
    quest.idx++;
    updateLetterChip();
    chime();
    saveGame();
    if (quest.idx >= QUEST_LETTERS.length) {
      showToast(`<b>环线跑通！</b><br>${letter.text}<br><span style="color:#0EA096;font-weight:700">十三个目的地，一条环线——贵州不再分散。</span>`, 9000);
      for (let i = 0; i < 3; i++) setTimeout(() => spawnFirework(), i * 600);
    } else {
      showToast(letter.text, 4500);
      // 随后弹出该站 NPC 的拼车/服务告示（商业流程的叙事化身）
      const meta = NPC_META[arrivedId];
      if (meta) setTimeout(() => { if (!state.paused) showToast(meta[1], 6500); }, 4800);
    }
  }
}
function updateQuests() {
  const cur = quest.idx < QUEST_LETTERS.length ? QUEST_LETTERS[quest.idx] : null;
  for (const l of LANDMARKS) {
    l.env.visible = !!(cur && !quest.carrying && l.id === cur.from);
  }
}

/* ============================================================
   音频：BGM + 空间音效（瀑布/篝火随距离衰减）
   ============================================================ */
const AU = { ctx: null, master: null, gains: {}, muted: false };
async function initAudio() {
  if (AU.ctx) return;
  try {
    AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = AU.ctx.createGain();
    AU.master.gain.value = 0.9;
    AU.master.connect(AU.ctx.destination);
    if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {});
    const files = {
      bgm: ['audio/bgm.mp3', 0.38],
      ambient: ['audio/ambient.mp3', 0.22],
      waterfall: ['audio/waterfall.mp3', 0],
      bonfire: ['audio/bonfire.mp3', 0],
    };
    for (const [k, [url, vol]] of Object.entries(files)) {
      try {
        const ab = await AU.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        const src = AU.ctx.createBufferSource();
        src.buffer = ab; src.loop = true;
        const gn = AU.ctx.createGain();
        gn.gain.value = vol;
        src.connect(gn).connect(AU.master);
        src.start();
        AU.gains[k] = gn;
      } catch (e) {}
    }
  } catch (e) {}
}
function updateAudio() {
  if (!AU.ctx) return;
  const wf = LANDMARKS.find(l => l.id === 'huangguoshu');
  const bf = LANDMARKS.find(l => l.id === 'zhaoxing');
  if (AU.gains.waterfall) {
    const d = player.position.distanceTo(wf.center);
    AU.gains.waterfall.gain.value = Math.pow(THREE.MathUtils.clamp(1 - d / 32, 0, 1), 2);
  }
  if (AU.gains.bonfire) {
    const d = player.position.distanceTo(bf.center);
    AU.gains.bonfire.gain.value = Math.pow(THREE.MathUtils.clamp(1 - d / 20, 0, 1), 2) * 0.9;
  }
}
document.getElementById('snd-btn').addEventListener('click', () => {
  AU.muted = !AU.muted;
  if (AU.master) AU.master.gain.value = AU.muted ? 0 : 0.9;
  document.getElementById('snd-btn').textContent = AU.muted ? '静音' : '音效';
});

/* ============================================================
   世界随进度鲜活：光照增强 + 蝴蝶 + 烟花
   ============================================================ */
let fireworksOn = false;
const butterflies = new THREE.Group();
butterflies.visible = false;
{
  const cols = [0xe88ca0, 0xe8c454, 0xf2ede0, 0x8fc9d8];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Group();
    const m = mat(cols[i % 4], { side: THREE.DoubleSide });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), m);
    const w2 = w1.clone();
    w1.position.x = -0.08; w2.position.x = 0.08;
    b.add(w1, w2);
    const d = randomDirFarFromLandmarks(0.02) || new THREE.Vector3(0, 1, 0);
    b.userData = { d, ph: Math.random() * 9, w1, w2 };
    butterflies.add(b);
  }
  scene.add(butterflies);
  animated.push((dt, t) => {
    if (!butterflies.visible) return;
    for (const b of butterflies.children) {
      const { d, ph, w1, w2 } = b.userData;
      b.position.copy(groundPos(d, 1.1 + Math.sin(t * 1.6 + ph) * 0.35));
      b.position.x += Math.sin(t * 0.9 + ph) * 0.3;
      b.quaternion.setFromUnitVectors(UP, d);
      const flap = Math.sin(t * 14 + ph) * 0.7;
      w1.rotation.y = flap; w2.rotation.y = -flap;
    }
  });
}

const FW = { bursts: [], timer: 3 };
const FW_COLS = [0xff6b6b, 0xe8c454, 0x7fc98f, 0x5aa8ff, 0xe88ca0];
function spawnFirework(dirOpt) {
  const n = 26;
  const dir = dirOpt || new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 0.9 + 0.3, Math.random() * 2 - 1).normalize();
  const origin = dir.multiplyScalar(R + 15 + Math.random() * 5);
  const posArr = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i++) {
    posArr.set([origin.x, origin.y, origin.z], i * 3);
    vel.push(new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
      .multiplyScalar(2.5 + Math.random() * 3.5));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const m = new THREE.PointsMaterial({
    color: FW_COLS[Math.floor(Math.random() * FW_COLS.length)],
    size: 0.34, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(g, m);
  scene.add(pts);
  FW.bursts.push({ pts, vel, life: 0 });
}
function updateFireworks(dt) {
  if (fireworksOn && state.started && !state.paused) {
    FW.timer -= dt;
    if (FW.timer <= 0) { spawnFirework(); FW.timer = 2.5 + Math.random() * 2.5; }
  }
  for (let i = FW.bursts.length - 1; i >= 0; i--) {
    const b = FW.bursts[i];
    b.life += dt;
    const p = b.pts.geometry.attributes.position;
    for (let k = 0; k < b.vel.length; k++) {
      b.vel[k].multiplyScalar(1 - 0.9 * dt);
      p.setXYZ(k, p.getX(k) + b.vel[k].x * dt, p.getY(k) + b.vel[k].y * dt - 1.2 * b.life * dt, p.getZ(k) + b.vel[k].z * dt);
    }
    p.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, 1 - b.life / 1.5);
    if (b.life > 1.5) {
      scene.remove(b.pts);
      b.pts.geometry.dispose(); b.pts.material.dispose();
      FW.bursts.splice(i, 1);
    }
  }
}

const motesObj = scene.getObjectByName('motes');
function applyLiveliness() {
  const c = LANDMARKS.filter(l => l.visited).length;
  sun.intensity = 1.9 + c * 0.05;
  hemi.intensity = 1.25 + c * 0.03;
  if (motesObj) motesObj.material.opacity = 0.55 + c * 0.03;
  butterflies.visible = c >= 4;
  fireworksOn = c >= 8;
}

/* ============================================================
   本地存档
   ============================================================ */
const SAVE_KEY = 'qx-save-v1';
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      visited: LANDMARKS.filter(l => l.visited).map(l => l.id),
      quest: quest.idx,
    }));
  } catch (e) {}
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!s) return;
    for (const id of s.visited || []) {
      const l = LANDMARKS.find(x => x.id === id);
      if (l && !l.visited) {
        l.visited = true;
        l.visitOrder = ++visitSeq;
        l.marker.material = markerDoneM.clone();
        dotsEl.children[LANDMARKS.indexOf(l)].classList.add('done');
      }
    }
    quest.idx = Math.min(s.quest || 0, QUEST_LETTERS.length);
  } catch (e) {}
}
loadGame();
applyLiveliness();

/* 调试参数：放在所有系统定义之后 */
if (params.has('tp')) {
  const l = LANDMARKS[+params.get('tp') || 0];
  state.dir.copy(l.dir).add(dirFromLatLon(l.lat + 6, l.lon + 6).multiplyScalar(0.16)).normalize();
  const toL = l.dir.clone().sub(state.dir);
  toL.sub(state.dir.clone().multiplyScalar(toL.dot(state.dir)));
  if (toL.lengthSq() > 1e-6) state.heading.copy(toL.normalize());
}
if (params.get('auto') === '1') begin();
if (params.has('card')) openCard(LANDMARKS[+params.get('card') || 0]);
if (params.has('plan')) { LANDMARKS.slice(0, 6).forEach(l => { l.visited = true; l.visitOrder = ++visitSeq; applyLiveliness(); }); openPlan(); }

/* ============================================================
   主循环
   ============================================================ */
const clock = new THREE.Clock();
camera.position.copy(groundPos(state.dir, 4)).addScaledVector(state.heading, -9);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (state.started) updatePlayer(dt);
  for (const fn of animated) fn(dt, t);
  cloudGroup.rotation.y += dt * 0.008;
  if (motesObj) motesObj.rotation.y += dt * 0.01;

  // 飞鸟环绕
  for (const b of birds) {
    const { center, phase, radius, wingL, wingR } = b.userData;
    const a = t * 0.25 + phase;
    const up = center;
    const tang = tmpV1.set(1, 0, 0).cross(up).normalize();
    const tang2 = tmpV2.copy(up).cross(tang).normalize();
    b.position.copy(center).multiplyScalar(R + 12)
      .addScaledVector(tang, Math.cos(a) * radius)
      .addScaledVector(tang2, Math.sin(a) * radius);
    b.quaternion.setFromUnitVectors(UP, tmpV3.copy(b.position).normalize());
    const flap = Math.sin(t * 9 + phase) * 0.5;
    wingL.rotation.z = 0.3 + flap; wingR.rotation.z = -0.3 - flap;
  }

  nearLandmark = null;
  if (state.started && !state.paused) computeInteraction();
  else { promptEl.classList.remove('show'); actBtn.classList.remove('show'); }

  updateQuests();
  updateAudio();
  updateFireworks(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__game = { state, LANDMARKS, camera, player };
