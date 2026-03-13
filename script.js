const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const countsEl = document.getElementById('counts');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Fehler sichtbar machen, falls etwas im JS abstürzt
window.onerror = (message, source, line, col, err) => {
  console.error('JS Error:', message, 'at', source + ':' + line + ':' + col, err);
  if (ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'red';
    ctx.font = '20px monospace';
    ctx.fillText('JS Error: ' + message, 10, 30);
  }
};
window.onunhandledrejection = (evt) => {
  console.error('Unhandled promise rejection:', evt.reason);
  if (ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'red';
    ctx.font = '20px monospace';
    ctx.fillText('Unhandled rejection: ' + (evt.reason?.message || evt.reason), 10, 30);
  }
};
const GRAVITY = 1.6;
const GROUND_MARGIN = 10;
const GRASS_STRIP_HEIGHT = 58; // sichtbare Wiesen-Höhe
const RESTITUTION = 0.45; // bounce factor when hitting ground (0..1)
const FRAG_GRAVITY = 0.9;
const FRAG_DRAG = 0.97;

// clouds in the sky
const clouds = [];
const CLOUD_COUNT = 8;
let gameStarted = false; // ensure startGame only runs once
function initClouds() {
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT * 0.3,
      scale: 0.7 + Math.random() * 0.6,
      speed: 0.2 + Math.random() * 0.3
    });
  }
}
function updateClouds() {
  clouds.forEach(c => {
    c.x += c.speed;
    if (c.x - 120 > WIDTH) c.x = -120;
  });
}
function drawCloud(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.scale, c.scale);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(0,0,20,0,Math.PI*2);
  ctx.arc(25,-10,30,0,Math.PI*2);
  ctx.arc(60,0,25,0,Math.PI*2);
  ctx.arc(90,-5,20,0,Math.PI*2);
  ctx.arc(45,10,22,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// user/account state
let currentUser = null;
function loadUsers() {
  const u = localStorage.getItem('users');
  return u ? JSON.parse(u) : {};
}
function saveUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}
function saveCurrentUserState() {
  if (!currentUser) return;
  // update data from globals
  currentUser.coins = coins;
  currentUser.unlockedTypes = unlockedTypes;
  currentUser.carUnlocked = carUnlocked;
  currentUser.minigunUnlocked = minigunUnlocked;
  currentUser.unlockedBefMops = unlockedBefMops;
  const users = loadUsers();
  users[currentUser.username] = currentUser;
  saveUsers(users);
}
function applyUserState(user) {
  coins = user.coins || 0;
  unlockedTypes = user.unlockedTypes ? Object.assign({}, user.unlockedTypes) : { box: true };
  carUnlocked = user.carUnlocked || false;
  minigunUnlocked = user.minigunUnlocked || false;
  unlockedBefMops = user.unlockedBefMops || false;
  updateSpawnButtonLabels();
  updateWeaponButtons();
  updateSpecialWeaponButtons();
}

function updateWeaponButtons() {
  document.querySelectorAll('.weapon-btn').forEach(btn => {
    const w = parseInt(btn.dataset.weapon, 10);
    if (w === 0) btn.textContent = 'Bombe 1';
    else if (w === 1) btn.textContent = 'Bombe 2';
    else if (w === 2) {
      btn.textContent = minigunUnlocked ? 'Minigun' : 'Minigun (1000 Coins)';
      btn.classList.toggle('locked', !minigunUnlocked);
    }
    btn.classList.toggle('sel', currentBombVariant === w);
  });
}

function updateSpecialWeaponButtons() {
  const btn = document.getElementById('befMopsBtn');
  if (btn) {
    if (!unlockedBefMops) {
      btn.textContent = 'Bef Mops (20000 Coins)';
    } else {
      const now = Date.now();
      const remaining = Math.ceil((BEF_MOPS_COOLDOWN - (now - lastBefMopsTime)) / 1000);
      if (remaining > 0) {
        btn.textContent = `Bef Mops (Cooldown: ${remaining}s)`;
      } else {
        btn.textContent = 'Bef Mops';
      }
    }
    btn.classList.toggle('locked', !unlockedBefMops);
  }
}

