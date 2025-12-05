let timerId = null;
let targetTime = null;

self.onmessage = function(e) {
    if (e.data.command === 'start') {
        targetTime = e.data.targetTime;
        timerId = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
            self.postMessage({ type: 'tick', seconds: remaining });
            if (remaining <= 0) {
                clearInterval(timerId);
                self.postMessage({ type: 'finish' });
            }
        }, 250);
    } else if (e.data.command === 'stop') {
        clearInterval(timerId);
        timerId = null;
                    targetTime = null;
    }
};
