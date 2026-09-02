// Timer Mode Configurations
const MODES = {
  pomodoro: {
    name: '[ 01 > FOCUS ]',
    shortName: 'POM',
    theme: 'theme-pomodoro',
    durationSeconds: 25 * 60,
    defaultText: '25:00'
  },
  shortBreak: {
    name: '[ 02 > SHORT ]',
    shortName: 'SBR',
    theme: 'theme-short-break',
    durationSeconds: 5 * 60,
    defaultText: '05:00'
  },
  longBreak: {
    name: '[ 03 > LONG ]',
    shortName: 'LBR',
    theme: 'theme-long-break',
    durationSeconds: 15 * 60,
    defaultText: '15:00'
  }
};

// DOM Elements
const container = document.querySelector('.container');
const collapseBtn = document.getElementById('collapse-btn');
const collapsedView = document.getElementById('collapsed-view');
const collapsedTimer = document.getElementById('collapsed-timer');
const modeFullEl = document.querySelector('.mode-full');
const modeShortEl = document.querySelector('.mode-short');
const termStatus = document.getElementById('term-status');
const pomodoroBtn = document.getElementById('pomodoro-btn');
const shortBreakBtn = document.getElementById('short-break-btn');
const longBreakBtn = document.getElementById('long-break-btn');
const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const modeButtons = document.querySelectorAll('.mode-btn');
const progressBarFill = document.getElementById('progress-bar-fill');

// Timer State
let currentMode = 'pomodoro';
let timeLeft = MODES.pomodoro.durationSeconds;
let totalDuration = MODES.pomodoro.durationSeconds;
let isRunning = false;
let timerInterval = null;
let endTime = null;
let audioCtx = null;

/**
 * Format total seconds into MM:SS string
 * @param {number} totalSeconds
 * @returns {string} Formatted time string
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');
  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Update the Clean Single Progress Bar width
 * @param {number} [ratio] - Exact continuous progress ratio (0 to 1)
 */
function updateProgressBar(ratio = (timeLeft / totalDuration)) {
  if (!progressBarFill) return;
  const safeRatio = Math.max(0, Math.min(1, ratio));
  progressBarFill.style.width = `${safeRatio * 100}%`;
}

/**
 * Update the timer on the page and the browser tab title
 * @param {number} [exactRatio] - Optional sub-second continuous ratio
 */
function updateDisplay(exactRatio) {
  const formatted = formatTime(timeLeft);
  timerDisplay.textContent = formatted;
  if (collapsedTimer) collapsedTimer.textContent = formatted;
  if (modeFullEl) modeFullEl.textContent = `// ${MODES[currentMode].shortName === 'POM' ? 'POMODORO' : (MODES[currentMode].shortName === 'SBR' ? 'SHORT BREAK' : 'LONG BREAK')}`;
  if (modeShortEl) modeShortEl.textContent = `// ${MODES[currentMode].shortName}`;

  if (termStatus) {
    if (isRunning) {
      termStatus.innerHTML = `<span class="status-full">STATUS: RUNNING // ${formatted}</span><span class="status-short">RUNNING // ${formatted}</span>`;
    } else if (timeLeft === 0) {
      termStatus.innerHTML = `<span class="status-full">STATUS: COMPLETE // READY</span><span class="status-short">COMPLETE</span>`;
    } else {
      termStatus.innerHTML = `<span class="status-full">STATUS: STANDBY // ${formatted}</span><span class="status-short">STANDBY // ${formatted}</span>`;
    }
  }

  const ratio = (exactRatio !== undefined) ? exactRatio : (timeLeft / totalDuration);
  updateProgressBar(ratio);

  if (isRunning) {
    document.title = `[ ${formatted} ] ${MODES[currentMode].shortName} // SYS`;
  } else {
    document.title = `[ ${formatted} ] POMODORO // SYS`;
  }
}

/**
 * Play a calm completion chime using Web Audio API
 */
function playCompletionChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // Dual-tone harmonic chime (C5 and E5)
    [523.25, 659.25].forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.15);

      gain.gain.setValueAtTime(0.25, now + index * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.15 + 1.2);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + index * 0.15);
      osc.stop(now + index * 0.15 + 1.2);
    });
  } catch (err) {
    console.warn('Audio chime error:', err);
  }
}

/**
 * Start the countdown timer with drift-proof timestamp tracking
 */
