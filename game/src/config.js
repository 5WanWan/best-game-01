// Tuning and content tables for EMBERWARD: one place holds every number the
// simulation uses, so balance lives here and nowhere else.
export const STEP = 1 / 60;
export const BEST_KEY = 'emberward-best';
export const VIEW = { width: 960, height: 600 };
export const ARENA = { x: 24, y: 84, width: 912, height: 492 };

export const PLAYER = {
  radius: 15,
  speed: 235,
  maxHp: 3,
  fireInterval: 0.24,
  bulletSpeed: 560,
  bulletDamage: 1,
  bulletRadius: 5,
  magnetRadius: 70,
  invulnSeconds: 1.1,
};

export const SCORE = {
  wisp: 50,
  spitter: 100,
  hulk: 200,
  boss: 2000,
  shard: 25,
  waveBonus: 100,
};

export const ENEMY = {
  wisp: { hp: 2, speed: 118, radius: 13, damage: 1, score: SCORE.wisp, color: '#b78cff' },
  spitter: { hp: 3, speed: 72, radius: 14, damage: 1, score: SCORE.spitter, color: '#ff7a9e' },
  hulk: { hp: 10, speed: 46, radius: 22, damage: 1, score: SCORE.hulk, color: '#7fe0a8' },
  boss: { hp: 160, speed: 52, radius: 38, damage: 1, score: SCORE.boss, color: '#ffb347' },
};

export const WAVES = [
  { wisps: 6, spitters: 0, hulks: 0, boss: false },
  { wisps: 9, spitters: 2, hulks: 0, boss: false },
  { wisps: 10, spitters: 4, hulks: 1, boss: false },
  { wisps: 12, spitters: 5, hulks: 2, boss: false },
  { wisps: 8, spitters: 4, hulks: 2, boss: true },
  { wisps: 14, spitters: 7, hulks: 3, boss: false },
  { wisps: 16, spitters: 8, hulks: 4, boss: false },
  { wisps: 18, spitters: 10, hulks: 5, boss: false },
  { wisps: 20, spitters: 12, hulks: 6, boss: false },
  { wisps: 10, spitters: 8, hulks: 4, boss: true },
];
export const TOTAL_WAVES = WAVES.length;

// How many enemies may be alive at once; the rest wait in the spawn queue.
export const MAX_ALIVE = 14;

export const UPGRADES = [
  {
    id: 'ember-rounds', name: 'EMBER ROUNDS', icon: '◆',
    blurb: '+35% bullet damage', max: 5,
    apply: (p) => { p.damage *= 1.35; },
  },
  {
    id: 'swift-trigger', name: 'SWIFT TRIGGER', icon: '≫',
    blurb: '+25% fire rate', max: 5,
    apply: (p) => { p.fireInterval *= 0.8; },
  },
  {
    id: 'wind-boots', name: 'WIND BOOTS', icon: '»',
    blurb: '+12% move speed', max: 4,
    apply: (p) => { p.speed *= 1.12; },
  },
  {
    id: 'twin-shot', name: 'TWIN SHOT', icon: '✦',
    blurb: '+1 bullet per shot', max: 3,
    apply: (p) => { p.multishot += 1; },
  },
  {
    id: 'piercing-light', name: 'PIERCING LIGHT', icon: '—›',
    blurb: 'Bullets pierce +1 enemy', max: 3,
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'heart-vessel', name: 'HEART VESSEL', icon: '♥',
    blurb: '+1 max heart, heal 1', max: 3,
    apply: (p) => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); },
  },
  {
    id: 'magnet-charm', name: 'MAGNET CHARM', icon: '◎',
    blurb: '+70% pickup pull', max: 3,
    apply: (p) => { p.magnetRadius *= 1.7; },
  },
  {
    id: 'aegis-ward', name: 'AEGIS WARD', icon: '⛨',
    blurb: 'A shield that blocks one hit, renewed each wave', max: 1,
    apply: (p) => { p.shield = true; p.hasAegis = true; },
  },
  {
    id: 'overdrive-core', name: 'OVERDRIVE CORE', icon: '☀',
    blurb: 'Overdrive pickups last twice as long', max: 2,
    apply: (p) => { p.overdriveBonus += 1; },
  },
];
