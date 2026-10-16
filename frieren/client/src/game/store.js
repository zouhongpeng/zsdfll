import { create } from 'zustand';
import {
  MAP_SIZE, WATER_LEVEL, DAY_DURATION, PHASES, START_RESOURCES,
  REGION_TYPES, REGION_TOWERS, TOWERS, ENEMIES, FORTRESS_NAME, SAVE_KEY, STATS_KEY,
} from './constants.js';
import { heightAt, biomeAt, biomeSpeed, isWater } from './terrain/terrain.js';
import { E, registerTowerRuntime, removeTowerRuntime } from './engine.js';

let idc = 1;
export const uid = () => String(idc++);

// 大地坐标为世界中心 0,0：区域/核心使用 cX,cZ 表示中心（世界坐标）
// 地形区域：以矩形左下角为锚点

export const useGame = create((set, get) => {
  // ---------- 内部工具 ----------
  const distToCore = (x, z) => {
    const c = get().core;
    return Math.sqrt((x - c.x) ** 2 + (z - c.z) ** 2);
  };

  const inMap = (x, z, m = MAP_SIZE / 2 - 6) =>
    Math.abs(x) < m && Math.abs(z) < m;

  // 坡度检测
  const slopeAt = (x, z, r = 6) => {
    const h1 = heightAt(x + r, z), h2 = heightAt(x - r, z);
    const h3 = heightAt(x, z + r), h4 = heightAt(x, z - r);
    const grad = Math.max(Math.abs(h1 - h2), Math.abs(h3 - h4));
    return grad;
  };

  // 区域contains判断（矩形）
  const regionContains = (rg, x, z) =>
    x >= rg.minX && x <= rg.maxX && z >= rg.minZ && z <= rg.maxZ;

  const canPlaceTower = (defId, x, z) => {
    const def = TOWERS[defId];
    if (!def) return { ok: false, reason: '未知建筑' };
    if (!inMap(x, z)) return { ok: false, reason: '超出边界' };
    if (isWater(x, z)) return { ok: false, reason: '无法建在水上' };
    const b = biomeAt(x, z);
    if (b === 'mountain') return { ok: false, reason: '山脉无法建造' };
    if (b !== 'mountain' && slopeAt(x, z) > 18) return { ok: false, reason: '坡度太陡' };

    // 找到所在区域
    const rg = get().regions.find((r) => regionContains(r, x, z));
    if (!rg) return { ok: false, reason: '未在任何区域内' };
    const allowed = REGION_TOWERS[rg.type];
    if (!allowed.includes(defId)) {
      return { ok: false, reason: `${REGION_TYPES[rg.type].name}不能放置${def.name}` };
    }
    // 容量
    const cap = REGION_TYPES[rg.type].cap;
    if (cap > 0) {
      const count = get().towers.filter((t) => t.regionId === rg.id).length;
      if (count >= cap) return { ok: false, reason: '该区域容量已满' };
    }
    // 魔力核心保护出生位置
    if (defId === 'core') return { ok: true, reason: '' };

    // 范围限制
    const inRange = distToCore(x, z) <= get().core.range + 4;
    if (!get().canBuildDuringNight) return { ok: true, reason: '' };
    if (def.region !== 'magic' && def.region !== 'outpost' && !inRange) {
      return { ok: false, reason: '需在魔力范围内' };
    }
    return { ok: true, reason: '' };
  };

  const computeCost = (defId, lvl) => {
    const def = TOWERS[defId];
    const cost = def.upgrade ? def.upgrade(lvl).cost : 0;
    return { crystal: cost, wood: Math.round(cost * 0.4) };
  };

  const addResources = (res) =>
    set((s) => ({
      resources: {
        crystal: Math.max(0, s.resources.crystal + (res.crystal || 0)),
        wood: Math.max(0, s.resources.wood + (res.wood || 0)),
        food: Math.max(0, s.resources.food + (res.food || 0)),
        population: s.resources.population,
      },
    }));

  const maybeSave = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(get().serialize())); }
    catch (e) {}
  };

  return {
    phase: PHASES.MENU,
    fortress: FORTRESS_NAME,
    day: 1,
    wave: 0,
    clock: DAY_DURATION,       // 白昼倒计时
    nightClock: 0,
    canBuildDuringNight: true,
    paused: false,
    speed: 1,
    resources: { ...START_RESOURCES },
    popCap: MAX_POP,
    core: { x: 0, z: 0, hp: 1000, maxHp: 1000, level: 1, range: 50 },
    selected: null,
    selectionInfo: null,       // 实时显示的详情（throttled）
    mode: 'none',              // none | region | build | demolish | pan
    regionBrush: null,         // {type}
    placingTowerId: null,
    regions: [],
    towers: [],
    murderCount: {},
    stats: {
      playSeconds: 0, day: 1, kills: 0, killsByType: {}, built: {}, builtTotal: 0,
      areaCount: 0, areaSize: 0, bestWave: 0, coreLevel: 1,
    },
    actionsHistory: 0,
    directions: [],            // 来袭方向预告
    waveModal: null,           // 结算弹窗数据
    underAttack: false,
    toastMsg: null,

    // ---------- 流程 ----------
    startGame: (fresh) => {
      idc = 1;
      let init = {
        phase: PHASES.DAY, day: 1, wave: 0, clock: DAY_DURATION, nightClock: 0,
        resources: { ...START_RESOURCES }, popCap: MAX_POP,
        core: { x: 0, z: 0, hp: 1000, maxHp: 1000, level: 1, range: 50 },
        regions: [], towers: [], directions: [], waveModal: null,
        underAttack: false, selected: null, selectionInfo: null,
        murderCount: {}, canBuildDuringNight: true,
        stats: { playSeconds: 0, day: 1, kills: 0, killsByType: {}, built: {}, builtTotal: 0, areaCount: 0, areaSize: 0, bestWave: 0, coreLevel: 1 },
      };
      if (!fresh) {
        const sd = get().deserialize();
        if (sd) init = { ...init, ...sd, phase: PHASES.DAY, waveModal: null, underAttack: false };
      }
      // 初始魔力核心区 + 魔力核心塔
      const coreTowerId = uid();
      init.towers = [
        { id: coreTowerId, defId: 'core', regionId: null, name: '魔力核心', x: 0, z: 0, level: 1, hp: init.core.maxHp, maxHp: init.core.maxHp, pos: { x: 0, z: 0 }, powered: true, category: '核心' },
      ];
      registerTowerRuntime(coreTowerId, 'core', 0, 0);
      set(init);
      E.reset(init);
      maybeSave();
      get().refreshUI();
    },

    newGame: () => get().startGame(true),
    continueGame: () => get().startGame(false),

    setPaused: (p) => set({ paused: p }),
    setSpeed: (s) => set({ speed: s }),

    // ---------- 波次 ----------
    onNightEnd: (result) => {
      set({ waveModal: result, phase: PHASES.MODAL, canBuildDuringNight: true });
      get().saveStats();
      get().maybeAutoSave();
    },
    nextWave: () => {
      const w = get().wave;
      const day = get().day;
      const nextDay = get().day + 1;
      set({
        phase: PHASES.DAY,
        wave: w + 1,
        day: nextDay,
        clock: DAY_DURATION,
        nightClock: 0,
        waveModal: null,
        directions: [],
        canBuildDuringNight: true,
        stats: { ...get().stats, day: nextDay, bestWave: Math.max(get().stats.bestWave, w + 1) },
      });
      get().maybeAutoSave();
      get().refreshUI();
    },

    startNight: () => {
      const w = get().wave;
      // 生成来袭方向预告
      const dirs = get().computeDirections(w);
      set({ phase: PHASES.NIGHT, nightClock: 0, directions: dirs, canBuildDuringNight: false });
      E.prepareSpawn(w, dirs);
      get().refreshUI();
    },

    // 计算本波进攻方向（2-5个，每5波全面8向，10/20七崩贤单方向）
    computeDirections: (w) => {
      const n = w + 1;
      if (n % 5 === 0) return allDirs();
      if (n % 10 === 0) return [pickBossDir()];
      // 魔族大潮（第7/14…天）：进攻方向+2
      const tide = get().day % 7 === 0 ? 2 : 0;
      const cnt = Math.min(2 + Math.min(3, Math.floor(w / 2)) + tide, 8);
      return pickDirs(cnt);
    },

    // ---------- 模式 ----------
    setMode: (m) => set({ mode: m, placingTowerId: null, regionBrush: null, selected: null }),
    setPlacing: (towerId) => set({ mode: 'build', placingTowerId: towerId, selected: null }),
    setRegionBrush: (type) => set({ mode: 'region', regionBrush: type, placingTowerId: null, selected: null }),
    cancelMode: () => set({ mode: 'none', placingTowerId: null, regionBrush: null }),

    selectEntity: (sel, info) => set({ selected: sel, selectionInfo: info }),

    // ---------- 区域 ----------
    createRegion: ({ type, x, z, w, h }) => {
      const rt = REGION_TYPES[type];
      if (!rt) return { ok: false, reason: '区域类型无效' };
      const minX = x, maxX = x + w, minZ = z, maxZ = z + h;
      if (maxX > MAP_SIZE / 2 - 4 || maxX < -MAP_SIZE / 2 + 4 || maxZ > MAP_SIZE / 2 - 4 || maxZ < -MAP_SIZE / 2 + 4) {
        return { ok: false, reason: '区域超出边界' };
      }
      // 重叠检测
      const overlap = get().regions.some((r) =>
        !(maxX <= r.minX || minX >= r.maxX || maxZ <= r.minZ || minZ >= r.maxZ));
      if (overlap) return { ok: false, reason: '与其他区域重叠' };
      if (minX >= maxX || minZ >= maxZ) return { ok: false, reason: '区域过小' };
      // 核心区只能有一个
      if (type === 'core' && get().regions.some((r) => r.type === 'core'))
        return { ok: false, reason: '魔力核心区仅一个' };
      const area = w * h;
      if ((type === 'core' || type === 'human' || type === 'workshop' || type === 'supply') && !rt.canPlaceOutsideRange) {
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
        if (distToCore(cx, cz) > get().core.range + 4) {
          return { ok: false, reason: '该区域类型需在魔力范围内' };
        }
      }
      const id = uid();
      set((s) => ({
        regions: [...s.regions, { id, type, name: rt.name, color: rt.color, minX, maxX, minZ, maxZ, x: minX, z: minZ, w, h, cap: rt.cap }],
        stats: { ...s.stats, areaCount: s.stats.areaCount + 1, areaSize: s.stats.areaSize + Math.round(area) },
      }));
      get().maybeAutoSave();
      return { ok: true, id };
    },

    // ---------- 魔法阵 ----------
    canPlaceTower,
    computeCost,

    placeTower: (defId, x, z) => {
      const res = canPlaceTower(defId, x, z);
      if (!res.ok) return res;
      const def = TOWERS[defId];
      const cost = computeCost(defId, 0);
      if (get().resources.crystal < cost.crystal || get().resources.wood < cost.wood)
        return { ok: false, reason: '资源不足' };
      const powered = distToCore(x, z) <= get().core.range + 4;
      const b = biomeAt(x, z);
      const id = uid();
      const rg = get().regions.find((r) => regionContains(r, x, z));
      const hp = typeof def.hp === 'function' ? def.hp(0) : def.hp;
      const tower = {
        id, defId, regionId: rg ? rg.id : null, name: def.name, x, z,
        level: 0, hp, maxHp: hp, pos: { x, z }, powered, category: def.category || def.region,
        color: def.color, biome: b,
      };
      set((s) => {
        const stats = { ...s.stats, builtTotal: s.stats.builtTotal + 1 };
        stats.built[defId] = (stats.built[defId] || 0) + 1;
        return {
          towers: [...s.towers, tower],
          resources: { ...s.resources, crystal: s.resources.crystal - cost.crystal, wood: s.resources.wood - cost.wood },
          stats,
        };
      });
      registerTowerRuntime(id, defId, x, z, powered);
      get().refreshUI();
      return { ok: true, tower };
    },

    upgradeTower: (id) => {
      const t = get().towers.find((x) => x.id === id);
      if (!t) return;
      const def = TOWERS[t.defId];
      const lvl = t.level;
      if (def.maxLevel && lvl >= def.maxLevel) return;
      const next = def.upgrade(lvl);
      const cost = { crystal: next.cost, wood: Math.round(next.cost * 0.4) };
      if (get().resources.crystal < cost.crystal || get().resources.wood < cost.wood) return;
      set((s) => ({
        towers: s.towers.map((x) => (x.id === id ? { ...x, level: lvl + 1, maxHp: t.maxHp * 1.12, hp: t.maxHp * 1.12 * 1.2 } : x)),
        resources: { ...s.resources, crystal: s.resources.crystal - cost.crystal, wood: s.resources.wood - cost.wood },
      }));
      E.markTowerUpgraded(id);
      get().refreshUI();
    },

    demolishTower: (id) => {
      const t = get().towers.find((x) => x.id === id);
      if (!t || t.defId === 'core') return;
      const def = TOWERS[t.defId];
      const refund = Math.round(computeCost(t.defId, t.level).crystal * 0.5);
      set((s) => ({
        towers: s.towers.filter((x) => x.id !== id),
        resources: { ...s.resources, crystal: s.resources.crystal + refund },
        selected: s.selected && s.selected.id === id ? null : s.selected,
        selectionInfo: null,
      }));
      removeTowerRuntime(id);
      get().refreshUI();
    },

    upgradeCore: () => {
      const c = get().core;
      const costs = [100, 250, 500, 1000, 2000];
      if (c.level >= 5) return;
      const cost = costs[c.level];
      if (get().resources.crystal < cost) return;
      set((s) => ({
        core: { ...s.core, level: c.level + 1, range: 50 + (c.level + 1) * 10, maxHp: s.core.maxHp * 1.3, hp: s.core.maxHp * 1.3 },
        resources: { ...s.resources, crystal: s.resources.crystal - cost },
        stats: { ...s.stats, coreLevel: c.level + 1 },
      }));
      E.markCoreUpgraded();
      get().refreshUI();
    },

    // 每段时间UI节流刷新（由画布调用）
    refreshUI: () => {
      const s = get();
      set({
        popCap: Math.max(6, s.towers.filter((t) => t.defId === 'house').length * 3 + 6),
        selectionInfo: s.selected ? getSelectionDetail(s.selected) : null,
      });
    },

    serialize: () => {
      const s = get();
      return {
        fortress: s.fortress, day: s.day, wave: s.wave, resources: s.resources,
        core: s.core, regions: s.regions, towers: s.towers, stats: s.stats,
        popCap: s.popCap,
      };
    },

    deserialize: () => {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        // 重新注册运行时塔
        d.towers.forEach((t) => registerTowerRuntime(t.id, t.defId, t.x, t.z, t.powered));
        return d;
      } catch (e) { return null; }
    },

    saveStats: () => {
      try {
        const old = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
        const merged = { ...old, ...get().stats };
        merged.playSeconds = Math.max(old.playSeconds || 0, get().stats.playSeconds);
        localStorage.setItem(STATS_KEY, JSON.stringify(merged));
      } catch (e) {}
    },

    maybeAutoSave: () => {
      if (get().phase !== PHASES.MENU && get().phase !== PHASES.LOST) maybeSave();
    },

    setToast: (t) => set({ toastMsg: { text: t, t: Date.now() } }),

    refreshForRender: (patch) => set(patch),
  };
});

