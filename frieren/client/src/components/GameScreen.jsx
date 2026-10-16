import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { createTerrainData } from '../game/terrain/generate.js';
import { useGame } from '../game/store.js';
import { update, syncTower } from '../game/engine.js';
import { injectSfx } from '../game/engine.js';
import { PHASES, DAY_DURATION } from '../game/constants.js';
import { playSfx } from '../game/audio.js';
import GameCanvas from './GameCanvas.jsx';
import TopBar from '../ui/TopBar.jsx';
import LeftPanel from '../ui/LeftPanel.jsx';
import RightPanel from '../ui/RightPanel.jsx';
import BottomBar from '../ui/BottomBar.jsx';
import Minimap from '../ui/Minimap.jsx';
import WaveModal from '../ui/WaveModal.jsx';
import GameOver from '../ui/GameOver.jsx';

injectSfx(playSfx);

// 游戏主循环（日/夜切换 + 引擎推进 + UI节流刷新）
function GameLoop() {
  const ref = useRef(0);
  useFrame((_, deltaRaw) => {
    const state = useGame.getState();
    const dtRaw = Math.min(deltaRaw, 0.05);
    const active = (state.phase === PHASES.DAY || state.phase === PHASES.NIGHT) && !state.paused;
    const dt = active ? dtRaw * state.speed : 0;

    if (state.phase !== PHASES.MENU && state.phase !== PHASES.LOST && state.phase !== PHASES.MODAL) {
      state.refreshForRender({ stats: { ...state.stats, playSeconds: state.stats.playSeconds + dt } });
    }

    if (active) {
      update(dt, state);
      syncTower(state);

      if (state.phase === PHASES.DAY) {
        const c = state.clock - dt;
        state.refreshForRender({ clock: Math.max(0, c) });
        if (c <= 0) {
          state.startNight();
          playSfx('alert');
          setTimeout(() => playSfx('drum'), 600);
        }
      } else {
        state.refreshForRender({ nightClock: state.nightClock + dt });
      }

      ref.current += dt;
      if (ref.current > 1.5) { ref.current = 0; state.refreshForRender({ underAttack: false }); }

      state.refreshUI();
    }
  });
  return null;
}

function AttackVignette() {
  const underAttack = useGame((s) => s.underAttack);
  const core = useGame((s) => s.core);
  const damaged = core.hp < core.maxHp;
  return <div className={`pointer-events-none ${underAttack || damaged ? 'under-attack' : ''}`} />;
}

function Toast() {
  const [last, setLast] = useState(null);
  const toast = useGame((s) => s.toastMsg);
  useEffect(() => {
    if (!toast) return;
    setLast({ text: toast.text, key: toast.t });
    const t = setTimeout(() => setLast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!last) return null;
  return (
    <div key={last.key} className="absolute left-1/2 bottom-28 z-30 -translate-x-1/2 fade-in">
      <div className="px-4 py-2 rounded bg-[#0A0E1A]/90 border border-[#5BC0DE]/40 text-[13px] text-[#cfeaf5] shadow-lg" style={{ boxShadow: '0 0 18px rgba(91,192,222,0.25)' }}>
        {last.text}
      </div>
    </div>
  );
}

export default function GameScreen() {
  const terrainData = useMemo(() => createTerrainData(), []);
  const phase = useGame((s) => s.phase);
  const underAttack = useGame((s) => s.underAttack);

  // 进入战场时给一点入场过渡
  useEffect(() => { playSfx('build'); }, []);

  return (
    <div className={`relative w-full h-full ${underAttack ? 'under-attack-holder' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 320, 420], fov: 50, near: 1, far: 2000 }}
        gl={{ antialias: true }}
      >
        <GameLoop />
        <GameCanvas terrain={terrainData} trees={terrainData.trees} />
      </Canvas>

      {/* ===== HUD ===== */}
      <TopBar />
      <LeftPanel />
      <RightPanel />
      <BottomBar />
      <Minimap />
      <AttackVignette />
      <Toast />
      <WaveModal />
      {phase === PHASES.LOST && <GameOver />}
    </div>
  );
}