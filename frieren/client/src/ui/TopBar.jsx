import { useGame } from '../game/store.js';
import { PHASES, DAY_DURATION } from '../game/constants.js';

const MMSS = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function TopBar() {
  const fortress = useGame((s) => s.fortress);
  const day = useGame((s) => s.day);
  const phase = useGame((s) => s.phase);
  const clock = useGame((s) => s.clock);
  const resources = useGame((s) => s.resources);
  const wave = useGame((s) => s.wave);
  const directions = useGame((s) => s.directions);

  const isNight = phase === PHASES.NIGHT;
  const phaseLabel = isNight ? 'NIGHT' : 'DAY';
  const dirCount = isNight ? directions.length : useGame.getState().computeDirections(wave).length;
  const forecast = isNight
    ? `战斗进行中 · ${dirCount}个方向`
    : `下一波：${Math.max(1, dirCount)}个方向来袭 · ${MMSS(clock)}`;

  const mm = Math.floor(clock / 60); const ss = Math.floor(clock % 60);
  const timeStr = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-3 py-2 pointer-events-none">
      {/* 左：要塞名 + 天数 */}
      <div className="panel px-4 py-2 flex flex-col pointer-events-auto">
        <div className="text-[12px] tracking-[0.1em] font-bold" style={{ color: '#5BC0DE' }}>{fortress}</div>
        <div className="label-mono mt-0.5">DAY {String(day).padStart(2, '0')} · {phaseLabel}</div>
      </div>

      {/* 中：资源 */}
      <div className="panel px-5 py-2 flex items-center gap-6 pointer-events-auto">
        <Res label="魔力结晶" value={resources.crystal} color="#5BC0DE" />
        <Res label="木材" value={resources.wood} color="#D4A843" />
        <Res label="粮食" value={resources.food} color="#48BB78" />
        <Res label="人口" value={`${resources.population}/${useGame.getState().popCap}`} color="#e8edf5" small />
      </div>

      {/* 右：倒计时 + 波次预告 */}
      <div className="panel px-4 py-2 flex flex-col items-end pointer-events-auto">
        <div className="label-mono flex items-center gap-2">
          <span style={{ color: isNight ? '#E53E3E' : '#8bedb5' }}>
            {isNight ? `WAVE ${wave + 1}` : `WAVE ${wave + 1} · ${timeStr}`}
          </span>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: '#8aa0c0' }}>{forecast}</div>
      </div>
    </div>
  );
}

function Res({ label, value, color, small }) {
  return (
    <div className="flex flex-col items-center">
      <div className="label-mono">{label}</div>
      <div className="res-num" style={{ color, fontSize: small ? 18 : undefined }}>{value}</div>
    </div>
  );
}