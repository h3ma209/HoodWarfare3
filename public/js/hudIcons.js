// Renders the stylized comic-book HUD ability icons, character portrait, and 2D street minimap
window.HoodHUD = (function () {
  function drawIconsForTeam(team) {
    drawGrenadeIcon(team);
    drawWeaponIcon(team);
    drawUltIcon(team);
    drawSnitchIcon();
    drawPortraitIcon(team);
  }

  function drawSnitchIcon() {
    const c = document.getElementById('icon-snitch');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 68, 68);

    // Police Red & Blue split background
    const grad = ctx.createLinearGradient(0, 0, 68, 68);
    grad.addColorStop(0, '#b71c1c');
    grad.addColorStop(0.5, '#1a237e');
    grad.addColorStop(1, '#01579b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 68, 68);

    // Smartphone frame
    ctx.save();
    ctx.translate(34, 34);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#ffdd00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-14, -22, 28, 44);
    ctx.strokeRect(-14, -22, 28, 44);

    // Phone screen
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-11, -17, 22, 34);

    // "SNITCH" text on phone screen
    ctx.fillStyle = '#ff1744';
    ctx.font = 'bold 6px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNITCH', 0, -4);

    // Green Call icon
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.arc(0, 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGrenadeIcon(team) {
    const c = document.getElementById('icon-grenade');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 68, 68);

    // Background radial glow
    const grad = ctx.createRadialGradient(34, 34, 4, 34, 34, 38);
    grad.addColorStop(0, team === 'biggie' ? '#ffe033' : '#64dd17');
    grad.addColorStop(1, '#121820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 68, 68);

    // Draw Kiwi + Cheese Wedge Hybrid Icon (like screenshot card 1!)
    ctx.save();
    ctx.translate(28, 32);
    ctx.fillStyle = '#7cb342';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 13, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cheese wedge in front
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.lineTo(24, 6);
    ctx.lineTo(6, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cheese holes
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.arc(12, 8, 2.5, 0, Math.PI * 2);
    ctx.arc(17, 6, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWeaponIcon(team) {
    const c = document.getElementById('icon-weapon');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 68, 68);

    const grad = ctx.createLinearGradient(0, 0, 68, 68);
    grad.addColorStop(0, '#16281e');
    grad.addColorStop(1, '#0e131a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 68, 68);

    ctx.save();
    ctx.translate(34, 34);
    ctx.rotate(-0.6);

    // Silhouette of futuristic rifle
    ctx.fillStyle = team === 'biggie' ? '#ffca28' : '#39ff14';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.fillRect(-22, -5, 44, 9);
    ctx.strokeRect(-22, -5, 44, 9);

    ctx.fillStyle = team === 'biggie' ? '#9c27b0' : '#1b5e20';
    ctx.fillRect(-10, 4, 8, 11);
    ctx.fillRect(-20, -2, 10, 10);
    ctx.restore();
  }

  function drawUltIcon(team) {
    const c = document.getElementById('icon-ult');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 68, 68);

    const grad = ctx.createRadialGradient(34, 34, 2, 34, 34, 34);
    grad.addColorStop(0, '#e0f7fa');
    grad.addColorStop(0.45, '#00e5ff');
    grad.addColorStop(1, '#0b1929');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 68, 68);

    // 4-point glowing star
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(34, 8);
    ctx.quadraticCurveTo(37, 31, 60, 34);
    ctx.quadraticCurveTo(37, 37, 34, 60);
    ctx.quadraticCurveTo(31, 37, 8, 34);
    ctx.quadraticCurveTo(31, 31, 34, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawPortraitIcon(team) {
    const c = document.getElementById('icon-portrait');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 76, 76);

    // Backdrop
    ctx.fillStyle = team === 'biggie' ? '#4a148c' : '#1b4332';
    ctx.fillRect(0, 0, 76, 76);

    if (team === 'biggie') {
      // Yellow Hoodie Collar
      ctx.fillStyle = '#ffdd00';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(38, 74, 32, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Gold Chain
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(38, 62, 15, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#6d4c41';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(38, 40, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Beard
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(38, 43, 15, 0.15, Math.PI - 0.15);
      ctx.fill();

      // Shades
      ctx.fillStyle = '#000';
      ctx.fillRect(25, 33, 11, 6);
      ctx.fillRect(40, 33, 11, 6);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(25, 33, 11, 6);
      ctx.strokeRect(40, 33, 11, 6);

      // Purple Cap with Cheese Badge
      ctx.fillStyle = '#9c27b0';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(38, 30, 17, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(20, 27, 36, 5);
      ctx.strokeRect(20, 27, 36, 5);
    } else {
      // Rza Kewi Tactical Portrait
      ctx.fillStyle = '#2d4c2b';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(38, 74, 32, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Head
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath();
      ctx.arc(38, 40, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Black Tactical Mask
      ctx.fillStyle = '#181c20';
      ctx.beginPath();
      ctx.arc(38, 42, 15, 0.05, Math.PI - 0.05);
      ctx.fill();
      ctx.stroke();

      // Glowing Green Visor Eyes
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(27, 34, 8, 4);
      ctx.fillRect(41, 34, 8, 4);

      // Black Beret with Kiwi Emblem
      ctx.fillStyle = '#111317';
      ctx.beginPath();
      ctx.ellipse(37, 24, 19, 8, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.arc(44, 24, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function renderMinimap(selfPlayer, allPlayers, mapData) {
    const c = document.getElementById('minimap-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width;
    const H = c.height;

    // Street asphalt background
    ctx.fillStyle = '#2b303c';
    ctx.fillRect(0, 0, W, H);

    // Diagonal street grid aesthetic (matching screenshot top-right radar!)
    ctx.save();
    ctx.translate(W / 2, H / 2);

    const scale = 1.15; // world units to minimap pixels for expanded 240x180 map

    // Draw Central Turf Zone
    ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-12 * scale, -12 * scale, 24 * scale, 24 * scale);
    ctx.strokeRect(-12 * scale, -12 * scale, 24 * scale, 24 * scale);

    // Draw Buildings, Houses & Crates
    for (const col of mapData.COLLIDERS) {
      if (col.type === 'boundary') continue;
      if (col.type === 'building' || col.type === 'subway_roof') {
        ctx.fillStyle = '#434a59';
        ctx.strokeStyle = '#151820';
        ctx.lineWidth = 1.5;
      } else if (col.type === 'house') {
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 1.5;
      } else if (col.type === 'house_porch') {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
      } else if (col.type === 'kiwi_crate') {
        ctx.fillStyle = '#558b2f';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
      } else if (col.type === 'cheese_crate') {
        ctx.fillStyle = '#fbc02d';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
      } else if (col.type && col.type.startsWith('car_')) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
      } else {
        ctx.fillStyle = '#64748b';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
      }
      ctx.fillRect(
        (col.x - col.w / 2) * scale,
        (col.z - col.d / 2) * scale,
        col.w * scale,
        col.d * scale
      );
      ctx.strokeRect(
        (col.x - col.w / 2) * scale,
        (col.z - col.d / 2) * scale,
        col.w * scale,
        col.d * scale
      );
    }

    // Draw Players
    for (const p of allPlayers.values()) {
      if (!p.alive || (selfPlayer && p.id === selfPlayer.id)) continue;
      const px = p.x * scale;
      const pz = p.z * scale;
      ctx.fillStyle = p.team === 'biggie' ? '#ffdd00' : '#39ff14';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, pz, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw Self Player Arrow (Green Triangle like screenshot!)
    if (selfPlayer) {
      const sx = selfPlayer.x * scale;
      const sz = selfPlayer.z * scale;
      ctx.save();
      ctx.translate(sx, sz);
      ctx.rotate(-selfPlayer.yaw);

      // Vision cone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -32);
      ctx.lineTo(18, -32);
      ctx.closePath();
      ctx.fill();

      // Player triangle
      ctx.fillStyle = '#39ff14';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5.5, 5.5);
      ctx.lineTo(-5.5, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  return {
    drawIconsForTeam,
    renderMinimap
  };
})();
