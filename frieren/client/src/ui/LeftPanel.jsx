import { useState } from 'react';
import { useGame } from '../game/store.js';
import { REGION_TYPES, REGION_TOWERS, TOWERS, ENEMIES } from '../game/constants.js';
import { playSfx as play } from '../game/audio.js';

const TABS = [
  { id: 'plan', name: '魔法阵规划' },
  { id: 'build', name: '魔法部署' },
  { id: 'grim', name: '魔导书' },
  { id: 'res', name: '资源管理' },
  { id: 'intel', name: '情报中心' },
];

const CAT_LABEL = { core: '魔力核心区', magic: '魔法阵区', human: '人类居住区', workshop: '魔法工坊区', supply: '后勤补给区', outpost: '前哨缓冲区' };

export default function LeftPanel({ collapsed, onToggle }) {
  const [tab, setTab] = useState('plan');
  const mode = useGame((s) => s.mode);
  const regionBrush = useGame((s) => s.regionBrush);
  const canBuild = useGame((s) => s.canBuildDuringNight) || useGame((s) => s.phase === 'day');

  if (collapsed) {
    return (
      <button className="absolute left-2 top-1/2 -translate-y-1/2 z-20 panel px-2 py-3" onClick={onToggle}>◀</button>
    );
  }

  return (
    <div className="absolute left-2 top-16 bottom-24 w-[252px] z-20 flex flex-col pointer-events-none">
      {/* 标签页头 */}
      <div className="flex gap-1 mb-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold pointer-events-auto transition ${tab === t.id ? 'bg-[#4A9EFF] text-white' : 'bg-[#16202f] text-[#8aa0c0] hover:bg-[#1d2a3d]'}`}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="panel flex-1 overflow-y-auto p-2.5 pointer-events-auto fade-in">
        {tab === 'plan' && <RegionPlan />}
        {tab === 'build' && <DeployPanel canBuild={canBuild} />}
        {tab === 'grim' && <Grimoire />}
        {tab === 'res' && <ResourcePanel />}
        {tab === 'intel' && <Intel />}
      </div>

      <button className="absolute -right-7 top-1 z-10 panel px-1.5 py-1 pointer-events-auto text-xs" onClick={onToggle}>▶</button>
    </div>
  );
}

function RegionPlan() {
  const regionBrush = useGame((s) => s.regionBrush);
  const setRegionBrush = useGame((s) => s.setRegionBrush);
  const cancel = useGame((s) => s.cancelMode);
  const regions = useGame((s) => s.regions);
  return (
    <div>
      <div className="panel-title mb-2">划定战区区域</div>
      <p className="text-[11px] text-[#8aa0c0] mb-2">选择类型后在地图上<b className="text-[#cfe6ff]">拖拽</b>划出矩形区域。区域决定可放置的魔法阵。</p>
      {Object.keys(REGION_TYPES).map((k) => {
        const rt = REGION_TYPES[k];
        const active = regionBrush === k;
        const isCoreUsed = k === 'core' && regions.some((r) => r.type === 'core');
        return (
          <button key={k} disabled={isCoreUsed}
            onClick={() => { if (active) cancel(); else setRegionBrush(k); play('click'); }}
            className={`w-full mb-1.5 flex items-center gap-2 px-2.5 py-2 rounded border text-left transition
              ${active ? 'border-[#fff] bg-[#4A9EFF]/20' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'} ${isCoreUsed ? 'opacity-40' : ''}`}>
            <span className="w-3 h-3 rounded-full" style={{ background: rt.color }} />
            <span className="flex-1">
              <div className="text-[12px] text-[#e8edf5]">{rt.name}</div>
              <div className="text-[10px] text-[#8aa0c0]">{rt.desc}</div>
            </span>
            {isCoreUsed && <span className="text-[10px] text-amber-400">已建</span>}
          </button>
        );
      })}
      <div className="text-[10px] text-[#5a6a80] mt-1">
        {regions.length > 0 ? `已规划 ${regions.length} 块区域` : '尚未规划区域'}
      </div>
    </div>
  );
}

