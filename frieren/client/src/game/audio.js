// Web Audio API 程序化音效（不引入音频文件）
let ctx = null;
let muted = false;

export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function ensure() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function note(freq, dur, type = 'sine', vol = 0.2, delay = 0, glideTo = null) {
  if (muted || !ctx) return;
  const c = ensure(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export function playSfx(name) {
  switch (name) {
    case 'fire': note(880, 0.12, 'square', 0.12, 0, 240); break;
    case 'die': note(320, 0.18, 'sawtooth', 0.16, 0, 60); note(500, 0.1, 'triangle', 0.1, 0.02, 150); break;
    case 'build': note(440, 0.15, 'sine', 0.15, 0, 660); note(660, 0.12, 'sine', 0.1, 0.08, 880); break;
    case 'place': note(520, 0.1, 'triangle', 0.14, 0, 780); break;
    case 'spawn': note(140, 0.4, 'sawtooth', 0.08, 0, 70); break;
    case 'coreHit': note(90, 0.35, 'triangle', 0.22, 0, 50); break;
    case 'destroy': note(200, 0.3, 'sawtooth', 0.2, 0, 55); break;
    case 'trap': note(300, 0.08, 'square', 0.1, 0, 180); break;
    case 'drum': // 战鼓
      for (let i = 0; i < 4; i++) { note(90 + i * 6, 0.28, 'sine', 0.25, i * 0.16); note(60, 0.3, 'triangle', 0.25, i * 0.16, 45); }
      break;
    case 'alert': note(740, 0.12, 'square', 0.12, 0); note(740, 0.12, 'square', 0.12, 0.16); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => note(f, 0.2, 'triangle', 0.15, i * 0.12)); break;
    case 'lose': [440, 392, 330, 262].forEach((f, i) => note(f, 0.3, 'sine', 0.18, i * 0.15)); break;
    case 'click': note(700, 0.05, 'triangle', 0.08); break;
    case 'upgrade': note(660, 0.1, 'triangle', 0.14, 0, 990); break;
    default: break;
  }
}

export function unlockAudio() { ensure(); }
export const getAudioCtx = () => ensure();