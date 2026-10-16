import { useEffect, useRef } from 'react';
import { useGame } from '../game/store.js';
import { MAP_SIZE, REGION_TYPES } from '../game/constants.js';
import { biomeAt } from '../game/terrain/terrain.js';

const HALF = MAP_SIZE / 2;
const BIOME_COLOR = {
  plain: '#22371f', hill: '#3d3322', mountain: '#26314a', snow: '#8fa2b8',
  water: '#12203a', swamp: '#2a2a3d', forest: '#1a2e1a', canyon: '#0f1520',
};

export default function Minimap() {
  const canvasRef = useRef(null);
  const regions = useGame((s) => s.regions);
  const towers = useGame((s) => s.towers);
  const core = useGame((s) => s.core);
  const directions = useGame((s) => s.directions);
  const phase = useGame((s) => s.phase);
  const day = useGame((s) => s.day);
  const wave = useGame((s) => s.wave);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    // 地形底图（粗采样）
    const step = 16;
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        const wx = (px / W - 0.5) * MAP_SIZE, wz = (py / H - 0.5) * MAP_SIZE;
        ctx.fillStyle = BIOME_COLOR[biomeAt(wx, wz)] || '#10151f';
        ctx.fillRect(px, py, step, step);
      }
    }
    // 区域色块
    for (const r of regions) {
      const px = (r.minX / HALF + 1) / 2 * W, pyy = (r.minZ / HALF + 1) / 2 * H;
      const pw = ((r.maxX - r.minX) / MAP_SIZE) * W, ph = ((r.maxZ - r.minZ) / MAP_SIZE) * H;
      ctx.fillStyle = r.color + '55';
      ctx.fillRect(px, pyy, Math.max(2, pw), Math.max(2, ph));
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, pyy, Math.max(2, pw), Math.max(2, ph));
    }
    // 核心能量范围（苍月青光圈）
    const cx = (core.x / HALF + 1) / 2 * W, cy = (core.z / HALF + 1) / 2 * H;
    ctx.beginPath(); ctx.arc(cx, cy, (core.range / HALF) * W / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(91,192,222,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#5BC0DE'; ctx.fill();
    // 魔法阵分布
    for (const t of towers) {
      const px = (t.x / HALF + 1) / 2 * W, pyy = (t.z / HALF + 1) / 2 * H;
      ctx.fillStyle = t.defId === 'core' ? '#5BC0DE' : '#e8edf5';
      ctx.fillRect(px - 1, pyy - 1, 2, 2);
    }
    // 来袭方向箭头（紫色）
    if (phase === 'night') {
      for (const d of directions) {
        const a = (d.angle * Math.PI) / 180;
        const ax = (Math.cos(a) * (HALF - 18) / HALF + 1) / 2 * W;
        const ay = (Math.sin(a) * (HALF - 18) / HALF + 1) / 2 * H;
        const mx = (Math.cos(a) * 20), my = (Math.sin(a) * 20);
        ctx.strokeStyle = d.boss ? '#FFD700' : '#8B5CF6';
        ctx.lineWidth = d.boss ? 2 : 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - mx, ay - my); ctx.stroke();
        // 箭头头
        const ang = Math.atan2(my, mx);
        ctx.beginPath();
        ctx.moveTo(ax - mx, ay - my);
        ctx.lineTo(ax - mx + 5 * Math.cos(ang - 0.7), ay - my + 5 * Math.sin(ang - 0.7));
        ctx.moveTo(ax - mx, ay - my);
        ctx.lineTo(ax - mx + 5 * Math.cos(ang + 0.7), ay - my + 5 * Math.sin(ang + 0.7));
        ctx.stroke();
      }
    }
  }, [regions, towers, core, directions, phase, day, wave]);

  return (
    <div className="absolute bottom-20 left-3 z-20 pointer-events-none opacity-90">
      <div className="panel p-1.5" style={{ width: 168 }}>
        <div className="label-mono text-[9px] text-center mb-1">战区小地图 · DAY {day}</div>
        <canvas ref={canvasRef} width={152} height={152} className="rounded" style={{ background: '#0c1220' }} />
      </div>
    </div>
  );
}