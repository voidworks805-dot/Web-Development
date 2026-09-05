// Timer Mode Configurations (Temporarily set to 10s for testing)
const MODES = {
  pomodoro: {
    name: 'DEEP FLOW',
    shortName: 'FLOW',
    theme: 'theme-pomodoro',
    durationSeconds: 10,
    defaultText: '00:10'
  },
  shortBreak: {
    name: 'QUICK REST',
    shortName: 'REST',
    theme: 'theme-short-break',
    durationSeconds: 10,
    defaultText: '00:10'
  },
  longBreak: {
    name: 'DEEP RESET',
    shortName: 'RESET',
    theme: 'theme-long-break',
    durationSeconds: 10,
    defaultText: '00:10'
  }
};

// Progress Bar Direction:
// 'depletion' = starts at 100% full & drains down to 0% (countdown battery/gauge)
// 'elapsed'   = starts at 0% empty & fills up to 100% (progress completed)
const PROGRESS_DIRECTION = 'depletion';

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
let remainingMs = MODES.pomodoro.durationSeconds * 1000;
let isRunning = false;
let timerInterval = null;
let endTime = null;
let audioCtx = null;
let completionTimeout = null;

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
 * Calculate the progress ratio (0 to 1) based on remaining time and chosen direction
 * @param {number} currentRemainingMs
 * @param {number} totalDurationSec
 * @returns {number} Ratio between 0 and 1
 */
function getProgressRatio(currentRemainingMs = remainingMs, totalDurationSec = totalDuration) {
  const totalMs = totalDurationSec * 1000;
  if (totalMs <= 0) return 0;
  const clampedMs = Math.max(0, Math.min(totalMs, currentRemainingMs));
  if (PROGRESS_DIRECTION === 'elapsed') {
    return (totalMs - clampedMs) / totalMs;
  }
  // Depletion: starts at 1.0 (100%) and counts down to 0
  return clampedMs / totalMs;
}

/**
 * Update the horizontal linear progress bar DOM element
 * @param {number} [ratio] - Continuous ratio (0 to 1)
 */
function updateProgressBar(ratio) {
  if (!progressBarFill) return;
  const activeRatio = (ratio !== undefined) ? ratio : getProgressRatio();
  const safePercent = Math.max(0, Math.min(100, activeRatio * 100));
  progressBarFill.style.width = `${safePercent}%`;

  const track = progressBarFill.parentElement;
  if (track && track.getAttribute('role') === 'progressbar') {
    track.setAttribute('aria-valuenow', Math.round(safePercent));
  }
}

/**
 * Update the timer text, status bar, document title, and progress bar
 * @param {number} [exactRatio] - Sub-second continuous progress ratio (0 to 1)
 */
