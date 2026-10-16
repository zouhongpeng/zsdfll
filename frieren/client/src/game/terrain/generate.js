import * as THREE from 'three';
import { MAP_SIZE, TERRAIN_SEGMENTS } from '../constants.js';
import { heightAt, biomeAt } from './terrain.js';

// 直接在世界坐标 XZ 构建地形网格（避免旋转坐标混淆）
export function buildTerrainGeometry() {
  const res = TERRAIN_SEGMENTS;
  const N = res + 1;
  const verts = new Float32Array(N * N * 3);
  const idx = new Uint32Array(res * res * 6);
  let vi = 0;
  for (let zi = 0; zi < N; zi++) {
    for (let xi = 0; xi < N; xi++) {
      const wx = (xi / res) * MAP_SIZE - MAP_SIZE / 2;
      const wz = (zi / res) * MAP_SIZE - MAP_SIZE / 2;
      verts[vi * 3] = wx;
      verts[vi * 3 + 1] = heightAt(wx, wz);
      verts[vi * 3 + 2] = wz;
      vi++;
    }
  }
  let ti = 0;
  for (let zi = 0; zi < res; zi++) {
    for (let xi = 0; xi < res; xi++) {
      const a = zi * N + xi;
      const b = a + 1;
      const c = a + N;
      const d = a + N + 1;
      idx[ti++] = a; idx[ti++] = c; idx[ti++] = b;
      idx[ti++] = b; idx[ti++] = c; idx[ti++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// 生成森林树木位置（InstancedMesh 优化，≤180棵）
export function buildTrees() {
  const trees = [];
  let guard = 0;
  while (trees.length < 180 && guard < 40000) {
    guard++;
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.96;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.96;
    const b = biomeAt(x, z);
    if (b === 'forest') {
      const dc = Math.hypot(x, z);
      if (dc > 34) trees.push({ x, z });
    }
  }
  return trees;
}

export function createTerrainData() {
  return {
    geometry: buildTerrainGeometry(),
    trees: buildTrees(),
  };
}