// ------ authentication UI ------
function showAuthOverlay(){
  const o = document.getElementById('authOverlay');
  if(o) o.style.display = 'flex';
  const msg = document.getElementById('authMsg'); if(msg) msg.textContent = '';
  // reset forms to login view and clear inputs
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if(loginForm) loginForm.style.display = 'block';
  if(registerForm) registerForm.style.display = 'none';
  const inputs = o ? o.querySelectorAll('input') : [];
  inputs.forEach(i=>i.value='');
}
function hideAuthOverlay(){
  const o = document.getElementById('authOverlay'); if(o) o.style.display = 'none';
}
function initAuth(){
  // always show login/register overlay at start
  showAuthOverlay();
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authMsg = document.getElementById('authMsg');
  document.getElementById('showRegister').addEventListener('click', e=>{
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authMsg.textContent = '';
  });
  document.getElementById('showLogin').addEventListener('click', e=>{
    e.preventDefault();
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    authMsg.textContent = '';
  });
  document.getElementById('loginBtn').addEventListener('click', ()=>{
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value;
    if(!u || !p){ authMsg.textContent = 'Bitte ausfüllen'; return; }
    const users = loadUsers();
    if(users[u] && users[u].password === p){
      currentUser = users[u];
      currentUser.username = u;
      authMsg.textContent = '';
      hideAuthOverlay();
      applyUserState(currentUser);
      updateSpecialWeaponButtons();
      // logout button always visible; enabling below will handle state
      saveCurrentUserState(); // ensure any initial state is persisted
    } else {
      authMsg.textContent = 'Benutzername oder Passwort falsch';
    }
  });
  document.getElementById('registerBtn').addEventListener('click', ()=>{
    const u = document.getElementById('regUsername').value.trim();
    const p = document.getElementById('regPassword').value;
    if(!u || !p){ authMsg.textContent = 'Bitte ausfüllen'; return; }
    const users = loadUsers();
    if(users[u]){ authMsg.textContent = 'Nutzer existiert bereits'; return; }
    users[u] = { password: p, coins:0, unlockedTypes:{box:true}, carUnlocked:false, minigunUnlocked:false, unlockedBefMops:false };
    saveUsers(users);
    // automatically log in newly registered user
    currentUser = users[u];
    currentUser.username = u;
    authMsg.textContent = '';
    hideAuthOverlay();
    applyUserState(currentUser);
    updateSpecialWeaponButtons();
  });
  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    if (currentUser) saveCurrentUserState();
    currentUser = null;
    coins = 0;
    unlockedTypes = { box: true, barrel: false, tree: false, book: false };
    carUnlocked = false;
    minigunUnlocked = false;
    unlockedBefMops = false;
    updateSpawnButtonLabels();
    updateWeaponButtons();
    updateSpecialWeaponButtons();
    // show login dialog again
    showAuthOverlay();
  });
}

let mouse = { x: 0, y: 0, down: false };
let placingMode = false;

// load car image (place the attached image as 'car.png' next to index.html)
const carImg = new Image();
let carImgLoaded = false;
let carTexture = null;
// carImg.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
carImg.src = 'car.png';
carImg.onload = () => {
  try {
    const off = document.createElement('canvas');
    off.width = carImg.width;
    off.height = carImg.height;
    const octx = off.getContext('2d');
    octx.drawImage(carImg, 0, 0);
    // remove near-white background (make transparent)
    try {
      const imgd = octx.getImageData(0, 0, off.width, off.height);
      const data = imgd.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 0 && r > 240 && g > 240 && b > 240) {
          data[i + 3] = 0;
        }
      }
      octx.putImageData(imgd, 0, 0);
    } catch (err) {
      // getImageData can fail if CORS/protection prevents it; just continue with original image
      console.warn('Could not process car image for background removal:', err);
    }
    carTexture = new Image();
    carTexture.onload = () => { carImgLoaded = true };
    carTexture.src = off.toDataURL();
  } catch (e) {
    console.warn('Error processing car image', e);
    carTexture = carImg;
    carImgLoaded = true;
  }
};

// load bomb images (optional)
const bombImg = new Image();
let bombImgLoaded = false;
let bombTexture = null;
// bombImg.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
bombImg.src = 'bomb.png';
bombImg.onload = () => {
  try {
    const off = document.createElement('canvas');
    off.width = bombImg.width;
    off.height = bombImg.height;
    const octx = off.getContext('2d');
    octx.drawImage(bombImg, 0, 0);
    try {
      const imgd = octx.getImageData(0, 0, off.width, off.height);
      const data = imgd.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 0 && r > 240 && g > 240 && b > 240) data[i + 3] = 0;
      }
      octx.putImageData(imgd, 0, 0);
    } catch (err) { console.warn('Could not process bomb image for background removal:', err); }
    bombTexture = new Image();
    bombTexture.onload = () => { bombImgLoaded = true; if (!currentBombTexture) setCurrentBombTexture(0); };
    bombTexture.src = off.toDataURL();
  } catch (e) {
    console.warn('Error processing bomb image', e);
    bombTexture = bombImg;
    bombImgLoaded = true;
    if (!currentBombTexture) setCurrentBombTexture(0);
  }
};

const bombImg2 = new Image();
let bomb2ImgLoaded = false;
let bombTexture2 = null;
// bombImg2.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
bombImg2.src = 'bomb2.png';
bombImg2.onload = () => {
  try {
    const off = document.createElement('canvas');
    off.width = bombImg2.width;
    off.height = bombImg2.height;
    const octx = off.getContext('2d');
    octx.drawImage(bombImg2, 0, 0);
    try {
      const imgd = octx.getImageData(0, 0, off.width, off.height);
      const data = imgd.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 0 && r > 240 && g > 240 && b > 240) data[i + 3] = 0;
      }
      octx.putImageData(imgd, 0, 0);
    } catch (err) { /* ignore */ }
    bombTexture2 = new Image();
    bombTexture2.onload = () => { bomb2ImgLoaded = true; };
    bombTexture2.src = off.toDataURL();
  } catch (e) {
    bombTexture2 = bombImg2;
    bomb2ImgLoaded = true;
  }
};
bombImg2.onerror = () => { /* bomb2.png optional */ };

// Minigun-Textur (Waffe in der Mitte)
const minigunImg = new Image();
let minigunTexture = null;
let minigunLoaded = false;
// minigunImg.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
minigunImg.src = 'Minigun.png';
minigunImg.onload = () => {
  minigunTexture = minigunImg;
  minigunLoaded = true;
};
minigunImg.onerror = () => { /* optional */ };

// Bef Mops Textur
const befMopsImg = new Image();
let befMopsTexture = null;
let befMopsLoaded = false;
// befMopsImg.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
befMopsImg.src = 'befmops.png';
befMopsImg.onload = () => {
  befMopsTexture = befMopsImg;
  befMopsLoaded = true;
};
befMopsImg.onerror = () => { /* optional */ };

