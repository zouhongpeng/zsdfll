import { useGame } from '../game/store.js';
import { emit } from '../game/bus.js';
import { playSfx } from '../game/audio.js';
import { Puzzle, Hammer, Trash2, Gauge, Play, Pause, Camera, Globe, X } from 'lucide-react';

const MODES = [
  { key: 'region', label: '区域规划', icon: Puzzle, color: '#5BC0DE' },
  { key: 'build', label: '建造模式', icon: Hammer, color: '#48BB78' },
  { key: 'demolish', label: '拆除模式', icon: Trash2, color: '#E53E3E' },
];

export default function BottomBar() {
  const mode = useGame((s) => s.mode);
  const setMode = useGame((s) => s.setMode);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const brush = useGame((s) => s.regionBrush);

  const toggleMode = (k) => {
    const next = mode === k ? null : k;
    setMode(next);
    emit('camera:setPanEnabled', next !== 'region'); // 区域划定时禁用平移避免冲突
    playSfx('click');
  };

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
      {mode === 'region' && brush && (
        <div className="panel px-4 py-2 flex items-center gap-4 fade-in">
          <span className="label-mono text-[#5BC0DE]">
            在战区内按住左键拖拽划出矩形区域，松开即创建；右键 / ESC 取消
          </span>
        </div>
      )}

      <div className="panel flex items-center gap-1 px-2 py-1.5">
        {MODES.map(({ key, label, icon: Icon, color }) => (
          <button key={key} onClick={() => toggleMode(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] transition-colors ${mode === key ? 'text-black' : 'text-[#cfe0f5] hover:bg-white/10'}`}
            style={mode === key ? { background: color, boxShadow: `0 0 10px ${color}66` } : {}}>
            <Icon size={13} />{label}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <button onClick={() => { setSpeed(speed === 2 ? 1 : 2); playSfx('click'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] ${speed === 2 ? 'text-black' : 'text-[#cfe0f5] hover:bg-white/10'}`}
          style={speed === 2 ? { background: '#D4A843', boxShadow: '0 0 10px #D4A84366' } : {}}>
          <Gauge size={13} />加速 {speed}×
        </button>
        <button onClick={() => { setPaused(!paused); playSfx('click'); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] text-[#cfe0f5] hover:bg-white/10">
          {paused ? <Play size={13} /> : <Pause size={13} />}{paused ? '继续' : '暂停'}
        </button>
        <button onClick={() => { emit('camera:reset'); playSfx('click'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] text-[#cfe0f5] hover:bg-white/10">
          <Camera size={13} />视角复位
        </button>
        <button onClick={() => { emit('camera:global'); playSfx('click'); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] text-[#cfe0f5] hover:bg-white/10">
          <Globe size={13} />全局视图
        </button>
      </div>
    </div>
  );
}