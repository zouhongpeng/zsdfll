// ============ 全域常量与配置 ============

export const MAP_SIZE = 1000;         // 地形边长
export const TERRAIN_SEGMENTS = 220;  // 高度图网格细分
export const NAV_SIZE = 60;           // 导航网格粗细（决定寻路精度）
export const WATER_LEVEL = 6;         // 水面高度
export const TIME_SCALE = 1;

export const DAY_DURATION = 90;       // 白昼（建造）秒
export const NIGHT_DURATION = 9999;   // 夜晚以清场为准

export const PHASES = { DAY: 'day', NIGHT: 'night', MODAL: 'modal', MENU: 'menu', LOST: 'lost', WIN: 'win' };

// ---------- 资源 ----------
export const START_RESOURCES = { crystal: 100, wood: 50, food: 50, population: 0 };
export const MAX_POP = 6;

// ---------- 区域类型 ----------
export const REGION_TYPES = {
  core:    { id: 'core',    name: '魔力核心区', color: '#5BC0DE', cap: 3,   canPlaceOutsideRange: false, desc: '要塞中枢，容纳魔力核心/书库/观测台' },
  magic:   { id: 'magic',   name: '魔法阵区',   color: '#4A9EFF', cap: 20,  canPlaceOutsideRange: true,  desc: '外围或隘口，部署防御魔法阵' },
  human:   { id: 'human',   name: '人类居住区', color: '#48BB78', cap: 15,  canPlaceOutsideRange: false, desc: '腹地聚落，提升人口与产出' },
  workshop:{ id: 'workshop',name: '魔法工坊区', color: '#D4A843', cap: 10,  canPlaceOutsideRange: false, desc: '靠近资源点，产出各类资源' },
  supply:  { id: 'supply',  name: '后勤补给区', color: '#8B5CF6', cap: 8,   canPlaceOutsideRange: false, desc: '交通要道，存储与运输资源' },
  outpost: { id: 'outpost', name: '前哨缓冲区', color: '#9AA5B1', cap: 0,   canPlaceOutsideRange: true,  desc: '外围无人区，布置陷阱诱饵路障' },
};