function DeployPanel({ canBuild }) {
  const setPlacing = useGame((s) => s.setPlacing);
  const placing = useGame((s) => s.placingTowerId);
  const cancel = useGame((s) => s.cancelMode);
  const resources = useGame((s) => s.resources);
  const towers = useGame((s) => s.towers);
  const regions = useGame((s) => s.regions);

  const cats = ['core', 'magic', 'human', 'workshop', 'supply', 'outpost'];

  return (
    <div>
      <div className="panel-title mb-2 flex items-center justify-between">
        <span>选择要部署的魔法阵</span>
      </div>
      {!canBuild && <div className="text-[11px] text-amber-400 mb-2">⏳ 战斗进行中，无法建造新魔法阵</div>}
      {regions.length === 0 && <div className="text-[11px] text-amber-400 mb-2">⚠ 请先在「魔法阵规划」划定区域</div>}
      {cats.map((cat) => {
        const ids = REGION_TOWERS[cat];
        if (!ids.length) return null;
        return (
          <div key={cat} className="mb-2">
            <div className="label-mono mb-1">{CAT_LABEL[cat]}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ids.map((id) => <TowerCard key={id} id={id} canBuild={canBuild} setPlacing={setPlacing} placing={placing} resources={resources} towers={towers} cancel={cancel} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TowerCard({ id, canBuild, setPlacing, placing, resources, towers, cancel }) {
  const def = TOWERS[id];
  if (!def) return null;
  const cost = def.upgrade ? def.upgrade(0) : null;
  const crystalCost = cost ? cost.cost : def.cost;
  const woodCost = Math.round(crystalCost * 0.4);
  const afford = resources.crystal >= crystalCost && resources.wood >= woodCost;
  const disabled = !canBuild || !afford || id === 'core';
  const active = placing === id;
  return (
    <button disabled={disabled}
      onClick={() => { if (active) cancel(); else setPlacing(id); play('click'); }}
      className={`p-2 rounded border text-left transition ${active ? 'border-[#fff] bg-[#48BB78]/25' : 'border-white/10 bg-white/[0.04]'} ${disabled && !active ? 'opacity-35 cursor-not-allowed' : 'hover:bg-white/[0.08]'}`}>
      <div className="text-[11px] text-[#e8edf5] flex items-center gap-1">
        <span className="w-2 h-2 rounded-full" style={{ background: def.color }} />{def.name}
      </div>
      <div className="text-[10px] text-[#8aa0c0] mt-0.5">💎{crystalCost} 🪵{woodCost}</div>
    </button>
  );
}

function Grimoire() {
  const items = [
    ['魔力核心范围', '初始 50，每级 +10；范围内魔法阵才能运作（魔法阵区/前哨区例外）'],
    ['区域协同', '居住区×工坊区 → 产出+10%；补给区×魔法阵区 → 攻击+10%；核心邻区 → 全属性+5%'],
    ['魔法阵相邻', '攻击阵相邻 +10% 范围（叠3）；民居相邻 +15% 人口；结晶矿相邻 +10% 产出；补给站相邻 +20% 运输'],
    ['地形加成', '山脉探测 +50% 视野；森林 +30% 隐蔽；河边 +10% 防御；峡谷防御阵攻击 +20%'],
    ['弑魔魔法', '攻击魔法阵满级后伤害翻倍'],
  ];
  return (
    <div>
      <div className="panel-title mb-2">芙莉莲的魔导书</div>
      {items.map(([t, d], i) => (
        <div key={i} className="mb-2 p-2 rounded bg-white/[0.03] border border-white/10">
          <div className="text-[11px] text-[#5BC0DE]">{t}</div>
          <div className="text-[10.5px] text-[#b8c4d8] mt-0.5 leading-snug">{d}</div>
        </div>
      ))}
    </div>
  );
}

function ResourcePanel() {
  const towers = useGame((s) => s.towers);
  const count = (id) => towers.filter((t) => t.defId === id).length;
  const fields = [
    ['魔力结晶矿', count('mine'), '💎 +2/5s'],
    ['木材场', count('lumber'), '🪵 +2/5s'],
    ['药草田', count('herb'), '🌾 +2/5s'],
    ['粮仓', count('granary'), '🌾 +3/5s'],
    ['民居', count('house'), '👥 人口 +3/座'],
  ];
  return (
    <div>
      <div className="panel-title mb-2">资源产出（每5秒）</div>
      {fields.map(([name, n, p]) => (
        <div key={name} className="flex items-center justify-between py-1.5 border-b border-white/5 text-[12px]">
          <span className="text-[#cfe6ff]">{name} <span className="text-[#5BC0DE]">×{n}</span></span>
          <span className="text-[#8aa0c0] text-[11px]">{p}</span>
        </div>
      ))}
      <div className="text-[10.5px] text-[#5a6a80] mt-2">生产类魔法阵建造后自动产出。</div>
    </div>
  );
}

function Intel() {
  return (
    <div>
      <div className="panel-title mb-2">魔族情报</div>
      {Object.values(ENEMIES).map((e) => (
        <div key={e.name} className="mb-1.5 p-2 rounded bg-white/[0.03] border border-white/10 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: e.color }} />
          <div>
            <div className="text-[11px] text-[#e8edf5]">{e.name}{e.boss && ' ★'}</div>
            <div className="text-[10px] text-[#8aa0c0]">HP {e.hp} · 速 {e.speed} · {e.targets === 'tower' ? '攻坚' : '冲核心'}</div>
          </div>
        </div>
      ))}
      <div className="text-[10.5px] text-[#5a6a80] mt-1">河流/山脉魔族无法通行；森林-30%速；沼泽-50%速。</div>
    </div>
  );
}