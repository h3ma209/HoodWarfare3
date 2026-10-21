const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MAP_DATA } = require('./public/js/mapData.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Optimized Static Asset Caching & Headers
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build'), {
  maxAge: '7d',
  immutable: true
}));

app.use('/sounds', express.static(path.join(__dirname, 'public/sounds'), {
  maxAge: '1d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true
}));

const PORT = process.env.PORT || 3000;

const BOT_NAMES = {
  biggie: ['Biggie_Boi', 'Biggie_Fan', 'Cheddar_Don', 'Gouda_Goon', 'Nacho_Libre', 'Parmesan_Pete', 'Queso_King', 'Brie_Baron'],
  kewi: ['Kewi_Stomper', 'Kewi_Master', 'Rza_Tactical', 'Fuzzy_Sniper', 'Green_Beret', 'Kiwi_Commando', 'Jungle_Fox', 'Viper_Rza']
};

function getRandomSpawn(team) {
  const list = MAP_DATA.SPAWNS[team] || MAP_DATA.SPAWNS.biggie;
  const pt = list[Math.floor(Math.random() * list.length)];
  return {
    x: pt.x + (Math.random() - 0.5) * 2.5,
    y: 0,
    z: pt.z + (Math.random() - 0.5) * 2.5,
    yaw: pt.yaw
  };
}

function createPlayerObj(id, name, team, isBot = false) {
  const spawn = getRandomSpawn(team);
  const defaultWeapon = team === 'biggie' ? 'cheese_blaster' : 'kewi_railgun';
  return {
    id,
    name,
    team,
    isBot,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: spawn.yaw,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    weapon: defaultWeapon,
    kills: 0,
    deaths: 0,
    killStreak: 0,
    isCop: false,
    expiresAt: 0,
    ultCharge: 40,
    overchargedUntil: 0,
    respawnAt: 0,
    // Bot AI state
    botTargetX: 0,
    botTargetZ: 0,
    botNextMoveAt: 0,
    botLastShotAt: 0,
    botLastGrenadeAt: 0,
    botStrafeDir: 1
  };
}

function resolveHorizontalCollision(x, z, y, radius = 0.65) {
  let nx = x;
  let nz = z;
  for (const c of MAP_DATA.COLLIDERS) {
    const minY = c.y - c.h / 2;
    const maxY = c.y + c.h / 2;
    if (y + 1.8 <= minY || y >= maxY) continue;

    const halfW = c.w / 2 + radius;
    const halfD = c.d / 2 + radius;
    const dx = nx - c.x;
    const dz = nz - c.z;
    if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
      const overlapX = halfW - Math.abs(dx);
      const overlapZ = halfD - Math.abs(dz);
      if (overlapX < overlapZ) {
        nx += dx >= 0 ? overlapX : -overlapX;
      } else {
        nz += dz >= 0 ? overlapZ : -overlapZ;
      }
    }
  }
  return { x: nx, z: nz };
}

function hasLineOfSight(x1, y1, z1, x2, y2, z2) {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const pz = z1 + (z2 - z1) * t;
    for (const c of MAP_DATA.COLLIDERS) {
      if (c.type !== 'building' && c.type !== 'subway_wall' && c.type !== 'house' && c.type !== 'spawn_barrier') continue;
      if (
        px >= c.x - c.w / 2 && px <= c.x + c.w / 2 &&
        py >= c.y - c.h / 2 && py <= c.y + c.h / 2 &&
        pz >= c.z - c.d / 2 && pz <= c.z + c.d / 2
      ) {
        return false;
      }
    }
  }
  return true;
}