// ---------- 魔法阵类型 ----------
export const TOWERS = {
  // 魔力核心区
  core: {
    id: 'core', name: '魔力核心', region: 'core', cost: 0, hp: 1000, range: 50,
    desc: '要塞之魂，范围内魔法阵才能运作', color: '#5BC0DE', maxLevel: 5, category: '核心',
    upgrade: (lvl) => ({ cost: [0, 100, 250, 500, 1000][lvl] || 2000, range: 50 + lvl * 10 }),
  },
  library: {
    id: 'library', name: '芙莉莲的魔法书库', region: 'core', cost: 120, hp: 500, range: 0,
    desc: '提升全图魔法阵效率 +8%', color: '#5BC0DE', maxLevel: 3, category: '核心',
    upgrade: (lvl) => ({ cost: [120, 80, 160][lvl] || 240, range: 0 }),
  },
  observatory: {
    id: 'observatory', name: '星空观测台', region: 'core', cost: 150, hp: 500, range: 0,
    desc: '魔力核心范围 +15', color: '#5BC0DE', maxLevel: 3, category: '核心',
    upgrade: (lvl) => ({ cost: [150, 100, 200][lvl] || 300, range: 0 }),
  },
  // 魔法阵区
  attack: {
    id: 'attack', name: '攻击魔法阵', region: 'magic', cost: 50, hp: 200, range: 60,
    desc: '发射一般攻击魔法，射速快伤害低', color: '#4A9EFF', maxLevel: 3, category: '魔法阵', towers: 'magic',
    atk: (lvl) => 14 * (1 + 0.6 * lvl), rof: (lvl) => 0.5, range: (lvl) => 60 + 6 * lvl,
    upgrade: (lvl) => ({ cost: [50, 60, 140][lvl] || 200, range: 60 + 6 * lvl }),
    // 3级升级为“弑魔魔法”
    flavorAtMax: '弑魔魔法：对魔族伤害翻倍',
  },
  shield: {
    id: 'shield', name: '防御魔法阵', region: 'magic', cost: 60, hp: 400, range: 0,
    desc: '生成屏障阻挡魔族，有HP', color: '#4A5568', maxLevel: 3, category: '魔法阵', towers: 'magic',
    hp: (lvl) => 400 * (1 + 0.5 * lvl),
    upgrade: (lvl) => ({ cost: [60, 60, 150][lvl] || 220 }),
  },
  bind: {
    id: 'bind', name: '束缚魔法阵', region: 'magic', cost: 45, hp: 200, range: 50,
    desc: '范围内魔族减速 45%', color: '#5BC0DE', maxLevel: 3, category: '魔法阵', towers: 'magic',
    slow: (lvl) => 0.45 + 0.1 * lvl, range: (lvl) => 50 + 6 * lvl,
    upgrade: (lvl) => ({ cost: [45, 50, 120][lvl] || 180, range: 50 + 6 * lvl }),
  },
  illusion: {
    id: 'illusion', name: '幻影魔法阵', region: 'magic', cost: 55, hp: 150, range: 0,
    desc: '生成幻影分身吸引魔族攻击', color: '#8B5CF6', maxLevel: 3, category: '魔法阵', towers: 'magic',
    hp: (lvl) => 300 * lvl,
    upgrade: (lvl) => ({ cost: [55, 60, 140][lvl] || 200 }),
  },
  detect: {
    id: 'detect', name: '探测魔法阵', region: 'magic', cost: 40, hp: 150, range: 70,
    desc: '扩大周围魔法阵攻击范围 +20%', color: '#D4A843', maxLevel: 3, category: '魔法阵', towers: 'magic',
    upgrade: (lvl) => ({ cost: [40, 50, 120][lvl] || 180 }),
  },
  // 人类居住区
  house:   { id: 'house',   name: '民居', region: 'human', cost: 40, hp: 150, desc: '提升人口上限', color: '#48BB78', maxLevel: 3, category: '居住', upgrade: (l)=>({ cost:[100,120,280][l]||380 }) },
  granary: { id: 'granary', name: '粮仓', region: 'human', cost: 40, hp: 150, desc: '每5s产出粮食+3', color: '#48BB78', maxLevel: 3, category: '居住', produce: { food: 3 }, upgrade: (l)=>({ cost:[60,80,200][l]||280 }) },
  well:    { id: 'well',    name: '水井', region: 'human', cost: 50, hp: 150, desc: '全图民居HP+5%', color: '#48BB78', maxLevel: 3, category: '居住', upgrade: (l)=>({ cost:[80,60,150][l]||220 }) },
  bonfire: { id: 'bonfire', name: '篝火', region: 'human', cost: 25, hp: 100, desc: '周边魔族闪避小幅降低', color: '#FF9F43', maxLevel: 2, category: '居住', upgrade: (l)=>({ cost:[40,60][l]||100 }) },
  clinic:  { id: 'clinic',  name: '治疗所', region: 'human', cost: 70, hp: 200, desc: '缓慢修复附近魔法阵', color: '#48BB78', maxLevel: 3, category: '居住', upgrade: (l)=>({ cost:[100,80,180][l]||260 }) },
  // 魔法工坊区
  mine:    { id: 'mine', name: '魔力结晶矿', region: 'workshop', cost: 80, hp: 150, desc: '每5s产出魔力结晶+2', color: '#D4A843', maxLevel: 3, category: '工坊', produce: { crystal: 2 }, upgrade: (l)=>({ cost:[120,160,400][l]||520 }) },
  lumber:  { id: 'lumber', name: '木材场', region: 'workshop', cost: 50, hp: 150, desc: '每5s产出木材+2', color: '#D4A843', maxLevel: 3, category: '工坊', produce: { wood: 2 }, upgrade: (l)=>({ cost:[80,120,300][l]||400 }) },
  research:{ id: 'research', name: '魔法研究台', region: 'workshop', cost: 90, hp: 180, desc: '全图魔法阵攻速+6%', color: '#D4A843', maxLevel: 3, category: '工坊', upgrade: (l)=>({ cost:[140,160,360][l]||460 }) },
  herb:    { id: 'herb', name: '药草田', region: 'workshop', cost: 40, hp: 120, desc: '每5s产出粮食+2', color: '#D4A843', maxLevel: 3, category: '工坊', produce: { food: 2 }, upgrade: (l)=>({ cost:[60,80,200][l]||260 }) },
  ranch:   { id: 'ranch', name: '魔物牧场', region: 'workshop', cost: 70, hp: 150, desc: '每波产出额外结晶', color: '#D4A843', maxLevel: 3, category: '工坊', upgrade: (l)=>({ cost:[100,100,240][l]||320 }) },
  // 后勤补给区
  depot:   { id: 'depot', name: '物资库', region: 'supply', cost: 60, hp: 180, desc: '提升区内魔法阵效率+5%', color: '#8B5CF6', maxLevel: 3, category: '补给', upgrade: (l)=>({ cost:[90,100,240][l]||300 }) },
  station: { id: 'station', name: '运输站', region: 'supply', cost: 70, hp: 180, desc: '加速资源运输', color: '#8B5CF6', maxLevel: 3, category: '补给', upgrade: (l)=>({ cost:[100,100,240][l]||300 }) },
  supplydepot: { id: 'supplydepot', name: '补给站', region: 'supply', cost: 80, hp: 220, desc: '附近资源运输+20%', color: '#8B5CF6', maxLevel: 3, category: '补给', upgrade: (l)=>({ cost:[120,120,280][l]||360 }) },
  // 前哨缓冲区
  trap:    { id: 'trap', name: '陷阱', region: 'outpost', cost: 20, hp: 60, desc: '伤害经过的魔族', color: '#9AA5B1', maxLevel: 3, category: '前哨', trap: (l) => 40 + 20 * l, upgrade: (l)=>({ cost:[30,30,80][l]||120 }) },
  bait:    { id: 'bait', name: '诱饵', region: 'outpost', cost: 15, hp: 120, desc: '吸引魔族注意力', color: '#9AA5B1', maxLevel: 3, category: '前哨', upgrade: (l)=>({ cost:[25,30,70][l]||100 }) },
  barricade:{ id: 'barricade', name: '路障', region: 'outpost', cost: 30, hp: 300, desc: '阻挡魔族前进', color: '#9AA5B1', maxLevel: 3, category: '前哨', upgrade: (l)=>({ cost:[45,60,140][l]||220 }) },
};

