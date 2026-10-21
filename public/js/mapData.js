(function (exports) {
  const MAP_SIZE = { width: 160, depth: 120 };

  // Collidable Axis-Aligned Bounding Boxes (x, y, z center, w, h, d dimensions)
  // y=0 is street ground level. Colliders have minY = y - h/2, maxY = y + h/2
  const COLLIDERS = [
    // Outer street boundaries (expanded map perimeter)
    { id: 'wall_north', x: 0, y: 10, z: -60, w: 164, h: 20, d: 4, type: 'boundary' },
    { id: 'wall_south', x: 0, y: 10, z: 60, w: 164, h: 20, d: 4, type: 'boundary' },
    { id: 'wall_west', x: -80, y: 10, z: 0, w: 4, h: 20, d: 124, type: 'boundary' },
    { id: 'wall_east', x: 80, y: 10, z: 0, w: 4, h: 20, d: 124, type: 'boundary' },

    // North-West Building: "BIGGIE CHEESE'S SPOT" Corner Store
    { id: 'bldg_biggie_spot', x: -28, y: 12, z: -34, w: 32, h: 24, d: 24, type: 'building', theme: 'biggie_spot' },
    // Awning / Balcony ledge in front of Biggie's Spot (jumpable)
    { id: 'awning_biggie', x: -28, y: 5.2, z: -20.5, w: 20, h: 0.8, d: 3.5, type: 'awning' },

    // Far West Apartment Block (Biggie Spawn Backdrop)
    { id: 'bldg_west_apt', x: -62, y: 14, z: -28, w: 20, h: 28, d: 32, type: 'building', theme: 'brick_warm' },
    { id: 'bldg_west_south', x: -62, y: 13, z: 28, w: 20, h: 26, d: 32, type: 'building', theme: 'brick_pink' },

    // North-East Building: Brick Apartment with Graffiti ("BIGGIE" vs "RZA")
    { id: 'bldg_ne_corner', x: 18, y: 14, z: -35, w: 28, h: 28, d: 22, type: 'building', theme: 'brick_red' },

    // East Structure: "RZA KEWI HQ" Subway Entrance
    { id: 'subway_hq_roof', x: 44, y: 7.5, z: -20, w: 18, h: 1.5, d: 16, type: 'subway_roof' },
    { id: 'subway_wall_l', x: 35.8, y: 3.5, z: -20, w: 1.5, h: 7, d: 16, type: 'subway_wall' },
    { id: 'subway_wall_r', x: 52.2, y: 3.5, z: -20, w: 1.5, h: 7, d: 16, type: 'subway_wall' },
    { id: 'subway_wall_back', x: 44, y: 3.5, z: -27.2, w: 17, h: 7, d: 1.5, type: 'subway_wall' },

    // South-East Building: Rza Tactical Warehouse
    { id: 'bldg_se_kewi', x: 36, y: 12, z: 36, w: 34, h: 24, d: 24, type: 'building', theme: 'kewi_warehouse' },

    // South-West Building: Bodega & Alleyway Wall
    { id: 'bldg_sw_bodega', x: -28, y: 11, z: 36, w: 30, h: 22, d: 24, type: 'building', theme: 'bodega' },

    // === PARKED STREET CARS (Cover & Atmosphere) ===
    { id: 'car_hood_lowrider_1', x: -12, y: 1.1, z: -14, w: 4.8, h: 2.1, d: 2.3, type: 'car_lowrider', color: 0x9c27b0 },
    { id: 'car_hood_taxi_2', x: 10, y: 1.1, z: -14, w: 4.8, h: 2.1, d: 2.3, type: 'car_taxi', color: 0xffca28 },
    { id: 'car_hood_muscle_3', x: -6, y: 1.1, z: 18, w: 4.9, h: 2.2, d: 2.3, type: 'car_muscle', color: 0x2e7d32 },
    { id: 'car_hood_sedan_4', x: 26, y: 1.1, z: 16, w: 4.7, h: 2.1, d: 2.2, type: 'car_sedan', color: 0x1565c0 },
    { id: 'car_cop_patrol_5', x: -38, y: 1.1, z: 4, w: 5.0, h: 2.2, d: 2.4, type: 'car_police_static', color: 0x11151c },
    { id: 'car_kewi_van_6', x: 40, y: 1.3, z: -2, w: 5.4, h: 2.6, d: 2.5, type: 'car_van', color: 0x33691e },

    // === STREET COVER: KIWI CRATES (Right / East Side & Mid) ===
    // Main Kiwi Crate Stack from screenshot
    { id: 'kiwi_stack_1a', x: 16, y: 1.1, z: 4, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },
    { id: 'kiwi_stack_1b', x: 16, y: 1.1, z: 6.3, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },
    { id: 'kiwi_stack_1c', x: 16, y: 1.1, z: 8.6, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },
    { id: 'kiwi_stack_1_top', x: 16, y: 3.3, z: 5.2, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },

    // Secondary Kiwi Crate Cluster (North-Mid)
    { id: 'kiwi_stack_2a', x: 22, y: 1.1, z: -8, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },
    { id: 'kiwi_stack_2b', x: 24.3, y: 1.1, z: -8, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },
    { id: 'kiwi_stack_2_top', x: 23.1, y: 3.3, z: -8, w: 2.2, h: 2.2, d: 2.2, type: 'kiwi_crate' },

    // East Spawn Defense Crates
    { id: 'kiwi_stack_3a', x: 38, y: 1.1, z: 6, w: 2.4, h: 2.4, d: 2.4, type: 'kiwi_crate' },
    { id: 'kiwi_stack_3b', x: 38, y: 1.1, z: 8.5, w: 2.4, h: 2.4, d: 2.4, type: 'kiwi_crate' },

    // === STREET COVER: BIGGIE CHEESE SIDE (Left / West Side & Mid) ===
    // Giant Swiss Cheese Block Barriers & Trash Cans
    { id: 'cheese_block_1a', x: -16, y: 1.1, z: -2, w: 2.4, h: 2.2, d: 2.4, type: 'cheese_crate' },
    { id: 'cheese_block_1b', x: -16, y: 1.1, z: 0.5, w: 2.4, h: 2.2, d: 2.4, type: 'cheese_crate' },
    { id: 'cheese_block_1_top', x: -16, y: 3.3, z: -0.8, w: 2.2, h: 2.2, d: 2.2, type: 'cheese_crate' },

    { id: 'cheese_block_2a', x: -22, y: 1.1, z: 12, w: 2.4, h: 2.2, d: 2.4, type: 'cheese_crate' },
    { id: 'cheese_block_2b', x: -19.5, y: 1.1, z: 12, w: 2.4, h: 2.2, d: 2.4, type: 'cheese_crate' },

    { id: 'cheese_block_3', x: -36, y: 1.1, z: -8, w: 2.5, h: 2.2, d: 2.5, type: 'cheese_crate' },

    // Center Intersection Low Cover (Moved slightly to keep center boulevard open for drive-by)
    { id: 'mid_dumpster_n', x: -14, y: 1.4, z: -10, w: 4.2, h: 2.8, d: 2.4, type: 'dumpster_yellow' },
    { id: 'mid_dumpster_s', x: 14, y: 1.4, z: 12, w: 4.2, h: 2.8, d: 2.4, type: 'dumpster_green' },
    { id: 'mid_payphone_booth', x: 0, y: 1.8, z: -12, w: 2.2, h: 3.6, d: 2.2, type: 'center_pillar' }
  ];

  // Jump pads for verticality (lets players launch up to awnings/subway roof!)
  const JUMP_PADS = [
    { id: 'jp_west', x: -38, y: 0.2, z: -20, radius: 2.4, vy: 19, color: 0xffd700 },
    { id: 'jp_east', x: 34, y: 0.2, z: -20, radius: 2.4, vy: 19, color: 0x39ff14 },
    { id: 'jp_south', x: 0, y: 0.2, z: 24, radius: 2.4, vy: 17, color: 0x00e5ff }
  ];

  // Team Spawn Points (Spaced comfortably across the wider avenue)
  const SPAWNS = {
    biggie: [
      { x: -32, y: 0, z: 2, yaw: -Math.PI / 2 },
      { x: -30, y: 0, z: -6, yaw: -Math.PI / 2 },
      { x: -34, y: 0, z: 10, yaw: -Math.PI / 2 },
      { x: -28, y: 0, z: -14, yaw: -Math.PI / 2 },
      { x: -36, y: 0, z: -2, yaw: -Math.PI / 2 }
    ],
    kewi: [
      { x: 32, y: 0, z: 3, yaw: Math.PI / 2 },
      { x: 30, y: 0, z: -6, yaw: Math.PI / 2 },
      { x: 34, y: 0, z: 10, yaw: Math.PI / 2 },
      { x: 30, y: 0, z: -14, yaw: Math.PI / 2 },
      { x: 36, y: 0, z: 0, yaw: Math.PI / 2 }
    ]
  };

  // Weapons Configuration (Zero movement recoil/bloom! Pure arcade precision)
  const WEAPONS = {
    cheese_blaster: {
      id: 'cheese_blaster',
      name: 'Cheese Blaster 9000',
      team: 'biggie',
      slot: 1,
      damage: 22,
      headshotMult: 1.5,
      fireRateMs: 115, // rapid fire cheddar wedges
      magSize: 30,
      reserveAmmo: 90,
      reloadTimeMs: 1300,
      projectileSpeed: 115,
      projectileType: 'cheese_wedge',
      color: '#ffdd00'
    },
    kewi_railgun: {
      id: 'kewi_railgun',
      name: 'Kewi-Railgun',
      team: 'kewi',
      slot: 1,
      damage: 34,
      headshotMult: 1.6,
      fireRateMs: 210, // high-velocity glowing green energy rays
      magSize: 24,
      reserveAmmo: 72,
      reloadTimeMs: 1400,
      projectileSpeed: 150,
      projectileType: 'kiwi_ray',
      color: '#39ff14'
    },
    fondue_shotty: {
      id: 'fondue_shotty',
      name: 'Swiss Shredder SMG',
      team: 'any',
      slot: 2,
      damage: 16,
      headshotMult: 1.4,
      fireRateMs: 75,
      magSize: 40,
      reserveAmmo: 120,
      reloadTimeMs: 1100,
      projectileSpeed: 105,
      projectileType: 'mini_cube',
      color: '#ff9900'
    },
    pistol_1911: {
      id: 'pistol_1911',
      name: 'Vintage 1911 Pistol',
      team: 'any',
      slot: 2,
      damage: 32,
      headshotMult: 1.8,
      fireRateMs: 240,
      magSize: 8,
      reserveAmmo: 48,
      reloadTimeMs: 950,
      projectileSpeed: 140,
      projectileType: 'bullet',
      color: '#e2e8f0'
    },
    ak47: {
      id: 'ak47',
      name: 'AK-47 Street Kalashnikov',
      team: 'any',
      slot: 1,
      damage: 28,
      headshotMult: 1.75,
      fireRateMs: 130,
      magSize: 30,
      reserveAmmo: 120,
      reloadTimeMs: 1400,
      projectileSpeed: 135,
      projectileType: 'bullet_heavy',
      color: '#d97706'
    },
    rpg: {
      id: 'rpg',
      name: 'RPG-7 Rocket Launcher',
      team: 'any',
      slot: 4,
      damage: 120,
      splashRadius: 9.5,
      headshotMult: 1.0,
      fireRateMs: 1600,
      magSize: 1,
      reserveAmmo: 6,
      reloadTimeMs: 1800,
      projectileSpeed: 60,
      projectileType: 'rocket',
      color: '#ef4444'
    }
  };

  exports.MAP_DATA = {
    MAP_SIZE,
    COLLIDERS,
    JUMP_PADS,
    SPAWNS,
    WEAPONS
  };
})(typeof exports === 'undefined' ? (window. HoodShared = {}) : exports);
