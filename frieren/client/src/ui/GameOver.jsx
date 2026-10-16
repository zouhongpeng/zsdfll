import { useGame } from '../game/store.js';
import { PHASES } from '../game/constants.js';
import { playSfx } from '../game/audio.js';

export default function GameOver() {
  const stats = useGame((s) => s.stats);
  const newGame = useGame((s) => s.newGame);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 fade-in gameover-vignette">
      <div className="text-[12px] label-mono text-[#E53E3E] tracking-[0.4em] mb-3">THE FORTRESS HAS FALLEN</div>
      <div className="panel-title text-[34px] text-[#E53E3E] mb-6">要塞陷落</div>

      <div className="panel w-[420px] max-w-[92vw] p-5 opacity-95">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <G label="存活天数" v={stats.day} />
          <G label="最高波次" v={stats.wave} />
          <G label="击杀魔族总数" v={stats.kills} />
          <G label="建造魔法阵" v={stats.builtTotal} />
          <G label="规划区域面积" v={`${stats.areaSize} 单位²`} />
          <G label="魔力核心等级" v={stats.coreLevel} />
        </div>
        <div className="text-center text-[12px] text-[#8aa0c0] mb-4 leading-relaxed">
          “吾活了千年有余……到头来，仍未能守住这方寸之间的灯火。”<br />
          <span className="text-[#5BC0DE]">—— 精灵大魔法使 芙莉莲</span>
        </div>
        <div className="flex flex-col gap-2">
          <button className="btn-primary w-full py-2.5" onClick={() => { newGame(); playSfx('build'); }}>重新开始</button>
          <button className="btn-secondary w-full py-2" onClick={() => { useGame.setState({ phase: PHASES.MENU }); playSfx('click'); }}>返回主菜单</button>
        </div>
      </div>
    </div>
  );
}

function G({ label, v }) {
  return (
    <div className="p-3 rounded bg-white/[0.04] border border-white/10">
      <div className="label-mono text-[10px]">{label}</div>
      <div className="text-[20px] font-black mono text-[#e8edf5]">{v}</div>
    </div>
  );
}