// 各区域允许的魔法阵
export const REGION_TOWERS = {
  core: ['core', 'library', 'observatory'],
  magic: ['attack', 'shield', 'bind', 'illusion', 'detect'],
  human: ['house', 'granary', 'well', 'bonfire', 'clinic'],
  workshop: ['mine', 'lumber', 'research', 'herb', 'ranch'],
  supply: ['depot', 'station', 'supplydepot'],
  outpost: ['trap', 'bait', 'barricade'],
};

// ---------- 魔族 ----------
export const ENEMIES = {
  soldier: { name: '魔族士兵', color: '#8B5CF6', hp: 60, speed: 8, dmg: 6, drop: 1, size: 1.0, targets: 'core' },
  scout:   { name: '魔族斥候', color: '#B48CF6', hp: 40, speed: 20, dmg: 4, drop: 2, size: 0.7, targets: 'core' },
  big:     { name: '大魔族', color: '#E53E3E', hp: 350, speed: 6, dmg: 25, drop: 5, size: 1.8, targets: 'tower' },
  ogre:    { name: '巨魔', color: '#FFD700', hp: 1400, speed: 3.5, dmg: 60, drop: 10, size: 2.6, targets: 'tower' },
  shadow:  { name: '影魔族', color: '#42224a', hp: 60, speed: 13, dmg: 10, drop: 3, size: 0.9, targets: 'core', stealth: true },
  bane:    { name: '七崩贤', color: '#FFD700', hp: 9000, speed: 4, dmg: 120, drop: 50, size: 3.4, targets: 'core', boss: true },
};

export const ENEMY_DIRS = 8; // 8方位标记

// ---------- 存档 key ----------
export const SAVE_KEY = 'frieren_magic_defense_save_v1';
export const STATS_KEY = 'frieren_magic_defense_stats_v1';
export const FORTRESS_NAME = '苍月山城塞';