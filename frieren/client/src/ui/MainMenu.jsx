import { useEffect, useState } from 'react';
import { useGame } from '../game/store.js';
import { SAVE_KEY } from '../game/constants.js';
import { playSfx } from '../game/audio.js';
import StatsOverlay from './Stats.jsx';

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export default function MainMenu() {
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const [saveable, setSaveable] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => { setSaveable(hasSave()); }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#070a14] overflow-hidden menu-bg">
      <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(75,158,255,0.18), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.14), transparent 55%)' }} />
      <div className="relative text-center px-6">
        <div className="label-mono text-[#5BC0DE] tracking-[0.35em] mb-3">AUTOCHTHON MONSTER DEFENSE</div>
        <h1 className="title-font text-[44px] md:text-[58px] font-black leading-tight mb-2" style={{ color: '#e8edf5' }}>
          葬送的芙莉莲
        </h1>
        <h2 className="text-[#4A9EFF] text-[22px] md:text-[30px] font-bold mb-1 tracking-[0.18em]">魔 法 防 线</h2>
        <p className="text-[12px] text-[#8aa0c0] max-w-[480px] mx-auto mb-8 leading-relaxed">
          魔王讨伐战结束多年，七崩贤的残党与各地魔族再度蠢蠢欲动。<br />
          你，是活了千年以上的精灵大魔法使——必须以解析与构筑魔法，在边境要塞建立不可摧的魔法防线。
        </p>

        <div className="flex flex-col items-center gap-3">
          <button className="btn-primary w-[300px] py-3 text-[15px]" onClick={() => { newGame(); playSfx('build'); }}>✦ 全新的战役</button>
          <button className="btn-secondary w-[300px] py-2.5 text-[13px]" disabled={!saveable} onClick={() => { continueGame(); playSfx('click'); }}>
            {saveable ? '⏵ 继续游戏' : '⏵ 继续游戏（无存档）'}
          </button>
          <button className="btn-secondary w-[300px] py-2.5 text-[13px]" onClick={() => { setShowStats(true); playSfx('click'); }}>▦ 查看统计</button>
        </div>

        <div className="mt-8 text-[11px] label-mono text-[#5a6a80]">Simplex Noise 程序化地形 · Three.js</div>
      </div>

      {showStats && <StatsOverlay onClose={() => setShowStats(false)} />}
    </div>
  );
}