// Bef Mops variables
let unlockedBefMops = false;
const BEF_MOPS_COST = 20000;
let befMopsList = [];
let lastBefMopsTime = 0;
const BEF_MOPS_COOLDOWN = 20000; // 20 seconds in ms

// 0 = Bombe 1, 1 = Bombe 2, 2 = Minigun (kostet 1000 Coins zum Freischalten)
let currentBombVariant = 0;
let minigunUnlocked = false;
const MINIGUN_COST = 1000;
let currentBombTexture = null;
let currentBombLoaded = false;
function setCurrentBombTexture(variant) {
  currentBombVariant = variant;
  if (variant === 2) return; // Minigun: keine Bomben-Textur
  if (variant === 1 && bomb2ImgLoaded && bombTexture2) {
    currentBombTexture = bombTexture2;
    currentBombLoaded = true;
  } else if (bombImgLoaded && bombTexture) {
    currentBombTexture = bombTexture;
    currentBombLoaded = bombImgLoaded;
  } else {
    currentBombTexture = variant === 1 ? (bombTexture2 || null) : (bombTexture || null);
    currentBombLoaded = variant === 1 ? bomb2ImgLoaded : bombImgLoaded;
  }
}

// load prop textures (box, barrel, tree) if present
const propTextures = {};
const propTextureLoaded = {};
function loadPropTexture(name, filename){
  const img = new Image();
  // img.crossOrigin = 'anonymous'; // entfernt für lokale Dateien
  img.src = filename;
  img.onload = () => {
    console.log('Loaded texture for', name);
    try{
      const off = document.createElement('canvas');
      off.width = img.width; off.height = img.height;
      const octx = off.getContext('2d');
      octx.drawImage(img,0,0);
      try{
        const imgd = octx.getImageData(0,0,off.width, off.height);
        const data = imgd.data;
        for(let i=0;i<data.length;i+=4){ const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3]; if(a>0 && r>240 && g>240 && b>240) data[i+3]=0; }
        octx.putImageData(imgd,0,0);
      }catch(e){ console.warn('Could not process image for', name, e); }
      const tex = new Image(); tex.onload = ()=>{ propTextures[name]=tex; propTextureLoaded[name]=true; console.log('Processed texture for', name); }; tex.src = off.toDataURL();
    }catch(e){ console.warn('Error loading prop texture', name, e); propTextures[name]=img; propTextureLoaded[name]=true; console.log('Fallback texture for', name); }
  };
  img.onerror = ()=>{ console.warn('Failed to load texture', name, filename); /* missing file ok */ };
}

loadPropTexture('box','box.png');
loadPropTexture('barrel','barrel.png');
loadPropTexture('tree','tree.png');
loadPropTexture('book','buch.png');

