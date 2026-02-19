let interval: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<{ cmd: 'start' | 'stop' }>) => {
  if (e.data.cmd === 'start') {
    if (interval) return;
    interval = setInterval(() => {
      self.postMessage({ tick: true });
    }, 100);
  } else if (e.data.cmd === 'stop') {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }
};
