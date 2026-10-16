import {
  MAP_SIZE, NAV_SIZE, WATER_LEVEL, PHASES, ENEMIES, TOWERS,
} from './constants.js';
import { heightAt, biomeAt, biomeSpeed } from './terrain/terrain.js';
import { useGame, uid, clamp, rand } from './store.js';

const HALF = MAP_SIZE / 2;
const CELL = MAP_SIZE / NAV_SIZE;

// ============ 运行时全局（可变） ============
export const E = {
  enemies: [],
  projectiles: [],
  particles: [],
  towers: new Map(),      // runtime tower 附加数据
  spawnQueue: [],
  nightTime: 0,
  spawnBudget: 0,
  produced: 0,            // 生产计时
  potential: null,        // 导航势场 → core
  bestWave: 0,
  elapsed: 0,
  shake: 0,
  coreAttacked: false,
  fx: [],                 // 提示/特效标记
};

// ============ 工具 ============
const w2c = (wx) => Math.floor(clamp((wx + HALF) / CELL, 0, NAV_SIZE - 1));
const cellCenter = (ci) => ci * CELL + CELL / 2 - HALF;

const axios = { 'core': { 6: 0 }, '0': 0 };

// ---------- 导航势场 ----------
function buildNav() {
  const G = NAV_SIZE, N = G * G;
  const pot = new Float32Array(N).fill(Infinity);
  const pass = new Uint8Array(N);
  for (let zi = 0; zi < G; zi++) {
    for (let xi = 0; xi < G; xi++) {
      const cx = cellCenter(xi), cz = cellCenter(zi);
      const b = biomeAt(cx, cz);
      pass[zi * G + xi] = (b === 'water' || b === 'mountain') ? 0 : 1;
    }
  }
  const cIdx = w2c(0) + w2c(0) * G;
  pot[cIdx] = 0;
  const open = [cIdx];
  const visited = new Uint8Array(N);
  const costOf = (b) => (b === 'forest' ? 1.7 : b === 'swamp' ? 2.4 : b === 'hill' ? 1.15 : b === 'snow' ? 1.05 : b === 'plain' ? 1 : 99);
  while (open.length) {
    // 取当前最小（简单扫描，G 较小可接受）
    let best = 0;
    for (let i = 1; i < open.length; i++) if (pot[open[i]] < pot[open[best]]) best = i;
    const cur = open.splice(best, 1)[0];
    if (visited[cur]) continue;
    visited[cur] = 1;
    const cx = cur % G, cz = Math.floor(cur / G);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx, dz] of dirs) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= G || nz >= G) continue;
      const nIdx = nz * G + nx;
      if (visited[nIdx] || !pass[nIdx]) continue;
      const diagonal = dx !== 0 && dz !== 0;
      const cb = biomeAt(cellCenter(nx), cellCenter(nz));
      const w = (diagonal ? 1.41 : 1) * costOf(cb);
      const nd = pot[cur] + w;
      if (nd < pot[nIdx]) { pot[nIdx] = nd; open.push(nIdx); }
    }
  }
  E.potential = { G, pot, pass };
}

function goalDir(x, z) {
  // 返回指向 core 的归一化向量（瞬时）
  const d = Math.hypot(x, z) || 1;
  return { x: -x / d, z: -z / d, dist: d };
}

function moveEnemy(en, dt) {
  const { pot, G } = E.potential || {};
  // 选择最佳邻居
  let best = null, bestScore = Infinity;
  const cxi = w2c(en.x), czi = w2c(en.z);
  const look = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1],[2,0],[-2,0],[0,2],[0,-2]];
  if (pot) {
    for (const [dx, dz] of look) {
      const nx = cxi + dx, nz = czi + dz;
      if (nx < 0 || nz < 0 || nx >= G || nz >= G) continue;
      const score = pot[nz * G + nx];
      if (score < bestScore) { bestScore = score; best = { x: nx, z: nz }; }
    }
  }
  let tx = 0, tz = 0;
  if (best) { tx = cellCenter(best.x) + rand(-CELL * 0.15, CELL * 0.15); tz = cellCenter(best.z) + rand(-CELL * 0.15, CELL * 0.15); }
  else { const g = goalDir(en.x, en.z); tx = en.x + g.x * 10; tz = en.z + g.z * 10; }
  const dx = tx - en.x, dz = tz - en.z;
  const len = Math.hypot(dx, dz) || 1;
  const b = biomeAt(en.x, en.z);
  let sp = en.speed * biomeSpeed(b) * en.slowFactor;
  // 束缚减速区由引擎每帧设置 en.slowFactor
  en.x += (dx / len) * sp * dt;
  en.z += (dz / len) * sp * dt;
  en.slowFactor = Math.max(1, en.slowFactor - dt * 0.2);
}

