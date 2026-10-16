import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MAP_SIZE, TOWERS, REGION_TYPES, PHASES, WATER_LEVEL } from '../game/constants.js';
import { heightAt, biomeAt } from '../game/terrain/terrain.js';
import { E } from '../game/engine.js';
import { useGame } from '../game/store.js';
import { on } from '../game/bus.js';
import { playSfx } from '../game/audio.js';

const HALF = MAP_SIZE / 2;
const ENEMY_COLORS = { soldier: '#8B5CF6', scout: '#B48CF6', big: '#E53E3E', ogre: '#FFD700', shadow: '#5a3a6a', bane: '#FFD700' };
const ENEMY_TYPES = ['soldier', 'scout', 'big', 'ogre', 'shadow', 'bane'];

// ================= 地形 =================
function Terrain({ terrain }) {
  const meshRef = useRef();
  useMemo(() => {
    const g = terrain.geometry;
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const shades = {
      plain: [42,61,42], hill: [74,61,42], mountain: [48,56,76],
      snow: [228,234,246], water: [26,42,74], swamp: [42,42,61],
      forest: [25,46,25], canyon: [15,21,32],
    };
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i); const wz = pos.getZ(i);
      const h = heightAt(wx, wz);
      pos.setY(i, h);
      const sh = shades[biomeAt(wx, wz)] || [42, 61, 42];
      const n = 0.82 + Math.random() * 0.18;
      colors[i * 3] = sh[0] / 255 * n; colors[i * 3 + 1] = sh[1] / 255 * n; colors[i * 3 + 2] = sh[2] / 255 * n;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    pos.needsUpdate = true;
  }, [terrain]);
  return (
    <mesh ref={meshRef} receiveShadow>
      <primitive object={terrain.geometry} attach="geometry" />
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

function Water() {
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = WATER_LEVEL + Math.sin(clock.elapsedTime * 0.6) * 0.15; });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_LEVEL, 0]}>
      <planeGeometry args={[MAP_SIZE, MAP_SIZE, 8, 8]} />
      <meshStandardMaterial color="#1A2A4A" transparent opacity={0.8} roughness={0.25} metalness={0.2} />
    </mesh>
  );
}

function Forest({ trees }) {
  const instRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mat = useMemo(() => new THREE.Matrix4(), []);
  useMemo(() => {
    const n = trees.length;
    for (let i = 0; i < n; i++) {
      const t = trees[i];
      dummy.position.set(t.x, heightAt(t.x, t.z), t.z);
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 2 + Math.random() * 3;
      dummy.scale.set(s, s * (1.4 + Math.random()), s);
      dummy.updateMatrix();
      mat.copy(dummy.matrix);
      instRef.current?.setMatrixAt(i, mat);
    }
    if (instRef.current) instRef.current.instanceMatrix.needsUpdate = true;
  }, [trees]);
  return (
    <instancedMesh ref={instRef} args={[undefined, undefined, Math.max(1, trees.length)]} castShadow>
      <coneGeometry args={[1, 2.4, 6]} />
      <meshStandardMaterial color="#14301c" roughness={1} />
    </instancedMesh>
  );
}

