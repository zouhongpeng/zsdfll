import { createNoise2D, createNoise3D } from 'simplex-noise';
import { MAP_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL } from '../constants.js';

// 流式噪声封装
const noise2 = createNoise2D(Math.random);
const noise3 = createNoise3D(Math.random);

export function n2(x, y, scale = 0.02) { return noise2(x * scale, y * scale); }
export function n3(x, y, z, scale = 0.02) { return noise3(x * scale, y * scale, z * scale); }

// 多倍频噪声（fbm）
export function fbm(x, z, octaves = 5, base = 0.02) {
  let amp = 1, freq = base, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

// ===================== 地形建模 =====================
// 输入：世界坐标（中心为 0,0，范围约 -MAP_SIZE/2..+MAP_SIZE/2）
// 输出高度：范围约 0 ~ 100
export function heightAt(wx, wz) {
  const x = 0.5 + wx / MAP_SIZE;      // 0..1
  const z = 0.5 + wz / MAP_SIZE;
  const cx = wx / MAP_SIZE;           // -0.5..0.5
  const cz = wz / MAP_SIZE;
  const d = Math.sqrt(cx * cx + cz * cz); // 0..~0.707

  // 大尺度起伏
  let base = fbm(x * 1.4, z * 1.4, 6, 0.5);
  base = base * 0.5 + 0.5;            // 0..1

  // 中心盆地（魔力核心所在地）
  const basin = Math.exp(-d * d * 26); // 中心接近1
  const rimFactor = smoothstep(0.18, 0.42, d); // 边缘隆起（山脉）

  // 山脉噪声（山脊）
  let ridge = Math.abs(noise2(x * 1.7, z * 1.7) * 0.5 + 0.5 - 0.35);
  ridge = Math.pow(ridge, 2.0);
  const mountain = smoothstep(0.45, 0.8, base) * rimFactor * (0.5 + ridge * 0.9);

  // 低地（平原/丘陵/盆地）
  const low = (1 - rimFactor) * base * 0.55 + basin * 22.0;
  // 峡谷（细长切割）
  const canyon = Math.abs(n2(x * 15, z * 8));
  let canyonDip = 0;
  if (canyon < 0.09 && d > 0.05) canyonDip = (0.09 - canyon) * 90;

  let h = low + mountain * 60 + basin * 8 - canyonDip;

  // 16条山口通道贯穿边缘山脉（供魔族进入，也形成“峡谷”地貌）
  let passDip = 0;
  if (d > 0.08) {
    const ang = Math.atan2(cz, cx);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      const diff = Math.atan2(Math.sin(ang - a), Math.cos(ang - a));
      passDip += Math.exp(-diff * diff * 55) * 46;
    }
    passDip *= rimFactor * smoothstep(0.12, 0.4, d);
    h -= passDip;
  }
  h = h * (0.7 + basin * 0.3);
  // 山口处保持可通行的陆地面（略高于水面）
  if (passDip > 12) h = Math.max(h, WATER_LEVEL + 3);
  h = Math.max(0, Math.min(100, h));

  return h;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function isWater(wx, wz) { return heightAt(wx, wz) <= WATER_LEVEL + 0.5; }

// 湿度/森林 噪声
export function moisture(wx, wz) { return fbm(wx * 0.012, wz * 0.012, 4, 0.8); }

// 地形类型判定
export function biomeAt(wx, wz) {
  const h = heightAt(wx, wz);
  if (h <= WATER_LEVEL + 0.5) return 'water';
  if (h > 84) return 'snow';
  if (h > 58) return 'mountain';
  const m = moisture(wx, wz);
  if (h > 30 && h <= 58) return 'hill';
  if (m > 0.62 && h < 42) return 'swamp';
  if (m > 0.42 && h < 42) return 'forest';
  return 'plain';
}

// 地形移动倍速（速度乘数，越小越慢）
export function biomeSpeed(b) {
  switch (b) {
    case 'forest': return 0.7;  // -30%
    case 'swamp': return 0.5;   // -50%
    case 'mountain': return 0;  // 不可通过
    case 'water': return 0;
    case 'snow': return 0.95;
    case 'hill': return 0.95;
    default: return 1;
  }
}

// 颜色（地形专用）
export function biomeColor(b) {
  switch (b) {
    case 'plain': return [0x2A, 0x3D, 0x2A];
    case 'hill': return [0x4A, 0x3D, 0x2A];
    case 'mountain': return [0x2D, 0x35, 0x48];
    case 'snow': return [0xE8, 0xED, 0xF5];
    case 'swamp': return [0x2A, 0x2A, 0x3D];
    case 'forest': return [0x1A, 0x2E, 0x1A];
    case 'water': return [0x1A, 0x2A, 0x4A];
    case 'canyon': return [0x0F, 0x15, 0x20];
    default: return [0x2A, 0x3D, 0x2A];
  }
}

// 构建高度图（供几何体使用），返回 { geometry 顶点高度数组, 尺寸 }
export function buildHeightMap(res) {
  const N = res + 1;
  const heights = new Float32Array(N * N);
  for (let zi = 0; zi < N; zi++) {
    for (let xi = 0; xi < N; xi++) {
      const wx = (xi / res) * MAP_SIZE;
      const wz = (zi / res) * MAP_SIZE;
      heights[zi * N + xi] = heightAt(wx, wz);
    }
  }
  return { N, heights };
}

export { TERRAIN_SEGMENTS, WATER_LEVEL };