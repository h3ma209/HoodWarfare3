// Procedural Cel-Shaded 3D World, Props, Character Models & Weapon Viewmodels
window.HoodWorld = (function () {
  // Helper: Add comic book black ink outlines to any Mesh
  function addComicOutline(mesh, thickness = 1.03, color = 0x090b10) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
    const lineMat = new THREE.LineBasicMaterial({ color });
    const wire = new THREE.LineSegments(edges, lineMat);
    mesh.add(wire);
    return mesh;
  }

  // Dynamic Canvas Texture: Kiwi Crate Stamp (matches screenshot crates!)
  function createKiwiCrateTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');

    // Olive wood slats
    ctx.fillStyle = '#5c7cfa';
    ctx.fillStyle = '#687d31';
    ctx.fillRect(0, 0, 256, 256);

    // Frame border
    ctx.strokeStyle = '#3d4c19';
    ctx.lineWidth = 26;
    ctx.strokeRect(13, 13, 230, 230);

    ctx.strokeStyle = '#111408';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);
    ctx.strokeRect(26, 26, 204, 204);

    // Kiwi Slice Logo Center
    ctx.save();
    ctx.translate(128, 128);

    // Outer green flesh
    ctx.fillStyle = '#4caf50';
    ctx.strokeStyle = '#1b3b14';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Lighter green inner ring
    ctx.fillStyle = '#8bc34a';
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();

    // Pale core
    ctx.fillStyle = '#dcedc8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Radial rays & black seeds
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      ctx.strokeStyle = '#33691e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 20, Math.sin(ang) * 20);
      ctx.lineTo(Math.cos(ang) * 54, Math.sin(ang) * 54);
      ctx.stroke();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * 34, Math.sin(ang) * 34, 4, 2, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Dynamic Canvas Texture: Swiss Cheese Block Crate
  function createCheeseCrateTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ffc107';
    ctx.fillRect(0, 0, 256, 256);

    // Darker cheddar border
    ctx.strokeStyle = '#ff8f00';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 238, 238);

    ctx.strokeStyle = '#1a1200';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);

    // Cheese holes
    const holes = [
      [65, 70, 24], [180, 60, 18], [130, 135, 30],
      [68, 190, 20], [190, 180, 25], [120, 60, 12]
    ];
    for (const [hx, hy, hr] of holes) {
      ctx.fillStyle = '#e65100';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.arc(hx + 3, hy + 3, hr * 0.78, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1a1200';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Dynamic Neon Sign Texture: "BIGGIE CHEESE'S SPOT"
  function createNeonSpotSignTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 220;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#241b38';
    ctx.fillRect(0, 0, 512, 220);

    // Outer neon cyan tube
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 16;
    ctx.strokeRect(14, 14, 484, 192);

    // Inner neon pink tube
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff4081';
    ctx.strokeRect(26, 26, 460, 168);

    // Text: BIGGIE CHEESE'S
    ctx.font = '900 44px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff0f6';
    ctx.shadowColor = '#ff4081';
    ctx.shadowBlur = 20;
    ctx.fillText("BIGGIE CHEESE'S", 256, 102);

    // Text: SPOT
    ctx.font = '900 50px "Bungee", sans-serif';
    ctx.fillStyle = '#ffe57f';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.fillText('— SPOT —', 256, 168);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Dynamic Graffiti Texture ("BIGGIE" / "RZA")
  function createGraffitiTexture(text, fillCol, outlineCol) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, 512, 256);
    ctx.save();
    ctx.translate(256, 140);
    ctx.rotate(-0.07);

    // Paint splatter backdrop
    ctx.fillStyle = outlineCol;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc((Math.random() - 0.5) * 380, (Math.random() - 0.5) * 120, 8 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '900 105px "Bungee", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 22;
    ctx.strokeText(text, 0, 0);

    ctx.strokeStyle = outlineCol;
    ctx.lineWidth = 10;
    ctx.strokeText(text, 0, 0);

    ctx.fillStyle = fillCol;
    ctx.fillText(text, 0, 0);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Dynamic Subway Sign Texture ("RZA KEWI HQ")
  function createSubwaySignTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#1b4d3e';
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = '#091a14';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 502, 118);

    ctx.font = '900 54px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7f3d0';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.fillText('RZA KEWI HQ', 256, 84);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  // Build Complete Street Map in Scene
  function buildMap(scene, mapData) {
    const kiwiTex = createKiwiCrateTexture();
    const cheeseTex = createCheeseCrateTexture();

    // 1. Street Asphalt Floor (Expanded arena dimensions)
    const groundGeo = new THREE.PlaneGeometry(170, 130);
    const groundMat = new THREE.MeshToonMaterial({ color: 0x454959 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Sidewalks (West, East, North, South curbs)
    const sidewalkMat = new THREE.MeshToonMaterial({ color: 0x7c8294 });
    const sidewalks = [
      { x: -36, z: -32, w: 60, d: 32 },
      { x: 34, z: -32, w: 60, d: 32 },
      { x: -36, z: 34, w: 60, d: 30 },
      { x: 34, z: 34, w: 60, d: 30 }
    ];
    for (const sw of sidewalks) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sw.w, 0.35, sw.d), sidewalkMat);
      m.position.set(sw.x, 0.175, sw.z);
      m.receiveShadow = true;
      addComicOutline(m);
      scene.add(m);
    }

    // Yellow dashed road lines & central Turf Zone highlight
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffca28 });
    for (let x = -70; x <= 70; x += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.45), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.03, 0);
      scene.add(dash);
    }

    // Central Turf Capture Ring
    const turfRingGeo = new THREE.RingGeometry(11.4, 12.0, 32);
    const turfRingMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    const turfRing = new THREE.Mesh(turfRingGeo, turfRingMat);
    turfRing.rotation.x = -Math.PI / 2;
    turfRing.position.set(0, 0.05, 0);
    scene.add(turfRing);

    // 2. Render All Colliders (Buildings, Crates, Subway, Dumpsters)
    for (const col of mapData.COLLIDERS) {
      if (col.type === 'boundary') continue;

      if (col.type === 'building') {
        const bColors = {
          biggie_spot: 0xd9735b,
          brick_warm: 0xe0826d,
          brick_pink: 0xc96b7c,
          brick_red: 0xc85a43,
          kewi_warehouse: 0xb58863,
          bodega: 0xbf6952
        };
        const bCol = bColors[col.theme] || 0xc85a43;
        const bMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ color: bCol })
        );
        bMesh.position.set(col.x, col.y, col.z);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        addComicOutline(bMesh);
        scene.add(bMesh);

        // Add Stylized Apartment Windows
        const winMat = new THREE.MeshBasicMaterial({ color: 0x2a3b4c });
        const litWinMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });
        const zFace = col.z < 0 ? col.z + col.d / 2 + 0.08 : col.z - col.d / 2 - 0.08;
        for (let wy = 7; wy < col.h - 3; wy += 5.5) {
          for (let wx = -col.w / 2 + 4; wx <= col.w / 2 - 4; wx += 5.5) {
            const wMesh = new THREE.Mesh(
              new THREE.BoxGeometry(2.3, 3.2, 0.2),
              Math.random() > 0.72 ? litWinMat : winMat
            );
            wMesh.position.set(col.x + wx, wy, zFace);
            addComicOutline(wMesh);
            scene.add(wMesh);
          }
        }
      } else if (col.type === 'awning') {
        const awnMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ color: 0xd81b60 })
        );
        awnMesh.position.set(col.x, col.y, col.z);
        addComicOutline(awnMesh);
        scene.add(awnMesh);
      } else if (col.type.startsWith('subway_')) {
        const subMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ color: 0x2c6e58 })
        );
        subMesh.position.set(col.x, col.y, col.z);
        subMesh.castShadow = true;
        subMesh.receiveShadow = true;
        addComicOutline(subMesh);
        scene.add(subMesh);
      } else if (col.type === 'kiwi_crate') {
        const crateMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ map: kiwiTex })
        );
        crateMesh.position.set(col.x, col.y, col.z);
        crateMesh.castShadow = true;
        crateMesh.receiveShadow = true;
        addComicOutline(crateMesh);
        scene.add(crateMesh);
      } else if (col.type === 'cheese_crate') {
        const cMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ map: cheeseTex })
        );
        cMesh.position.set(col.x, col.y, col.z);
        cMesh.castShadow = true;
        cMesh.receiveShadow = true;
        addComicOutline(cMesh);
        scene.add(cMesh);
      } else if (col.type && col.type.startsWith('car_')) {
        const carGrp = new THREE.Group();
        const carColor = col.color || 0x222222;

        const carBody = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, 0.95, col.d),
          new THREE.MeshToonMaterial({ color: carColor })
        );
        carBody.position.set(0, 0.72, 0);
        addComicOutline(carBody);

        const carCabin = new THREE.Mesh(
          new THREE.BoxGeometry(col.w * 0.58, 0.75, col.d * 0.9),
          new THREE.MeshToonMaterial({ color: col.type === 'car_taxi' ? 0xffca28 : carColor })
        );
        carCabin.position.set(-col.w * 0.05, 1.48, 0);
        addComicOutline(carCabin);

        const carWin = new THREE.Mesh(
          new THREE.BoxGeometry(col.w * 0.6, 0.62, col.d * 0.94),
          new THREE.MeshBasicMaterial({ color: 0x1e293b })
        );
        carWin.position.set(-col.w * 0.05, 1.46, 0);

        if (col.type === 'car_taxi') {
          const taxiSign = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.28, 0.4),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          taxiSign.position.set(0, 1.95, 0);
          carGrp.add(taxiSign);
        } else if (col.type === 'car_police_static') {
          const pLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.25, 0.5),
            new THREE.MeshBasicMaterial({ color: 0xff1744 })
          );
          pLight.position.set(0, 1.95, 0);
          carGrp.add(pLight);
        }

        const wGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.35, 12);
        wGeo.rotateX(Math.PI / 2);
        const wMat = new THREE.MeshToonMaterial({ color: 0x090b10 });
        [
          [-col.w * 0.32, 0.44, -col.d * 0.48],
          [col.w * 0.32, 0.44, -col.d * 0.48],
          [-col.w * 0.32, 0.44, col.d * 0.48],
          [col.w * 0.32, 0.44, col.d * 0.48]
        ].forEach(([wx, wy, wz]) => {
          const wheel = new THREE.Mesh(wGeo, wMat);
          wheel.position.set(wx, wy, wz);
          carGrp.add(wheel);
        });

        carGrp.add(carBody, carCabin, carWin);
        carGrp.position.set(col.x, 0, col.z);
        scene.add(carGrp);
      } else {
        const dCol = col.type === 'dumpster_yellow' ? 0xfbc02d : col.type === 'dumpster_green' ? 0x388e3c : 0x5c6bc0;
        const dMesh = new THREE.Mesh(
          new THREE.BoxGeometry(col.w, col.h, col.d),
          new THREE.MeshToonMaterial({ color: dCol })
        );
        dMesh.position.set(col.x, col.y, col.z);
        dMesh.castShadow = true;
        dMesh.receiveShadow = true;
        addComicOutline(dMesh);
        scene.add(dMesh);
      }
    }

    // 3. Landmark 1: "BIGGIE CHEESE'S SPOT" Neon Storefront + Giant 3D Cheese Wedge!
    const neonTex = createNeonSpotSignTexture();
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(15, 6.2, 0.8),
      new THREE.MeshBasicMaterial({ map: neonTex })
    );
    signBoard.position.set(-24, 9.2, -16.6);
    addComicOutline(signBoard);
    scene.add(signBoard);

    // Giant 3D Neon Cheese Wedge on top of sign (rotates gently in game loop!)
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(-3.2, 0);
    wedgeShape.lineTo(3.2, 0);
    wedgeShape.lineTo(0.8, 3.8);
    wedgeShape.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: 2.2, bevelEnabled: false });
    wedgeGeo.center();
    const giantCheese = new THREE.Mesh(
      wedgeGeo,
      new THREE.MeshToonMaterial({ color: 0xffdd00, emissive: 0xff9900, emissiveIntensity: 0.45 })
    );
    giantCheese.position.set(-24, 14.3, -16.5);
    addComicOutline(giantCheese);
    scene.add(giantCheese);

    // 4. Landmark 2: "RZA KEWI HQ" Subway Entrance Fascia
    const subSignTex = createSubwaySignTexture();
    const subSign = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 2.6, 0.6),
      new THREE.MeshBasicMaterial({ map: subSignTex })
    );
    subSign.position.set(36, 7.6, -8.8);
    addComicOutline(subSign);
    scene.add(subSign);

    // 5. Graffiti Decals on Brick Walls ("BIGGIE" & "RZA")
    const biggieGraffiti = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 7),
      new THREE.MeshBasicMaterial({
        map: createGraffitiTexture('BIGGIE', '#ff80ab', '#76ff03'),
        transparent: true
      })
    );
    biggieGraffiti.position.set(8, 5.2, -18.85);
    scene.add(biggieGraffiti);

    const rzaGraffiti = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6),
      new THREE.MeshBasicMaterial({
        map: createGraffitiTexture('RZA KEWI', '#00e5ff', '#39ff14'),
        transparent: true
      })
    );
    rzaGraffiti.position.set(25, 5.0, 18.85);
    rzaGraffiti.rotation.y = Math.PI;
    scene.add(rzaGraffiti);

    // 6. Overturned Silver Trash Cans with Cheese Splatter (from foreground left of screenshot!)
    const canMat = new THREE.MeshToonMaterial({ color: 0x90a4ae });
    const knockedCan = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 2.6, 12), canMat);
    knockedCan.rotation.z = Math.PI / 2.2;
    knockedCan.rotation.y = 0.4;
    knockedCan.position.set(-21, 0.9, 7);
    addComicOutline(knockedCan);
    scene.add(knockedCan);

    // Melted Cheese Puddle next to knocked trash can
    const puddle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.9, 0.12, 14),
      new THREE.MeshToonMaterial({ color: 0xffca28 })
    );
    puddle.position.set(-19.5, 0.06, 7.2);
    scene.add(puddle);

    // 7. Jump Pads (Glowing Launch Rings)
    for (const jp of mapData.JUMP_PADS) {
      const padGroup = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(jp.radius, jp.radius + 0.3, 0.35, 16),
        new THREE.MeshToonMaterial({ color: 0x1e293b })
      );
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(jp.radius * 0.78, jp.radius * 0.78, 0.4, 16),
        new THREE.MeshBasicMaterial({ color: jp.color })
      );
      padGroup.add(base, glow);
      padGroup.position.set(jp.x, 0.18, jp.z);
      scene.add(padGroup);
    }

    // 8. Real Street Objects (Fire hydrants, tall street light poles, newsstands, metal benches)
    const poleMat = new THREE.MeshToonMaterial({ color: 0x334155 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const hydrantMat = new THREE.MeshToonMaterial({ color: 0xdc2626 });
    const benchMat = new THREE.MeshToonMaterial({ color: 0x475569 });

    // Street Lamps along North & South sidewalks
    const lampPositions = [
      [-48, -20], [-16, -20], [16, -20], [48, -20],
      [-48, 20], [-16, 20], [16, 20], [48, 20]
    ];
    for (const [lx, lz] of lampPositions) {
      const lampGrp = new THREE.Group();
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7.5, 8), poleMat);
      pole.position.set(0, 3.75, 0);
      addComicOutline(pole);
      // Arm & head
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.22), poleMat);
      arm.position.set(lz < 0 ? 0 : 0, 7.4, lz < 0 ? 0.7 : -0.7);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.6), lampGlowMat);
      light.position.set(0, 7.2, lz < 0 ? 1.2 : -1.2);
      lampGrp.add(pole, arm, light);
      lampGrp.position.set(lx, 0, lz);
      scene.add(lampGrp);
    }

    // Fire Hydrants near corners
    const hydrantPositions = [[-24, -18], [24, -18], [-24, 18], [24, 18]];
    for (const [hx, hz] of hydrantPositions) {
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 10), hydrantMat);
      hyd.position.set(hx, 0.55, hz);
      addComicOutline(hyd);
      scene.add(hyd);
    }

    // Street Benches on sidewalks
    const benchPositions = [[-34, -20], [34, -20], [-34, 20], [34, 20]];
    for (const [bx, bz] of benchPositions) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.9), benchMat);
      bench.position.set(bx, 0.35, bz);
      addComicOutline(bench);
      scene.add(bench);
    }

    return { giantCheese, turfRing };
  }

  // Build Stylized 3D Gang Character Model (Biggie Cheese Crew vs Rza Kewi)
  function createCharacterMesh(team) {
    const group = new THREE.Group();

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.55, 0);

    if (team === 'biggie') {
      // === BIGGIE CHEESE CREW ===
      // Purple Baggies (Legs)
      const legMat = new THREE.MeshToonMaterial({ color: 0x6a1b9a });
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.42), legMat);
      leftLeg.position.set(-0.24, 0.36, 0);
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.42), legMat);
      rightLeg.position.set(0.24, 0.36, 0);
      addComicOutline(leftLeg);
      addComicOutline(rightLeg);
      group.add(leftLeg, rightLeg);

      // Fresh White/Yellow High-Top Sneakers
      const shoeMat = new THREE.MeshToonMaterial({ color: 0xffffff });
      const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.56), shoeMat);
      lShoe.position.set(-0.24, 0.11, -0.06);
      const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.56), shoeMat);
      rShoe.position.set(0.24, 0.11, -0.06);
      group.add(lShoe, rShoe);

      // Chunky Bright Yellow & Purple Hoodie Torso
      const torsoMat = new THREE.MeshToonMaterial({ color: 0xffd600 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.92, 0.74), torsoMat);
      torso.position.set(0, 1.05, 0);
      torso.userData.isBody = true;
      addComicOutline(torso);
      group.add(torso);

      // Heavy Gold Chain & Cheese Medallion
      const chain = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.055, 8, 16),
        new THREE.MeshToonMaterial({ color: 0xffea00 })
      );
      chain.position.set(0, 1.28, -0.36);
      chain.rotation.x = 0.35;
      group.add(chain);

      // Yellow Sleeves
      const armMat = new THREE.MeshToonMaterial({ color: 0xffca28 });
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.68, 0.34), armMat);
      lArm.position.set(-0.7, 1.05, -0.15);
      const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.68, 0.34), armMat);
      rArm.position.set(0.7, 1.05, -0.25);
      rArm.rotation.x = 0.7;
      addComicOutline(lArm);
      addComicOutline(rArm);
      group.add(lArm, rArm);

      // Head + Beard + Sunglasses + Purple Flat-Brim Cap
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.54, 0.56),
        new THREE.MeshToonMaterial({ color: 0x6d4c41 })
      );
      head.userData.isHead = true;
      addComicOutline(head);
      headGroup.add(head);

      // Shades
      const shades = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.14, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      shades.position.set(0, 0.05, -0.26);
      headGroup.add(shades);

      // Purple Cap
      const capMat = new THREE.MeshToonMaterial({ color: 0x9c27b0 });
      const capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.6), capMat);
      capCrown.position.set(0, 0.26, 0);
      const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.35), capMat);
      capBrim.position.set(0, 0.16, -0.4);
      addComicOutline(capCrown);
      headGroup.add(capCrown, capBrim);

      // Held Weapon: Cheese Blaster 9000 (Purple & Yellow Assault Rifle)
      const gunGroup = new THREE.Group();
      const bodyGun = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.24, 0.95),
        new THREE.MeshToonMaterial({ color: 0xffd600 })
      );
      const stockGun = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.22, 0.45),
        new THREE.MeshToonMaterial({ color: 0x8e24aa })
      );
      stockGun.position.set(0, -0.04, 0.35);
      addComicOutline(bodyGun);
      gunGroup.add(bodyGun, stockGun);
      gunGroup.position.set(0.48, 1.05, -0.58);
      group.add(gunGroup);
    } else {
      // === RZA KEWI TACTICAL GANG ===
      const pantsMat = new THREE.MeshToonMaterial({ color: 0x2f3e2e });
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.78, 0.34), pantsMat);
      leftLeg.position.set(-0.2, 0.39, 0);
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.78, 0.34), pantsMat);
      rightLeg.position.set(0.2, 0.39, 0);
      addComicOutline(leftLeg);
      addComicOutline(rightLeg);
      group.add(leftLeg, rightLeg);

      // Tactical Vest & Olive Uniform
      const vestMat = new THREE.MeshToonMaterial({ color: 0x1e2b1e });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.9, 0.56), vestMat);
      torso.position.set(0, 1.08, 0);
      torso.userData.isBody = true;
      addComicOutline(torso);
      group.add(torso);

      // Arms
      const armMat = new THREE.MeshToonMaterial({ color: 0x3b5238 });
      const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.68, 0.28), armMat);
      lArm.position.set(-0.54, 1.08, -0.15);
      const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.68, 0.28), armMat);
      rArm.position.set(0.54, 1.08, -0.25);
      rArm.rotation.x = 0.7;
      addComicOutline(lArm);
      addComicOutline(rArm);
      group.add(lArm, rArm);

      // Head + Black Tactical Balaclava Mask + Black Beret
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.52, 0.5),
        new THREE.MeshToonMaterial({ color: 0xd7ccc8 })
      );
      head.userData.isHead = true;
      addComicOutline(head);
      headGroup.add(head);

      const mask = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.32, 0.52),
        new THREE.MeshToonMaterial({ color: 0x15181c })
      );
      mask.position.set(0, -0.1, 0);
      headGroup.add(mask);

      // Black Beret with Glowing Green Kiwi Badge
      const beret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.3, 0.14, 12),
        new THREE.MeshToonMaterial({ color: 0x111318 })
      );
      beret.position.set(-0.04, 0.29, 0);
      beret.rotation.z = 0.18;
      addComicOutline(beret);
      headGroup.add(beret);

      // Held Weapon: Kewi-Railgun (Black Tactical + Glowing Neon Green Coils)
      const gunGroup = new THREE.Group();
      const railBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.22, 1.05),
        new THREE.MeshToonMaterial({ color: 0x1e242b })
      );
      const railGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.08, 0.85),
        new THREE.MeshBasicMaterial({ color: 0x39ff14 })
      );
      railGlow.position.set(0, 0.04, -0.05);
      addComicOutline(railBody);
      gunGroup.add(railBody, railGlow);
      gunGroup.position.set(0.42, 1.08, -0.58);
      group.add(gunGroup);
    }

    group.add(headGroup);
    group.userData.headGroup = headGroup;
    return group;
  }

  // First-Person Viewmodel Attached to Player Camera
  function createFirstPersonWeapon(weaponId) {
    const group = new THREE.Group();

    if (weaponId === 'cheese_blaster') {
      // Cheese Blaster 9000 (Yellow Barrel + Purple Receiver + Cheese Wedge Sight)
      const receiver = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.18, 0.55),
        new THREE.MeshToonMaterial({ color: 0x8e24aa })
      );
      addComicOutline(receiver);

      const barrelHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.16, 0.55),
        new THREE.MeshToonMaterial({ color: 0xffd600 })
      );
      barrelHousing.position.set(0, 0.02, -0.42);
      addComicOutline(barrelHousing);

      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.26, 0.14),
        new THREE.MeshToonMaterial({ color: 0xffab00 })
      );
      mag.position.set(0, -0.18, -0.22);
      mag.rotation.x = 0.2;
      addComicOutline(mag);

      const muzzleTip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8),
        new THREE.MeshToonMaterial({ color: 0xab47bc })
      );
      muzzleTip.rotation.x = Math.PI / 2;
      muzzleTip.position.set(0, 0.03, -0.74);

      group.add(receiver, barrelHousing, mag, muzzleTip);
    } else if (weaponId === 'kewi_railgun') {
      // Kewi-Railgun (Sleek Military Carbon + Neon Green Energy Core)
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.17, 0.92),
        new THREE.MeshToonMaterial({ color: 0x1b2228 })
      );
      frame.position.set(0, 0, -0.25);
      addComicOutline(frame);

      const energyCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.145, 0.055, 0.76),
        new THREE.MeshBasicMaterial({ color: 0x39ff14 })
      );
      energyCore.position.set(0, 0.02, -0.28);

      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10),
        new THREE.MeshToonMaterial({ color: 0x2e3b2f })
      );
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.12, -0.2);
      addComicOutline(scope);

      group.add(frame, energyCore, scope);
    } else if (weaponId === 'ak47') {
      // AK-47 Street Kalashnikov (Wood + Stamped Steel)
      const woodMat = new THREE.MeshToonMaterial({ color: 0x8d4925 });
      const steelMat = new THREE.MeshToonMaterial({ color: 0x1f2937 });

      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.58), steelMat);
      rec.position.set(0, 0, -0.2);
      addComicOutline(rec);

      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.44), woodMat);
      stock.position.set(0, -0.06, 0.26);
      stock.rotation.x = -0.12;
      addComicOutline(stock);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.35), woodMat);
      handguard.position.set(0, 0.02, -0.58);
      addComicOutline(handguard);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.52, 8), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.82);

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.15), new THREE.MeshToonMaterial({ color: 0xb45309 }));
      mag.position.set(0, -0.22, -0.32);
      mag.rotation.x = 0.38;
      addComicOutline(mag);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.1), woodMat);
      grip.position.set(0, -0.18, -0.02);
      grip.rotation.x = -0.35;
      addComicOutline(grip);

      group.add(rec, stock, handguard, barrel, mag, grip);
    } else if (weaponId === 'pistol_1911') {
      // Classic 1911 Pistol
      const silverMat = new THREE.MeshToonMaterial({ color: 0xd1d5db });
      const frameMat = new THREE.MeshToonMaterial({ color: 0x374151 });
      const gripMat = new THREE.MeshToonMaterial({ color: 0x78350f });

      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.42), silverMat);
      slide.position.set(0, 0.06, -0.2);
      addComicOutline(slide);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.38), frameMat);
      frame.position.set(0, 0.01, -0.19);

      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.12), gripMat);
      grip.position.set(0, -0.12, -0.06);
      grip.rotation.x = -0.32;
      addComicOutline(grip);

      group.add(slide, frame, grip);
      group.position.set(0.24, -0.22, -0.35);
      return group;
    } else if (weaponId === 'rpg') {
      // Heavy RPG-7 Rocket Launcher
      const oliveMat = new THREE.MeshToonMaterial({ color: 0x3f6212 });
      const heatMat = new THREE.MeshToonMaterial({ color: 0x92400e });
      const warheadMat = new THREE.MeshToonMaterial({ color: 0x475569 });

      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.35, 10), oliveMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.05, -0.35);
      addComicOutline(tube);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.065, 0.3, 10), oliveMat);
      exhaust.rotation.x = -Math.PI / 2;
      exhaust.position.set(0, 0.05, 0.45);
      addComicOutline(exhaust);

      const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 10), heatMat);
      heatShield.rotation.x = Math.PI / 2;
      heatShield.position.set(0, 0.05, -0.22);
      addComicOutline(heatShield);

      const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), warheadMat);
      warhead.rotation.x = -Math.PI / 2;
      warhead.position.set(0, 0.05, -1.2);
      addComicOutline(warhead);

      const fGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.07), oliveMat);
      fGrip.position.set(0, -0.14, -0.4);

      group.add(tube, exhaust, heatShield, warhead, fGrip);
      group.position.set(0.28, -0.22, -0.42);
      return group;
    } else {
      // Swiss Shredder SMG
      const smgBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.16, 0.52),
        new THREE.MeshToonMaterial({ color: 0xff9100 })
      );
      smgBody.position.set(0, 0, -0.2);
      addComicOutline(smgBody);
      group.add(smgBody);
    }

    group.position.set(0.32, -0.28, -0.45);
    return group;
  }

  // Build Stylized 3D Cop Character Model (Spawned by the 2-Kill "SNITCH" Phone Scorestreak!)
  function createCopCharacterMesh(team) {
    const group = new THREE.Group();
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.55, 0);

    // Navy Police Trousers
    const legMat = new THREE.MeshToonMaterial({ color: 0x0d1b2a });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.76, 0.36), legMat);
    leftLeg.position.set(-0.21, 0.38, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.76, 0.36), legMat);
    rightLeg.position.set(0.21, 0.38, 0);
    addComicOutline(leftLeg);
    addComicOutline(rightLeg);
    group.add(leftLeg, rightLeg);

    // Navy Police Uniform Torso + Duty Belt
    const torsoMat = new THREE.MeshToonMaterial({ color: 0x1b263b });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.6), torsoMat);
    torso.position.set(0, 1.06, 0);
    torso.userData.isBody = true;
    addComicOutline(torso);
    group.add(torso);

    // Gold Police Shield Badge on Chest
    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.05, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.22, 1.26, -0.32);
    group.add(badge);

    // Team Armband so you know whose Snitch called them
    const bandColor = team === 'biggie' ? 0xffdd00 : 0x39ff14;
    const lArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.68, 0.28),
      new THREE.MeshToonMaterial({ color: 0x1b263b })
    );
    lArm.position.set(-0.6, 1.06, -0.15);
    const rArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.68, 0.28),
      new THREE.MeshToonMaterial({ color: bandColor })
    );
    rArm.position.set(0.6, 1.06, -0.25);
    rArm.rotation.x = 0.7;
    addComicOutline(lArm);
    addComicOutline(rArm);
    group.add(lArm, rArm);

    // Head + Aviator Shades + Peaked Police Cap + Flashing Siren Beacon
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.52, 0.52),
      new THREE.MeshToonMaterial({ color: 0xe0ac69 })
    );
    head.userData.isHead = true;
    addComicOutline(head);
    headGroup.add(head);

    // Cop Mustache & Aviator Sunglasses
    const shades = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.14, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x050505 })
    );
    shades.position.set(0, 0.06, -0.25);
    headGroup.add(shades);

    // Peaked Police Hat
    const hatCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.3, 0.22, 8),
      new THREE.MeshToonMaterial({ color: 0x0d1b2a })
    );
    hatCrown.position.set(0, 0.32, 0);
    addComicOutline(hatCrown);
    const hatVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.06, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    hatVisor.position.set(0, 0.21, -0.32);
    headGroup.add(hatCrown, hatVisor);

    // Red & Blue Siren Lights on Cap
    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xff1744 })
    );
    redLight.position.set(-0.1, 0.48, 0);
    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.12, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x00b0ff })
    );
    blueLight.position.set(0.1, 0.48, 0);
    headGroup.add(redLight, blueLight);

    // Cop Issue Enforcer Shotgun
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.22, 0.92),
      new THREE.MeshToonMaterial({ color: 0x263238 })
    );
    addComicOutline(gunBody);
    gunGroup.add(gunBody);
    gunGroup.position.set(0.44, 1.06, -0.55);
    group.add(gunGroup);

    group.add(headGroup);
    group.userData.headGroup = headGroup;
    group.userData.redLight = redLight;
    group.userData.blueLight = blueLight;
    return group;
  }

  // First-Person Smartphone Calling Viewmodel (Pulled out for Cops & Drive-By!)
  function createSnitchPhoneViewmodel(mode = 'cops') {
    const group = new THREE.Group();
    const isDriveby = mode === 'homies';

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, isDriveby ? '#3b0764' : '#1e1b4b');
    grad.addColorStop(1, isDriveby ? '#1f1303' : '#31102f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // Status bar
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📶 HOOD-CELL 5G   🔋100%', 128, 34);

    // Red/Blue or Gold/Purple header
    ctx.fillStyle = isDriveby ? '#eab308' : '#ff1744';
    ctx.fillRect(16, 54, 108, 16);
    ctx.fillStyle = isDriveby ? '#a855f7' : '#00b0ff';
    ctx.fillRect(132, 54, 108, 16);

    // Avatar Circle
    ctx.fillStyle = isDriveby ? '#a855f7' : '#ffdd00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 150, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '54px sans-serif';
    ctx.fillText(isDriveby ? '🚗' : '🚔', 128, 168);

    // Title
    ctx.font = '900 46px "Bungee", sans-serif';
    ctx.fillStyle = isDriveby ? '#eab308' : '#ff1744';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 9;
    const titleText = isDriveby ? 'HOMIES' : 'SNITCH';
    ctx.strokeText(titleText, 128, 272);
    ctx.fillText(titleText, 128, 272);

    // Sub-labels
    ctx.font = 'bold 22px "Bungee", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isDriveby ? 'CALLING CREW...' : 'CALLING 911...', 128, 322);
    ctx.fillStyle = isDriveby ? '#fbbf24' : '#39ff14';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(isDriveby ? 'LOWRIDER ROLLING IN!' : '2 COPS PULLING UP!', 128, 356);

    // Call Button
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 432, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '36px sans-serif';
    ctx.fillText('📞', 128, 444);

    const screenTex = new THREE.CanvasTexture(c);
    screenTex.needsUpdate = true;

    // Phone Body
    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.46, 0.035),
      new THREE.MeshToonMaterial({ color: isDriveby ? 0x9333ea : 0xffd600 })
    );
    addComicOutline(caseMesh);

    // Glowing Phone Screen
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.42),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    screenMesh.position.set(0, 0, 0.02);

    // Hand holding phone
    const handMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.22, 0.18),
      new THREE.MeshToonMaterial({ color: 0x6d4c41 })
    );
    handMesh.position.set(-0.08, -0.16, -0.05);
    addComicOutline(handMesh);

    group.add(caseMesh, screenMesh, handMesh);
    group.position.set(0.0, -0.1, -0.44);
    group.rotation.y = -0.12;
    group.rotation.x = -0.08;
    return group;
  }

  // 3D Cel-Shaded Police Cruiser that pulls up when Snitch is called!
  function createPoliceCruiserMesh() {
    const car = new THREE.Group();

    // Lower Chassis (Black & White Livery)
    const bodyBlack = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 1.15, 2.5),
      new THREE.MeshToonMaterial({ color: 0x11151c })
    );
    bodyBlack.position.set(0, 0.85, 0);
    addComicOutline(bodyBlack);

    const doorsWhite = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.18, 2.54),
      new THREE.MeshToonMaterial({ color: 0xf8fafc })
    );
    doorsWhite.position.set(0, 0.85, 0);
    addComicOutline(doorsWhite);

    // Cabin Roof
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.95, 2.2),
      new THREE.MeshToonMaterial({ color: 0xf8fafc })
    );
    cabin.position.set(-0.1, 1.85, 0);
    addComicOutline(cabin);

    // Windshield & Windows
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.76, 0.72, 2.26),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    glass.position.set(-0.1, 1.82, 0);

    // Siren Lightbar on Roof (Red + Blue)
    const sirenRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.24, 0.95),
      new THREE.MeshBasicMaterial({ color: 0xff1744 })
    );
    sirenRed.position.set(0, 2.45, -0.5);
    addComicOutline(sirenRed);

    const sirenBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.24, 0.95),
      new THREE.MeshBasicMaterial({ color: 0x00b0ff })
    );
    sirenBlue.position.set(0, 2.45, 0.5);
    addComicOutline(sirenBlue);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshToonMaterial({ color: 0x090b10 });
    [
      [-1.7, 0.48, -1.25],
      [1.7, 0.48, -1.25],
      [-1.7, 0.48, 1.25],
      [1.7, 0.48, 1.25]
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, wy, wz);
      car.add(w);
    });

    car.add(bodyBlack, doorsWhite, cabin, glass, sirenRed, sirenBlue);
    car.userData.sirenRed = sirenRed;
    car.userData.sirenBlue = sirenBlue;
    return car;
  }

  // 3D Gang Lowrider Drive-By Vehicle with visible gang members leaning out the windows
  function createDrivebyCarMesh(team) {
    const car = new THREE.Group();
    const primaryColor = team === 'biggie' ? 0xffca28 : 0x2e7d32;
    const accentColor = team === 'biggie' ? 0x9c27b0 : 0x111111;

    // Sleek lowrider body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 1.05, 2.6),
      new THREE.MeshToonMaterial({ color: primaryColor })
    );
    body.position.set(0, 0.72, 0);
    addComicOutline(body);

    // Chrome bumpers & trim
    const chrome = new THREE.Mesh(
      new THREE.BoxGeometry(6.35, 0.25, 2.65),
      new THREE.MeshToonMaterial({ color: 0xe2e8f0 })
    );
    chrome.position.set(0, 0.45, 0);

    // Open-top convertible interior cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.55, 2.3),
      new THREE.MeshToonMaterial({ color: accentColor })
    );
    cabin.position.set(-0.2, 1.15, 0);
    addComicOutline(cabin);

    // Windshield
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.75, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    windshield.position.set(1.4, 1.55, 0);
    windshield.rotation.z = -0.35;

    // 4 Chrome Spoke Wheels
    const wGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.38, 14);
    wGeo.rotateX(Math.PI / 2);
    const wMat = new THREE.MeshToonMaterial({ color: 0x090b10 });
    [
      [-1.9, 0.46, -1.35],
      [1.9, 0.46, -1.35],
      [-1.9, 0.46, 1.35],
      [1.9, 0.46, 1.35]
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, wMat);
      w.position.set(wx, wy, wz);
      car.add(w);
    });

    // Visible Gang Members inside the car leaning out to shoot
    const gangTorsoColor = team === 'biggie' ? 0xffd600 : 0x3b5238;
    const gangCapColor = team === 'biggie' ? 0x9c27b0 : 0x111318;

    // Driver + 2 Shooters hanging out left & right windows
    const shooters = [
      { x: 0.6, y: 1.45, z: -0.65, rotZ: 0 },    // Driver
      { x: -0.5, y: 1.55, z: -1.05, rotZ: -0.25 }, // Shooter leaning out left window
      { x: -0.5, y: 1.55, z: 1.05, rotZ: 0.25 }    // Shooter leaning out right window
    ];

    shooters.forEach((s, idx) => {
      const shooterGrp = new THREE.Group();
      // Body
      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.6, 0.45),
        new THREE.MeshToonMaterial({ color: gangTorsoColor })
      );
      addComicOutline(torso);
      // Head + Cap/Beret
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.38, 0.38),
        new THREE.MeshToonMaterial({ color: 0x6d4c41 })
      );
      head.position.set(0, 0.48, 0);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.16, 0.42),
        new THREE.MeshToonMaterial({ color: gangCapColor })
      );
      cap.position.set(0, 0.64, 0);
      addComicOutline(head);

      // Gun aimed outward from the car window
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.12, 0.65),
        new THREE.MeshToonMaterial({ color: 0x111111 })
      );
      gun.position.set(0.18, 0.3, idx === 1 ? -0.35 : idx === 2 ? 0.35 : 0);
      gun.rotation.y = idx === 1 ? -Math.PI / 2 : idx === 2 ? Math.PI / 2 : 0;
      addComicOutline(gun);

      shooterGrp.add(torso, head, cap, gun);
      shooterGrp.position.set(s.x, s.y, s.z);
      shooterGrp.rotation.z = s.rotZ;
      car.add(shooterGrp);
    });

    car.add(body, chrome, cabin, windshield);
    return car;
  }

  return {
    buildMap,
    createCharacterMesh,
    createCopCharacterMesh,
    createFirstPersonWeapon,
    createSnitchPhoneViewmodel,
    createPoliceCruiserMesh,
    createDrivebyCarMesh,
    addComicOutline
  };
})();