function startTimer() {
  if (isRunning) return;

  // Unlock AudioContext on first user interaction
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    // Ignore audio initialization errors
  }

  isRunning = true;
  startBtn.innerHTML = `<span class="btn-text-full">[ || PAUSE ]</span><span class="btn-text-short">PAUSE</span>`;
  if (container) container.classList.add('timer-active');

  // Calculate target finish timestamp
  endTime = Date.now() + timeLeft * 1000;
  updateDisplay();

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    const msRemaining = Math.max(0, endTime - now);
    const remainingSeconds = Math.ceil(msRemaining / 1000);

    if (msRemaining <= 0) {
      // Session Complete
      timeLeft = 0;
      updateDisplay(0);
      pauseTimer();
      playCompletionChime();

      // Reset to mode's default duration
      timeLeft = MODES[currentMode].durationSeconds;
      totalDuration = MODES[currentMode].durationSeconds;
      setTimeout(() => {
        updateDisplay(1);
      }, 1000);
    } else {
      timeLeft = remainingSeconds;
      const exactRatio = msRemaining / (totalDuration * 1000);
      updateDisplay(exactRatio);
    }
  }, 40); // 40ms interval for silky-smooth 25fps continuous bar depletion
}

/**
 * Pause the active timer
 */
function pauseTimer() {
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  startBtn.innerHTML = `<span class="btn-text-full">[ > EXECUTE ]</span><span class="btn-text-short">START</span>`;
  if (container) container.classList.remove('timer-active');
  updateDisplay();
}

/**
 * Play a distinct tactile click / toggle sound for the Start / Pause button
 * @param {boolean} isStarting - True when starting countdown, false when pausing
 */
function playStartButtonSound(isStarting) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (isStarting) {
      // Resonant, energetic affirmative chime-pop for Start
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      // Soft mechanical tactile click for Pause
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Toggle Start / Pause state with spring bounce micro-interaction & sound
 */
function toggleTimer() {
  // Trigger tactile spring-bounce animation on button
  startBtn.classList.remove('btn-spring-click');
  // Trigger reflow to restart CSS animation cleanly
  void startBtn.offsetWidth;
  startBtn.classList.add('btn-spring-click');

  if (isRunning) {
    playStartButtonSound(false);
    pauseTimer();
  } else {
    playStartButtonSound(true);
    startTimer();
  }
}

/**
 * Play a subtle, tactile UI click sound via Web Audio API (for ghost mode buttons)
 */
function playClickSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Crisp, subtle modern UI tap (pitch drop from 900Hz to 400Hz in 40ms)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch (err) {
    // Ignore audio errors
  }
}

/**
 * Switch active mode, reset countdown, update theme and timer display
 * @param {string} modeKey - 'pomodoro' | 'shortBreak' | 'longBreak'
 * @param {HTMLButtonElement} selectedBtn - The clicked ghost button element
 */
function setMode(modeKey, selectedBtn) {
  const modeConfig = MODES[modeKey];
  if (!modeConfig) return;

  // Play auditory click feedback
  playClickSound();

  // Pause active countdown
  pauseTimer();

  currentMode = modeKey;
  timeLeft = modeConfig.durationSeconds;
  totalDuration = modeConfig.durationSeconds;

  // Update active ghost button styling
  modeButtons.forEach(btn => btn.classList.remove('active'));
  selectedBtn.classList.add('active');

  // Morph background color smoothly via body theme class
  document.body.classList.remove('theme-pomodoro', 'theme-short-break', 'theme-long-break');
  document.body.classList.add(modeConfig.theme);

  // Update timer display & progress ring
  updateDisplay();
}

/**
 * Toggle between full expanded card and minimalist collapsed Zen pill
 */
function toggleCollapse() {
  if (!container) return;
  playClickSound();
  container.classList.toggle('is-collapsed');
}

// Event Listeners
pomodoroBtn.addEventListener('click', () => setMode('pomodoro', pomodoroBtn));
shortBreakBtn.addEventListener('click', () => setMode('shortBreak', shortBreakBtn));
longBreakBtn.addEventListener('click', () => setMode('longBreak', longBreakBtn));
startBtn.addEventListener('click', toggleTimer);

if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);
if (collapsedView) collapsedView.addEventListener('click', toggleCollapse);

startBtn.addEventListener('animationend', () => {
  startBtn.classList.remove('btn-spring-click');
});

// Initial display setup
updateDisplay();