// ================= 区域色块（世界坐标四边形，贴合地形） =================
function RegionPlate({ r, selected, onClick }) {
  const geo = useMemo(() => {
    const corners = [
      [r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ],
    ];
    const g = new THREE.BufferGeometry();
    const verts = [];
    for (const [cx, cz] of corners) verts.push(cx, heightAt(cx, cz) + 0.6, cz);
    // 对角线拆成两个三角形
    const idx = [0, 1, 2, 0, 2, 3];
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [r.minX, r.maxX, r.minZ, r.maxZ]);

  const edgePos = useMemo(() => {
    const a = [r.minX, heightAt(r.minX, r.minZ) + 0.6, r.minZ];
    const b = [r.maxX, heightAt(r.maxX, r.minZ) + 0.6, r.minZ];
    const c = [r.maxX, heightAt(r.maxX, r.maxZ) + 0.6, r.maxZ];
    const d = [r.minX, heightAt(r.minX, r.maxZ) + 0.6, r.maxZ];
    return new THREE.Float32BufferAttribute([...a, ...b, ...b, ...c, ...c, ...d, ...d, ...a], 3);
  }, [r.minX, r.maxX, r.minZ, r.maxZ]);

  return (
    <group>
      <mesh geometry={geo} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <meshBasicMaterial color={r.color} transparent opacity={selected ? 0.42 : 0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePos]} />
        </bufferGeometry>
        <lineBasicMaterial color={selected ? '#ffffff' : r.color} transparent opacity={selected ? 1 : 0.5} />
      </lineSegments>
    </group>
  );
}

// ================= 魔力核心范围 =================
function CoreAura() {
  const core = useGame((s) => s.core);
  const ref = useRef();
  useFrame(({ clock }) => { if (ref.current) { const s = 1 + Math.sin(clock.elapsedTime * 2) * 0.05; ref.current.scale.setScalar(s); } });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[core.x, 1.2, core.z]}>
      <ringGeometry args={[core.range, core.range + 2, 96]} />
      <meshBasicMaterial color="#5BC0DE" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ================= 塔模型 =================
function TowerMesh({ tower, onSelect }) {
  const y = heightAt(tower.x, tower.z);
  const m = towerShape(tower.defId, tower.level);
  const color = tower.powered ? m.color : '#666';
  const emissive = tower.powered ? m.color : '#222';
  return (
    <group
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {renderShape(tower, m, tower.x, y, tower.z)}
      {/* 攻击/束缚范围提示环 */}
      <RingIfRange tower={tower} />
    </group>
  );
}

function RingIfRange({ tower }) {
  const selected = useGame((s) => s.selected?.id === tower.id);
  const def = TOWERS[tower.defId];
  let range = def.range || 0;
  if (typeof range === 'function') range = range(tower.level);
  if (!selected || range <= 0) return null;
  const y = heightAt(tower.x, tower.z);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[tower.x, y + 1, tower.z]}>
      <ringGeometry args={[range, range + 0.6, 48]} />
      <meshBasicMaterial color="#4A9EFF" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