class Car {
  constructor(x, y) {
    // make car wider (stretched horizontally)
    this.w = 320; this.h = 120;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.color = `rgb(${rand(50,255)},${rand(50,255)},${rand(50,255)})`;
    // give a small initial downward velocity so fall is immediately visible
    this.vy = 2;
    this.type = 'car';
  }
  draw(ctx){
    if (carImgLoaded && carTexture) {
      ctx.drawImage(carTexture, this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = this.color;
      roundRect(ctx, this.x, this.y, this.w, this.h, 6, true, false);
      ctx.fillStyle = '#1e1e1e';
      circle(ctx, this.x+18, this.y+this.h-8, 10, true);
      circle(ctx, this.x+this.w-18, this.y+this.h-8, 10, true);
    }
  }
  contains(px,py){ return px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h }
  centerX(){ return this.x + this.w/2 }
  centerY(){ return this.y + this.h/2 }
  update(allObjects){
    this.vy += GRAVITY;
    this.y += this.vy;
    // Landefläche: Boden oder höchstes Objekt UNTER uns, auf dem wir horizontal aufliegen
    let surfaceY = HEIGHT - GROUND_MARGIN;
    if (allObjects) {
      for (const other of allObjects) {
        if (other === this) continue;
        const overlapX = this.x < other.x + other.w && this.x + this.w > other.x;
        const otherIsBelowUs = other.y >= this.y; // anderes Objekt liegt unter uns (nicht darüber)
        const hitFromAbove = this.y + this.h >= other.y - 2 && this.vy >= 0;
        if (overlapX && otherIsBelowUs && hitFromAbove && other.y < surfaceY) surfaceY = other.y;
      }
    }
    if (this.y + this.h > surfaceY) {
      this.y = surfaceY - this.h;
      if (Math.abs(this.vy) > 1.5) this.vy = -this.vy * RESTITUTION;
      else this.vy = 0;
    }
  }
}

class Bomb{
  constructor(x){ this.x = x; this.y = -30; this.vy = 0; this.r = 22; }
  update(){ this.vy += 1.2; this.y += this.vy }
  draw(ctx){
    if (currentBombLoaded && currentBombTexture) {
      const w = this.r * 4;
      const h = this.r * 4;
      ctx.drawImage(currentBombTexture, this.x - w/2, this.y - h/2, w, h);
    } else {
      ctx.fillStyle='#c62828';
      circle(ctx, this.x, this.y, this.r, true);
      ctx.fillStyle='#222';
      circle(ctx,this.x,this.y, this.r-6,true);
    }
  }
  offscreen(){ return this.y - this.r > HEIGHT+100 }
}

class Explosion{
  constructor(x,y){
    this.x = x; this.y = y;
    this.life = 40;
    this.age = 0;
    this.particles = [];
    for (let i = 0; i < 26; i++){
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        life: Math.random() * 24 + 12,
        size: Math.random() * 3 + 2,
        color: `hsl(${Math.floor(Math.random()*50+30)},100%,50%)`
      });
    }
  }
  update(){
    this.age++;
    this.life--;
    const g = 0.35;
    for (let p of this.particles){
      p.vy += g;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }
  draw(ctx){
    // flash
    const t = (40 - this.life) / 40;
    const radius = 12 + 140 * t;
    const alpha = Math.max(0, 0.9 * (1 - t));
    ctx.beginPath(); ctx.fillStyle = `rgba(255,200,60,${alpha})`; ctx.arc(this.x,this.y,radius,0,Math.PI*2); ctx.fill();
    // particles
    for (let p of this.particles){
      const fade = Math.max(0, p.life / 40);
      ctx.beginPath(); ctx.fillStyle = `rgba(255,${120+Math.floor(Math.random()*80)},0,${fade})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    }
  }
  done(){ return this.life <= 0 && this.particles.length === 0 }
}

class BefMops {
  constructor() {
    // ~1/4 des Spielfelds breit und etwas flacher
    this.w = WIDTH * 0.25;
    this.h = 80;
    this.x = -this.w;
    this.y = HEIGHT - GROUND_MARGIN - this.h;
    this.speed = 6;
    this.blastDone = false;
  }
  update() {
    this.x += this.speed;

    // once the Bef Mops has entered the visible area, destroy all spawned objects
    if (!this.blastDone && this.x > -50) {
      this.blastDone = true;

      // destroy every object currently on the field
      for (let i = cars.length - 1; i >= 0; i--) {
        const c = cars[i];
        const cx = c.centerX(), cy = c.centerY();
        const amount = coinsPerKill[c.type] ?? 10;
        explosions.push(new Explosion(cx, cy));
        createFragmentsFromObject(c);
        coins += amount;
        coinPopups.push({ x: cx, y: cy, life: 90, amount });
      }
      cars.length = 0;

      // also clear bombs and minigun bullets so it truly clears the field
      bombs.length = 0;
      minigunBullets.length = 0;

      saveCurrentUserState();
    }

    if (this.x > WIDTH + 200) {
      befMopsList.splice(befMopsList.indexOf(this), 1);
    }
  }
  draw(ctx) {
    if (befMopsLoaded && befMopsTexture) {
      ctx.drawImage(befMopsTexture, this.x, this.y, this.w, this.h);
    } else {
      // Platzhalter: Grünes Rechteck mit Text
      ctx.fillStyle = 'green';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = 'darkgreen';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      // Text hinzufügen
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BEF MOPS', this.x + this.w / 2, this.y + this.h / 2);
    }
  }
}

const cars = [];
const bombs = [];
const explosions = [];
const fragments = [];
const coinPopups = []; // "+10 Coins" Float-Text bei Zerstörung
const minigunBullets = []; // schwarze Punkte der Minigun
const MINIGUN_X = 0.5; // Anteil an WIDTH (wird in draw/update mit WIDTH multipliziert)
const MINIGUN_Y = 0.5; // Anteil an HEIGHT
const BULLET_SPEED = 18;
const BULLET_RADIUS = 2;
const MINIGUN_BULLET_COUNT = 70;

// spawnable types and selection
let selectedType = 'box'; // Kiste ist gratis und zuerst in der Liste
let coins = 0;
const coinsPerKill = { car: 50, box: 10, barrel: 30, tree: 40, book: 20 }; // Coins pro zerstörtem Objekt
let carUnlocked = false;
let unlockedTypes = { box: true, barrel: false, tree: false, book: false }; // Kiste gratis
const unlockCosts = { box: 0, book: 50, barrel: 100, tree: 150, car: 500 }; // Coins zum Freischalten
const spawnTypes = {
  car: { label: 'Auto', w: 320, h: 120, color: null },
  box: { label: 'Kiste', w: 120, h: 90, color: '#8B5A2B' },
  barrel: { label: 'Fass', w: 110, h: 130, color: '#6B3E26' },
  tree: { label: 'Baum', w: 140, h: 180, color: '#2E8B57' },
  book: { label: 'Buch', w: 70, h: 95, color: '#8B4513' }
};

function rand(a,b){ return Math.floor(Math.random()*(b-a+1))+a }
function circle(ctx,x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if(fill) ctx.fill(); else ctx.stroke(); }
function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); if(fill) ctx.fill(); if(stroke) ctx.stroke(); }

class CarFragment {
  constructor(obj, sxRel, syRel, swRel, shRel) {
    // render size relative to object
    this.w = Math.max(6, Math.round(swRel * obj.w));
    this.h = Math.max(6, Math.round(shRel * obj.h));
    this.x = obj.x + Math.round(sxRel * obj.w);
    this.y = obj.y + Math.round(syRel * obj.h);
    // slower initial velocities
    this.vx = (Math.random() - 0.5) * 6 + (this.x < obj.centerX() ? -1 : 1);
    this.vy = - (Math.random() * 3 + 2);
    this.angle = Math.random() * Math.PI * 2;
    this.angVel = (Math.random() - 0.5) * 0.25;
    this.life = 160; // frames after landing
    this.landed = false;
    this.type = obj.type || 'prop';

    // per-type appearance
    this.isLeaf = false;
    this.fragTexture = null; // texture for prop fragments (tree, box, barrel)
    if (this.type === 'tree') {
      const greens = [ '#4CAF50', '#3CB371', '#2E8B57', '#66CDAA' ];
      this.color = greens[rand(0, greens.length-1)];
      this.vx *= 0.6; this.vy *= 0.6;
      if (propTextureLoaded['tree'] && propTextures['tree']) {
        const tex = propTextures['tree'];
        this.fragTexture = tex;
        this.src = {
          sx: Math.max(0, Math.round(sxRel * tex.width)),
          sy: Math.max(0, Math.round(syRel * tex.height)),
          sw: Math.max(2, Math.round(swRel * tex.width)),
          sh: Math.max(2, Math.round(shRel * tex.height))
        };
      } else {
        this.isLeaf = true;
        this.w = Math.max(4, Math.round(this.w * 0.5));
        this.h = Math.max(4, Math.round(this.h * 0.5));
      }
    } else if (this.type === 'box') {
      this.color = obj.color || '#8B5A2B';
      if (propTextureLoaded['box'] && propTextures['box']) {
        const tex = propTextures['box'];
        this.fragTexture = tex;
        this.src = {
          sx: Math.max(0, Math.round(sxRel * tex.width)),
          sy: Math.max(0, Math.round(syRel * tex.height)),
          sw: Math.max(2, Math.round(swRel * tex.width)),
          sh: Math.max(2, Math.round(shRel * tex.height))
        };
      }
    } else if (this.type === 'barrel') {
      this.color = obj.color || '#6B3E26';
      if (propTextureLoaded['barrel'] && propTextures['barrel']) {
        const tex = propTextures['barrel'];
        this.fragTexture = tex;
        this.src = {
          sx: Math.max(0, Math.round(sxRel * tex.width)),
          sy: Math.max(0, Math.round(syRel * tex.height)),
          sw: Math.max(2, Math.round(swRel * tex.width)),
          sh: Math.max(2, Math.round(shRel * tex.height))
        };
      }
    } else if (this.type === 'book') {
      // Einzelseiten: flach, weiß, segeln zum Boden
      this.isPage = true;
      this.w = 32 + rand(0, 22);
      this.h = 4 + rand(0, 4);
      this.x = obj.x + rand(0, Math.max(0, obj.w - this.w));
      this.y = obj.y + rand(0, Math.max(0, obj.h - this.h));
      this.color = ['#fffef7', '#fffffe', '#fafaf5', '#fffef9'][rand(0, 3)];
      this.vx = (Math.random() - 0.5) * 14 + (this.x < obj.centerX() ? -3 : 3);
      this.vy = -(Math.random() * 4 + 1);
      this.gravityMult = 0.35;
      this.angVel = (Math.random() - 0.5) * 0.4;
    } else if (this.type === 'car') {
      this.color = obj.color || `rgb(${rand(50,255)},${rand(50,255)},${rand(50,255)})`;
    } else {
      this.color = obj.color || `rgb(${rand(40,200)},${rand(40,200)},${rand(40,200)})`;
    }

    // prepare source cropping for car texture (if no fragTexture set above)
    if (!this.src && this.type === 'car' && carTexture && carImgLoaded) {
      const imgW = carTexture.width;
      const imgH = carTexture.height;
      this.src = {
        sx: Math.max(0, Math.round(sxRel * imgW)),
        sy: Math.max(0, Math.round(syRel * imgH)),
        sw: Math.max(2, Math.round(swRel * imgW)),
        sh: Math.max(2, Math.round(shRel * imgH))
      };
    }
  }
  update(){
    if (!this.landed) {
      this.vy += FRAG_GRAVITY * (this.gravityMult !== undefined ? this.gravityMult : 1);
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.angVel;
      // apply slight air drag
      this.vx *= FRAG_DRAG;
      this.angVel *= 0.995;
      if (this.y + this.h > HEIGHT - GROUND_MARGIN) {
        this.y = HEIGHT - GROUND_MARGIN - this.h;
        this.vy = 0;
        this.vx *= 0.25;
        this.angVel *= 0.2;
        this.landed = true;
      }
    } else {
      this.life--;
      // slow slide on ground
      this.vx *= 0.92;
      this.x += this.vx;
    }
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x + this.w/2, this.y + this.h/2);
    ctx.rotate(this.angle);
    if (this.isPage) {
      // Weiße Buchseiten: flaches Rechteck, leichter Rand
      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.8;
      roundRect(ctx, -this.w/2, -this.h/2, this.w, this.h, 1, true, true);
    } else if (this.fragTexture && this.src) {
      // Baum-, Kisten- oder Fass-Teile mit Originaltextur
      try {
        ctx.drawImage(this.fragTexture, this.src.sx, this.src.sy, this.src.sw, this.src.sh, -this.w/2, -this.h/2, this.w, this.h);
      } catch (e) {
        ctx.fillStyle = this.color; ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
      }
    } else if (this.isLeaf) {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(2, this.w/2), Math.max(1.5, this.h/2), 0, 0, Math.PI*2);
      ctx.fill();
    } else if (this.src && carImgLoaded) {
      try {
        ctx.drawImage(carTexture, this.src.sx, this.src.sy, this.src.sw, this.src.sh, -this.w/2, -this.h/2, this.w, this.h);
      } catch (e) {
        ctx.fillStyle = this.color; ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
      }
    } else {
      ctx.fillStyle = this.color; ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
    }
    ctx.restore();
  }
  done(){ return this.life <= 0 }
}

function spawnSelectedAtMouse(){
  // only allow spawning when logged in
  if (!currentUser) return;
  const t = selectedType;
  const def = spawnTypes[t];
  if (!def) return;
  if (t === 'car') {
    if (!carUnlocked) {
      const cost = unlockCosts.car || 500;
      if (coins < cost) return;
      coins -= cost;
      carUnlocked = true;
      updateSpawnButtonLabels();
      saveCurrentUserState();
    }
    const c = new Car(mouse.x, mouse.y); c.type = 'car'; cars.push(c);
    return;
  }
  // Gegenstände: Freischalt-Kosten je Typ (Buch 50, Fass 100, Baum 150)
  const cost = unlockCosts[t] ?? 10;
  if (!unlockedTypes[t]) {
    if (coins < cost) return;
    coins -= cost;
    unlockedTypes[t] = true;
    updateSpawnButtonLabels();
    saveCurrentUserState();
  }
  cars.push(new Prop(mouse.x, mouse.y, def.w, def.h, def.color, t));
}

function updateSpawnButtonLabels(){
  document.querySelectorAll('.options button[data-type]').forEach(btn => {
    const type = btn.dataset.type;
    const def = spawnTypes[type];
    if (!def) return;
    if (type === 'car') {
      const cost = unlockCosts.car || 500;
      btn.textContent = carUnlocked ? def.label : def.label + ' (' + cost + ' Coins)';
      btn.classList.toggle('locked', !carUnlocked);
      return;
    }
    const cost = unlockCosts[type] ?? 10;
    if (unlockedTypes[type]) {
      btn.textContent = def.label;
      btn.classList.remove('locked');
    } else {
      btn.textContent = def.label + ' (' + cost + ' Coins)';
      btn.classList.add('locked');
    }
  });
}

class Prop {
  constructor(x,y,w,h,color,type){
    this.w = w; this.h = h; this.x = x - this.w/2; this.y = y - this.h/2; this.color = color || `rgb(${rand(40,200)},${rand(40,200)},${rand(40,200)})`;
    this.vy = 2; this.vx = 0;
    this.type = type || 'prop';
  }
  draw(ctx){
    if (this.type === 'barrel' && propTextureLoaded['barrel'] && propTextures['barrel']) {
      ctx.drawImage(propTextures['barrel'], this.x, this.y, this.w, this.h);
    } else if (this.type === 'tree' && propTextureLoaded['tree'] && propTextures['tree']) {
      ctx.drawImage(propTextures['tree'], this.x, this.y, this.w, this.h);
    } else if (this.type === 'box' && propTextureLoaded['box'] && propTextures['box']) {
      ctx.drawImage(propTextures['box'], this.x, this.y, this.w, this.h);
    } else if (this.type === 'book' && propTextureLoaded['book'] && propTextures['book']) {
      ctx.drawImage(propTextures['book'], this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = this.color;
      roundRect(ctx, this.x, this.y, this.w, this.h, 6, true, false);
    }
  }
  contains(px,py){ return px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h }
  centerX(){ return this.x + this.w/2 }
  centerY(){ return this.y + this.h/2 }
  update(allObjects){
    this.vy += GRAVITY; this.y += this.vy;
    let surfaceY = HEIGHT - GROUND_MARGIN;
    if (allObjects) {
      for (const other of allObjects) {
        if (other === this) continue;
        const overlapX = this.x < other.x + other.w && this.x + this.w > other.x;
        const otherIsBelowUs = other.y >= this.y;
        const hitFromAbove = this.y + this.h >= other.y - 2 && this.vy >= 0;
        if (overlapX && otherIsBelowUs && hitFromAbove && other.y < surfaceY) surfaceY = other.y;
      }
    }
    if (this.y + this.h > surfaceY) {
      this.y = surfaceY - this.h;
      if (Math.abs(this.vy) > 1.5) this.vy = -this.vy * RESTITUTION;
      else this.vy = 0;
    }
  }
}

function gameLoop(){
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function createFragmentsFromObject(obj){
  if (obj.type === 'book') {
    // Viele einzelne weiße Seiten segeln lassen
    const numPages = 10 + rand(0, 6);
    for (let i = 0; i < numPages; i++) {
      fragments.push(new CarFragment(obj, 0, i / numPages, 1, 1 / numPages));
    }
    return;
  }
  // split into grid pieces (cols x rows) scaled to object size
  const cols = Math.min(5, Math.max(2, Math.round(obj.w / 80)));
  const rows = Math.min(3, Math.max(1, Math.round(obj.h / 80)));
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const sxRel = c/cols;
      const syRel = r/rows;
      const swRel = 1/cols;
      const shRel = 1/rows;
      fragments.push(new CarFragment(obj, sxRel, syRel, swRel, shRel));
    }
  }
}

function destroyRandomObjectWithSelectedWeapon() {
  if (cars.length === 0) return;
  const i = rand(0, cars.length - 1);
  const obj = cars[i];
  const cx = obj.centerX();
  const cy = obj.centerY();
  const amount = coinsPerKill[obj.type] ?? 10;

  explosions.push(new Explosion(cx, cy));
  createFragmentsFromObject(obj);
  coins += amount;
  coinPopups.push({ x: cx, y: cy, life: 90, amount });
  cars.splice(i, 1);

  // If the selected weapon is the minigun, show a short bullet spray for effect.
  if (currentBombVariant === 2) {
    spawnMinigunBullets(cx, cy);
  }

  saveCurrentUserState();
}

function update(){
  console.log('Updating frame');
  // sky elements
  updateClouds();
  // update cars (gravity + Stapeln auf anderen Objekten)
  cars.forEach(c=>c.update(cars));
  // bombs
  bombs.forEach(b=>b.update());
  // bombs hitting ground -> explode
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (b.y + b.r >= HEIGHT - GROUND_MARGIN) {
      explosions.push(new Explosion(b.x, Math.min(b.y, HEIGHT - GROUND_MARGIN)));
      bombs.splice(i, 1);
    }
  }
  // collisions: bomb with car
  for(let i=bombs.length-1;i>=0;i--){
    const b = bombs[i];
    for(let j=cars.length-1;j>=0;j--){
      const c = cars[j];
      if(b.x > c.x && b.x < c.x + c.w && b.y + b.r > c.y && b.y - b.r < c.y + c.h){
        const cx = c.centerX(), cy = c.centerY();
        const amount = coinsPerKill[c.type] ?? 10;
        explosions.push(new Explosion(cx, cy));
        createFragmentsFromObject(c);
        coins += amount;
        saveCurrentUserState();
        coinPopups.push({ x: cx, y: cy, life: 90, amount });
        cars.splice(j,1);
        bombs.splice(i,1);
        break;
      }
    }
  }
  // update fragments
  for (let i = fragments.length - 1; i >= 0; i--) {
    fragments[i].update();
    if (fragments[i].done()) fragments.splice(i,1);
  }

  // Minigun-Kugeln: bewegen, Kollision mit Objekten
  if (currentBombVariant === 2) {
    for (let bi = minigunBullets.length - 1; bi >= 0; bi--) {
      const b = minigunBullets[bi];
      b.x += b.vx;
      b.y += b.vy;
      let hit = false;
      for (let j = cars.length - 1; j >= 0 && !hit; j--) {
        if (cars[j].contains(b.x, b.y)) {
          const c = cars[j];
          const cx = c.centerX(), cy = c.centerY();
          const amount = coinsPerKill[c.type] ?? 10;
          explosions.push(new Explosion(cx, cy));
          createFragmentsFromObject(c);
          coins += amount;
          saveCurrentUserState();
          coinPopups.push({ x: cx, y: cy, life: 90, amount });
          cars.splice(j, 1);
          hit = true;
        }
      }
      if (hit || b.x < -20 || b.x > WIDTH + 20 || b.y < -20 || b.y > HEIGHT + 20) {
        minigunBullets.splice(bi, 1);
      }
    }
  }

  // cleanup
  for(let i=bombs.length-1;i>=0;i--) if(bombs[i].offscreen()) bombs.splice(i,1);
  explosions.forEach(e=>e.update());
  befMopsList.forEach(b => b.update());
  for(let i=explosions.length-1;i>=0;i--) if(explosions[i].done()) explosions.splice(i,1);
  // Coin-Popups: nach oben schweben, life runterzählen
  for (let i = coinPopups.length - 1; i >= 0; i--) {
    coinPopups[i].y -= 1.2;
    coinPopups[i].life--;
    if (coinPopups[i].life <= 0) coinPopups.splice(i, 1);
  }
  // update HUD
  let hudText = '';
  if (currentUser && currentUser.username) hudText += `User: ${currentUser.username}   `;
  hudText += `Objekte: ${cars.length}   Bomben: ${bombs.length}   Explosionen: ${explosions.length}   Teile: ${fragments.length}`;
  countsEl.textContent = hudText;
  // keep logout button visible; disable when not logged in
  const lb = document.getElementById('logoutBtn');
  if (lb) {
    lb.style.display = 'block';
    lb.disabled = !currentUser;
  }
  updateSpecialWeaponButtons();
}

function draw(){
  console.log('Drawing frame');
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  // Himmel: hellblau
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(0, 0, WIDTH, HEIGHT - GROUND_MARGIN);
  // clouds
  clouds.forEach(c=>drawCloud(ctx,c));
  // Wiese: grüne Basis
  const grassY = HEIGHT - GRASS_STRIP_HEIGHT;
  ctx.fillStyle = '#4a7c23';
  ctx.fillRect(0, grassY, WIDTH, GRASS_STRIP_HEIGHT);
  // Gras-Halme (deterministisch, damit kein Flackern)
  const greens = ['#3d6b1e', '#5a9a2e', '#6bab3a', '#528b2a', '#4a7c23'];
  for (let x = 0; x < WIDTH + 8; x += 3) {
    const h = 8 + (x * 17 % 38);
    const tipX = (x * 13 % 9) - 4;
    const g = greens[(x * 11 % greens.length)];
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + tipX, grassY + GRASS_STRIP_HEIGHT - h);
    ctx.stroke();
  }
  // schmaler dunkler Streifen am unteren Rand (Bodenlinie)
  ctx.fillStyle = '#2d5016';
  ctx.fillRect(0, HEIGHT - GROUND_MARGIN, WIDTH, GROUND_MARGIN);
  cars.forEach(c=>c.draw(ctx));
  befMopsList.forEach(b => b.draw(ctx));
  bombs.forEach(b=>b.draw(ctx));
  fragments.forEach(f=>f.draw(ctx));
  explosions.forEach(e=>e.draw(ctx));
  // Minigun in der Mitte + Kugeln (wenn Minigun-Modus)
  if (currentBombVariant === 2) {
    const mgX = WIDTH * MINIGUN_X;
    const mgY = HEIGHT * MINIGUN_Y;
    const angle = Math.atan2(mouse.y - mgY, mouse.x - mgX);
    ctx.save();
    ctx.translate(mgX, mgY);
    ctx.rotate(angle);
    if (minigunLoaded && minigunTexture) {
      const mw = 140, mh = 80;
      ctx.drawImage(minigunTexture, -mw/2, -mh/2, mw, mh);
    } else {
      ctx.fillStyle = '#333';
      roundRect(ctx, -40, -15, 80, 30, 4, true, false);
    }
    ctx.restore();
    ctx.fillStyle = '#000';
    minigunBullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // "+10 Coins" Float-Texte (golden)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  coinPopups.forEach(p => {
    const alpha = Math.min(1, p.life / 45);
    const text = '+' + (p.amount ?? 10) + ' Coins';
    ctx.fillStyle = `rgba(218,165,32,${alpha})`;
    ctx.strokeStyle = `rgba(139,90,43,${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.font = 'bold 26px Arial';
    ctx.strokeText(text, p.x, p.y);
    ctx.fillText(text, p.x, p.y);
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Münzen-Anzeige oben rechts
  const coinX = WIDTH - 14;
  const coinY = 28;
  const coinR = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, coinX - 88, 8, 92, 44, 8, true, false);
  ctx.strokeStyle = 'rgba(255,200,80,0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, coinX - 88, 8, 92, 44, 8, false, true);
  ctx.fillStyle = '#e8c547';
  ctx.beginPath();
  ctx.arc(coinX - 68, coinY, coinR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8962e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(coins, coinX - 8, coinY + 7);
}

// Minigun: Kugeln von der Mitte zum Ziel spawnen
function spawnMinigunBullets(targetX, targetY) {
  const cx = WIDTH * MINIGUN_X;
  const cy = HEIGHT * MINIGUN_Y;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  for (let i = 0; i < MINIGUN_BULLET_COUNT; i++) {
    const spread = 0.08;
    const ax = ux + (Math.random() - 0.5) * spread;
    const ay = uy + (Math.random() - 0.5) * spread;
    const len = Math.hypot(ax, ay) || 1;
    minigunBullets.push({
      x: cx,
      y: cy,
      vx: (ax / len) * BULLET_SPEED,
      vy: (ay / len) * BULLET_SPEED
    });
  }
}

// input
canvas.addEventListener('mousemove', e=>{ const rect=canvas.getBoundingClientRect(); mouse.x = e.clientX-rect.left; mouse.y = e.clientY-rect.top });
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  if (placingMode) {
    mouse.x = clickX;
    mouse.y = clickY;
    spawnSelectedAtMouse();
    placingMode = false;
    return;
  }
  if (currentBombVariant === 2) {
    // Minigun: Objekt unter Klick anvisieren und beschießen
    for (let i = cars.length - 1; i >= 0; i--) {
      if (cars[i].contains(clickX, clickY)) {
        const c = cars[i];
        spawnMinigunBullets(c.centerX(), c.centerY());
        break;
      }
    }
    return;
  }
  // Bombe: auf Objekt klicken = Bombe fällt
  for (let i = cars.length - 1; i >= 0; i--) {
    if (cars[i].contains(clickX, clickY)) {
      const cx = cars[i].centerX() + rand(-8, 8);
      bombs.push(new Bomb(cx));
      break;
    }
  }
});

// menu buttons: wire up selection
function setupMenu(){
  const buttons = document.querySelectorAll('.options button');
  buttons.forEach(b=>{
    b.addEventListener('click', ()=>{
      buttons.forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      selectedType = b.dataset.type;
    });
    if (!b.dataset.type) b.dataset.type = b.textContent.trim().toLowerCase();
  });
  const initial = document.querySelector('.options button[data-type="'+selectedType+'"]');
  if (initial) initial.classList.add('sel');
  updateSpawnButtonLabels();

  // Waffenauswahl: drei Buttons (Bombe 1, Bombe 2, Minigun) – jederzeit jede Waffe wählbar
  document.querySelectorAll('.weapon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.dataset.weapon, 10);
      if (w === 2 && !minigunUnlocked) {
        if (coins < MINIGUN_COST) return;
        coins -= MINIGUN_COST;
        minigunUnlocked = true;
        saveCurrentUserState();
      }
      currentBombVariant = w;
      setCurrentBombTexture(currentBombVariant);
      updateWeaponButtons();
    });
  });
  updateWeaponButtons();

  document.getElementById('befMopsBtn').addEventListener('click', () => {
    if (!unlockedBefMops) {
      if (coins < BEF_MOPS_COST) return;
      coins -= BEF_MOPS_COST;
      unlockedBefMops = true;
      saveCurrentUserState();
      updateSpecialWeaponButtons();
    }
  });

  updateSpecialWeaponButtons();
}

window.addEventListener('keydown', e=>{
  if(e.key==='p' || e.key==='P'){ spawnSelectedAtMouse(); }
  if(e.key==='s' || e.key==='S'){ destroyRandomObjectWithSelectedWeapon(); }
  if(e.key==='b' || e.key==='B'){
    if (!unlockedBefMops) return;
    const now = Date.now();
    if (now - lastBefMopsTime < BEF_MOPS_COOLDOWN) return;
    lastBefMopsTime = now;
    befMopsList.push(new BefMops());
  }
  if(e.key==='Escape'){ /* no-op: user can close tab */ }
});

// add event listener for place button
document.getElementById('placeButton').addEventListener('click', () => {
  placingMode = true;
});

// initialize menu handlers after DOM ready
window.addEventListener('load', ()=>{ setupMenu(); initAuth(); startGame(); });

function startGame(){
  if (gameStarted) return;
  gameStarted = true;
  initClouds();
  gameLoop();
}

// NOTE: gameLoop now always runs; login only affects state/spawning logic.
