// Main Client Game Loop, Multiplayer Sync, Zero-Bloom Arcade FPS Shooting & HUD
(function () {
  const MAP_DATA = window.HoodShared.MAP_DATA;
  const socket = io();

  // Share URL helper in lobby
  const shareUrlEl = document.getElementById('share-url');
  if (shareUrlEl) shareUrlEl.textContent = window.location.origin;

  // Three.js Setup
  const container = document.getElementById('game-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffc994); // Warm golden sunset urban sky from screenshot
  scene.fog = new THREE.FogExp2(0xffc994, 0.0065);

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 250);
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Warm afternoon lighting + cool street shadows (cel-shaded feel)
  const hemiLight = new THREE.HemisphereLight(0xfff3e0, 0x3b4266, 0.88);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffe0b2, 1.15);
  dirLight.position.set(35, 65, 25);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -65;
  dirLight.shadow.camera.right = 65;
  dirLight.shadow.camera.top = 55;
  dirLight.shadow.camera.bottom = -55;
  scene.add(dirLight);

  // Build 3D Street Map
  const worldRefs = window.HoodWorld.buildMap(scene, MAP_DATA);

  // Build Raycastable Environment Meshes for Bullet Impact Points
  const mapRaycastBoxes = [];
  for (const col of MAP_DATA.COLLIDERS) {
    if (col.type === 'boundary') continue;
    const dummy = new THREE.Mesh(
      new THREE.BoxGeometry(col.w, col.h, col.d),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    dummy.position.set(col.x, col.y, col.z);
    scene.add(dummy);
    mapRaycastBoxes.push(dummy);
  }
  const groundPlaneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 110),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  groundPlaneMesh.rotation.x = -Math.PI / 2;
  scene.add(groundPlaneMesh);
  mapRaycastBoxes.push(groundPlaneMesh);

  // Local Player State
  let selfId = null;
  let selectedTeam = 'biggie';
  const localPlayer = {
    x: -36,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: -Math.PI / 2,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    team: 'biggie',
    name: 'Biggie_Boi',
    weapon: 'cheese_blaster',
    mag: 30,
    reserve: 90,
    reloading: false,
    lastShotAt: 0,
    lastGrenadeAt: 0,
    ultCharge: 40,
    overcharged: false,
    onGround: true
  };

  // Remote Players & Bots Map: id -> { data, mesh, labelEl }
  const playersMap = new Map();
  const worldLabelsContainer = document.getElementById('world-labels');

  // Active Projectiles & FX
  const projectiles = [];
  const activeGrenades = [];
  const particles = [];

  // Viewmodel Holder
  let fpWeaponMesh = null;
  let recoilKick = 0;

  function equipWeapon(weaponId) {
    const wCfg = MAP_DATA.WEAPONS[weaponId] || MAP_DATA.WEAPONS.cheese_blaster;
    localPlayer.weapon = wCfg.id;
    localPlayer.mag = wCfg.magSize;
    localPlayer.reserve = wCfg.reserveAmmo;
    localPlayer.reloading = false;
    document.getElementById('reload-indicator').classList.add('hidden');

    if (fpWeaponMesh) {
      camera.remove(fpWeaponMesh);
    }
    fpWeaponMesh = window.HoodWorld.createFirstPersonWeapon(wCfg.id);
    camera.add(fpWeaponMesh);

    const tagEl = document.getElementById('active-weapon-tag');
    if (tagEl) {
      const icon = wCfg.team === 'kewi' ? '🥝' : '🧀';
      tagEl.textContent = `${icon} ${wCfg.name.toUpperCase()} [${wCfg.slot}]`;
      tagEl.style.color = wCfg.color;
    }
    updateAmmoHUD();
  }

  function updateAmmoHUD() {
    const wCfg = MAP_DATA.WEAPONS[localPlayer.weapon];
    const pct = Math.max(0, Math.min(100, (localPlayer.mag / wCfg.magSize) * 100));
    document.getElementById('ammo-bar-fill').style.width = `${pct}%`;
    document.getElementById('ammo-text').textContent = `${localPlayer.mag}/${localPlayer.reserve}`;
  }

  function updateHealthHUD() {
    const pct = Math.max(0, Math.min(100, (localPlayer.hp / localPlayer.maxHp) * 100));
    document.getElementById('hp-bar-fill').style.width = `${pct}%`;
    document.getElementById('hp-text').textContent = `${localPlayer.hp}/${localPlayer.maxHp}`;
  }

  function updateScoreHUD(ms) {
    if (!ms) return;
    document.getElementById('biggie-score').textContent = ms.biggieScore;
    document.getElementById('kewi-score').textContent = ms.kewiScore;

    const mins = String(Math.floor(ms.timeLeft / 60)).padStart(2, '0');
    const secs = String(ms.timeLeft % 60).padStart(2, '0');
    document.getElementById('round-timer').textContent = `${mins}:${secs}`;

    const turfEl = document.getElementById('turf-status');
    if (turfEl) {
      if (ms.turfOwner === 'biggie') {
        turfEl.textContent = 'TURF: BIGGIE CHEESE';
        turfEl.style.color = '#ffdd00';
      } else if (ms.turfOwner === 'kewi') {
        turfEl.textContent = 'TURF: RZA KEWI';
        turfEl.style.color = '#39ff14';
      } else {
        turfEl.textContent = 'THE BLOCK: CONTESTED';
        turfEl.style.color = '#cbd5e1';
      }
    }
  }

  function ensurePlayerEntity(pData) {
    if (pData.id === selfId) return null;
    let entry = playersMap.get(pData.id);

    if (!entry || entry.team !== pData.team || entry.isCop !== Boolean(pData.isCop)) {
      if (entry) {
        scene.remove(entry.mesh);
        entry.labelEl.remove();
      }
      const mesh = pData.isCop
        ? window.HoodWorld.createCopCharacterMesh(pData.team)
        : window.HoodWorld.createCharacterMesh(pData.team);
      mesh.position.set(pData.x, pData.y, pData.z);

      // Generous invisible capsule/cylinder body hitbox for 100% reliable bullet registration
      const bodyHitbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.85, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      bodyHitbox.position.set(0, 0.95, 0);
      bodyHitbox.userData.ownerId = pData.id;
      bodyHitbox.userData.isHitbox = true;
      mesh.add(bodyHitbox);

      // Dedicated head hitbox for crisp headshots
      const headHitbox = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 6, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      headHitbox.position.set(0, 1.62, 0);
      headHitbox.userData.ownerId = pData.id;
      headHitbox.userData.isHead = true;
      mesh.add(headHitbox);

      scene.add(mesh);

      const labelEl = document.createElement('div');
      labelEl.className = `world-tag team-${pData.team}${pData.isCop ? ' is-cop' : ''}`;
      labelEl.innerHTML = `
        <div class="tag-name">${pData.name}</div>
        <div class="tag-hp-track"><div class="tag-hp-bar" style="width:100%"></div></div>
      `;
      worldLabelsContainer.appendChild(labelEl);

      entry = {
        id: pData.id,
        team: pData.team,
        isCop: Boolean(pData.isCop),
        data: pData,
        mesh,
        labelEl,
        targetPos: new THREE.Vector3(pData.x, pData.y, pData.z),
        targetYaw: pData.yaw || 0
      };
      playersMap.set(pData.id, entry);
    }

    // Handle player death animation / ragdoll fall
    if (entry.data.alive && !pData.alive) {
      if (!entry.isDying) {
        entry.isDying = true;
        entry.deathStartTime = performance.now();
        if (!entry.isFlyback) {
          const yaw = pData.yaw || 0;
          entry.flyVx = -Math.sin(yaw) * 4;
          entry.flyVz = -Math.cos(yaw) * 4;
          entry.flyVy = 2.5;
          entry.spinX = 4;
          entry.spinY = 0;
          entry.spinZ = 0;
        }
      }
    } else if (!entry.data.alive && pData.alive) {
      entry.isDying = false;
      entry.isFlyback = false;
      entry.mesh.rotation.x = 0;
      entry.mesh.rotation.y = pData.yaw || 0;
      entry.mesh.rotation.z = 0;
      entry.mesh.position.set(pData.x, pData.y, pData.z);
    }

    entry.data = pData;
    entry.targetPos.set(pData.x, pData.y, pData.z);
    entry.targetYaw = pData.yaw || 0;
    entry.mesh.visible = Boolean(pData.alive) || Boolean(entry.isDying);
    entry.labelEl.style.display = pData.alive ? 'block' : 'none';

    const hpPct = Math.max(0, Math.min(100, (pData.hp / (pData.isCop ? 150 : 100)) * 100));
    const hpBar = entry.labelEl.querySelector('.tag-hp-bar');
    if (hpBar) hpBar.style.width = `${hpPct}%`;
    const nameDiv = entry.labelEl.querySelector('.tag-name');
    if (nameDiv) nameDiv.textContent = pData.name;

    return entry;
  }

  function removePlayerEntity(id) {
    const entry = playersMap.get(id);
    if (entry) {
      scene.remove(entry.mesh);
      entry.labelEl.remove();
      playersMap.delete(id);
    }
  }

  // ==================== SOCKET.IO EVENTS ====================
  socket.on('connect', () => {
    selfId = socket.id;
  });

  socket.on('init', (payload) => {
    selfId = payload.selfId || socket.id;
    updateScoreHUD(payload.matchState);
    document.getElementById('bot-count-label').textContent = payload.targetBotsPerTeam;

    for (const p of payload.players) {
      if (p.id === selfId) {
        localPlayer.x = p.x;
        localPlayer.y = p.y;
        localPlayer.z = p.z;
        localPlayer.yaw = p.yaw;
        localPlayer.team = p.team;
        localPlayer.name = p.name;
        selectedTeam = p.team;
        document.getElementById('player-name-input').value = p.name;
        selectTeamUI(p.team);
        equipWeapon(p.weapon);
        window.HoodHUD.drawIconsForTeam(p.team);
        updateSnitchHUD();
      } else {
        ensurePlayerEntity(p);
      }
    }

    // Seed initial authentic screenshot kill-feed lines so HUD looks live immediately!
    pushKillFeed({
      killerName: 'Biggie_Boi',
      killerTeam: 'biggie',
      victimName: 'Kewi_Stomper',
      victimTeam: 'kewi',
      verb: 'eliminated'
    });
    pushKillFeed({
      killerName: 'Kewi_Master',
      killerTeam: 'kewi',
      victimName: 'Biggie_Fan',
      victimTeam: 'biggie',
      verb: 'tagged'
    });
  });

  function handleWorldSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.players)) return;
    const seenIds = new Set();
    for (const p of snapshot.players) {
      seenIds.add(p.id);
      if (p.id === selfId) {
        localPlayer.hp = p.hp;
        localPlayer.alive = p.alive;
        localPlayer.ultCharge = p.ultCharge || 0;
        localPlayer.overcharged = p.overcharged;
        localPlayer.killStreak = p.killStreak || 0;
        updateHealthHUD();
        updateSnitchHUD();

        const ultBadge = document.getElementById('ult-pct-badge');
        if (ultBadge) {
          ultBadge.textContent = localPlayer.ultCharge >= 100 ? 'READY' : `${localPlayer.ultCharge}%`;
          ultBadge.style.color = localPlayer.ultCharge >= 100 ? '#ffdd00' : '#fff';
        }
        document.getElementById('ult-aura').style.boxShadow = localPlayer.overcharged
          ? `inset 0 0 80px ${localPlayer.team === 'biggie' ? 'rgba(255,221,0,0.45)' : 'rgba(57,255,20,0.45)'}`
          : 'inset 0 0 70px rgba(0,0,0,0)';
      } else {
        ensurePlayerEntity(p);
      }
    }

    for (const existingId of Array.from(playersMap.keys())) {
      if (!seenIds.has(existingId)) {
        removePlayerEntity(existingId);
      }
    }

    // Update Tab Scoreboard if open
    if (!document.getElementById('tab-scoreboard').classList.contains('hidden')) {
      renderTabScoreboard(snapshot.players);
    }
  }

  socket.on('worldState', handleWorldSnapshot);
  socket.on('snapshot', handleWorldSnapshot);

  socket.on('rosterUpdate', (data) => {
    document.getElementById('bot-count-label').textContent = data.targetBotsPerTeam;
  });

  socket.on('playerLeft', ({ id }) => {
    removePlayerEntity(id);
  });

  socket.on('playerRespawned', (data) => {
    if (data.id === selfId) {
      localPlayer.x = data.x;
      localPlayer.y = data.y;
      localPlayer.z = data.z;
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      localPlayer.vz = 0;
      localPlayer.yaw = data.yaw;
      localPlayer.pitch = 0;
      localPlayer.hp = data.hp;
      localPlayer.alive = true;
      equipWeapon(localPlayer.team === 'biggie' ? 'cheese_blaster' : 'kewi_railgun');
      updateHealthHUD();
    }
  });

  socket.on('playerShot', (shot) => {
    if (shot.shooterId === selfId) return; // local player already spawned visual projectile
    spawnVisualProjectile(shot.origin, shot.dir, shot.hitPoint, shot.weapon, shot.team);
    if (window.HoodAudio && window.HoodAudio.playShootPositional) {
      window.HoodAudio.playShootPositional(shot.weapon, shot.origin, localPlayer);
    }
  });

  socket.on('playerDamaged', (ev) => {
    // Update local player if hit
    if (ev.victimId === selfId) {
      localPlayer.hp = ev.hp;
      updateHealthHUD();
      const flash = document.getElementById('damage-flash');
      flash.style.boxShadow = 'inset 0 0 100px rgba(255, 25, 65, 0.72)';
      setTimeout(() => {
        flash.style.boxShadow = 'inset 0 0 90px rgba(255, 20, 50, 0)';
      }, 180);

      if (Math.random() < 0.08 && ev.hp > 0) {
        window.HoodAudio.playPositionalClip('hurt', null, null, 24, 0.18);
      }
    } else {
      // Update victim enemy/bot HP and health bar immediately
      const victimEntry = playersMap.get(ev.victimId);
      if (victimEntry) {
        victimEntry.data.hp = ev.hp;
        const hpPct = Math.max(0, Math.min(100, (ev.hp / (victimEntry.isCop ? 150 : 100)) * 100));
        const hpBar = victimEntry.labelEl.querySelector('.tag-hp-bar');
        if (hpBar) hpBar.style.width = `${hpPct}%`;
      }
    }

    if (ev.attackerId === selfId && ev.victimId !== selfId) {
      showHitmarker(ev.isHeadshot);
      spawnFloatingDamage(ev.x, ev.y, ev.z, ev.damage, ev.isHeadshot);
    }
    spawnImpactParticles(ev.x, ev.y, ev.z, 0xffdd00, 7);
  });

  socket.on('grenadeThrown', (g) => {
    spawnGrenadeEntity(g.origin, g.velocity, g.team);
  });

  socket.on('grenadeExplode', (ex) => {
    window.HoodAudio.playExplosion();
    const col = ex.team === 'biggie' ? 0xffca28 : 0x39ff14;
    spawnImpactParticles(ex.x, ex.y + 0.5, ex.z, col, 32);

    // Expanding blast sphere visual
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75 })
    );
    sphere.position.set(ex.x, ex.y + 0.5, ex.z);
    scene.add(sphere);

    const start = performance.now();
    function expandBlast(now) {
      const t = (now - start) / 360;
      if (t >= 1) {
        scene.remove(sphere);
        return;
      }
      const s = 1 + t * 7.5;
      sphere.scale.set(s, s, s);
      sphere.material.opacity = 0.75 * (1 - t);
      requestAnimationFrame(expandBlast);
    }
    requestAnimationFrame(expandBlast);
  });

  // RPG Rocket Explosion with fiery shockwave + burning lingering flames
  function triggerRpgExplosion(x, y, z) {
    window.HoodAudio.playExplosion();

    // 1. Expanding bright fiery shockwave
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xff3d00, transparent: true, opacity: 0.95 });
    const shockwave = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), shockMat);
    shockwave.position.set(x, y + 0.3, z);
    scene.add(shockwave);

    const start = performance.now();
    function expandShock(now) {
      const t = (now - start) / 450;
      if (t >= 1) {
        scene.remove(shockwave);
        return;
      }
      const scale = 1 + t * 9.5;
      shockwave.scale.set(scale, scale * 0.75, scale);
      shockwave.material.opacity = 0.95 * (1 - t);
      requestAnimationFrame(expandShock);
    }
    requestAnimationFrame(expandShock);

    // 2. Heavy flying shrapnel & fire sparks
    spawnImpactParticles(x, y + 0.5, z, 0xff9100, 32);
    spawnImpactParticles(x, y + 0.8, z, 0xff1744, 24);

    // 3. Ground fire scorch mark
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 16),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75, depthWrite: false })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(x, 0.04, z);
    scene.add(scorch);

    // 4. Lingering animated flames (flicker for 4.5 seconds)
    const flameCount = 12;
    const flameMeshes = [];
    for (let f = 0; f < flameCount; f++) {
      const flameColor = Math.random() > 0.4 ? 0xff5722 : 0xffc107;
      const fl = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 + Math.random() * 0.2, 0.9 + Math.random() * 0.8, 5),
        new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.9 })
      );
      const angle = (f / flameCount) * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.8;
      fl.position.set(x + Math.cos(angle) * r, 0.5, z + Math.sin(angle) * r);
      fl.userData.baseY = 0.5;
      fl.userData.baseScale = fl.scale.y;
      scene.add(fl);
      flameMeshes.push(fl);
    }

    const flameBorn = performance.now();
    function animateFlames(now) {
      const elapsed = (now - flameBorn) / 1000;
      if (elapsed > 4.5) {
        flameMeshes.forEach(fl => scene.remove(fl));
        scene.remove(scorch);
        return;
      }

      const fade = Math.max(0, 1 - (elapsed / 4.5));
      flameMeshes.forEach((fl, idx) => {
        const flicker = Math.sin(now * 0.018 + idx * 1.5) * 0.35 + 0.9;
        fl.scale.set(flicker * fade, flicker * fade * 1.2, flicker * fade);
        fl.position.y = fl.userData.baseY * flicker;
        fl.material.opacity = fade * 0.85;
      });

      requestAnimationFrame(animateFlames);
    }
    requestAnimationFrame(animateFlames);
  }

  socket.on('rpgExplode', (ex) => {
    triggerRpgExplosion(ex.x, ex.y, ex.z);
  });

  // Spatial Proximity Voice Lines & Sound FX
  socket.on('spatialSound', (data) => {
    const listener = {
      x: localPlayer.x,
      y: localPlayer.y,
      z: localPlayer.z,
      yaw: localPlayer.yaw
    };
    window.HoodAudio.playPositionalClip(
      data.category,
      { x: data.x, y: data.y, z: data.z },
      listener,
      24,
      0.18
    );
  });

  // ==================== SNITCH PHONE SCORESTREAK ====================
  const policeCruisers = [];
  let phoneMesh = null;
  let phoneUntil = 0;

  function updateSnitchHUD() {
    const ready = true; // Always ready for player
    const badge = document.getElementById('snitch-streak-badge');
    if (badge) {
      badge.textContent = 'READY';
      badge.style.color = '#ffdd00';
    }
    const card = document.getElementById('card-snitch');
    if (card) card.classList.toggle('snitch-ready', true);
    const toast = document.getElementById('snitch-ready-toast');
    if (toast) toast.classList.toggle('hidden', !(inGame && localPlayer.alive));
  }

  function callSnitch() {
    if (!localPlayer.alive) return;
    if (performance.now() < phoneUntil) return;
    showPhoneViewmodel('cops');
    window.HoodAudio.playSnitchCall();
    socket.emit('callSnitch');
  }

  function showPhoneViewmodel(mode = 'cops') {
    if (phoneMesh) camera.remove(phoneMesh);
    phoneMesh = window.HoodWorld.createSnitchPhoneViewmodel(mode);
    camera.add(phoneMesh);
    if (fpWeaponMesh) fpWeaponMesh.visible = false;
    phoneUntil = performance.now() + 1750;
  }

  function hidePhoneViewmodel() {
    if (phoneMesh) {
      camera.remove(phoneMesh);
      phoneMesh = null;
    }
    if (fpWeaponMesh) fpWeaponMesh.visible = true;
  }

  socket.on('snitchCalled', (ev) => {
    window.HoodAudio.playSnitchCall();

    if (ev.callerId === selfId || ev.callerId === socket.id) {
      localPlayer.killStreak = Math.max(0, (localPlayer.killStreak || 0) - 2);
      updateSnitchHUD();
      showPhoneViewmodel('cops');
    }

    pushKillFeed({
      killerName: ev.callerName,
      killerTeam: ev.team,
      victimName: '🚔 2 COPS',
      victimTeam: ev.team,
      verb: '📱 snitched & called'
    });

    // Police cruiser drives in from the street edge and parks
    const car = window.HoodWorld.createPoliceCruiserMesh();
    const fromX = ev.team === 'biggie' ? -55 : 55;
    car.position.set(fromX, 0, ev.cruiserZ);
    car.rotation.y = ev.team === 'biggie' ? 0 : Math.PI;
    scene.add(car);
    policeCruisers.push({
      mesh: car,
      fromX,
      toX: ev.cruiserX,
      z: ev.cruiserZ,
      bornAt: performance.now(),
      expiresAt: performance.now() + 35000
    });

    const banner = document.getElementById('police-alert-banner');
    if (banner) {
      const teamName = ev.team === 'biggie' ? 'BIGGIE CHEESE CREW' : 'RZA KEWI';
      banner.textContent = `🚔 ${ev.callerName} SNITCHED! 2 COPS PULLED UP FOR ${teamName}! 🚔`;
      banner.classList.remove('hidden');
      clearTimeout(banner._t);
      banner._t = setTimeout(() => banner.classList.add('hidden'), 3500);
    }
  });

  // ==================== DRIVE-BY KILLSTREAK ====================
  const drivebyCars = [];

  function callDriveby() {
    if (!localPlayer.alive) return;
    if (performance.now() < phoneUntil) return;
    showPhoneViewmodel('homies');
    window.HoodAudio.playSnitchCall();
    socket.emit('callDriveby');
  }

  socket.on('drivebyStarted', (ev) => {
    window.HoodAudio.playEngineSound();
    window.HoodAudio.playTireScreech();

    if (ev.callerId === selfId || ev.callerId === socket.id) {
      showPhoneViewmodel('homies');
    }

    // Play gangster voice line at balanced volume
    window.HoodAudio.playPositionalClip('driveby', { x: 0, y: 1, z: 0 }, { x: localPlayer.x, y: localPlayer.y, z: localPlayer.z }, 32, 0.28);

    const banner = document.getElementById('police-alert-banner');
    if (banner) {
      banner.textContent = `🚗💥 ${ev.callerName} CALLED A GANG DRIVE-BY! CAR ROLLING THROUGH! 💥🚗`;
      banner.classList.remove('hidden');
      clearTimeout(banner._t);
      banner._t = setTimeout(() => banner.classList.add('hidden'), 4000);
    }

    pushKillFeed({
      killerName: ev.callerName,
      killerTeam: ev.team,
      victimName: 'GANG DRIVE-BY CAR',
      victimTeam: ev.team,
      verb: '🚗 summoned'
    });

    // 3D Gang Lowrider Driveby vehicle with visible shooters hanging out the sides
    const dbCar = window.HoodWorld.createDrivebyCarMesh(ev.team);
    scene.add(dbCar);
    drivebyCars.push({
      mesh: dbCar,
      team: ev.team,
      startTime: performance.now(),
      duration: 22000 // 2 full relaxed loops (11s each)
    });
  });

  socket.on('killFeed', (kf) => {
    updateScoreHUD({
      biggieScore: kf.biggieScore,
      kewiScore: kf.kewiScore,
      timeLeft: currentTimerSec
    });
    pushKillFeed(kf);

    // Ragdoll Flyback trigger for victim (rocket / shotgun / headshot deaths fly 10m+)
    const entry = playersMap.get(kf.victimId);
    if (entry) {
      entry.isDying = true;
      entry.deathStartTime = performance.now();
      entry.isFlyback = Boolean(kf.isHeavyKill);
      const kb = kf.knockbackDir || { x: 0, z: -1 };
      if (entry.isFlyback) {
        const isRocket = Boolean(kf.weapon && (kf.weapon.includes('RPG') || kf.weapon.includes('Rocket')));
        const isShotty = Boolean(kf.weapon && (kf.weapon.includes('Shotty') || kf.weapon.includes('Shotgun')));
        const speed = isRocket ? 24 : (isShotty ? 20 : 18);
        entry.flyVx = kb.x * speed;
        entry.flyVz = kb.z * speed;
        entry.flyVy = isRocket ? 9.5 : 7.2;
        entry.spinX = (Math.random() - 0.5) * 8 + 6;
        entry.spinY = (Math.random() - 0.5) * 12;
        entry.spinZ = (Math.random() - 0.5) * 10;
      }
    }

    // Local player heavy death knockback kick
    if (kf.victimId === selfId && kf.isHeavyKill) {
      const kb = kf.knockbackDir || { x: 0, z: -1 };
      localPlayer.vx = kb.x * 16;
      localPlayer.vz = kb.z * 16;
      localPlayer.vy = 8;
      localPlayer.pitch = -0.6;
    }
  });

  let currentTimerSec = 275;
  socket.on('timerSync', (ms) => {
    currentTimerSec = ms.timeLeft;
    updateScoreHUD(ms);
  });

  socket.on('matchEnded', (ms) => {
    const banner = document.getElementById('match-end-banner');
    const title = document.getElementById('winner-title');
    banner.classList.remove('hidden');
    if (ms.winner === 'biggie') {
      title.textContent = '🧀 BIGGIE CHEESE CREW OWNS THE BLOCK!';
      title.style.color = '#ffdd00';
    } else {
      title.textContent = '🥝 RZA KEWI CAPTURES THE STREET!';
      title.style.color = '#39ff14';
    }
    if (document.pointerLockElement) document.exitPointerLock();
  });

  socket.on('matchReset', (data) => {
    document.getElementById('match-end-banner').classList.add('hidden');
    updateScoreHUD(data.matchState);
  });

  function pushKillFeed(kf) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'kill-item';
    const kClass = kf.killerTeam === 'biggie' ? 'k-biggie' : 'k-kewi';
    const vClass = kf.victimTeam === 'biggie' ? 'k-biggie' : 'k-kewi';
    item.innerHTML = `<span class="${kClass}">${kf.killerName}</span><span class="k-verb">${kf.verb}</span><span class="${vClass}">${kf.victimName}</span>`;
    feed.appendChild(item);

    while (feed.children.length > 3) {
      feed.removeChild(feed.firstChild);
    }
    setTimeout(() => {
      if (item.parentNode === feed) feed.removeChild(item);
    }, 5500);
  }

  function showHitmarker(isHeadshot) {
    window.HoodAudio.playHitmarker(isHeadshot);
    const hm = document.getElementById('hitmarker');
    hm.classList.remove('hidden');
    clearTimeout(hm._timer);
    hm._timer = setTimeout(() => hm.classList.add('hidden'), 110);
  }

  function spawnFloatingDamage(wx, wy, wz, dmg, isHeadshot) {
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(camera);
    if (v.z > 1) return;
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = `floating-dmg${isHeadshot ? ' headshot' : ''}`;
    el.textContent = isHeadshot ? `💥 ${dmg}` : `-${dmg}`;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  // ==================== CACHED GEOMETRIES & MATERIALS (Zero-Allocation GC Optimization) ====================
  const sharedParticleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  const sharedTracerGeo = new THREE.BoxGeometry(0.04, 0.04, 0.35);
  const sharedPistolGeo = new THREE.SphereGeometry(0.06, 5, 5);
  const sharedRpgGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 8);
  sharedRpgGeo.rotateX(Math.PI / 2);
  const sharedCheeseGeo = new THREE.ConeGeometry(0.16, 0.3, 4);
  const sharedKewiGeo = new THREE.SphereGeometry(0.08, 6, 6);

  const _matCache = new Map();
  function getCachedBasicMaterial(colorHex, transparent = false, opacity = 1) {
    const k = `${colorHex}_${transparent ? 1 : 0}_${opacity}`;
    let m = _matCache.get(k);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: colorHex, transparent, opacity });
      _matCache.set(k, m);
    }
    return m;
  }

  const _vOrigin = new THREE.Vector3();
  const _vEnd = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _tempLabelVec = new THREE.Vector3();

  // ==================== VISUAL PROJECTILES & FX ====================
  function spawnVisualProjectile(origin, dir, hitPoint, weaponId, team) {
    const start = _vOrigin.set(origin.x, origin.y, origin.z);
    let end;
    if (hitPoint) {
      end = _vEnd.set(hitPoint.x, hitPoint.y, hitPoint.z);
    } else {
      end = _vEnd.set(origin.x + dir.x * 65, origin.y + dir.y * 65, origin.z + dir.z * 65);
    }

    if (weaponId === 'kewi_railgun') {
      // Clean thin green railgun laser beam (no clutter)
      const dist = start.distanceTo(end);
      const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, dist, 6);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = getCachedBasicMaterial(0x39ff14, true, 0.85);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(start).lerp(end, 0.5);
      beam.lookAt(end);
      scene.add(beam);

      const born = performance.now();
      function fadeBeam(now) {
        const t = (now - born) / 120;
        if (t >= 1) {
          scene.remove(beam);
          beamGeo.dispose();
          return;
        }
        requestAnimationFrame(fadeBeam);
      }
      requestAnimationFrame(fadeBeam);
      return; // Railgun uses clean beam only
    }

    // Projectile visual representation based on weapon type (Cached Geometries & Materials)
    let mesh;
    let colHex = 0xffdd00;
    let projSpeed = 120;

    if (weaponId === 'rpg') {
      mesh = new THREE.Mesh(sharedRpgGeo, getCachedBasicMaterial(0xef4444));
      colHex = 0xff5722;
      projSpeed = 48;
    } else if (weaponId === 'ak47') {
      mesh = new THREE.Mesh(sharedTracerGeo, getCachedBasicMaterial(0xfbbf24));
      colHex = 0xfbbf24;
      projSpeed = 140;
    } else if (weaponId === 'pistol_1911') {
      mesh = new THREE.Mesh(sharedPistolGeo, getCachedBasicMaterial(0xffffff));
      colHex = 0xffffff;
      projSpeed = 145;
    } else {
      const isCheese = team === 'biggie' || weaponId === 'cheese_blaster';
      mesh = new THREE.Mesh(
        isCheese ? sharedCheeseGeo : sharedKewiGeo,
        getCachedBasicMaterial(isCheese ? 0xffdd00 : 0x39ff14)
      );
      colHex = isCheese ? 0xffdd00 : 0x39ff14;
      projSpeed = 110;
    }

    mesh.position.copy(start);
    scene.add(mesh);

    const velocity = _vDir.subVectors(end, start).normalize().multiplyScalar(projSpeed).clone();
    projectiles.push({
      mesh,
      velocity,
      target: end.clone(),
      color: colHex,
      isRpg: weaponId === 'rpg',
      bornAt: performance.now()
    });
  }

  function spawnGrenadeEntity(origin, velocity, team) {
    const isBiggie = team === 'biggie';
    const mesh = new THREE.Mesh(
      isBiggie ? new THREE.CylinderGeometry(0.22, 0.25, 0.4, 8) : new THREE.SphereGeometry(0.24, 10, 10),
      new THREE.MeshToonMaterial({ color: isBiggie ? 0xffd600 : 0x64dd17 })
    );
    window.HoodWorld.addComicOutline(mesh);
    mesh.position.set(origin.x, origin.y, origin.z);
    scene.add(mesh);

    activeGrenades.push({
      mesh,
      vx: velocity.x,
      vy: velocity.y,
      vz: velocity.z,
      bornAt: performance.now()
    });
  }

  function spawnImpactParticles(x, y, z, colorHex, count = 8) {
    const mat = getCachedBasicMaterial(colorHex);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(sharedParticleGeo, mat);
      m.position.set(x, y, z);
      scene.add(m);
      particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * 7 + 1,
        vz: (Math.random() - 0.5) * 9,
        bornAt: performance.now()
      });
    }
  }

  // ==================== INPUT & CONTROLS ====================
  const keys = {};
  let mouseDown = false;
  let isPointerLocked = false;
  let inGame = false;
  let lastMouseX = null;
  let lastMouseY = null;
  let currentRoomCode = 'HOOD';
  let currentBotsPerTeam = 3;
  let activeMenuTab = 'quickplay';

  const lobbyOverlay = document.getElementById('lobby-overlay');
  const deployBtn = document.getElementById('deploy-btn');

  // Menu Tab Navigation (Quick Play vs Create Custom vs Join With Code)
  const tabBtns = document.querySelectorAll('.menu-tab');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMenuTab = btn.getAttribute('data-tab');

      const qpPanel = document.getElementById('tab-panel-quickplay');
      const crPanel = document.getElementById('tab-panel-create');
      const jnPanel = document.getElementById('tab-panel-join');
      if (qpPanel) qpPanel.classList.toggle('hidden', activeMenuTab !== 'quickplay');
      if (crPanel) crPanel.classList.toggle('hidden', activeMenuTab !== 'create');
      if (jnPanel) jnPanel.classList.toggle('hidden', activeMenuTab !== 'join');

      const roomHint = document.getElementById('share-code-hint');
      if (roomHint) {
        if (activeMenuTab === 'create') {
          const cInput = document.getElementById('room-code-create');
          roomHint.textContent = cInput ? cInput.value.toUpperCase() : 'GANG';
        } else if (activeMenuTab === 'join') {
          const jInput = document.getElementById('room-code-join');
          roomHint.textContent = (jInput && jInput.value.trim()) ? jInput.value.toUpperCase() : 'HOOD';
        } else {
          roomHint.textContent = 'HOOD';
        }
      }
    });
  });

  // Random room code generator button
  const btnRandomCode = document.getElementById('btn-random-code');
  if (btnRandomCode) {
    btnRandomCode.addEventListener('click', () => {
      const codeInput = document.getElementById('room-code-create');
      if (codeInput) {
        codeInput.value = `G${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const roomHint = document.getElementById('share-code-hint');
        if (roomHint) roomHint.textContent = codeInput.value;
      }
    });
  }

  // Quick "HOOD" fill button
  const btnQuickHood = document.getElementById('btn-quick-hood');
  if (btnQuickHood) {
    btnQuickHood.addEventListener('click', () => {
      const joinInput = document.getElementById('room-code-join');
      if (joinInput) {
        joinInput.value = 'HOOD';
        const roomHint = document.getElementById('share-code-hint');
        if (roomHint) roomHint.textContent = 'HOOD';
      }
    });
  }

  // Toast feedback notification
  function showToast(msg) {
    const toast = document.getElementById('toast-banner');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  // In-Game HUD Room Code Pill (Click to copy code)
  const hudRoomBadge = document.getElementById('hud-room-code-badge');
  if (hudRoomBadge) {
    hudRoomBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = currentRoomCode || 'HOOD';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      showToast(`📋 ROOM CODE [${code}] COPIED TO CLIPBOARD!`);
    });
  }

  function selectTeamUI(team) {
    selectedTeam = team;
    document.getElementById('select-biggie').classList.toggle('selected', team === 'biggie');
    document.getElementById('select-kewi').classList.toggle('selected', team === 'kewi');
    const ch = document.getElementById('crosshair');
    ch.className = team === 'biggie' ? 'crosshair-biggie' : 'crosshair-kewi';
  }

  document.getElementById('select-biggie').addEventListener('click', () => selectTeamUI('biggie'));
  document.getElementById('select-kewi').addEventListener('click', () => selectTeamUI('kewi'));

  function startGameplay() {
    const nameInput = document.getElementById('player-name-input');
    const nameVal = nameInput ? nameInput.value.trim() : '';
    localPlayer.name = nameVal || (selectedTeam === 'biggie' ? 'Biggie_Boi' : 'Kewi_Stomper');
    localPlayer.team = selectedTeam;

    if (activeMenuTab === 'create') {
      const codeInput = document.getElementById('room-code-create');
      const roomCode = (codeInput ? codeInput.value.trim() : 'GANG').toUpperCase() || 'GANG';
      const bots = parseInt(document.getElementById('setting-bots').value, 10);
      const score = parseInt(document.getElementById('setting-score').value, 10);
      const duration = parseInt(document.getElementById('setting-duration').value, 10);

      socket.emit('createRoom', {
        roomCode,
        roomName: `${roomCode} Turf`,
        name: localPlayer.name,
        team: localPlayer.team,
        settings: {
          botsPerTeam: isNaN(bots) ? 3 : bots,
          scoreLimit: isNaN(score) ? 75 : score,
          roundDurationSec: isNaN(duration) ? 300 : duration
        }
      });
    } else if (activeMenuTab === 'join') {
      const joinInput = document.getElementById('room-code-join');
      const roomCode = (joinInput ? joinInput.value.trim() : 'HOOD').toUpperCase() || 'HOOD';

      socket.emit('joinRoom', {
        roomCode,
        name: localPlayer.name,
        team: localPlayer.team
      });
    } else {
      // Quick Play (Public HOOD Room)
      socket.emit('quickPlay', {
        name: localPlayer.name,
        team: localPlayer.team
      });
    }

    equipWeapon(localPlayer.team === 'biggie' ? 'cheese_blaster' : 'kewi_railgun');
    window.HoodHUD.drawIconsForTeam(localPlayer.team);
    updateSnitchHUD();

    inGame = true;
    lobbyOverlay.classList.add('hidden');
    window.HoodAudio.preloadSounds();
    try {
      if (renderer.domElement.requestPointerLock) {
        const p = renderer.domElement.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } catch (err) {}
  }

  deployBtn.addEventListener('click', startGameplay);

  // Room Joined event listener from server
  socket.on('roomJoined', (data) => {
    currentRoomCode = data.roomCode || 'HOOD';
    const hudBadge = document.getElementById('hud-room-code');
    if (hudBadge) hudBadge.textContent = currentRoomCode;

    const displayEl = document.getElementById('active-room-display');
    if (displayEl) displayEl.textContent = `${currentRoomCode} (${data.roomName || 'Custom Match'})`;

    const summaryEl = document.getElementById('room-settings-summary');
    if (summaryEl && data.settings) {
      summaryEl.textContent = `Bots: ${data.settings.botsPerTeam}/team • Target: ${data.settings.scoreLimit} Kills • ${Math.round(data.settings.roundDurationSec / 60)}m`;
    }

    const shareCodeEl = document.getElementById('share-code-hint');
    if (shareCodeEl) shareCodeEl.textContent = currentRoomCode;
  });

  const snitchCard = document.getElementById('card-snitch');
  if (snitchCard) {
    snitchCard.addEventListener('click', (e) => {
      e.stopPropagation();
      callSnitch();
    });
  }

  renderer.domElement.addEventListener('click', () => {
    if (inGame && !isPointerLocked) {
      try {
        const p = renderer.domElement.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    }
  });

  const btnPlayAgain = document.getElementById('btn-play-again');
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      socket.emit('resetMatch');
      startGameplay();
    });
  }

  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
  });

  window.addEventListener('mousemove', (e) => {
    if (!inGame) return;
    const sensitivity = 0.0022;
    let dx = e.movementX;
    let dy = e.movementY;

    if (!isPointerLocked) {
      if (lastMouseX !== null && lastMouseY !== null) {
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
      } else {
        dx = 0;
        dy = 0;
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }

    localPlayer.yaw -= dx * sensitivity;
    localPlayer.pitch -= dy * sensitivity;
    const maxPitch = Math.PI / 2 - 0.05;
    localPlayer.pitch = Math.max(-maxPitch, Math.min(maxPitch, localPlayer.pitch));
  });

  window.addEventListener('mousedown', (e) => {
    if (!inGame) return;
    if (e.target && e.target.closest && e.target.closest('#lobby-overlay, #match-end-banner')) return;
    if (e.button === 0) {
      mouseDown = true;
      tryShoot();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.code === 'Enter') startGameplay();
      return;
    }

    keys[e.code] = true;

    if (e.code === 'Tab') {
      e.preventDefault();
      document.getElementById('tab-scoreboard').classList.remove('hidden');
    }

    if (e.code === 'KeyM' || e.code === 'Escape') {
      inGame = false;
      mouseDown = false;
      if (document.pointerLockElement) document.exitPointerLock();
      lobbyOverlay.classList.remove('hidden');
      return;
    }

    if (!inGame) return;

    if (e.code === 'KeyR') startReload();
    if (e.code === 'Digit1') equipWeapon(localPlayer.team === 'biggie' ? 'cheese_blaster' : 'kewi_railgun');
    if (e.code === 'Digit2') equipWeapon('pistol_1911');
    if (e.code === 'Digit4') equipWeapon('ak47');
    if (e.code === 'Digit5') equipWeapon('rpg');
    if (e.code === 'Digit6') equipWeapon('fondue_shotty');
    if (e.code === 'KeyQ' || e.code === 'KeyG') throwGrenade();
    if (e.code === 'KeyE') activateUltimate();
    if (e.code === 'Digit3' || e.code === 'KeyC') callSnitch();
    if (e.code === 'KeyV' || e.code === 'KeyB') callDriveby();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Tab') {
      document.getElementById('tab-scoreboard').classList.add('hidden');
    }
  });

  let reloadStartTime = 0;
  let reloadDurationMs = 1200;

  function startReload() {
    const wCfg = MAP_DATA.WEAPONS[localPlayer.weapon];
    if (localPlayer.reloading || localPlayer.mag >= wCfg.magSize || localPlayer.reserve <= 0) return;
    localPlayer.reloading = true;
    reloadStartTime = performance.now();
    reloadDurationMs = wCfg.reloadTimeMs;
    document.getElementById('reload-indicator').classList.remove('hidden');

    setTimeout(() => {
      const needed = wCfg.magSize - localPlayer.mag;
      const take = Math.min(needed, localPlayer.reserve);
      localPlayer.mag += take;
      localPlayer.reserve -= take;
      localPlayer.reloading = false;
      document.getElementById('reload-indicator').classList.add('hidden');
      updateAmmoHUD();
    }, wCfg.reloadTimeMs);
  }

  // ==================== ZERO-BLOOM ARCADE SHOOTING ====================
  const raycaster = new THREE.Raycaster();

  function tryShoot() {
    if (!localPlayer.alive || localPlayer.reloading) return;
    if (phoneMesh) return; // busy on the phone with 911
    const wCfg = MAP_DATA.WEAPONS[localPlayer.weapon];
    const now = performance.now();
    if (now - localPlayer.lastShotAt < wCfg.fireRateMs) return;

    if (localPlayer.mag <= 0) {
      startReload();
      return;
    }

    localPlayer.lastShotAt = now;
    localPlayer.mag -= 1;
    updateAmmoHUD();
    if (localPlayer.mag === 0) startReload();

    recoilKick = 0.085; // Purely visual viewmodel animation — crosshair aim stays 100% dead-center!
    window.HoodAudio.playShoot(localPlayer.weapon);

    // Muzzle flash burst at gun barrel tip
    const flashCol = localPlayer.weapon === 'kewi_railgun' ? 0x39ff14 : 0xffdd00;
    spawnImpactParticles(
      camera.position.x + Math.sin(localPlayer.yaw) * -0.6,
      camera.position.y - 0.15,
      camera.position.z + Math.cos(localPlayer.yaw) * -0.6,
      flashCol,
      3
    );

    // Crosshair reactive recoil bloom pulse
    const ch = document.getElementById('crosshair');
    if (ch) {
      ch.style.transform = 'scale(1.28)';
      clearTimeout(ch._t);
      ch._t = setTimeout(() => { ch.style.transform = 'scale(1)'; }, 80);
    }

    // Raycast from exact center of screen (0, 0) -> Zero spread, Zero recoil pattern!
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Gather enemy hitboxes + environment colliders
    const enemyMeshes = [];
    for (const entry of playersMap.values()) {
      if (entry.data.alive && entry.data.team !== localPlayer.team) {
        entry.mesh.traverse((child) => {
          if (child.isMesh) {
            child.userData.ownerId = entry.id;
            enemyMeshes.push(child);
          }
        });
      }
    }

    const envHits = raycaster.intersectObjects(mapRaycastBoxes, false);
    const envDist = envHits.length > 0 ? envHits[0].distance : Infinity;

    const playerHits = raycaster.intersectObjects(enemyMeshes, false);
    let victimId = null;
    let isHeadshot = false;
    let hitPoint = envHits.length > 0
      ? envHits[0].point
      : camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(80));

    if (playerHits.length > 0 && playerHits[0].distance < envDist) {
      victimId = playerHits[0].object.userData.ownerId;
      isHeadshot = Boolean(playerHits[0].object.userData.isHead);
      hitPoint = playerHits[0].point;
    }

    // Muzzle origin in world space
    const muzzleOrigin = camera.position.clone()
      .add(new THREE.Vector3(0, -0.12, 0))
      .add(raycaster.ray.direction.clone().multiplyScalar(0.6));

    spawnVisualProjectile(
      muzzleOrigin,
      raycaster.ray.direction,
      hitPoint,
      localPlayer.weapon,
      localPlayer.team
    );

    socket.emit('shoot', {
      weapon: localPlayer.weapon,
      origin: { x: muzzleOrigin.x, y: muzzleOrigin.y, z: muzzleOrigin.z },
      dir: { x: raycaster.ray.direction.x, y: raycaster.ray.direction.y, z: raycaster.ray.direction.z },
      hitPoint: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
      victimId,
      isHeadshot
    });
  }

  function throwGrenade() {
    const now = performance.now();
    if (now - localPlayer.lastGrenadeAt < 4500 || !localPlayer.alive) return;
    localPlayer.lastGrenadeAt = now;

    // Cooldown UI
    const cdEl = document.getElementById('grenade-cd-overlay');
    cdEl.classList.remove('hidden');
    let rem = 4;
    cdEl.textContent = rem;
    const iv = setInterval(() => {
      rem -= 1;
      if (rem <= 0) {
        cdEl.classList.add('hidden');
        clearInterval(iv);
      } else {
        cdEl.textContent = rem;
      }
    }, 1000);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const dir = raycaster.ray.direction.clone().normalize();
    const origin = {
      x: localPlayer.x,
      y: localPlayer.y + 1.5,
      z: localPlayer.z
    };
    const velocity = {
      x: dir.x * 22,
      y: Math.max(4.5, dir.y * 18 + 6.5),
      z: dir.z * 22
    };

    socket.emit('throwGrenade', { origin, velocity });
  }

  function activateUltimate() {
    if ((localPlayer.ultCharge || 0) < 100 || !localPlayer.alive) return;
    socket.emit('activateUlt');
  }

  // ==================== PLAYER PHYSICS & COLLISION ====================
  function updateLocalPhysics(dt) {
    if (!localPlayer.alive) return;

    const isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
    const baseSpeed = isSprinting ? 14.5 : 10.5;
    const speed = localPlayer.overcharged ? baseSpeed * 1.25 : baseSpeed;

    let forward = 0;
    let strafe = 0;
    if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
    if (keys['KeyS'] || keys['ArrowDown']) forward -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;

    if (forward !== 0 || strafe !== 0) {
      const len = Math.sqrt(forward * forward + strafe * strafe);
      forward /= len;
      strafe /= len;
    }

    const sinY = Math.sin(localPlayer.yaw);
    const cosY = Math.cos(localPlayer.yaw);

    const moveX = (-sinY * forward + cosY * strafe) * speed;
    const moveZ = (-cosY * forward - sinY * strafe) * speed;

    // Jump
    if (keys['Space'] && localPlayer.onGround) {
      localPlayer.vy = 11.2;
      localPlayer.onGround = false;
    }

    // Check Jump Pads
    for (const jp of MAP_DATA.JUMP_PADS) {
      const dx = localPlayer.x - jp.x;
      const dz = localPlayer.z - jp.z;
      if (dx * dx + dz * dz <= jp.radius * jp.radius && localPlayer.y < 1.2) {
        localPlayer.vy = jp.vy;
        localPlayer.onGround = false;
        window.HoodAudio.playJumpPad();
      }
    }

    // Gravity
    localPlayer.vy -= 26.0 * dt;
    let nextX = localPlayer.x + moveX * dt;
    let nextY = localPlayer.y + localPlayer.vy * dt;
    let nextZ = localPlayer.z + moveZ * dt;

    // Vertical & Horizontal Collider Resolution
    const playerRadius = 0.62;
    const playerHeight = 1.75;
    let grounded = false;

    if (nextY <= 0) {
      nextY = 0;
      localPlayer.vy = 0;
      grounded = true;
    }

    for (const c of MAP_DATA.COLLIDERS) {
      const halfW = c.w / 2 + playerRadius;
      const halfD = c.d / 2 + playerRadius;
      const minY = c.y - c.h / 2;
      const maxY = c.y + c.h / 2;

      const withinXZ = Math.abs(nextX - c.x) < halfW && Math.abs(nextZ - c.z) < halfD;
      if (!withinXZ) continue;

      // Landing on top of crate / awning / subway roof
      if (localPlayer.y >= maxY - 0.25 && nextY <= maxY && localPlayer.vy <= 0) {
        nextY = maxY;
        localPlayer.vy = 0;
        grounded = true;
        continue;
      }

      // Horizontal wall/crate pushout
      if (nextY + playerHeight > minY && nextY < maxY - 0.15) {
        const dx = nextX - c.x;
        const dz = nextZ - c.z;
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);
        if (overlapX < overlapZ) {
          nextX += dx >= 0 ? overlapX : -overlapX;
        } else {
          nextZ += dz >= 0 ? overlapZ : -overlapZ;
        }
      }
    }

    localPlayer.x = Math.max(-56, Math.min(56, nextX));
    localPlayer.y = nextY;
    localPlayer.z = Math.max(-41, Math.min(41, nextZ));
    localPlayer.onGround = grounded;

    // Update Camera Position & Orientation
    camera.position.set(localPlayer.x, localPlayer.y + 1.6, localPlayer.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = localPlayer.yaw;
    camera.rotation.x = localPlayer.pitch;
  }

  function renderTabScoreboard(playersList) {
    const titleEl = document.querySelector('.scoreboard-modal h2');
    if (titleEl) {
      titleEl.textContent = `STREET TURF STANDINGS • ROOM: [${currentRoomCode || 'HOOD'}]`;
    }
    const bBody = document.querySelector('#sb-table-biggie tbody');
    const kBody = document.querySelector('#sb-table-kewi tbody');
    if (!bBody || !kBody) return;
    bBody.innerHTML = '';
    kBody.innerHTML = '';

    const sorted = [...playersList].sort((a, b) => b.kills - a.kills);
    for (const p of sorted) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}${p.id === selfId ? ' (YOU)' : ''}</td><td>${p.kills}</td><td>${p.deaths}</td>`;
      if (p.team === 'biggie') bBody.appendChild(tr);
      else kBody.appendChild(tr);
    }
  }

  // ==================== MAIN RENDER & NETWORK LOOP ====================
  let lastFrameTime = performance.now();
  let lastNetSend = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (inGame && mouseDown) {
      tryShoot();
    }

    if (inGame) {
      updateLocalPhysics(dt);
    } else {
      // Cinematic street overview camera while in lobby
      camera.position.set(localPlayer.x, localPlayer.y + 1.6, localPlayer.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = localPlayer.yaw;
      camera.rotation.x = localPlayer.pitch;
    }

    // Rotate Giant Neon Cheese Wedge on Biggie's Spot Roof
    if (worldRefs && worldRefs.giantCheese) {
      worldRefs.giantCheese.rotation.y += dt * 0.9;
    }

    // Viewmodel subtle bobbing, recoil recovery & smooth reload animation
    if (fpWeaponMesh) {
      recoilKick = Math.max(0, recoilKick - dt * 0.55);
      const moveBob = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) && localPlayer.onGround
        ? Math.sin(now * 0.012) * 0.012
        : 0;

      let reloadDropY = 0;
      let reloadTiltZ = 0;
      if (localPlayer.reloading) {
        const reloadProg = Math.min(1, (now - reloadStartTime) / reloadDurationMs);
        // Weapon drops down, tilts to side, then slides back up
        const dropCycle = Math.sin(reloadProg * Math.PI);
        reloadDropY = -0.22 * dropCycle;
        reloadTiltZ = 0.35 * dropCycle;
      }

      // 90s Gangsta Sideways Grip (Visual only - instant hood vibe, zero extra buttons)
      const isPistol = localPlayer.weapon === 'pistol_1911';
      const isRpg = localPlayer.weapon === 'rpg';
      const gangstaTiltZ = isPistol ? -1.18 : (isRpg ? -0.22 : -0.78);
      const gangstaPosX = isPistol ? 0.22 : (isRpg ? 0.28 : 0.24);
      const gangstaPosY = isPistol ? -0.23 : -0.25;

      fpWeaponMesh.position.set(
        gangstaPosX,
        gangstaPosY + moveBob + reloadDropY,
        -0.42 + recoilKick
      );
      fpWeaponMesh.rotation.x = recoilKick * 1.2 + (reloadDropY * 0.8);
      fpWeaponMesh.rotation.y = isPistol ? 0.20 : 0.12;
      fpWeaponMesh.rotation.z = gangstaTiltZ + reloadTiltZ;
    }

    // Interpolate Remote Players, Death Animation & Update 3D Screen-Space Nameplates
    for (const entry of playersMap.values()) {
      if (entry.isDying) {
        const elapsed = (now - entry.deathStartTime) / 1000;
        if (entry.isFlyback) {
          // Ragdoll Flyback: launches 10+ meters down the street, spins like bowling pin, bounces on street
          entry.mesh.position.x += entry.flyVx * dt;
          entry.mesh.position.z += entry.flyVz * dt;
          entry.mesh.position.y += entry.flyVy * dt;
          entry.flyVy -= 26 * dt; // gravity

          if (entry.mesh.position.y <= 0.25) {
            entry.mesh.position.y = 0.25;
            if (Math.abs(entry.flyVy) > 1.2) {
              entry.flyVy = -entry.flyVy * 0.35; // bounce on street
              entry.flyVx *= 0.75;
              entry.flyVz *= 0.75;
              spawnImpactParticles(entry.mesh.position.x, 0.3, entry.mesh.position.z, 0xaaaaaa, 3);
            } else {
              entry.flyVy = 0;
              entry.flyVx *= Math.max(0, 1 - dt * 5);
              entry.flyVz *= Math.max(0, 1 - dt * 5);
            }
          }

          // Bowling pin tumbling rotation
          entry.mesh.rotation.x += entry.spinX * dt;
          entry.mesh.rotation.y += entry.spinY * dt;
          entry.mesh.rotation.z += entry.spinZ * dt;
          entry.spinX *= Math.max(0, 1 - dt * 1.5);
          entry.spinY *= Math.max(0, 1 - dt * 1.5);
          entry.spinZ *= Math.max(0, 1 - dt * 1.5);

          if (elapsed > 1.8) {
            entry.mesh.visible = false;
          }
        } else {
          // Standard backward fall
          const fallT = Math.min(1, (now - entry.deathStartTime) / 450);
          entry.mesh.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, fallT);
          entry.mesh.position.y = Math.max(0.2, THREE.MathUtils.lerp(entry.targetPos.y, 0.25, fallT));
          if (fallT >= 1) {
            entry.mesh.visible = false;
          }
        }
      } else {
        entry.mesh.position.lerp(entry.targetPos, Math.min(1, dt * 14));
        entry.mesh.rotation.y = entry.targetYaw;
      }

      if (entry.data.alive) {
        _tempLabelVec.copy(entry.mesh.position);
        _tempLabelVec.y += 2.25;
        _tempLabelVec.project(camera);
        if (_tempLabelVec.z < 1 && _tempLabelVec.z > -1) {
          const sx = (_tempLabelVec.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-_tempLabelVec.y * 0.5 + 0.5) * window.innerHeight;
          entry.labelEl.style.left = `${sx}px`;
          entry.labelEl.style.top = `${sy}px`;
          entry.labelEl.style.opacity = '1';
        } else {
          entry.labelEl.style.opacity = '0';
        }
      }
    }

    // Calling Phone viewmodel: raise, shake/wobble while dialing, then drop away
    if (phoneMesh) {
      const remaining = phoneUntil - now;
      if (remaining <= 0) {
        hidePhoneViewmodel();
      } else {
        const elapsed = 1750 - remaining;
        const raise = Math.min(1, elapsed / 220);
        const lower = remaining < 280 ? remaining / 280 : 1;
        const k = Math.min(raise, lower);
        const shake = Math.sin(now * 0.05) * 0.005;
        phoneMesh.position.set(
          shake,
          -0.65 + 0.55 * k,
          -0.42
        );
        phoneMesh.rotation.set(
          -0.08 + Math.sin(now * 0.03) * 0.02,
          -0.10 + Math.sin(now * 0.04) * 0.03,
          Math.sin(now * 0.05) * 0.02
        );
      }
    }

    // Police cruisers: drive in, flash sirens, despawn
    const sirenOn = Math.floor(now / 180) % 2 === 0;
    for (let i = policeCruisers.length - 1; i >= 0; i--) {
      const pc = policeCruisers[i];
      const t = Math.min(1, (now - pc.bornAt) / 900);
      const ease = 1 - Math.pow(1 - t, 3);
      pc.mesh.position.x = pc.fromX + (pc.toX - pc.fromX) * ease;
      pc.mesh.userData.sirenRed.material.color.setHex(sirenOn ? 0xff1744 : 0x330000);
      pc.mesh.userData.sirenBlue.material.color.setHex(sirenOn ? 0x001a33 : 0x00b0ff);
      if (now >= pc.expiresAt) {
        scene.remove(pc.mesh);
        policeCruisers.splice(i, 1);
      }
    }

    // Drive-By Cars Animation (Car cruises down middle avenue for 2 full loops)
    for (let i = drivebyCars.length - 1; i >= 0; i--) {
      const db = drivebyCars[i];
      const elapsed = now - db.startTime;
      if (elapsed > db.duration) {
        scene.remove(db.mesh);
        drivebyCars.splice(i, 1);
        continue;
      }

      // Loop progress (0 to 1 every 11000ms - comfortable cruising speed)
      const loopProg = (elapsed % 11000) / 11000;
      // Drives smoothly back and forth down the center street lane
      const pingPong = Math.sin(loopProg * Math.PI * 2);
      const posX = pingPong * 52;
      const posZ = Math.cos(loopProg * Math.PI * 2) * 4;
      const dirX = Math.cos(loopProg * Math.PI * 2);

      db.mesh.position.set(posX, 0, posZ);
      db.mesh.rotation.y = dirX >= 0 ? 0 : Math.PI;

      // Realistic muzzle flashes & gun bursts from the side windows
      if (Math.random() < 0.22) {
        const sideZ = dirX >= 0 ? 1.3 : -1.3;
        spawnImpactParticles(posX, 1.5, posZ + sideZ, 0xffd600, 2);
      }
    }

    // Cop cap siren lights flash
    for (const entry of playersMap.values()) {
      if (entry.isCop && entry.mesh.userData.redLight) {
        entry.mesh.userData.redLight.material.color.setHex(sirenOn ? 0xff1744 : 0x330000);
        entry.mesh.userData.blueLight.material.color.setHex(sirenOn ? 0x001a33 : 0x00b0ff);
      }
    }

    // Update Flying Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.mesh.position.x += pr.velocity.x * dt;
      pr.mesh.position.y += pr.velocity.y * dt;
      pr.mesh.position.z += pr.velocity.z * dt;
      pr.mesh.rotation.x += 12 * dt;
      pr.mesh.rotation.y += 12 * dt;

      if (pr.mesh.position.distanceToSquared(pr.target) < 4.0 || now - pr.bornAt > (pr.isRpg ? 1400 : 900)) {
        if (pr.isRpg) {
          triggerRpgExplosion(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z);
        } else {
          spawnImpactParticles(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, pr.color, 4);
        }
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
      }
    }

    // Update Bouncing Grenades
    for (let i = activeGrenades.length - 1; i >= 0; i--) {
      const g = activeGrenades[i];
      g.vy -= 22 * dt;
      g.mesh.position.x += g.vx * dt;
      g.mesh.position.y += g.vy * dt;
      g.mesh.position.z += g.vz * dt;
      g.mesh.rotation.x += 6 * dt;
      g.mesh.rotation.z += 5 * dt;

      if (g.mesh.position.y < 0.25) {
        g.mesh.position.y = 0.25;
        g.vy = -g.vy * 0.45;
        g.vx *= 0.7;
        g.vz *= 0.7;
      }

      if (now - g.bornAt > 1200) {
        scene.remove(g.mesh);
        activeGrenades.splice(i, 1);
      }
    }

    // Update Impact Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.vy -= 18 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (now - pt.bornAt > 380) {
        scene.remove(pt.mesh);
        particles.splice(i, 1);
      }
    }

    // Send local player transform at 20Hz
    if (now - lastNetSend > 45 && selfId) {
      lastNetSend = now;
      socket.emit('move', {
        x: localPlayer.x,
        y: localPlayer.y,
        z: localPlayer.z,
        yaw: localPlayer.yaw,
        pitch: localPlayer.pitch,
        weapon: localPlayer.weapon
      });
    }

    // Update Top-Right Minimap
    const allForMinimap = new Map();
    for (const [id, ent] of playersMap.entries()) {
      allForMinimap.set(id, ent.data);
    }
    window.HoodHUD.renderMinimap(localPlayer, allForMinimap, MAP_DATA);

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  requestAnimationFrame(animate);
})();