function renderShape(tower, m, x, y, z) {
  const pos = [x, y + 1.5, z];
  const simple = (geo, em = 0.45) => (
    <mesh position={pos}>
      {geo}
      <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={em} roughness={0.5} />
    </mesh>
  );
  switch (tower.defId) {
    case 'core': return (
      <group>
        <mesh position={[x, y + 2, z]}>
          <sphereGeometry args={[4, 20, 20]} />
          <meshStandardMaterial color="#5BC0DE" emissive="#5BC0DE" emissiveIntensity={0.9} />
        </mesh>
        {rangeRing(x, y, z, 4.4, '#5BC0DE', 0.5)}
        {rangeRing(x, y, z, 5.6, '#8fd0ff', 0.4)}
      </group>
    );
    case 'library': return <group>{simple(<boxGeometry args={[4, 3.4, 4]} />)}<mesh position={[x, y + 3.4, z]}><boxGeometry args={[2.2, 1, 2.2]} /><meshStandardMaterial color="#9fe6ff" emissive="#5BC0DE" emissiveIntensity={0.4} /></mesh></group>;
    case 'observatory': return simple(<coneGeometry args={[3.4, 6, 14]} />);
    case 'attack': return simple(<octahedronGeometry args={[tower.level >= 3 ? 3.6 : 2.6, 0]} />, tower.level >= 3 ? 0.9 : 0.5);
    case 'shield': return <mesh position={[x, y + 3, z]}><capsuleGeometry args={[2.6, 3, 6, 12]} /><meshStandardMaterial color="#9fb4c8" transparent opacity={0.85} emissive="#4A5568" emissiveIntensity={0.2} /></mesh>;
    case 'bind': return <group>{rangeRing(x, y, z, 3, '#5BC0DE', 0.6)}<mesh position={pos}><torusGeometry args={[1.6, 0.4, 8, 16]} /><meshStandardMaterial color="#5BC0DE" emissive="#5BC0DE" emissiveIntensity={0.5} /></mesh></group>;
    case 'illusion': return <group>{simple(<sphereGeometry args={[2.2, 14, 14]} />, 0.9)}</group>;
    case 'detect': return (
      <group>
        <mesh position={[x, y + 1.6, z]}><boxGeometry args={[0.8, 3.2, 0.8]} /><meshStandardMaterial color="#D4A843" emissive="#D4A843" emissiveIntensity={0.4} /></mesh>
        {rangeRing(x, y, z, 3, '#D4A843', 0.5)}
      </group>
    );
    case 'house': return (
      <group>
        <mesh position={[x, y + 1.3, z]}><boxGeometry args={[3, 2.6, 3]} /><meshStandardMaterial color="#5aa06a" /></mesh>
        <mesh position={[x, y + 3.2, z]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.7, 2, 4]} /><meshStandardMaterial color="#8a6a5a" /></mesh>
      </group>
    );
    case 'granary': return simple(<boxGeometry args={[3, 3, 3]} />);
    case 'well': return <group>{simple(<cylinderGeometry args={[2, 2.3, 1.6, 12]} />)}</group>;
    case 'bonfire': return (
      <group>
        <mesh position={[x, y + 1.6, z]}><coneGeometry args={[1.3, 2.6, 8]} /><meshStandardMaterial color="#FF9F43" emissive="#ff7a30" emissiveIntensity={0.9} /></mesh>
        <mesh position={[x, y + 0.6, z]}>{(<boxGeometry args={[1.8, 0.5, 1.8]} />)}<meshStandardMaterial color="#5a3a2a" /></mesh>
      </group>
    );
    case 'clinic': return <group>{simple(<boxGeometry args={[3, 2.4, 3]} />)}<mesh position={[x, y + 1.2, z]} rotation={[Math.PI / 2, 0, 0]}><boxGeometry args={[2.4, 0.5, 0.5]} /><meshStandardMaterial color="#e85d6a" /></mesh></group>;
    case 'mine': return <mesh position={[x, y + 2, z]}><octahedronGeometry args={[2.6, 0]} /><meshStandardMaterial color="#D4A843" emissive="#D4A843" emissiveIntensity={0.7} /></mesh>;
    case 'lumber': return <group>{[0, 1, 2].map((i) => <mesh key={i} position={[x + (i - 1) * 1.4, y + 1.2, z]} rotation={[0, 0, 0.4]}><cylinderGeometry args={[0.7, 0.9, 2.4, 6]} /><meshStandardMaterial color="#8b6d45" /></mesh>)}</group>;
    case 'research': return simple(<coneGeometry args={[2.6, 3.4, 4]} />);
    case 'herb': return simple(<sphereGeometry args={[1.8, 10, 10]} />);
    case 'ranch': return simple(<boxGeometry args={[3.2, 1.8, 3.2]} />, 0.1);
    case 'depot': return simple(<boxGeometry args={[3.6, 3, 3.6]} />);
    case 'station': return simple(<coneGeometry args={[2.4, 4.4, 6]} />);
    case 'supplydepot': return simple(<boxGeometry args={[4, 3, 4]} />);
    case 'trap': return <group>{rangeRing(x, y, z, 2.4, '#9AA5B1', 0.4)}</group>;
    case 'bait': return simple(<sphereGeometry args={[1.7, 12, 12]} />, 0.7);
    case 'barricade': return <mesh position={[x, y + 1.4, z]}><boxGeometry args={[3.2, 2.6, 1.4]} /><meshStandardMaterial color="#a0aa99" /></mesh>;
    default: return simple(<boxGeometry args={[2.4, 2.4, 2.4]} />);
  }
}

