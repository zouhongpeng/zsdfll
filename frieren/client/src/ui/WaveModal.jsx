import { useState } from 'react';
import { useGame } from '../game/store.js';
import { PHASES } from '../game/constants.js';
import { playSfx } from '../game/audio.js';
import StatsOverlay from './Stats.jsx';

const TYPES = ['soldier', 'scout', 'big', 'ogre', 'shadow', 'bane'];
const NAMES = { soldier: '魔族士兵', scout: '魔族斥候', big: '大魔族', ogre: '巨魔', shadow: '影魔族', bane: '七崩贤' };

export default function WaveModal() {
  const waveModal = useGame((s) => s.waveModal);
  const nextWave = useGame((s) => s.nextWave);
  const [showStats, setShowStats] = useState(false);

  if (!waveModal) return null;
  const w = waveModal;

  const buildPhase = () => {
    useGame.setState({ phase: PHASES.DAY, waveModal: null, canBuildDuringNight: true });
    playSfx('click');
  };

  return (
    <>
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 fade-in">
        <div className="panel w-[440px] max-w-[92vw] p-5">
          <div className="label-mono text-center text-[#5BC0DE] mb-1">DAY {w.day} · WAVE {w.wave + 1}</div>
          <div className="panel-title text-[20px] text-center mb-4">本轮战斗结束</div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Cell label="击杀总数" value={w.kills} color="#8B5CF6" />
            <Cell label="获得魔力结晶" value={Math.round((w.gained?.crystal || 0))} color="#5BC0DE" />
            <Cell label="损失魔法阵" value={w.lostTowers} color="#E53E3E" />
            <Cell label="核心受损" value={w.lostCoreHp ? `-${Math.round(w.lostCoreHp)}` : '无损'} color="#E53E3E" />
          </div>

          <div className="mb-3">
            <div className="label-mono mb-1.5">分类型击杀</div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.filter((t) => w.killsByType?.[t]).map((t) => (
                <span key={t} className="px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[11px]">
                  {NAMES[t]} <b className="text-[#e8edf5]">×{w.killsByType[t]}</b>
                </span>
              ))}
              {!TYPES.some((t) => w.killsByType?.[t]) && <span className="text-[11px] text-[#5a6a80]">无</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full py-2.5 text-[14px]" onClick={() => { nextWave(); playSfx('build'); }}>
              继续下一波（进入建造阶段）
            </button>
            <button className="btn-secondary w-full py-2 text-[12px]" onClick={() => { setShowStats(true); playSfx('click'); }}>查看统计</button>
            <button className="btn-secondary w-full py-2 text-[12px]" onClick={buildPhase}>调整战区部署</button>
          </div>
        </div>
      </div>
      {showStats && <StatsOverlay onClose={() => setShowStats(false)} />}
    </>
  );
}

function Cell({ label, value, color }) {
  return (
    <div className="p-3 rounded bg-white/[0.04] border border-white/10 text-center">
      <div className="text-[10px] text-[#8aa0c0] label-mono">{label}</div>
      <div className="text-[24px] font-black mono mt-1" style={{ color }}>{value}</div>
    </div>
  );
}