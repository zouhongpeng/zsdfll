import { useGame } from '../game/store.js';
import { PHASES, REGION_TYPES, TOWERS } from '../game/constants.js';
import { playSfx } from '../game/audio.js';

export default function RightPanel({ collapsed, onToggle }) {
  const selectionInfo = useGame((s) => s.selectionInfo);
  const selected = useGame((s) => s.selected);
  const core = useGame((s) => s.core);
  const regionBrush = useGame((s) => s.regionBrush);

  if (collapsed) {
    return <button className="absolute right-2 top-1/2 -translate-y-1/2 z-20 panel px-2 py-3" onClick={onToggle}>▶</button>;
  }

  return (
    <div className="absolute right-2 top-16 bottom-24 w-[248px] z-20 flex flex-col items-end pointer-events-none">
      <div className="panel w-full flex-1 overflow-y-auto p-3 pointer-events-auto fade-in">
        {selected && selectionInfo ? (
          <SelectionView info={selectionInfo} selected={selected} core={core} />
        ) : (
          <Overview core={core} />
        )}
      </div>
      <button className="absolute -left-7 top-1 z-10 panel px-1.5 py-1 pointer-events-auto text-xs" onClick={onToggle}>◀</button>
    </div>
  );
}

function SelectionView({ info, selected, core }) {
  const towers = useGame((s) => s.towers);
  if (info.type === 'tower') {
    const tower = towers.find((t) => t.id === selected.id);
    if (!tower) return null;
    return <TowerDetail tower={tower} info={info} />;
  }
  if (info.type === 'core') return <CoreDetail core={core} info={info} />;
  if (info.type === 'region') return <RegionDetail info={info} sel={selected} />;
  return (
    <div>
      <div className="panel-title mb-2">{info.title}</div>
      <Table rows={info.stats} />
      {info.desc && <p className="text-[11px] text-[#8aa0c0] mt-2 leading-snug">{info.desc}</p>}
    </div>
  );
}

function TowerDetail({ tower, info }) {
  const upgrade = useGame((s) => s.upgradeTower);
  const demolish = useGame((s) => s.demolishTower);
  const resources = useGame((s) => s.resources);
  const afford = info.cost && (resources.crystal >= info.cost.crystal && resources.wood >= info.cost.wood);
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ background: info.color }} />
        <div className="panel-title text-[13px]">{info.title}</div>
      </div>
      <div className="text-[10px] text-[#8aa0c0] mb-2">{info.desc}</div>
      <Table rows={info.stats} />
      <div className="mt-3 space-y-1.5">
        {info.cost && tower.defId !== 'core' ? (
          tower.defId === 'core' ? null : (
            <button disabled={!afford || tower.level >= info.maxLevel} onClick={() => { upgrade(tower.id); playSfx('upgrade'); }}
              className="btn-primary w-full text-center">
              {tower.level >= info.maxLevel ? '已达满级' : `升级 (💎${info.cost.crystal})`}
            </button>
          )
        ) : null}
        {tower.defId !== 'core' && (
          <button onClick={() => { demolish(tower.id); playSfx('destroy'); }} className="btn-danger w-full text-center">
            拆除（返还50%造价）
          </button>
        )}
      </div>
    </div>
  );
}

function CoreDetail({ core, info }) {
  const upgradeCore = useGame((s) => s.upgradeCore);
  const resources = useGame((s) => s.resources);
  const costs = [100, 250, 500, 1000, 2000];
  const cost = costs[core.level];
  const afford = resources.crystal >= cost;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ background: '#5BC0DE', boxShadow: '0 0 8px #5BC0DE' }} />
        <div className="panel-title text-[13px]">{info.title}</div>
      </div>
      <div className="text-[10px] text-[#8aa0c0] mb-2">{info.desc}</div>
      <Table rows={info.stats} />
      <div className="mt-2">
        <div className="h-2.5 w-full rounded bg-[#1a1f2e] overflow-hidden border border-white/10">
          <div className="h-full transition-all" style={{ width: `${Math.max(0, (core.hp / core.maxHp) * 100)}%`, background: core.hp / core.maxHp < 0.35 ? '#E53E3E' : '#5BC0DE' }} />
        </div>
        <div className="label-mono mt-1 text-right">核心 HP {Math.max(0, Math.round(core.hp))}/{core.maxHp}</div>
      </div>
      {core.level < 5 ? (
        <button disabled={!afford} onClick={() => { upgradeCore(); playSfx('upgrade'); }} className="btn-primary w-full mt-3 text-center">
          {afford ? `升级魔力核心 Lv.${core.level}→${core.level + 1} (💎${cost})` : `升级需要 💎${cost}`}
        </button>
      ) : <div className="panel-title mt-3 text-center">魔力核心已达最高级 ✦</div>}
    </div>
  );
}

function RegionDetail({ info, sel }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded-full" style={{ background: info.color }} />
        <div className="panel-title text-[13px]">{info.title}</div>
      </div>
      <Table rows={info.stats} />
      <p className="text-[11px] text-[#8aa0c0] mt-2 leading-snug">{info.desc}</p>
      <div className="text-[10px] text-[#5a6a80] mt-2">点击该区域内魔法阵可升级或拆除。</div>
    </div>
  );
}

function Table({ rows }) {
  return (
    <div className="mt-1">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between py-1 border-b border-white/5 text-[12px]">
          <span className="label-mono">{k}</span>
          <span className="text-[#e8edf5] mono">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Overview({ core }) {
  const regions = useGame((s) => s.regions);
  const towers = useGame((s) => s.towers);
  const totalArea = regions.reduce((a, r) => a + r.w * r.h, 0);
  const magicTowers = towers.filter((t) => ['attack', 'shield', 'bind', 'illusion', 'detect'].includes(t.defId)).length;
  const atk = towers.filter((t) => t.defId === 'attack').length * 14;
  const defense = Math.round(400 + magicTowers * 40 + core.level * 60);
  return (
    <div>
      <div className="panel-title mb-3">战区总览</div>
      <ViewRow k="议案地图面积" v={`${(1000)}×${1000} 单位`} />
      <ViewRow k="已规划区域" v={`${regions.length} 块（${Math.round(totalArea)} 单位²）`} />
      <ViewRow k="总魔法阵数" v={towers.length} />
      <ViewRow k="魔力核心等级" v={`Lv.${core.level}（范围 ${core.range}）`} />
      <ViewRow k="预计防御力" v={defense} />
      <ViewRow k="当前攻击输出" v={`约 ${atk}/秒`} />
      <ViewRow k="地形加成" v={biomeBonusStr()} />
      <p className="text-[10.5px] text-[#5a6a80] mt-3">点击地图任意处查看地块/区域/魔法阵详情；双击快速定位到地图位置。</p>
    </div>
  );
}

function biomeBonusStr() {
  const r = useGame.getState().towers.filter((t) => t.biome === 'mountain').length;
  return r > 0 ? `${r} 座建于山脉（+50%视野）` : '—';
}

function ViewRow({ k, v }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-white/5 text-[12px]">
      <span className="label-mono">{k}</span><span className="text-[#e8edf5] mono text-right">{v}</span>
    </div>
  );
}