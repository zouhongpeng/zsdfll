import { useGame } from '../game/store.js';
import { STATS_KEY } from '../game/constants.js';

function readCumulative() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (e) { return {}; }
}

export default function StatsOverlay({ onClose }) {
  const stats = useGame((s) => s.stats);
  const cum = readCumulative();

  const killsByType = [...(cum.killsByType ? Object.entries(cum.killsByType) : [])];
  const builtByType = [...(cum.built ? Object.entries(cum.built) : [])];
  const maxK = Math.max(1, ...killsByType.map(([, v]) => v));
  const maxB = Math.max(1, ...builtByType.map(([, v]) => v));
  const names = { soldier: '士兵', scout: '斥候', big: '大魔族', ogre: '巨魔', shadow: '影魔', bane: '七崩贤' };
  const builtNames = { attack: '攻击', shield: '防御', bind: '束缚', illusion: '幻影', detect: '探测', house: '民居', mine: '结晶矿', lumber: '木材场', trap: '陷阱' };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 fade-in">
      <div className="panel w-[560px] max-w-[92vw] max-h-[86vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="panel-title text-[18px]">战争档案 · 数据统计</div>
          <button className="btn-secondary px-3 py-1 text-[12px]" onClick={onClose}>✕ 关闭</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="累计存活天数" value={cum.day ?? stats.day} />
          <Stat label="累计击杀魔族" value={cum.kills ?? stats.kills} />
          <Stat label="建造魔法阵总数" value={cum.builtTotal ?? stats.builtTotal} />
          <Stat label="规划区域总面积" value={`${cum.areaSize ?? stats.areaSize} 单位²`} />
          <Stat label="最高波次" value={cum.bestWave ?? stats.bestWave} />
          <Stat label="魔力核心最高等级" value={cum.coreLevel ?? stats.coreLevel} />
          <Stat label="累计游戏时长" value={fmtTime(cum.playSeconds ?? stats.playSeconds)} />
          <Stat label="存活的要塞" value="苍月山城塞" />
        </div>

        {killsByType.length > 0 && (
          <div className="mb-4">
            <div className="label-mono mb-2">击杀魔族（按类型）</div>
            {killsByType.map(([k, v]) => (
              <Bar key={k} label={names[k] || k} value={v} max={maxK} color="#8B5CF6" />
            ))}
          </div>
        )}
        {builtByType.length > 0 && (
          <div>
            <div className="label-mono mb-2">建造魔法阵（按类型 Top10）</div>
            {builtByType.slice(0, 10).map(([k, v]) => (
              <Bar key={k} label={builtNames[k] || k} value={v} max={maxB} color="#4A9EFF" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-2.5 rounded bg-white/[0.04] border border-white/10">
      <div className="label-mono text-[10px]">{label}</div>
      <div className="text-[22px] font-black mono" style={{ color: '#e8edf5' }}>{value}</div>
    </div>
  );
}

function Bar({ label, value, max, color }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[11px] text-[#b8c4d8] w-16 text-right mono">{label}</span>
      <div className="flex-1 h-3 bg-[#101624] rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="text-[11px] text-[#e8edf5] w-8 mono">{value}</span>
    </div>
  );
}

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return `${h > 0 ? h + '时' : ''}${m}分${ss}秒`;
}