function findNearestTower(x, z, maxR, predicate) {
  const state = useGame.getState();
  let best = null, bd = maxR * maxR;
  for (const t of state.towers) {
    if (!predicate || !predicate(t)) continue;
    const d = (t.x - x) ** 2 + (t.z - z) ** 2;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// ---------- 生成波次 ----------
export function buildWaveCounts(wave, dirs) {
  const w = wave + 1;
  const baneWave = w % 10 === 0;
  const fullAssault = w % 5 === 0;
  let dirCount = fullAssault ? 8 : dirs.length;
  if (dirCount === 0) dirCount = 2;
  const events = [];
  const base = 3 + wave * 1.4;
  const types = ['soldier', 'scout', 'big', 'ogre', 'shadow'];
  for (let d = 0; d < dirCount; d++) {
    // 每方向主题
    const theme = types[(d + wave) % types.length];
    let count = Math.round(base * (theme === 'big' ? 0.45 : theme === 'ogre' ? 0.18 : 1));
    for (let i = 0; i < count; i++) {
      const angle = ((fullAssault ? d * 45 : d * (360 / dirCount)) * Math.PI) / 180;
      const R = HALF + 30;
      const sx = Math.cos(angle) * R, sz = Math.sin(angle) * R;
      let type = theme;
      if (Math.random() < 0.18 && theme === 'soldier') type = 'scout';
      if (Math.random() < 0.1 && theme === 'soldier') type = 'big';
      const delay = i * rand(0.4, 1.1) + d * rand(1.5, 4);
      events.push({ type, delay, x: sx, z: sz });
    }
  }
  if (baneWave) {
    const dir = dirs[0] || { angle: 0 };
    const a = (dir.angle * Math.PI) / 180;
    const R = HALF + 30;
    events.push({ type: 'bane', delay: 12, x: Math.cos(a) * R, z: Math.sin(a) * R });
  }
  return events;
}

// ---------- 波次准备 ----------
export function prepareSpawn(wave, dirs) {
  E.spawnQueue = buildWaveCounts(wave, dirs);
  E.nightTime = 0;
}

export function reset(init) {
  E.enemies = []; E.projectiles = []; E.particles = []; E.towers = new Map(); E.fx = [];
  E.elapsed = 0; E.shake = 0; E.coreAttacked = false; E.bestWave = 0; E.produced = 0;
  buildNav();
  init.towers.forEach((t) => registerTowerRuntime(t.id, t.defId, t.x, t.z, t.powered));
}

// ---------- 运行时塔 ----------
export function registerTowerRuntime(id, defId, x, z, powered = true) {
  const def = TOWERS[defId];
  E.towers.set(id, {
    id, defId, x, z, level: 0, powered: powered !== false,
    cd: 0, hp: typeof def.hp === 'function' ? def.hp(0) : (def.hp || 200),
    maxHp: typeof def.hp === 'function' ? def.hp(0) : (def.hp || 200),
    flash: 0, born: 0, // 放置浮现动画
    phantomHp: 0, attackTargets: new Map(), // 陷阱冷却
  });
}
export function removeTowerRuntime(id) { E.towers.delete(id); }
export function markTowerUpgraded(id) { const t = E.towers.get(id); if (t) t.level++; }
export function markCoreUpgraded() {
  // 提升核心塔血量
  const state = useGame.getState();
  const t = E.towers.get(state.towers.find((x) => x.defId === 'core')?.id);
  if (t) { t.maxHp = state.core.maxHp; }
}

function spawnEnemy(event, wave) {
  // 魔族从山口（16条通道）进入战场，避免出生在高山/水面
  const ang0 = Math.atan2(event.z, event.x);
  const step = Math.PI / 8;
  const snapped = Math.round(ang0 / step) * step;
  const R = HALF - 70 + rand(-20, 10);
  const sx = Math.cos(snapped) * R, sz = Math.sin(snapped) * R;
  const def = ENEMIES[event.type];
  const hpMul = 1 + wave * 0.32;
  const radius = def.size;
  const e = {
    id: uid(), type: event.type, name: def.name, x: sx, z: sz,
    hp: def.hp * hpMul * (def.boss ? 1 : 1), maxHp: def.hp * hpMul,
    speed: def.speed * (1 + Math.min(0.5, wave * 0.015)),
    dmg: def.dmg, drop: def.drop, size: radius, color: def.color,
    targets: def.targets, boss: !!def.boss, stealth: !!def.stealth,
    state: 'march', slowFactor: 1, hitCooldown: 0, spawnFlash: 0.8, radius,
  };
  E.enemies.push(e);
}

// ---------- 播放音效（由audio导出，注入避免循环依赖） ----------
let _sfx = null;
export function injectSfx(sfx) { _sfx = sfx; }
function sfx(name) { if (_sfx) _sfx(name); }

// ---------- 主更新 ----------
export function update(dt, state) {
  const g = state;
  E.elapsed += dt;
  E.shake = Math.max(0, E.shake - dt);
  // 防御模式下暂停真实推进？UI暂停仍推进视觉（这里不做，暂停在画布控制调用）

  // 战斗只在夜间
  if (g.phase === PHASES.NIGHT) {
    E.nightTime += dt;
    // 生成
    while (E.spawnQueue.length && E.spawnQueue[0].delay <= E.nightTime) {
      const ev = E.spawnQueue.shift();
      // 方向预告前3秒
      spawnEnemy(ev, g.wave);
      sfx('spawn');
    }
  }

  // ---------- 产出（白昼与夜间均可，每5秒） ----------
  E.produced += dt;
  if (E.produced >= 5) {
    E.produced = 0;
    const add = { crystal: 0, wood: 0, food: 0 };
    let pop = 0;
    for (const t of g.towers) {
      const def = TOWERS[t.defId];
      const prod = def.produce;
      const boosted = boostForTower(state, t);
      if (prod) {
        add.crystal += (prod.crystal || 0) * boosted;
        add.wood += (prod.wood || 0) * boosted;
        add.food += (prod.food || 0) * boosted;
      }
      // 人口由民居提供
      if (t.defId === 'house') pop++;
    }
    if (add.crystal || add.wood || add.food) {
      useGame.getState().addResources(add);
    }
  }

  // ---------- 魔法阵生效 ----------
  const state2 = useGame.getState();
  applyTowerAbilities(dt, state2);

  // ---------- 敌人 ----------
  updateEnemies(dt, state2);

  // ---------- 弹道 ----------
  updateProjectiles(dt, state2);

  // ---------- 粒子 ----------
  updateParticles(dt);

  // ---------- 胜负判定 ----------
  checkEnd(state2);
}

function boostForTower(state, t) {
  const region = state.regions.find((r) => r.id === t.regionId);
  let b = 1;
  // 魔法工坊区内 魔力结晶矿 计数提升产出
  if (region && region.type === 'workshop') {
    const mines = state.towers.filter((x) => x.regionId === region.id && x.defId === 'mine').length;
    b += Math.min(0.3, mines * 0.05);
  }
  // 邻近魔法工坊区 +10%（人类居住区靠近魔法工坊区）
  if (t.defId === 'house') {
    const near = state.regions.some((r) => r.type === 'workshop' && r.id !== t.regionId &&
      rectNear(region, r, 40));
    if (near) b += 0.1;
  }
  return b;
}

function rectNear(a, b, tol) {
  if (!a || !b) return false;
  return !(a.maxX + tol < b.minX || b.maxX + tol < a.minX || a.maxZ + tol < b.minZ || b.maxZ + tol < a.minZ);
}

function applyTowerAbilities(dt, state) {
  const coreS = state.core;
  for (const t of state.towers) {
    const rt = E.towers.get(t.id);
    if (!rt) continue;
    rt.cd = Math.max(0, (rt.cd || 0) - dt);
    rt.flash = Math.max(0, (rt.flash || 0) - dt);
    rt.hp = t.hp; rt.maxHp = t.maxHp;
    const def = TOWERS[t.defId];
    const lvl = t.level;
    const powered = t.powered && rt.powered !== false;
    if (!powered) {
      // 范围外：效率减半
      continue;
    }
    // 全局加成
    const library = state.towers.filter((x) => x.defId === 'library').length;
    const research = state.towers.filter((x) => x.defId === 'research').length;
    const mineAdj = neighborCount(state, t, 'mine');
    const depotAdj = neighborCount(state, t, 'depot');

    if (t.defId === 'attack') {
      const baseRange = def.range(lvl);
      // 探测加成
      const detectB = nearbyDefs(state, t, 'detect').length;
      const rangeBoost = baseRange * (1 + 0.2 * Math.min(3, detectB));
      // 相邻攻击魔法阵 攻击范围+10%（叠3次）
      const adjAtk = neighborCount(state, t, 'attack');
      const finalRange = rangeBoost * (1 + 0.1 * Math.min(3, adjAtk));
      const target = nearestEnemyInRange(t.x, t.z, finalRange, t);
      if (target && rt.cd <= 0) {
        const baseAtk = def.atk(lvl);
        let dmg = baseAtk;
        // 区域协同：魔法阵区内每有1攻击魔法阵 → 防御阵攻击力（这里作用于全域）简化叠加
        const inMagic = state.towers.filter((x) => x.defId === 'attack').length;
        dmg *= 1 + Math.min(0.3, inMagic * 0.01);
        // 产后效率
        dmg *= 1 + Math.min(0.4, research * 0.03) + Math.min(0.4, depotAdj * 0.03);
        // 探测范围已算
        // 满级弑魔魔法翻倍
        if (lvl >= def.maxLevel) dmg *= 2;
        // 地形：峡谷防御魔法阵攻击+20% / 山脉探测视野等
        const b = biomeAt(t.x, t.z);
        if (b === 'canyon') dmg *= 1.2;
        if (b === 'mountain') {} 
        fireProjectile({ x: t.x, y: heightAt(t.x, t.z) + 4, z: t.z }, target, dmg, lvl);
        rt.cd = def.rof(lvl) || 0.5;
        rt.flash = 0.12;
        sfx('fire');
      }
    } else if (t.defId === 'bind') {
      const r = def.range(lvl);
      for (const e of E.enemies) {
        const d = Math.hypot(e.x - t.x, e.z - t.z);
        if (d < r) e.slowFactor = Math.max(e.slowFactor, 1 + def.slow(lvl));
      }
    } else if (t.defId === 'shield') {
      // 生成屏障：靠近的魔族转而攻击
      const r = def.sizeRadius || 6;
      for (const e of E.enemies) {
        const d = Math.hypot(e.x - t.x, e.z - t.z);
        if (d < 7 && !e.boss) { e.state = 'blocked'; e.towerTargetId = t.id; }
      }
    } else if (t.defId === 'illusion') {
      // 幻影吸引附近魔族
      const phHp = rt.phantomHp || 0;
      for (const e of E.enemies) {
        const d = Math.hypot(e.x - t.x, e.z - t.z);
        if (d < 16 && !e.towerTargetId && !e.boss) { e.towerTargetId = t.id; }
      }
      if (phHp <= 0) rt.phantomHp = 1; // 需要抽取血量由敌人攻击逻辑处理
    } else if (t.defId === 'trap') {
      const r = 5;
      for (const e of E.enemies) {
        const d = Math.hypot(e.x - t.x, e.z - t.z);
        if (d < r) {
          const key = e.id;
          if (!rt.attackTargets.has(key)) {
            const dmg = def.trap(lvl) * trapBoost(state, t);
            damageEnemy(state, e, dmg, t, true);
            rt.attackTargets.set(key, true);
            E.fx.push({ x: t.x, z: t.z, t: 0.3, color: '#9AA5B1' });
            sfx('trap');
            if (rt.attackTargets.size > 200) rt.attackTargets.clear();
          }
        }
      }
    }
  }
}

function trapBoost(state, t) {
  // 前哨区每1个陷阱 该区域陷阱伤害+10%
  const rg = state.regions.find((r) => r.id === t.regionId);
  if (!rg) return 1;
  const n = state.towers.filter((x) => x.regionId === rg.id && x.defId === 'trap').length;
  return 1 + 0.1 * n;
}

function neighborCount(state, t, defId, tol = 14) {
  let c = 0;
  for (const o of state.towers) {
    if (o.defId !== defId || o.id === t.id) continue;
    const d = Math.hypot(o.x - t.x, o.z - t.z);
    if (d < tol) c++;
  }
  return c;
}
function nearbyDefs(state, t, defId, tol = 40) {
  const out = [];
  for (const o of state.towers) if (o.defId === defId && Math.hypot(o.x - t.x, o.z - t.z) < tol) out.push(o);
  return out;
}
function nearestEnemyInRange(x, z, range, tower) {
  let best = null, bd = range * range;
  for (const e of E.enemies) {
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function fireProjectile(from, target, dmg, lvl) {
  E.projectiles.push({
    x: from.x, y: from.y, z: from.z, targetId: target.id, dmg,
    speed: 70, color: lvl >= 3 ? '#FFD0FF' : '#4A9EFF', life: 3,
  });
}

function updateEnemies(dt, state) {
  const core = state.core;
  const coreId = state.towers.find((t) => t.defId === 'core')?.id;
  const toRemove = [];
  for (const e of E.enemies) {
    e.hitCooldown = Math.max(0, e.hitCooldown - dt);
    e.spawnFlash = Math.max(0, e.spawnFlash - dt);
    // ===== AI 有限状态机 =====
    // 1) 攻击指定目标（屏障/幻影/塔）
    if (e.towerTargetId) {
      const tt = state.towers.find((t) => t.id === e.towerTargetId);
      if (tt && !TOWERS[tt.defId].isDoor) {
        const d = Math.hypot(tt.x - e.x, tt.z - e.z);
        if (d < 8 && e.hitCooldown <= 0) {
          attackTower(state, tt, e);
          e.hitCooldown = 1;
        } else if (d < 30) {
          // 走向目标塔
          const g = dirTo(e, tt.x, tt.z);
          const b = biomeAt(e.x, e.z);
          e.x += g.x * e.speed * biomeSpeed(b) * e.slowFactor * dt;
          e.z += g.z * e.speed * biomeSpeed(b) * e.slowFactor * dt;
          e.slowFactor = Math.max(1, e.slowFactor - dt * 2);
        } else { e.towerTargetId = null; }
      } else { e.towerTargetId = null; }
      // 目标被摧毁则继续
    }
    // 2) 有重大目标（大魔族/巨魔）优先攻击魔法阵
    else if (e.targets === 'tower') {
      const att = findNearestTower(e.x, e.z, 20, (t) => t.defId !== 'core');
      if (att) {
        const d = Math.hypot(att.x - e.x, att.z - e.z);
        if (d < 9 && e.hitCooldown <= 0) { attackTower(state, att, e); e.hitCooldown = 1; }
        else { const g = dirTo(e, att.x, att.z); const b = biomeAt(e.x, e.z); e.x += g.x * e.speed * biomeSpeed(b) * e.slowFactor * dt; e.z += g.z * e.speed * biomeSpeed(b) * e.slowFactor * dt; e.slowFactor = Math.max(1, e.slowFactor - dt); }
      } else moveEnemy(e, dt);
    }
    // 3) 普通魔族向核心推进；若在核心范围内攻击核心
    else {
      const dc = Math.hypot(e.x, e.z);
      if (dc < 10 && e.hitCooldown <= 0) {
        // 攻击魔力核心（受攻击冷却约束）
        attackCore(state, e);
        e.hitCooldown = 1;
      } else if (dc >= 10) {
        moveEnemy(e, dt);
      }
    }
    // 边界防守
    if (e.hp <= 0) toRemove.push(e);
  }
  for (const e of toRemove) {
    E.enemies = E.enemies.filter((x) => x.id !== e.id);
  }
}

function dirTo(e, x, z) { const d = Math.hypot(x - e.x, z - e.z) || 1; return { x: (x - e.x) / d, z: (z - e.z) / d }; }

function attackTower(state, tower, e) {
  const rt = E.towers.get(tower.id);
  const dmg = e.dmg;
  const hp = Math.max(0, tower.hp - dmg);
  // 更新 state
  state.refreshForRender({ towers: state.towers.map((t) => t.id === tower.id ? { ...t, hp } : t) });
  if (hp <= 0 && tower.defId !== 'core') {
    // 拆除该塔
    state.demolishTower(tower.id);
    E.fx.push({ x: tower.x, z: tower.z, t: 0.5, color: '#E53E3E' });
    sfx('destroy');
  }
}

function attackCore(state, e) {
  const core = state.core;
  const hp = Math.max(0, core.hp - e.dmg);
  state.refreshForRender({ core: { ...core, hp }, underAttack: true });
  E.coreAttacked = true;
  E.shake = Math.max(E.shake, 0.25);
  sfx('coreHit');
}

function damageEnemy(state, e, dmg, source, byTrap) {
  e.hp -= dmg;
  if (e.hp <= 0) killEnemy(state, e, source);
}

function killEnemy(state, e, source) {
  E.enemies = E.enemies.filter((x) => x.id !== e.id);
  // 掉落/统计
  const def = ENEMIES[e.type];
  const drops = def.drop;
  state.addResources({ crystal: drops });
  const s = state.refreshForRender({
    murderCount: { ...state.murderCount, [e.type]: (state.murderCount[e.type] || 0) + 1 },
    stats: { ...state.stats, kills: state.stats.kills + 1, killsByType: { ...state.stats.killsByType, [e.type]: (state.stats.killsByType[e.type] || 0) + 1 } },
  });
  // 粒子
  for (let i = 0; i < 12; i++) {
    E.particles.push({
      x: e.x, y: heightAt(e.x, e.z) + 2, z: e.z,
      vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3),
      life: rand(0.4, 0.8), color: e.color, size: rand(0.6, 1.4),
    });
  }
  E.shake = Math.max(E.shake, 0.12);
  sfx('die');
}

function updateProjectiles(dt, state) {
  const gone = [];
  for (const p of E.projectiles) {
    p.life -= dt;
    const target = E.enemies.find((x) => x.id === p.targetId);
    if (!target || p.life <= 0) { gone.push(p); continue; }
    const g = dirTo(p, target.x, target.z);
    p.x += g.x * p.speed * dt;
    p.z += g.z * p.speed * dt;
    p.y = heightAt(p.x, p.z) + 3;
    if (Math.hypot(p.x - target.x, p.z - target.z) < target.size + 1.2) {
      damageEnemy(state, target, p.dmg, p);
      for (let i = 0; i < 6; i++) E.particles.push({ x: target.x, y: heightAt(target.x, target.z) + 3, z: target.z, vx: rand(-2,2), vy: rand(1,4), vz: rand(-2,2), life: 0.4, color: '#4A9EFF', size: 0.7 });
      gone.push(p);
    }
  }
  for (const p of gone) E.projectiles = E.projectiles.filter((x) => x !== p);
}

function updateParticles(dt) {
  for (const p of E.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 3 * dt;
  }
  E.particles = E.particles.filter((p) => p.life > 0);
  for (const f of E.fx) f.t -= dt;
  E.fx = E.fx.filter((f) => f.t > 0);
}

function checkEnd(state) {
  if (state.core.hp <= 0) {
    state.refreshForRender({ phase: PHASES.LOST, underAttack: true });
    state.saveStats();
    return;
  }
  // 夜间清场 → 结算
  if (state.phase === PHASES.NIGHT && E.spawnQueue.length === 0 && E.enemies.length === 0) {
    const result = {
      wave: state.wave, day: state.day,
      kills: state.stats.kills,
      killsByType: { ...state.stats.killsByType },
      gained: state.resources, // 简化
      lostTowers: 0, lostCoreHp: state.core.maxHp - state.core.hp,
    };
    state.onNightEnd(result);
  }
}

// 供 UI/画布使用
export function enemyStats(e) {
  const def = ENEMIES[e.type];
  return [
    ['名称', def.name], ['HP', `${Math.max(0, Math.round(e.hp))}/${Math.round(e.maxHp)}`],
    ['类型', def.targets === 'tower' ? '攻击魔法阵' : '冲击核心'], ['掉落结晶', def.drop],
  ];
}

// 同步运行时生命值（从 state 拉取塔的 HP 到 runtime）
export function syncTower(state) {
  for (const t of state.towers) {
    const rt = E.towers.get(t.id);
    if (rt) { rt.pos = { x: t.x, z: t.z }; rt.level = t.level; rt.powered = t.powered; }
  }
}