function rangeRing(x, y, z, r, color, op) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.7, z]}>
    <ringGeometry args={[r, r + 0.4, 24]} />
    <meshBasicMaterial color={color} transparent opacity={op} depthWrite={false} />
  </mesh>;
}

function towerShape(defId, lvl) {
  const c = TOWERS[defId]?.color || '#ffffff';
  return { color: c };
}

// ================= 敌人（InstancedMesh） =================
function Enemies() {
  const refs = useRef({});
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame(() => {
    const per = {};
    for (let i = 0; i < E.enemies.length; i++) { const e = E.enemies[i]; per[e.type] = (per[e.type] || 0) + 1; }
    for (const t of ENEMY_TYPES) {
      const inst = refs.current[t]; if (!inst) continue;
      const n = per[t] || 0;
      if (inst.count !== n) inst.count = n;
      let k = 0;
      for (let i = 0; i < E.enemies.length; i++) {
        const e = E.enemies[i]; if (e.type !== t) continue;
        dummy.position.set(e.x, heightAt(e.x, e.z) + e.size * 0.7, e.z);
        const sc = e.size * (e.spawnFlash > 0 ? 0.6 : 1);
        dummy.scale.setScalar(sc);
        dummy.rotation.y = Math.atan2(e.x, e.z);
        dummy.updateMatrix();
        matrix.copy(dummy.matrix);
        inst.setMatrixAt(k++, matrix);
      }
      if (n > 0) inst.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group>
      {ENEMY_TYPES.map((t) => (
        <instancedMesh key={t} ref={(el) => { if (el) refs.current[t] = el; }} args={[undefined, undefined, 400]} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={ENEMY_COLORS[t]} emissive={ENEMY_COLORS[t]} emissiveIntensity={0.55} />
        </instancedMesh>
      ))}
    </group>
  );
}

// ================= 弹道 =================
function Projectiles() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame(() => {
    const inst = ref.current; if (!inst) return;
    inst.count = E.projectiles.length;
    for (let i = 0; i < E.projectiles.length; i++) {
      const p = E.projectiles[i];
      dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(0.8); dummy.updateMatrix(); matrix.copy(dummy.matrix);
      inst.setMatrixAt(i, matrix);
    }
    if (E.projectiles.length) inst.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 500]} frustumCulled={false}>
      <sphereGeometry args={[0.7, 8, 8]} />
      <meshStandardMaterial color="#4A9EFF" emissive="#4A9EFF" emissiveIntensity={2.4} />
    </instancedMesh>
  );
}

// ================= 粒子 =================
const MAXP = 900;
function Particles() {
  const ref = useRef();
  useFrame(() => {
    const pts = ref.current; if (!pts) return;
    const n = Math.min(E.particles.length, MAXP);
    const pos = pts.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) { const p = E.particles[i]; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; }
    pts.geometry.setDrawRange(0, n);
    pts.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(MAXP * 3), 3]} />
      </bufferGeometry>
      <pointsMaterial size={1.4} color="#a06bff" transparent opacity={0.95} depthWrite={false} />
    </points>
  );
}

