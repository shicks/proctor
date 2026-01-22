// --- App Logic ---

let TOTAL_MINUTES = 30;
let CHECKPOINTS = [15, 10, 5];

let worker = null;
let audioCtx = null;
let wakeLock = null;
let isRunning = false;
let lastSeconds = 0;
let targetTime = null;
let whiteNoiseNode = null;

const el = {
    display: document.getElementById('timer-display'),
    pocketTime: document.getElementById('pocket-time'),
    ring: document.getElementById('progress-ring'),
    start: document.getElementById('start-btn'),
    stop: document.getElementById('stop-btn'),
    overlay: document.getElementById('pocket-overlay'),
    pocketMsg: document.getElementById('pocket-msg'),
    input: document.getElementById('config-input'),
    status: document.getElementById('config-status')
};

// Initialize Config
const savedConfig = localStorage.getItem('proctorConfig');
el.input.value = savedConfig || "30, 15, 10, 5";

// Initialize Worker
worker = new Worker('worker.js');

worker.onmessage = (e) => {
    if (e.data.type === 'tick') {
        const s = e.data.seconds;
        if (s !== lastSeconds) {
            lastSeconds = s;
            updateUI(s);
            checkAnnouncements(s);
        }
    } else if (e.data.type === 'finish') {
        finishTimer();
    }
};

applyConfig(true);
loadState();

// --- State Management ---

function saveState() {
    const state = {
        isRunning: isRunning,
        targetTime: targetTime,
        lastSeconds: lastSeconds
    };
    localStorage.setItem('proctorState', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('proctorState');
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        lastSeconds = state.lastSeconds;
        isRunning = state.isRunning;
        targetTime = state.targetTime;

        if (isRunning && targetTime) {
            const now = Date.now();
            const remaining = Math.ceil((targetTime - now) / 1000);
            if (remaining > 0) {
                lastSeconds = remaining;
                updateUI(lastSeconds);
                updateControls(true);
                el.input.disabled = true;
                worker.postMessage({ command: 'start', targetTime: targetTime });
            } else {
                isRunning = false;
                targetTime = null;
                finishTimer();
            }
        } else {
            updateUI(lastSeconds);
            updateControls(isRunning);
        }
    } catch (e) {
        console.error("Error loading state:", e);
    }
}

// --- Core Functions ---

function applyConfig(isInit = false) {
    if (isRunning) return;

    const raw = el.input.value;
    const numbers = raw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);

    if (numbers.length > 0) {
        TOTAL_MINUTES = numbers[0];
        CHECKPOINTS = numbers.slice(1).filter(n => n < TOTAL_MINUTES);
        localStorage.setItem('proctorConfig', raw);

        const alertText = CHECKPOINTS.length > 0 ? CHECKPOINTS.join(', ') : 'None';
        el.status.textContent = `Total: ${TOTAL_MINUTES}m | Alerts: ${alertText}`;
        el.status.className = "text-[10px] text-green-500 h-4";

        lastSeconds = TOTAL_MINUTES * 60;
        updateUI(lastSeconds);
        if (!isInit) saveState();
    } else {
        el.status.textContent = "Invalid format. Try: 30, 15, 10, 5";
        el.status.className = "text-[10px] text-red-500 h-4";
    }
}

async function startTimer() {
    if (isRunning) return;
    el.input.disabled = true;
    initAudio();
    requestWakeLock();
    const now = Date.now();
    targetTime = now + (lastSeconds * 1000);
    worker.postMessage({ command: 'start', targetTime: targetTime });
    isRunning = true;
    updateControls(true);
    saveState();
}

function stopTimer() {
    if (!isRunning) return;
    worker.postMessage({ command: 'stop' });
    isRunning = false;
    targetTime = null;
    updateControls(false);
    stopAudio();
    if (wakeLock) wakeLock.release();
    el.input.disabled = false;
    el.overlay.classList.remove('alarm-bg');
    el.pocketMsg.classList.add('hidden');
    saveState();
}

function finishTimer() {
    stopTimer();
    lastSeconds = TOTAL_MINUTES * 60;
    el.overlay.classList.add('alarm-bg');
    el.pocketMsg.classList.remove('hidden');
    playChime();
    speak("Time is up. Pencils down.");
    saveState();
}

// --- Audio ---

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // White Noise Generator
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 0.001; }

    whiteNoiseNode = audioCtx.createBufferSource();
    whiteNoiseNode.buffer = noiseBuffer;
    whiteNoiseNode.loop = true;
    whiteNoiseNode.connect(audioCtx.destination);
    whiteNoiseNode.start();
}

function stopAudio() {
    if (whiteNoiseNode) {
        try { whiteNoiseNode.stop(); } catch(e){}
        whiteNoiseNode = null;
    }
}

function playChime() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 1.5);
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1;
        window.speechSynthesis.speak(u);
    }
}

// --- UI Updates ---

function checkAnnouncements(seconds) {
    // TODO - this is very brittle.  A much better approach would be to store the _set_ of future
    // announcement times, and then at _every_ wakeup (not just whole minutes), we check if there
    // are _any_ expired times in that set.  If so, remove them all and announce the actual
    // remaining time, in case we miss an exact notification.
    if (seconds % 60 === 0) {
        const mins = seconds / 60;
        if (CHECKPOINTS.includes(mins)) {
            playChime();
            speak(`${mins} minutes remaining.`);
            navigator.vibrate(500);
        }
    }
}

function updateUI(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const str = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    el.display.textContent = str;
    el.pocketTime.textContent = str;
    document.title = str;
    const r = 283;
    const totalSecs = TOTAL_MINUTES * 60;
    const offset = r - (seconds / totalSecs) * r;
    el.ring.style.strokeDashoffset = -offset;
}

function updateControls(active) {
    el.start.disabled = active;
    el.start.className = active ? "w-full bg-gray-700 text-gray-500 font-bold py-4 rounded-xl text-lg opacity-50 cursor-not-allowed" : "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg active:scale-95 transition";
    el.stop.disabled = !active;
    el.stop.className = !active ? "w-full bg-gray-700 text-gray-400 font-bold py-4 rounded-xl text-lg opacity-50 cursor-not-allowed" : "w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg active:scale-95 transition";
}

// --- Wake Lock & Pocket Mode ---

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                if (isRunning && document.visibilityState === 'visible') requestWakeLock();
            });
        }
    } catch (err) { console.log(err); }
}

function enterPocketMode() {
    if (!isRunning) {
        alert("Please START the timer first.");
        return;
    }
    initAudio();
    requestWakeLock();
    el.overlay.style.display = 'flex';
}

let lastTap = 0;
el.overlay.addEventListener('click', (e) => {
    const cur = new Date().getTime();
    if (cur - lastTap < 500) {
        el.overlay.style.display = 'none';
    }
    lastTap = cur;
});

document.addEventListener('visibilitychange', () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});
