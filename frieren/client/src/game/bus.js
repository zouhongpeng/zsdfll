// 极简事件总线：用于 React UI 与 Three.js 场景之间的命令通信
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  set.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error('[bus]', event, e); }
  });
}