// ================= 来袭方向箭头 =================
function DirectionArrows() {
  const directions = useGame((s) => s.directions);
  const phase = useGame((s) => s.phase);
  if (phase !== PHASES.NIGHT || directions.length === 0) return null;
  return (
    <group>
      {directions.map((d, i) => {
        const a = (d.angle * Math.PI) / 180;
        const x = Math.cos(a) * (HALF - 40), z = Math.sin(a) * (HALF - 40);
        return (
          <mesh key={i} position={[x, heightAt(x, z) + 6, z]} rotation={[0, -a + Math.PI / 2, 0]}>
            <coneGeometry args={[5, 10, 4]} />
            <meshBasicMaterial color={d.boss ? '#FFD700' : '#8B5CF6'} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

// ================= 主场景 =================
export default function GameCanvas({ terrain, trees }) {
  const regionBrush = useGame((s) => s.regionBrush);
  const placingTowerId = useGame((s) => s.placingTowerId);
  const mode = useGame((s) => s.mode);
  const selected = useGame((s) => s.selected);
  const regions = useGame((s) => s.regions);
  const towers = useGame((s) => s.towers);

  const ghost = useRef(null);
  const drag = useRef({ active: false, start: null, cur: null });
  const controlsRef = useRef();
  const flyTarget = useRef(null);
  const [hoverValid, setHoverValid] = useState(null);

  const selCore = useGame((s) => s.core);

  // 右键取消
  useEffect(() => {
    const ctx = (e) => e.preventDefault();
    window.addEventListener('contextmenu', ctx);
    const down = (ev) => { if (ev.button === 2) { const st = useGame.getState(); if (st.mode === 'build' || st.mode === 'region') st.cancelMode(); } };
    window.addEventListener('pointerdown', down);
    return () => { window.removeEventListener('contextmenu', ctx); window.removeEventListener('pointerdown', down); };
  }, []);

  const interactionProps = {
    onPointerMove: (e) => {
      if (!e.intersections.length) return;
      const pt = e.point;
      ghost.current = { x: pt.x, z: pt.z };
      if (drag.current.active) drag.current.cur = { x: pt.x, z: pt.z };
      if (placingTowerId) {
        const res = useGame.getState().canPlaceTower(placingTowerId, pt.x, pt.z);
        if (res.ok !== hoverValid) setHoverValid(res.ok);
      }
    },
    onPointerDown: (e) => {
      if (e.delta > 5) return;
      if (mode === 'region' && regionBrush) {
        drag.current = { active: true, start: { x: e.point.x, z: e.point.z }, cur: { x: e.point.x, z: e.point.z } };
      }
    },
    onPointerUp: (e) => {
      if (mode === 'region' && regionBrush && drag.current.active) {
        const s = drag.current.start, c = drag.current.cur;
        drag.current.active = false;
        if (s && c) {
          const x = Math.min(s.x, c.x), z = Math.min(s.z, c.z);
          const w = Math.abs(s.x - c.x), h = Math.abs(s.z - c.z);
          if (w > 5 && h > 5) {
            const res = useGame.getState().createRegion({ type: regionBrush, x, z, w: Math.min(w, 100), h: Math.min(h, 100) });
            if (res.ok) { useGame.getState().setToast('区域已规划'); playSfx('build'); }
            else { useGame.getState().setToast(res.reason); }
          }
        }
      }
    },
    onDoubleClick: (e) => { if (e.point) flyTarget.current = { x: e.point.x, z: e.point.z }; },
  };

  const onGroundClick = (e) => {
    if (mode === 'build' && placingTowerId) {
      if (hoverValid) {
        const res = useGame.getState().placeTower(placingTowerId, e.point.x, e.point.z);
        if (res.ok) { setHoverValid(null); useGame.getState().cancelMode(); playSfx('place'); }
        else useGame.getState().setToast(res.reason);
      } else useGame.getState().setToast('无法在此建造');
      return;
    }
    if (mode === 'none' || mode === 'pan') {
      useGame.getState().selectEntity({ type: 'land', x: e.point.x, z: e.point.z }, null);
    }
  };

  const PlacementGhost = () => {
    if (!placingTowerId || !ghost.current) return null;
    const valid = hoverValid;
    const col = valid ? '#48BB78' : '#E53E3E';
    return (
      <group position={[ghost.current.x, heightAt(ghost.current.x, ghost.current.z) + 1.5, ghost.current.z]}>
        <mesh>
          <octahedronGeometry args={[2.2, 0]} />
          <meshStandardMaterial color={col} transparent opacity={0.55} emissive={col} emissiveIntensity={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <ringGeometry args={[3, 5, 20]} />
          <meshBasicMaterial color={col} transparent opacity={0.6} />
        </mesh>
      </group>
    );
  };

  const RegionPreview = () => {
    if (!drag.current.active || !drag.current.start || !drag.current.cur) return null;
    const s = drag.current.start, c = drag.current.cur;
    const x = Math.min(s.x, c.x), z = Math.min(s.z, c.z);
    const w = Math.abs(s.x - c.x), h = Math.abs(s.z - c.z);
    const col = REGION_TYPES[regionBrush]?.color || '#fff';
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x + w / 2, heightAt(x + w / 2, z + h / 2) + 1, z + h / 2]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={col} transparent opacity={0.32} depthWrite={false} />
      </mesh>
    );
  };

  const renderTower = (t) => (
    <TowerMesh key={t.id} tower={t} onSelect={() => {
      const st = useGame.getState();
      if (st.mode === 'demolish' && t.defId !== 'core') { st.demolishTower(t.id); playSfx('destroy'); }
      else st.selectEntity({ type: 'tower', id: t.id }, null);
    }} />
  );

  return (
    <>
      <ambientLight intensity={0.5} color="#8aa0c0" />
      <directionalLight position={[200, 300, 150]} intensity={0.85} color="#c8d8ff" castShadow />
      <hemisphereLight args={['#2a3a4a', '#0A0E1A', 0.55]} />
      <fog attach="fog" args={['#0A0E1A', 180, 620]} />

      <Terrain terrain={terrain} />
      <Water />
      {trees && <Forest trees={trees} />}

      <CoreAura />
      {regions.map((r) => (
        <RegionPlate key={r.id} r={r} selected={selected?.type === 'region' && selected.id === r.id}
          onClick={() => useGame.getState().selectEntity({ type: 'region', id: r.id }, null)} />
      ))}
      {towers.map(renderTower)}

      <Enemies />
      <Projectiles />
      <Particles />
      <DirectionArrows />

      {/* 交互平面（承接所有指针事件） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onGroundClick} {...interactionProps}>
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {placingTowerId && <PlacementGhost />}
      {drag.current.active && <RegionPreview />}

      <CameraDrivers controlsRef={controlsRef} flyTarget={flyTarget} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={50}
        maxDistance={720}
        maxPolarAngle={Math.PI / 2.3}
        target={[0, 0, 0]}
        rotateEnabled={mode !== 'region'}
        panEnabled={mode !== 'region'}
      />
    </>
  );
}

function CameraDrivers({ controlsRef, flyTarget }) {
  const destRef = useRef(null);
  useEffect(() => {
    const off1 = on('camera:reset', () => {
      destRef.current = { pos: new THREE.Vector3(0, 320, 420), tgt: new THREE.Vector3(0, 0, 0), min: 50, max: 720 };
    });
    const off2 = on('camera:global', () => {
      destRef.current = { pos: new THREE.Vector3(0, 780, 0.1), tgt: new THREE.Vector3(0, 0, 0), min: 60, max: 900 };
    });
    return () => { off1(); off2(); };
  }, []);
  useFrame(() => {
    const c = controlsRef.current; if (!c) return;
    // 视角复位 / 全局视图：平滑缓动到位
    if (destRef.current) {
      const d = destRef.current;
      c.object.position.lerp(d.pos, 0.08);
      c.target.lerp(d.tgt, 0.12);
      c.minDistance = d.min; c.maxDistance = d.max;
      c.update();
      if (c.object.position.distanceTo(d.pos) < 14) destRef.current = null;
      return;
    }
    // 双击快速定位（平滑阻尼）
    if (flyTarget.current) {
      const t = flyTarget.current;
      const target = c.target.clone();
      target.lerp(new THREE.Vector3(t.x, 0, t.z), 0.14);
      c.target.copy(target);
      if (target.distanceTo(new THREE.Vector3(t.x, 0, t.z)) < 4) flyTarget.current = null;
      c.update();
    }
  });
  return null;
}