// Procedural WebAudio Arcade SFX Engine + Spatial 3D Audio Clips
window.HoodAudio = (function () {
  let ctx = null;
  let masterGain = null;
  const audioBuffers = new Map(); // name -> AudioBuffer

  // Catalog of files in /sounds/ mapped to actions & categories
  const SOUND_MANIFEST = {
    // Spawn / Round start
    spawn_welcome: '/sounds/welcome-to-san-andreas-im-cj-from-grove-street.mp3',
    spawn_again_1: '/sounds/ah-shit-here-we-go-again_jyHLMOg.mp3',
    spawn_again_2: '/sounds/gta-san-andreas-ah-shit-here-we-go-again_4WUig8O.mp3',
    spawn_again_3: '/sounds/y2mate_OQnyD9i.mp3',
    spawn_dog: '/sounds/aw-my-dog-whats-up-cj.mp3',

    // Eliminations / Kills / Taunts
    kill_wrong_house: '/sounds/you-picked-the-wrong-house-fool-sound-effect_8qQJFVB.mp3',
    kill_casino: '/sounds/f-you-and-your-casino_zxqltnR.mp3',
    kill_shut_mouth: '/sounds/shut-your-mouth.mp3',
    kill_cj_reactions: '/sounds/cj-reactions.mp3',

    // Deaths / Hurt / Fire / Damage
    death_fire_1: '/sounds/gta-sa-cj-on-fire.mp3',
    death_fire_2: '/sounds/gta-san-andreas-cj-on-fire-sound.mp3',
    hurt_shit: '/sounds/shit-cj-shit.mp3',
    hurt_wtf: '/sounds/cj-wtf.mp3',

    // Grenade / Explosions
    grenade_oh_god: '/sounds/big_smoke_oh_my_god.mp3',
    grenade_throw_1: '/sounds/shit-cj-shit.mp3',

    // Snitch / Cops Pulled Up / Scorestreak
    snitch_pull_up: '/sounds/hey-baby-you-okay-man.mp3',
    cops_action: '/sounds/all-we-had-to-do-was-follow-the-damn-train-cj_720p_hd_2.mp3',
    cops_long: '/sounds/cj2.mp3',
    cj_1: '/sounds/cj_1.mp3',
    cj_r: '/sounds/r.mp3',

    // Rifle Shoot Sounds (Authentic AR & AK-47 Gunshots)
    ar_shooting: '/sounds/ar-shooting-sound.mp3',
    ak47_shooting: '/sounds/ak47-firing-sound.mp3',

    // RPG Launch & Explosion Sounds
    rpg_launch: '/sounds/rocket-launcher.mp3',
    rpg_explosion: '/sounds/explosion-sound.mp3',

    // Drive-By Scorestreak
    driveby_shout: '/sounds/you-picked-the-wrong-house-fool-sound-effect_8qQJFVB.mp3',
    driveby_horn: '/sounds/hey-baby-you-okay-man.mp3'
  };

  const CATEGORIES = {
    spawn: ['spawn_welcome', 'spawn_again_1', 'spawn_again_2', 'spawn_again_3', 'spawn_dog', 'cj_1'],
    kill: ['kill_wrong_house', 'kill_casino', 'kill_shut_mouth', 'kill_cj_reactions'],
    death: ['death_fire_1', 'death_fire_2', 'hurt_shit', 'cj_r'],
    hurt: ['hurt_wtf', 'hurt_shit', 'cj_r'],
    grenade: ['grenade_oh_god', 'grenade_throw_1'],
    snitch: ['snitch_pull_up', 'cops_action', 'cops_long'],
    driveby: ['driveby_shout', 'driveby_horn']
  };

  // HTML5 Audio pool for AR shooting (100% reliable zero-delay hardware fallback)
  const AR_AUDIO_POOL_SIZE = 8;
  const arAudioPool = [];
  try {
    for (let i = 0; i < AR_AUDIO_POOL_SIZE; i++) {
      const aud = new Audio('/sounds/ar-shooting-sound.mp3');
      aud.preload = 'auto';
      aud.volume = 0.22;
      arAudioPool.push(aud);
    }
  } catch (e) {}

  let arPoolIdx = 0;
  function playArAudioDirect() {
    if (arAudioPool.length === 0) return;
    try {
      const aud = arAudioPool[arPoolIdx];
      arPoolIdx = (arPoolIdx + 1) % arAudioPool.length;
      aud.currentTime = 0;
      aud.volume = 0.22;
      aud.play().catch(() => {});
    } catch (e) {}
  }

  // HTML5 Audio pool for AK-47 shooting (Heavy 7.62 Kalashnikov)
  const AK_AUDIO_POOL_SIZE = 8;
  const akAudioPool = [];
  try {
    for (let i = 0; i < AK_AUDIO_POOL_SIZE; i++) {
      const aud = new Audio('/sounds/ak47-firing-sound.mp3');
      aud.preload = 'auto';
      aud.volume = 0.25;
      akAudioPool.push(aud);
    }
  } catch (e) {}

  let akPoolIdx = 0;
  let activeAkAudio = null;

  function playAkAudioDirect() {
    if (akAudioPool.length === 0) return;
    try {
      const aud = akAudioPool[akPoolIdx];
      akPoolIdx = (akPoolIdx + 1) % akAudioPool.length;
      aud.currentTime = 0;
      aud.volume = 0.25;
      aud.play().catch(() => {});
      activeAkAudio = aud;
    } catch (e) {}
  }

  // Active streaming state for local AK-47 gunfire
  let activeAkSource = null;
  let activeAkGain = null;
  let isAkLoopPlaying = false;
  let akLoopTailTimer = null;

  // Remote player / bot AK audio streams: id -> { source, gainNode, stopTimer }
  const remoteAkStreams = new Map();

  function stopAkShoot() {
    if (akLoopTailTimer) {
      clearTimeout(akLoopTailTimer);
      akLoopTailTimer = null;
    }
    const c = ensureCtx();
    if (activeAkGain && c) {
      try {
        const now = c.currentTime;
        activeAkGain.gain.cancelScheduledValues(now);
        activeAkGain.gain.setValueAtTime(activeAkGain.gain.value, now);
        activeAkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch (e) {}
    }
    if (activeAkSource) {
      try {
        activeAkSource.stop(c ? c.currentTime + 0.09 : 0);
      } catch (e) {}
      activeAkSource = null;
    }
    if (activeAkAudio) {
      try {
        activeAkAudio.pause();
        activeAkAudio.currentTime = 0;
      } catch (e) {}
      activeAkAudio = null;
    }
    activeAkGain = null;
    isAkLoopPlaying = false;
  }

  function startOrExtendAkLoop() {
    const c = ensureCtx();
    const now = c ? c.currentTime : 0;

    // Reset silence/tail timer on each continuous shot (stops playing ~200ms after user releases trigger)
    if (akLoopTailTimer) {
      clearTimeout(akLoopTailTimer);
    }
    akLoopTailTimer = setTimeout(() => {
      stopAkShoot();
    }, 220);

    // If loop is already running, just keep it flowing
    if (isAkLoopPlaying && activeAkSource) {
      return;
    }

    isAkLoopPlaying = true;

    if (c && c.state === 'running') {
      const akBuf = audioBuffers.get('ak47_shooting');
      if (akBuf) {
        try {
          const src = c.createBufferSource();
          src.buffer = akBuf;
          src.loop = true; // Seamless continuous Kalashnikov full-mag fire
          src.playbackRate.setValueAtTime(0.98 + Math.random() * 0.04, now);

          const g = c.createGain();
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.26, now + 0.03);

          src.connect(g);
          g.connect(getMaster());
          src.start(now);

          activeAkSource = src;
          activeAkGain = g;
          return;
        } catch (e) {}
      }
    }

    // HTML5 fallback
    playAkAudioDirect();
  }

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.28, ctx.currentTime);
        masterGain.connect(ctx.destination);
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function getMaster() {
    ensureCtx();
    return masterGain || (ctx ? ctx.destination : null);
  }

  // Preload sound files in parallel into WebAudio buffers
  let isPreloading = false;
  async function preloadSounds() {
    const c = ensureCtx();
    if (!c || isPreloading) return;
    isPreloading = true;

    const entries = Object.entries(SOUND_MANIFEST);
    await Promise.all(entries.map(async ([key, url]) => {
      if (audioBuffers.has(key)) return;
      try {
        const resp = await fetch(url);
        if (!resp.ok) return;
        const arrayBuf = await resp.arrayBuffer();
        if (c.decodeAudioData.length === 1) {
          const decoded = await c.decodeAudioData(arrayBuf);
          audioBuffers.set(key, decoded);
        } else {
          c.decodeAudioData(arrayBuf, (decoded) => {
            audioBuffers.set(key, decoded);
          }, () => {});
        }
      } catch (err) {}
    }));
    isPreloading = false;
  }

  // Eager preloading immediately on page load + unlock on user gesture
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => preloadSounds());
    preloadSounds();
    ['click', 'keydown', 'mousedown', 'touchstart', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, () => {
        ensureCtx();
        if (audioBuffers.size < Object.keys(SOUND_MANIFEST).length) {
          preloadSounds();
        }
      }, { passive: true });
    });
  }

  // Proximity Voice Shuffle Cache to prevent back-to-back duplicate clips
  const lastPlayedPerCategory = new Map();
  let globalLastClipTime = 0;

  // Play a sound buffer with calm 3D spatial panning, anti-repeat shuffle & smart rate limiting
  function playPositionalClip(keyOrCategory, worldPos, listenerPos, maxDist = 42, volume = 0.28) {
    const c = ensureCtx();
    if (!c) return;

    const nowSec = performance.now();
    // Global speech cooldown so voice clips don't talk over each other in cacophony
    if (nowSec - globalLastClipTime < 1100) {
      return;
    }

    let key = keyOrCategory;
    if (CATEGORIES[keyOrCategory]) {
      const pool = CATEGORIES[keyOrCategory];
      const lastKey = lastPlayedPerCategory.get(keyOrCategory);
      // Filter out immediately repeated clip if pool has multiple options
      const filtered = pool.filter(k => pool.length <= 1 || k !== lastKey);
      key = filtered[Math.floor(Math.random() * filtered.length)];
      lastPlayedPerCategory.set(keyOrCategory, key);
    }

    globalLastClipTime = nowSec;

    const buffer = audioBuffers.get(key);
    if (!buffer) {
      // Direct HTML5 Audio fallback so voice plays even before WebAudio decode or in edge states
      if (SOUND_MANIFEST[key]) {
        try {
          const a = new Audio(SOUND_MANIFEST[key]);
          a.volume = Math.min(1.0, volume * 1.5);
          a.play().catch(() => {});
        } catch (e) {}
      }
      return;
    }

    const source = c.createBufferSource();
    source.buffer = buffer;

    const gainNode = c.createGain();
    let panX = 0;

    if (worldPos && listenerPos) {
      const dx = worldPos.x - listenerPos.x;
      const dy = (worldPos.y || 0) - (listenerPos.y || 0);
      const dz = worldPos.z - listenerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist > maxDist) return; // Beyond audible range

      // Linear/gentle quadratic roll-off so voice clips remain audible across streets
      const norm = dist / maxDist;
      const atten = Math.max(0.08, Math.pow(1 - norm, 1.4));
      gainNode.gain.setValueAtTime(atten * volume, c.currentTime);

      const yaw = listenerPos.yaw || 0;
      const relX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      panX = Math.max(-0.95, Math.min(0.95, relX / 24));
    } else {
      gainNode.gain.setValueAtTime(volume * 0.95, c.currentTime);
    }

    if (c.createStereoPanner) {
      const panner = c.createStereoPanner();
      panner.pan.setValueAtTime(panX, c.currentTime);
      source.connect(panner);
      panner.connect(gainNode);
    } else {
      source.connect(gainNode);
    }

    gainNode.connect(getMaster());
    source.start(0);
  }

  function isRifle(weaponId) {
    return weaponId === 'cheese_blaster' ||
           weaponId === 'kewi_railgun' ||
           (typeof weaponId === 'string' && (weaponId.includes('rifle') || weaponId.includes('blaster')));
  }

  // Authentic Shoot SFX (Balanced levels, guaranteed rifle gunshot sound)
  function playShoot(weaponId) {
    const c = ensureCtx();

    // 1. AK-47 Assault Rifle: plays continuous full-mag gunfire while trigger is held
    if (weaponId === 'ak47') {
      startOrExtendAkLoop();
      return;
    }

    // 2. Primary Rifles (Cheese Blaster AR, Kewi Primary)
    if (isRifle(weaponId)) {
      if (c && c.state === 'running') {
        const arBuf = audioBuffers.get('ar_shooting');
        if (arBuf) {
          const src = c.createBufferSource();
          src.buffer = arBuf;
          src.playbackRate.setValueAtTime(0.97 + Math.random() * 0.06, c.currentTime);
          const g = c.createGain();
          g.gain.setValueAtTime(0.24, c.currentTime);
          src.connect(g);
          g.connect(getMaster());
          src.start(c.currentTime);
          return;
        }
      }
      // Direct HTML5 audio fallback if WebAudio buffer still loading
      playArAudioDirect();
      return;
    }

    if (!c) return;
    const now = c.currentTime;

    // 2. RPG Launch
    if (weaponId === 'rpg') {
      const rBuf = audioBuffers.get('rpg_launch');
      if (rBuf) {
        const src = c.createBufferSource();
        src.buffer = rBuf;
        const g = c.createGain();
        g.gain.setValueAtTime(0.26, now);
        src.connect(g);
        g.connect(getMaster());
        src.start(now);
        return;
      }
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(35, now + 0.3);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      osc.connect(gain);
      gain.connect(getMaster());
      osc.start(now);
      osc.stop(now + 0.33);
      return;
    }

    // 3. Vintage 1911 Pistol
    if (weaponId === 'pistol_1911') {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(getMaster());
      osc.start(now);
      osc.stop(now + 0.09);
      return;
    }

    // 4. Fallback Shot
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 3D Spatial gunshot for remote players & bots (subdued distance mix)
  function playShootPositional(weaponId, worldPos, listenerPos, entityId = null) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;

    if (!worldPos || !listenerPos) {
      playShoot(weaponId);
      return;
    }

    const dx = worldPos.x - listenerPos.x;
    const dy = (worldPos.y || 0) - (listenerPos.y || 0);
    const dz = worldPos.z - listenerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const maxDist = 36;
    if (dist > maxDist) return; // Beyond audible distance

    const normDist = dist / maxDist;
    const atten = Math.max(0.01, Math.pow(1 - normDist, 2));

    let panX = 0;
    const yaw = listenerPos.yaw || 0;
    const relX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    panX = Math.max(-0.95, Math.min(0.95, relX / 20));

    // For AK-47, don't spawn overlapping 2-second sounds per bullet: sustain loop per entity
    if (weaponId === 'ak47') {
      const eKey = entityId || `${Math.round(worldPos.x)}_${Math.round(worldPos.z)}`;
      let stream = remoteAkStreams.get(eKey);
      if (stream) {
        clearTimeout(stream.stopTimer);
        stream.stopTimer = setTimeout(() => {
          try {
            stream.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
            stream.src.stop(c.currentTime + 0.09);
          } catch (e) {}
          remoteAkStreams.delete(eKey);
        }, 220);
        // update spatial volume/pan in-flight
        try {
          stream.gain.gain.setValueAtTime(atten * 0.18, now);
          if (stream.panner) stream.panner.pan.setValueAtTime(panX, now);
        } catch (e) {}
        return;
      }

      const akBuf = audioBuffers.get('ak47_shooting') || audioBuffers.get('ar_shooting');
      if (akBuf) {
        try {
          const src = c.createBufferSource();
          src.buffer = akBuf;
          src.loop = true;
          src.playbackRate.setValueAtTime(0.96 + Math.random() * 0.05, now);
          const gainNode = c.createGain();
          gainNode.gain.setValueAtTime(atten * 0.18, now);
          let panner = null;
          if (c.createStereoPanner) {
            panner = c.createStereoPanner();
            panner.pan.setValueAtTime(panX, now);
            src.connect(panner);
            panner.connect(gainNode);
          } else {
            src.connect(gainNode);
          }
          gainNode.connect(getMaster());
          src.start(now);

          const stopTimer = setTimeout(() => {
            try {
              gainNode.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
              src.stop(c.currentTime + 0.09);
            } catch (e) {}
            remoteAkStreams.delete(eKey);
          }, 220);

          remoteAkStreams.set(eKey, { src, gain: gainNode, panner, stopTimer });
          return;
        } catch (e) {}
      }
    }

    let buffer = null;
    if (weaponId === 'ak47') {
      buffer = audioBuffers.get('ak47_shooting') || audioBuffers.get('ar_shooting');
    } else if (isRifle(weaponId)) {
      buffer = audioBuffers.get('ar_shooting');
    } else if (weaponId === 'rpg') {
      buffer = audioBuffers.get('rpg_launch');
    }

    if (buffer) {
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(0.95 + Math.random() * 0.1, now);
      const gainNode = c.createGain();
      gainNode.gain.setValueAtTime(atten * 0.16, now);

      if (c.createStereoPanner) {
        const panner = c.createStereoPanner();
        panner.pan.setValueAtTime(panX, now);
        src.connect(panner);
        panner.connect(gainNode);
      } else {
        src.connect(gainNode);
      }
      gainNode.connect(getMaster());
      src.start(now);
      return;
    }

    // Procedural distant pop
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);
    g.gain.setValueAtTime(atten * 0.10, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(g);
    g.connect(getMaster());
    osc.start(now);
    osc.stop(now + 0.07);
  }

  function playHitmarker(isHeadshot = false) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 1400 : 980, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 1900 : 650, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function playExplosion(x, y, z) {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;

    const expBuf = audioBuffers.get('rpg_explosion');
    if (expBuf) {
      const src = c.createBufferSource();
      src.buffer = expBuf;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.24, now);
      src.connect(gain);
      gain.connect(getMaster());
      src.start(now);
      return;
    }

    const bufferSize = Math.floor(c.sampleRate * 0.35);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.1));
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);
    filter.frequency.linearRampToValueAtTime(80, now + 0.3);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getMaster());
    noise.start(now);
  }

  function playJumpPad() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.22);
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(now);
    osc.stop(now + 0.25);
  }

  function playUlt() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.08, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
      osc.connect(gain);
      gain.connect(getMaster());
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.24);
    });
  }

  function playSnitchCall() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;

    const tones = [
      [852, 1477, 0.0],
      [697, 1209, 0.12],
      [697, 1209, 0.24]
    ];
    tones.forEach(([f1, f2, offset]) => {
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const g = c.createGain();
      o1.type = 'sine';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(f1, now + offset);
      o2.frequency.setValueAtTime(f2, now + offset);
      g.gain.setValueAtTime(0.08, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);
      o1.connect(g);
      o2.connect(g);
      g.connect(getMaster());
      o1.start(now + offset);
      o2.start(now + offset);
      o1.stop(now + offset + 0.10);
      o2.stop(now + offset + 0.10);
    });

    const siren = c.createOscillator();
    const sGain = c.createGain();
    siren.type = 'triangle';
    const sStart = now + 0.85;
    siren.frequency.setValueAtTime(600, sStart);
    siren.frequency.linearRampToValueAtTime(1100, sStart + 0.3);
    siren.frequency.linearRampToValueAtTime(600, sStart + 0.6);
    sGain.gain.setValueAtTime(0.11, sStart);
    sGain.gain.exponentialRampToValueAtTime(0.001, sStart + 0.65);
    siren.connect(sGain);
    sGain.connect(getMaster());
    siren.start(sStart);
    siren.stop(sStart + 0.7);
  }

  function playEngineSound() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.35);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.75);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.9);

    osc.connect(gain);
    gain.connect(getMaster());
    osc.start(now);
    osc.stop(now + 0.95);
  }

  function playTireScreech() {
    const c = ensureCtx();
    if (!c) return;
    const now = c.currentTime;
    const bufferSize = Math.floor(c.sampleRate * 0.35);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / 15);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(5, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getMaster());
    noise.start(now);
  }

  return {
    preloadSounds,
    playPositionalClip,
    playShoot,
    stopAkShoot,
    playShootPositional,
    playHitmarker,
    playExplosion,
    playJumpPad,
    playUlt,
    playSnitchCall,
    playEngineSound,
    playTireScreech
  };
})();