// 六种敌军类型定义（enemies helper）
export function getSelectionDetail(sel) {
  if (!sel) return null;
  if (sel.type === 'core') {
    const s = useGame.getState();
    const c = s.core;
    return { type: 'core', title: '魔力核心', stats: [
      ['等级', `Lv.${c.level}`], ['HP', `${Math.max(0, Math.round(c.hp))}/${c.maxHp}`],
      ['能量范围', `${c.range} 单位`], ['全图HP加成', `+${c.level * 3}%`],
    ], desc: '芙莉莲的要塞之魂。范围内魔法阵才能正常运作，被摧毁则要塞陷落。' };
  }
  if (sel.type === 'region') {
    const r = useGame.getState().regions.find((rg) => rg.id === sel.id);
    const s = useGame.getState();
    if (!r) return null;
    const towers = s.towers.filter((t) => t.regionId === r.id);
    const rt = REGION_TYPES[r.type];
    return { type: 'region', title: rt.name, color: r.color, stats: [
      ['面积', `${Math.round(r.w * r.h)} 单位²`], ['已放置', `${towers.length}`],
      ['容量', rt.cap === 0 ? '不限' : `${towers.length}/${rt.cap}`],
    ], desc: rt.desc };
  }
  if (sel.type === 'tower') {
    const s = useGame.getState();
    const t = s.towers.find((x) => x.id === sel.id);
    if (!t) return null;
    const def = TOWERS[t.defId];
    const next = def.upgrade ? def.upgrade(t.level) : null;
    return {
      type: 'tower', title: t.name, color: def.color,
      id: t.id, defId: t.defId, level: t.level, maxLevel: def.maxLevel,
      powered: t.powered,
      stats: [
        ['等级', `Lv.${t.level}${t.level >= def.maxLevel ? '（满级）' : ''}`],
        ['HP', `${Math.round(t.hp)}/${Math.round(t.maxHp)}`],
        ['状态', t.powered ? '已连接魔力 ✓' : '魔力断开（弱化）'],
      ],
      desc: def.desc,
      cost: next ? { crystal: next.cost, wood: Math.round(next.cost * 0.4) } : null,
      flavor: def.flavorAtMax,
    };
  }
  if (sel.type === 'land') {
    const s = useGame.getState();
    const b = biomeAt(sel.x, sel.z);
    const biomeNames = { plain: '平原', hill: '丘陵', mountain: '山脉', snow: '雪原', water: '水域', swamp: '沼泽', forest: '森林', canyon: '峡谷' };
    return { type: 'land', title: `${biomeNames[b] || b}地形`, stats: [['高度', `${Math.round(heightAt(sel.x, sel.z))}`]], desc: sel.msg || '' };
  }
  if (sel.type === 'enemy') return { type: 'enemy', title: sel.stats?.name || '魔族', stats: sel.stats || [], desc: '魔族正在逼近！' };
  return null;
}

// 方向工具
const DIR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const DIR_LABEL = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
function allDirs() { return DIR_ANGLES.map((a, i) => ({ angle: a, label: DIR_LABEL[i] })); }
function pickDirs(n) {
  const idxs = DIR_ANGLES.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
  return idxs.slice(0, n).map((i) => ({ angle: DIR_ANGLES[i], label: DIR_LABEL[i] }));
}
function pickBossDir() { const i = Math.floor(Math.random() * 8); return { angle: DIR_ANGLES[i], label: DIR_LABEL[i], boss: true }; }

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));