// ==================== ROOM CLASS ====================
class Room {
  constructor(code, name = 'Hood Turf', settings = {}) {
    this.code = (code || 'HOOD').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) || 'HOOD';
    this.name = (name || 'Hood Turf').trim().slice(0, 24);
    this.settings = {
      botsPerTeam: typeof settings.botsPerTeam === 'number' ? Math.max(0, Math.min(8, settings.botsPerTeam)) : 3,
      scoreLimit: typeof settings.scoreLimit === 'number' ? Math.max(10, Math.min(200, settings.scoreLimit)) : 75,
      roundDurationSec: typeof settings.roundDurationSec === 'number' ? Math.max(60, settings.roundDurationSec) : 300
    };
    this.matchState = {
      biggieScore: 0,
      kewiScore: 0,
      timeLeft: this.settings.roundDurationSec,
      status: 'playing',
      winner: null,
      turfOwner: null,
      turfProgress: 0,
      roomCode: this.code,
      roomName: this.name,
      settings: this.settings
    };
    this.players = new Map();
    this.emptySince = null;
    this.lastSecTick = Date.now();
    this.drivebyActive = false;
  }

  broadcast(event, data) {
    io.to(this.code).emit(event, data);
  }

  getHumansCount() {
    let count = 0;
    for (const p of this.players.values()) {
      if (!p.isBot) count++;
    }
    return count;
  }

  pickBalancedTeam() {
    let biggieCount = 0;
    let kewiCount = 0;
    for (const p of this.players.values()) {
      if (!p.isBot) {
        if (p.team === 'biggie') biggieCount++;
        else kewiCount++;
      }
    }
    return biggieCount <= kewiCount ? 'biggie' : 'kewi';
  }

  syncBots() {
    const targetBots = this.settings.botsPerTeam;
    for (const team of ['biggie', 'kewi']) {
      const teamHumans = Array.from(this.players.values()).filter(p => !p.isBot && p.team === team).length;
      const teamBots = Array.from(this.players.values()).filter(p => p.isBot && !p.isCop && p.team === team);
      const desiredBots = targetBots <= 0 ? 0 : Math.max(0, targetBots - Math.max(0, teamHumans - 1));

      while (teamBots.length < desiredBots) {
        const botIndex = teamBots.length;
        const botId = `bot_${this.code}_${team}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const usedNames = new Set(Array.from(this.players.values()).map(p => p.name));
        const pool = BOT_NAMES[team];
        let botName = pool.find(n => !usedNames.has(n)) || `${team === 'biggie' ? 'Biggie' : 'Kewi'}_Bot_${botIndex + 1}`;
        const bot = createPlayerObj(botId, botName, team, true);
        this.players.set(botId, bot);
        teamBots.push(bot);
      }

      while (teamBots.length > desiredBots) {
        const removed = teamBots.pop();
        if (removed) {
          this.players.delete(removed.id);
          this.broadcast('playerLeft', { id: removed.id });
        }
      }
    }
  }

  addPlayer(socket, name, team) {
    socket.join(this.code);
    socket.roomCode = this.code;
    const finalTeam = (team === 'biggie' || team === 'kewi') ? team : this.pickBalancedTeam();
    const finalName = (name && typeof name === 'string') ? name.trim().slice(0, 16) || 'Hustler' : 'Hustler';

    let p = this.players.get(socket.id);
    if (!p) {
      p = createPlayerObj(socket.id, finalName, finalTeam, false);
      this.players.set(socket.id, p);
    } else {
      p.name = finalName;
      p.team = finalTeam;
      p.weapon = p.team === 'biggie' ? 'cheese_blaster' : 'kewi_railgun';
    }

    const sp = getRandomSpawn(p.team);
    p.x = sp.x;
    p.y = sp.y;
    p.z = sp.z;
    p.yaw = sp.yaw;
    p.hp = p.maxHp;
    p.alive = true;
    p.respawnAt = 0;

    this.syncBots();
    this.emptySince = null;

    socket.emit('roomJoined', {
      roomCode: this.code,
      roomName: this.name,
      settings: this.settings,
      matchState: this.matchState,
      selfId: socket.id,
      player: p,
      players: Array.from(this.players.values())
    });

    this.broadcast('playerJoined', p);
    this.broadcast('rosterUpdate', {
      players: Array.from(this.players.values()),
      targetBotsPerTeam: this.settings.botsPerTeam,
      settings: this.settings
    });
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (p) {
      this.players.delete(socketId);
      this.broadcast('playerLeft', { id: socketId });
      this.syncBots();
      this.broadcast('rosterUpdate', {
        players: Array.from(this.players.values()),
        targetBotsPerTeam: this.settings.botsPerTeam,
        settings: this.settings
      });
    }
    if (this.getHumansCount() === 0) {
      this.emptySince = Date.now();
    }
  }

  updateSettings(newSettings = {}) {
    if (typeof newSettings.botsPerTeam === 'number') {
      this.settings.botsPerTeam = Math.max(0, Math.min(8, newSettings.botsPerTeam));
    }
    if (typeof newSettings.scoreLimit === 'number') {
      this.settings.scoreLimit = Math.max(10, Math.min(200, newSettings.scoreLimit));
    }
    if (typeof newSettings.roundDurationSec === 'number') {
      this.settings.roundDurationSec = Math.max(60, newSettings.roundDurationSec);
    }
    this.matchState.settings = this.settings;
    this.syncBots();
    this.broadcast('settingsUpdated', {
      settings: this.settings,
      matchState: this.matchState
    });
    this.broadcast('rosterUpdate', {
      players: Array.from(this.players.values()),
      targetBotsPerTeam: this.settings.botsPerTeam,
      settings: this.settings
    });
  }

  resetMatch() {
    this.matchState.biggieScore = 0;
    this.matchState.kewiScore = 0;
    this.matchState.timeLeft = this.settings.roundDurationSec;
    this.matchState.status = 'playing';
    this.matchState.winner = null;
    this.matchState.turfOwner = null;
    this.matchState.turfProgress = 0;

    for (const p of this.players.values()) {
      if (p.isCop) {
        this.players.delete(p.id);
        this.broadcast('playerLeft', { id: p.id });
        continue;
      }
      p.hp = p.maxHp;
      p.alive = true;
      p.respawnAt = 0;
      p.kills = 0;
      p.deaths = 0;
      p.killStreak = 0;
      const sp = getRandomSpawn(p.team);
      p.x = sp.x;
      p.y = sp.y;
      p.z = sp.z;
      p.yaw = sp.yaw;
    }

    this.broadcast('matchReset', { matchState: this.matchState });
  }

  addTeamScore(team, points = 1) {
    if (this.matchState.status !== 'playing') return;
    if (team === 'biggie') this.matchState.biggieScore += points;
    if (team === 'kewi') this.matchState.kewiScore += points;

    const limit = this.settings.scoreLimit;
    if (this.matchState.biggieScore >= limit || this.matchState.kewiScore >= limit) {
      this.matchState.status = 'ended';
      this.matchState.winner = this.matchState.biggieScore >= limit ? 'biggie' : 'kewi';
      this.broadcast('matchEnded', this.matchState);
      setTimeout(() => {
        if (this.matchState.status === 'ended') this.resetMatch();
      }, 6000);
    }
  }

  applyDamage(attacker, victim, amount, weaponName, isHeadshot = false) {
    if (!victim || !victim.alive || this.matchState.status !== 'playing') return;
    if (attacker && attacker.team === victim.team && attacker.id !== victim.id) return;

    let finalDmg = amount;
    if (attacker && attacker.overchargedUntil > Date.now()) {
      finalDmg = Math.round(finalDmg * 1.35);
    }
    if (victim.overchargedUntil > Date.now()) {
      finalDmg = Math.round(finalDmg * 0.75);
    }

    victim.hp = Math.max(0, victim.hp - finalDmg);
    if (attacker && attacker.id !== victim.id) {
      attacker.ultCharge = Math.min(100, (attacker.ultCharge || 0) + Math.round(finalDmg * 0.45));
    }

    this.broadcast('playerDamaged', {
      victimId: victim.id,
      attackerId: attacker ? attacker.id : null,
      hp: victim.hp,
      damage: finalDmg,
      isHeadshot,
      x: victim.x,
      y: victim.y + 1.5,
      z: victim.z
    });

    // Hurt reaction voicelines (CJ wtf / shit) on taking heavy damage (tasteful 16% rate)
    if (victim.hp > 0 && Math.random() < 0.16) {
      this.broadcast('spatialSound', {
        category: 'hurt',
        x: victim.x,
        y: victim.y + 1.2,
        z: victim.z
      });
    }

    if (victim.hp <= 0) {
      victim.alive = false;
      victim.deaths += 1;
      victim.killStreak = 0;

      if (victim.isCop) {
        setTimeout(() => {
          this.players.delete(victim.id);
          this.broadcast('playerLeft', { id: victim.id });
        }, 600);
      } else {
        victim.respawnAt = Date.now() + 3000;
      }

      if (attacker && attacker.id !== victim.id) {
        attacker.kills += 1;
        attacker.killStreak = (attacker.killStreak || 0) + 1;
        attacker.ultCharge = Math.min(100, (attacker.ultCharge || 0) + 25);
        this.addTeamScore(attacker.team, 1);
      }

      // Death & Kill GTA CJ Voicelines (randomized ~25% frequency so it doesn't overwhelm)
      if (Math.random() < 0.28) {
        this.broadcast('spatialSound', {
          category: 'death',
          x: victim.x,
          y: victim.y + 1.2,
          z: victim.z
        });
      } else if (attacker && Math.random() < 0.22) {
        this.broadcast('spatialSound', {
          category: 'kill',
          x: attacker.x,
          y: attacker.y + 1.2,
          z: attacker.z
        });
      }

      const verbs = weaponName === 'Cheese Grenade' || weaponName === 'Kiwi Frag'
        ? ['splattered', 'blasted', 'cooked']
        : (attacker && attacker.isCop)
          ? ['busted', 'arrested', 'locked up']
          : ['eliminated', 'tagged', 'smoked', 'dropped'];
      const verb = isHeadshot ? 'HEADSHOT' : verbs[Math.floor(Math.random() * verbs.length)];

      let knockbackDir = { x: 0, z: -1 };
      if (attacker && attacker.id !== victim.id) {
        const kdx = victim.x - attacker.x;
        const kdz = victim.z - attacker.z;
        const klen = Math.hypot(kdx, kdz) || 1;
        knockbackDir = { x: kdx / klen, z: kdz / klen };
      } else {
        const yaw = victim.yaw || 0;
        knockbackDir = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      }

      const isHeavyKill = Boolean(
        isHeadshot ||
        (weaponName && (
          weaponName.includes('RPG') ||
          weaponName.includes('Rocket') ||
          weaponName.includes('Shotty') ||
          weaponName.includes('Shotgun') ||
          weaponName.includes('Grenade')
        ))
      );

      this.broadcast('killFeed', {
        killerId: attacker ? attacker.id : victim.id,
        killerName: attacker ? attacker.name : 'The Street',
        killerTeam: attacker ? attacker.team : victim.team,
        victimId: victim.id,
        victimName: victim.name,
        victimTeam: victim.team,
        weapon: weaponName,
        verb,
        isHeadshot,
        isHeavyKill,
        knockbackDir,
        biggieScore: this.matchState.biggieScore,
        kewiScore: this.matchState.kewiScore
      });
    }
  }

  callDriveby(player) {
    if (!player || !player.alive || this.matchState.status !== 'playing' || this.drivebyActive) return;
    this.drivebyActive = true;

    this.broadcast('drivebyStarted', {
      callerId: player.id,
      callerName: player.name,
      team: player.team
    });

    const drivebyStart = Date.now();
    const drivebyInterval = setInterval(() => {
      const elapsed = Date.now() - drivebyStart;
      if (elapsed > 22000 || this.matchState.status !== 'playing') {
        clearInterval(drivebyInterval);
        this.drivebyActive = false;
        return;
      }

      const enemies = Array.from(this.players.values()).filter(t => t.alive && t.team !== player.team);
      if (enemies.length > 0) {
        const victim = enemies[Math.floor(Math.random() * enemies.length)];
        const loopProg = (elapsed % 11000) / 11000;
        const carX = Math.sin(loopProg * Math.PI * 2) * 52;
        const carZ = 0;

        this.broadcast('playerShot', {
          shooterId: player.id,
          team: player.team,
          weapon: 'ak47',
          origin: { x: carX, y: 1.5, z: carZ },
          dir: { x: victim.x - carX, y: 0.5, z: victim.z - carZ },
          hitPoint: { x: victim.x, y: victim.y + 1.0, z: victim.z }
        });

        this.applyDamage(player, victim, 22, 'Gang Drive-By AK-47', false);
      }
    }, 550);
  }

  callSnitch(player) {
    if (!player || !player.alive || this.matchState.status !== 'playing') return;
    player.killStreak = Math.max(0, (player.killStreak || 0) - 2);

    const cruiserX = Math.max(-28, Math.min(28, player.x + (player.team === 'biggie' ? 6 : -6)));
    const cruiserZ = Math.max(-14, Math.min(14, player.z));
    const cruiserYaw = player.team === 'biggie' ? 0 : Math.PI;

    this.broadcast('snitchCalled', {
      callerId: player.id,
      callerName: player.name,
      team: player.team,
      cruiserX,
      cruiserZ,
      cruiserYaw
    });

    this.broadcast('spatialSound', {
      category: 'snitch',
      x: cruiserX,
      y: 0,
      z: cruiserZ
    });

    setTimeout(() => {
      if (this.matchState.status !== 'playing') return;
      const copNames = ['🚔 Officer_Donut', '🚔 Officer_Sirens'];
      copNames.forEach((cName, idx) => {
        const copId = `cop_${this.code}_${Date.now()}_${idx}`;
        const cop = createPlayerObj(copId, cName, player.team, true);
        cop.isCop = true;
        cop.hp = 150;
        cop.maxHp = 150;
        cop.expiresAt = Date.now() + 18000;
        cop.x = cruiserX + (idx === 0 ? -1.8 : 1.8);
        cop.z = cruiserZ + (player.team === 'biggie' ? 1.5 : -1.5);
        this.players.set(copId, cop);
        this.broadcast('playerJoined', cop);
      });
      this.broadcast('rosterUpdate', {
        players: Array.from(this.players.values()),
        targetBotsPerTeam: this.settings.botsPerTeam,
        settings: this.settings
      });
    }, 950);
  }

  tick(now, dt) {
    // 1-second interval timer sync
    if (now - this.lastSecTick >= 1000) {
      this.lastSecTick = now;
      if (this.matchState.status === 'playing' && this.settings.roundDurationSec < 9000) {
        this.matchState.timeLeft = Math.max(0, this.matchState.timeLeft - 1);
        if (this.matchState.timeLeft <= 0) {
          this.matchState.status = 'ended';
          this.matchState.winner = this.matchState.biggieScore > this.matchState.kewiScore ? 'biggie' : 'kewi';
          this.broadcast('matchEnded', this.matchState);
          setTimeout(() => {
            if (this.matchState.status === 'ended') this.resetMatch();
          }, 6000);
        }
      }
      this.broadcast('timerSync', {
        timeLeft: this.matchState.timeLeft,
        biggieScore: this.matchState.biggieScore,
        kewiScore: this.matchState.kewiScore,
        turfStatus: 'THE BLOCK: CONTESTED'
      });
    }

    // Respawn & Cops lifetime
    for (const [id, p] of this.players.entries()) {
      if (p.isCop && p.expiresAt && now >= p.expiresAt) {
        this.players.delete(id);
        this.broadcast('playerLeft', { id });
        continue;
      }

      if (!p.alive && p.respawnAt && now >= p.respawnAt) {
        const sp = getRandomSpawn(p.team);
        p.x = sp.x;
        p.y = sp.y;
        p.z = sp.z;
        p.yaw = sp.yaw;
        p.hp = p.maxHp;
        p.alive = true;
        p.respawnAt = 0;
        this.broadcast('playerRespawned', {
          id: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
          yaw: p.yaw,
          hp: p.hp
        });
        if (Math.random() < 0.20) {
          this.broadcast('spatialSound', {
            category: 'spawn',
            x: p.x,
            y: p.y + 1.2,
            z: p.z
          });
        }
      }

      // Bot AI
      if (p.isBot && p.alive && this.matchState.status === 'playing') {
        let nearestEnemy = null;
        let nearestDist = Infinity;

        for (const other of this.players.values()) {
          if (!other.alive || other.team === p.team) continue;
          const dx = other.x - p.x;
          const dz = other.z - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < nearestDist && dist < 75) {
            if (hasLineOfSight(p.x, p.y + 1.5, p.z, other.x, other.y + 1.4, other.z)) {
              nearestDist = dist;
              nearestEnemy = other;
            }
          }
        }

        if (now >= p.botNextMoveAt) {
          p.botNextMoveAt = now + 1200 + Math.random() * 1000;
          p.botStrafeDir = Math.random() > 0.5 ? 1 : -1;
          const biasX = p.team === 'biggie' ? -15 + Math.random() * 14 : 15 - Math.random() * 14;
          const biasZ = (Math.random() - 0.5) * 20;
          p.botTargetX = biasX;
          p.botTargetZ = biasZ;
        }

        const speed = 7.5 * (50 / 1000);
        if (nearestEnemy) {
          const dx = nearestEnemy.x - p.x;
          const dz = nearestEnemy.z - p.z;
          p.yaw = Math.atan2(-dx, -dz);
          p.pitch = Math.atan2((nearestEnemy.y + 1.2) - (p.y + 1.4), nearestDist);

          const strafeAngle = p.yaw + (Math.PI / 2) * p.botStrafeDir;
          let moveX = p.x - Math.sin(strafeAngle) * speed * 0.85;
          let moveZ = p.z - Math.cos(strafeAngle) * speed * 0.85;
          if (nearestDist > 16) {
            moveX += (dx / nearestDist) * speed * 0.65;
            moveZ += (dz / nearestDist) * speed * 0.65;
          }
          const resolved = resolveHorizontalCollision(moveX, moveZ, p.y);
          p.x = Math.max(-45, Math.min(45, resolved.x));
          p.z = Math.max(-32, Math.min(32, resolved.z));

          const fireCooldown = p.team === 'biggie' ? 240 : 330;
          if (now - p.botLastShotAt >= fireCooldown) {
            p.botLastShotAt = now;
            const aimSpread = 0.06;
            const dirX = (dx / nearestDist) + (Math.random() - 0.5) * aimSpread;
            const dirY = (((nearestEnemy.y + 1.2) - (p.y + 1.4)) / nearestDist) + (Math.random() - 0.5) * aimSpread;
            const dirZ = (dz / nearestDist) + (Math.random() - 0.5) * aimSpread;

            const hitChance = Math.max(0.24, 0.55 - nearestDist * 0.005);
            const didHit = Math.random() < hitChance;

            this.broadcast('playerShot', {
              shooterId: p.id,
              team: p.team,
              weapon: p.weapon,
              origin: { x: p.x, y: p.y + 1.35, z: p.z },
              dir: { x: dirX, y: dirY, z: dirZ },
              hitPoint: didHit
                ? { x: nearestEnemy.x, y: nearestEnemy.y + 1.2, z: nearestEnemy.z }
                : { x: p.x + dirX * 32, y: Math.max(0.2, p.y + 1.35 + dirY * 32), z: p.z + dirZ * 32 }
            });

            if (didHit) {
              const wCfg = MAP_DATA.WEAPONS[p.weapon];
              const botDmg = Math.round(wCfg.damage * 0.45);
              this.applyDamage(p, nearestEnemy, botDmg, wCfg.name, false);
            }
          }

          if (now - (p.botLastGrenadeAt || 0) > 8500 && Math.random() < 0.04) {
            p.botLastGrenadeAt = now;
            const gId = `bgren_${now}_${Math.random().toString(36).slice(2, 5)}`;
            const gType = p.team === 'biggie' ? 'Cheese Grenade' : 'Kiwi Frag';
            if (Math.random() < 0.18) {
              this.broadcast('spatialSound', {
                category: 'grenade',
                x: p.x,
                y: p.y + 1.6,
                z: p.z
              });
            }
            this.broadcast('grenadeThrown', {
              id: gId,
              ownerId: p.id,
              team: p.team,
              name: gType,
              origin: { x: p.x, y: p.y + 1.6, z: p.z },
              velocity: {
                x: (dx / nearestDist) * 18,
                y: 6.5,
                z: (dz / nearestDist) * 18
              }
            });
            setTimeout(() => {
              this.broadcast('grenadeExplode', {
                id: gId,
                ownerId: p.id,
                team: p.team,
                x: nearestEnemy.x + (Math.random() - 0.5) * 3,
                y: 0.4,
                z: nearestEnemy.z + (Math.random() - 0.5) * 3
              });
            }, 1200);
          }
        } else {
          const dx = p.botTargetX - p.x;
          const dz = p.botTargetZ - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 1.2) {
            p.yaw = Math.atan2(-dx, -dz);
            p.pitch = 0;
            const resolved = resolveHorizontalCollision(
              p.x + (dx / dist) * speed,
              p.z + (dz / dist) * speed,
              p.y
            );
            p.x = Math.max(-45, Math.min(45, resolved.x));
            p.z = Math.max(-32, Math.min(32, resolved.z));
          }
        }
      }
    }

    const snapshotPayload = {
      players: Array.from(this.players.values()),
      matchState: this.matchState,
      roomCode: this.code
    };
    this.broadcast('worldState', snapshotPayload);
    this.broadcast('snapshot', snapshotPayload);
  }
}

// ==================== ROOM REGISTRY ====================
const rooms = new Map();
const defaultRoom = new Room('HOOD', 'Public Hood Turf', {
  botsPerTeam: 3,
  scoreLimit: 75,
  roundDurationSec: 300
});
rooms.set('HOOD', defaultRoom);

function getOrCreateRoom(code, name, settings) {
  const c = (code || 'HOOD').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) || 'HOOD';
  let r = rooms.get(c);
  if (!r) {
    r = new Room(c, name, settings);
    rooms.set(c, r);
  } else if (settings && Object.keys(settings).length > 0) {
    r.updateSettings(settings);
  }
  return r;
}

function findSocketRoom(socket) {
  if (socket.roomCode && rooms.has(socket.roomCode)) {
    return rooms.get(socket.roomCode);
  }
  return null;
}

// ==================== SOCKET.IO DISPATCHER ====================
io.on('connection', (socket) => {
  // Client requesting room list or room info
  socket.on('getRoomInfo', (code, callback) => {
    const c = (code || 'HOOD').toUpperCase().trim();
    const r = rooms.get(c);
    if (r) {
      if (typeof callback === 'function') {
        callback({
          exists: true,
          code: r.code,
          name: r.name,
          settings: r.settings,
          playerCount: r.getHumansCount()
        });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ exists: false, code: c });
      }
    }
  });

  // Join or Create Room
  socket.on('joinRoom', (data = {}) => {
    const prevRoom = findSocketRoom(socket);
    if (prevRoom) {
      prevRoom.removePlayer(socket.id);
      socket.leave(prevRoom.code);
    }

    const roomCode = (data.roomCode || 'HOOD').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) || 'HOOD';
    const room = getOrCreateRoom(roomCode, data.roomName || `${roomCode} Turf`, data.settings);
    room.addPlayer(socket, data.name, data.team);
  });

  socket.on('createRoom', (data = {}) => {
    const prevRoom = findSocketRoom(socket);
    if (prevRoom) {
      prevRoom.removePlayer(socket.id);
      socket.leave(prevRoom.code);
    }

    const roomCode = (data.roomCode || '').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '').slice(0, 10) ||
      `H${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const room = new Room(roomCode, data.roomName || `${roomCode} Turf`, data.settings);
    rooms.set(roomCode, room);
    room.addPlayer(socket, data.name, data.team);
  });

  // Quick Play (default HOOD room)
  socket.on('quickPlay', (data = {}) => {
    const prevRoom = findSocketRoom(socket);
    if (prevRoom) {
      prevRoom.removePlayer(socket.id);
      socket.leave(prevRoom.code);
    }
    defaultRoom.addPlayer(socket, data.name, data.team);
  });

  // Legacy fallback joinGame event
  socket.on('joinGame', (data = {}) => {
    const room = findSocketRoom(socket) || defaultRoom;
    room.addPlayer(socket, data.name, data.team);
  });

  socket.on('updateRoomSettings', (settings) => {
    const room = findSocketRoom(socket);
    if (room) {
      room.updateSettings(settings);
    }
  });

  socket.on('setBots', (count) => {
    const room = findSocketRoom(socket);
    if (room) {
      room.updateSettings({ botsPerTeam: parseInt(count, 10) || 0 });
    }
  });

  socket.on('resetMatch', () => {
    const room = findSocketRoom(socket);
    if (room) {
      room.resetMatch();
    }
  });

  socket.on('move', (state) => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    if (typeof state.x === 'number') p.x = Math.max(-58, Math.min(58, state.x));
    if (typeof state.y === 'number') p.y = Math.max(0, Math.min(30, state.y));
    if (typeof state.z === 'number') p.z = Math.max(-43, Math.min(43, state.z));
    if (typeof state.yaw === 'number') p.yaw = state.yaw;
    if (typeof state.pitch === 'number') p.pitch = state.pitch;
    if (typeof state.weapon === 'string') p.weapon = state.weapon;
  });

  socket.on('shoot', (shot) => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || room.matchState.status !== 'playing') return;

    room.broadcast('playerShot', {
      shooterId: p.id,
      team: p.team,
      weapon: shot.weapon || p.weapon,
      origin: shot.origin,
      dir: shot.dir,
      hitPoint: shot.hitPoint
    });

    // 1. RPG-7 Splash & Explosion Damage
    if (shot.weapon === 'rpg' && shot.hitPoint) {
      room.broadcast('rpgExplode', {
        x: shot.hitPoint.x,
        y: shot.hitPoint.y,
        z: shot.hitPoint.z
      });

      const blastRadius = 9.5;
      for (const target of room.players.values()) {
        if (!target.alive || target.team === p.team) continue;
        const dx = target.x - shot.hitPoint.x;
        const dy = (target.y + 1.0) - shot.hitPoint.y;
        const dz = target.z - shot.hitPoint.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= blastRadius) {
          const dmg = Math.round(120 * (1 - (dist / blastRadius) * 0.65));
          room.applyDamage(p, target, dmg, 'RPG-7 Rocket Launcher', false);
        }
      }
      return;
    }

    // 2. Direct Hit Check (Client Raycast)
    let victim = null;
    let isHeadshot = Boolean(shot.isHeadshot);

    if (shot.victimId) {
      const v = room.players.get(shot.victimId);
      if (v && v.alive && v.team !== p.team) {
        victim = v;
      }
    }

    // 3. Server-side lag compensation fallback raycast (if client desynced or missed by centimeters)
    if (!victim && shot.origin && shot.dir) {
      const ox = shot.origin.x;
      const oy = shot.origin.y;
      const oz = shot.origin.z;
      const dx = shot.dir.x;
      const dy = shot.dir.y;
      const dz = shot.dir.z;
      const dlen = Math.hypot(dx, dy, dz) || 1;
      const ndx = dx / dlen;
      const ndy = dy / dlen;
      const ndz = dz / dlen;

      let closestDist = Infinity;
      for (const target of room.players.values()) {
        if (!target.alive || target.team === p.team || target.id === p.id) continue;
        const vx = target.x - ox;
        const vy = (target.y + 1.0) - oy;
        const vz = target.z - oz;
        const proj = vx * ndx + vy * ndy + vz * ndz;
        if (proj > 0.4 && proj < 85) {
          const cx = ox + ndx * proj;
          const cy = oy + ndy * proj;
          const cz = oz + ndz * proj;
          const distSq = (target.x - cx) ** 2 + ((target.y + 1.0) - cy) ** 2 + (target.z - cz) ** 2;
          if (distSq < 0.85 * 0.85 && proj < closestDist) {
            closestDist = proj;
            victim = target;
            isHeadshot = Math.abs(cy - (target.y + 1.6)) < 0.35;
          }
        }
      }
    }

    if (victim) {
      const wCfg = MAP_DATA.WEAPONS[shot.weapon] || MAP_DATA.WEAPONS.cheese_blaster;
      const dmg = Math.round(wCfg.damage * (isHeadshot ? wCfg.headshotMult : 1));
      room.applyDamage(p, victim, dmg, wCfg.name, isHeadshot);
    }
  });

  socket.on('throwGrenade', (gData) => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || room.matchState.status !== 'playing') return;
    const grenadeId = `gren_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const gType = p.team === 'biggie' ? 'Cheese Grenade' : 'Kiwi Frag';

    if (Math.random() < 0.50) {
      room.broadcast('spatialSound', {
        category: 'grenade',
        x: p.x,
        y: p.y + 1.5,
        z: p.z
      });
    }

    room.broadcast('grenadeThrown', {
      id: grenadeId,
      ownerId: p.id,
      team: p.team,
      name: gType,
      origin: gData.origin,
      velocity: gData.velocity
    });

    setTimeout(() => {
      const ex = gData.explodePos || {
        x: gData.origin.x + gData.velocity.x * 0.9,
        y: 0.4,
        z: gData.origin.z + gData.velocity.z * 0.9
      };
      room.broadcast('grenadeExplode', {
        id: grenadeId,
        ownerId: p.id,
        team: p.team,
        x: ex.x,
        y: ex.y,
        z: ex.z
      });

      const blastRadius = 8.5;
      for (const target of room.players.values()) {
        if (!target.alive || target.team === p.team) continue;
        const dx = target.x - ex.x;
        const dy = (target.y + 1.0) - ex.y;
        const dz = target.z - ex.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= blastRadius) {
          const dmg = Math.round(75 * (1 - (dist / blastRadius) * 0.65));
          room.applyDamage(p, target, dmg, gType, false);
        }
      }
    }, 1200);
  });

  socket.on('activateUlt', () => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || (p.ultCharge || 0) < 100) return;
    p.ultCharge = 0;
    p.overchargedUntil = Date.now() + 7000;
    p.hp = Math.min(p.maxHp, p.hp + 50);
    room.broadcast('ultActivated', {
      playerId: p.id,
      team: p.team,
      name: p.team === 'biggie' ? 'BIGGIE FONDUE FRENZY' : 'KEWI RAIL OVERCHARGE'
    });
  });

  socket.on('callDriveby', () => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) room.callDriveby(p);
  });

  socket.on('callSnitch', () => {
    const room = findSocketRoom(socket);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) room.callSnitch(p);
  });

  socket.on('leaveRoom', () => {
    const room = findSocketRoom(socket);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(room.code);
      socket.roomCode = null;
    }
  });

  socket.on('disconnect', () => {
    const room = findSocketRoom(socket);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(room.code);
    }
  });
});

// ==================== 20Hz GLOBAL TICK DISPATCHER ====================
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    room.tick(now, 50 / 1000);
    // Cleanup empty custom rooms after 3 minutes of inactivity
    if (code !== 'HOOD' && room.emptySince && (now - room.emptySince > 180000)) {
      rooms.delete(code);
    }
  }
}, 50);

server.listen(PORT, () => {
  console.log(`🧀🥝 HoodWarfare Server running at http://localhost:${PORT}`);
});
