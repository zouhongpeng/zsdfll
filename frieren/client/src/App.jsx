import { useEffect, useState } from 'react';
import { useGame } from './game/store.js';
import { PHASES } from './game/constants.js';
import MainMenu from './ui/MainMenu.jsx';
import GameScreen from './components/GameScreen.jsx';

function LoadScreen() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const steps = [
      ['解析魔力地形……', 34],
      ['唤起程序化山峦与河流……', 62],
      ['铺展苍月能量核心……', 84],
      ['校准远古防御法阵……', 100],
    ];
    let i = 0;
    const iv = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setP(steps[i][1]);
    }, 220);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#06080f] menu-bg">
      <div className="title-font text-[26px] font-black mb-1" style={{ color: '#5BC0DE' }}>魔法防线</div>
      <div className="text-[11px] label-mono mb-6 tracking-[0.3em] text-[#8aa0c0]">FRIREN · MAGIC DEFENSE</div>
      <div className="w-64 h-1.5 bg-[#141a2b] rounded overflow-hidden">
        <div className="h-full rounded transition-all duration-200" style={{ width: `${p}%`, background: 'linear-gradient(90deg,#4A9EFF,#5BC0DE)' }} />
      </div>
      <div className="mt-3 text-[11px] mono text-[#6b7c96]">正在解析魔法阵地形… {p}%</div>
    </div>
  );
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 800); return () => clearTimeout(t); }, []);
  if (!ready) return <LoadScreen />;
  return phase === PHASES.MENU ? <MainMenu /> : <GameScreen />;
}