function updateDisplay(exactRatio) {
  const formatted = formatTime(timeLeft);
  if (timerDisplay) timerDisplay.textContent = formatted;
  if (collapsedTimer) collapsedTimer.textContent = formatted;

  const modeData = MODES[currentMode];
  if (modeFullEl) {
    modeFullEl.textContent = modeData.name;
  }
  if (modeShortEl) {
    modeShortEl.textContent = modeData.shortName;
  }

  if (termStatus) {
    if (isRunning) {
      termStatus.innerHTML = `<span class="status-full">STATE: IN FLOW · ${formatted}</span><span class="status-short">IN FLOW · ${formatted}</span>`;
    } else if (timeLeft === 0) {
      termStatus.innerHTML = `<span class="status-full">STATE: COMPLETE · BREATHE</span><span class="status-short">COMPLETE</span>`;
    } else {
      termStatus.innerHTML = `<span class="status-full">STATE: READY · ${formatted}</span><span class="status-short">READY · ${formatted}</span>`;
    }
  }

  const ratio = (exactRatio !== undefined) ? exactRatio : getProgressRatio();
  updateProgressBar(ratio);

  if (isRunning) {
    document.title = `${formatted} · ${modeData.name} [MONO]`;
  } else {
    document.title = `${formatted} · Monochrome Glass`;
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
      // Resonant affirmative chime-pop for Start
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
 * Start the countdown timer with drift-proof timestamp tracking
 */
function startTimer() {
  if (isRunning) return;

  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }

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
  if (startBtn) {
    startBtn.innerHTML = `<span class="btn-text-full">PAUSE FLOW</span><span class="btn-text-short">PAUSE</span>`;
  }
  if (container) container.classList.add('timer-active');

  // Calculate target finish timestamp using remainingMs for sub-second continuity
  endTime = Date.now() + remainingMs;
  updateDisplay(getProgressRatio());

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = Date.now();
    remainingMs = Math.max(0, endTime - now);
    timeLeft = Math.ceil(remainingMs / 1000);

    if (remainingMs <= 0) {
      // Session Complete
      timeLeft = 0;
      remainingMs = 0;
      updateDisplay(PROGRESS_DIRECTION === 'depletion' ? 0 : 1);
      pauseTimer();
      playCompletionChime();

      // Reset to mode default duration after completion notification
      completionTimeout = setTimeout(() => {
        remainingMs = MODES[currentMode].durationSeconds * 1000;
        timeLeft = MODES[currentMode].durationSeconds;
        totalDuration = MODES[currentMode].durationSeconds;
        updateDisplay();
        completionTimeout = null;
      }, 1500);
    } else {
      updateDisplay(getProgressRatio());
    }
  }, 40); // 40ms interval for silky-smooth 25fps continuous bar updates
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
  if (endTime) {
    remainingMs = Math.max(0, endTime - Date.now());
    timeLeft = Math.ceil(remainingMs / 1000);
  }
  if (startBtn) {
    startBtn.innerHTML = `<span class="btn-text-full">ENTER FLOW STATE</span><span class="btn-text-short">ENTER FLOW</span>`;
  }
  if (container) container.classList.remove('timer-active');
  updateDisplay(getProgressRatio());
}

/**
 * Toggle Start / Pause state with spring bounce micro-interaction & sound
 */
function toggleTimer() {
  if (startBtn) {
    startBtn.classList.remove('btn-spring-click');
    void startBtn.offsetWidth; // Force reflow
    startBtn.classList.add('btn-spring-click');
  }

  if (isRunning) {
    playStartButtonSound(false);
    pauseTimer();
  } else {
    playStartButtonSound(true);
    startTimer();
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

  if (completionTimeout) {
    clearTimeout(completionTimeout);
    completionTimeout = null;
  }

  // Play auditory click feedback
  playClickSound();

  // Pause active countdown
  pauseTimer();

  currentMode = modeKey;
  timeLeft = modeConfig.durationSeconds;
  totalDuration = modeConfig.durationSeconds;
  remainingMs = modeConfig.durationSeconds * 1000;

  // Update active ghost button styling
  modeButtons.forEach(btn => btn.classList.remove('active'));
  if (selectedBtn) selectedBtn.classList.add('active');

  // Morph background color smoothly via body theme class
  document.body.classList.remove('theme-pomodoro', 'theme-short-break', 'theme-long-break');
  document.body.classList.add(modeConfig.theme);

  // Update timer display & progress bar
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
if (pomodoroBtn) pomodoroBtn.addEventListener('click', () => setMode('pomodoro', pomodoroBtn));
if (shortBreakBtn) shortBreakBtn.addEventListener('click', () => setMode('shortBreak', shortBreakBtn));
if (longBreakBtn) longBreakBtn.addEventListener('click', () => setMode('longBreak', longBreakBtn));
if (startBtn) startBtn.addEventListener('click', toggleTimer);

if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);
if (collapsedView) collapsedView.addEventListener('click', toggleCollapse);

if (startBtn) {
  startBtn.addEventListener('animationend', () => {
    startBtn.classList.remove('btn-spring-click');
  });
}

// Initial display setup
updateDisplay();
