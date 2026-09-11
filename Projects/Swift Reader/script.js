/**
 * Swift Reader - Core Engine
 * Vanilla JavaScript implementation supporting:
 * - Dual Reading Modes (RSVP Single-Word Mode with ORP & Full Text Guided Mode)
 * - Synchronized state machine & timing engine
 * - Keyboard shortcuts, speed presets, scrubbing, and stats tracking
 */

// Pure tokenization function
function tokenize(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }
  return rawText.trim().match(/\S+/g) || [];
}

/**
 * Calculates the Optimal Recognition Point (ORP) index for a word.
 * Fixation is positioned roughly 30-35% into the word.
 *
 * @param {string} word
 * @returns {number} 0-based anchor index
 */
function getOrpIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

// Global Application State
let tokens = [];
let wordElements = [];
let currentIndex = 0;
let isPlaying = false;
let timerId = null;
let currentWpm = 300;
let currentMode = 'rsvp'; // 'rsvp' | 'fulltext'

const MIN_WPM = 60;
const MAX_WPM = 900;

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const body = document.body;
  const textInput = document.getElementById('text-input');
  const loadTextBtn = document.getElementById('load-text-btn');
  const sourceCollapsible = document.getElementById('source-collapsible');
  const sourceHeaderBtn = document.getElementById('source-header-btn');
  const collapseTextBtn = document.getElementById('collapse-text-btn');
  const wordCountBadge = document.getElementById('word-count-badge');
  const sourceToggleBtn = document.getElementById('source-toggle-btn');
  const modeToggleBtn = document.getElementById('mode-toggle-btn');
  const readingStats = document.getElementById('reading-stats');
  const readingWorkspace = document.querySelector('.reading-workspace');
  let isTransitioningMode = false;

  // RSVP Elements
  const rsvpWordDisplay = document.getElementById('rsvp-word-display');
  const rsvpWpmBadge = document.getElementById('rsvp-wpm-badge');
  const prevWordBtn = document.getElementById('prev-word-btn');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const nextWordBtn = document.getElementById('next-word-btn');
  const speedSlider = document.getElementById('speed-slider');
  const speedDisplayVal = document.getElementById('speed-display-val');
  const speedMinusBtn = document.getElementById('speed-minus-btn');
  const speedPlusBtn = document.getElementById('speed-plus-btn');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Full Text Elements
  const readerPassage = document.getElementById('reader-passage');
  const ftPrevBtn = document.getElementById('ft-prev-btn');
  const ftPlayPauseBtn = document.getElementById('ft-play-pause-btn');
  const ftNextBtn = document.getElementById('ft-next-btn');
  const ftProgressBar = document.getElementById('ft-progress-bar');
  const ftTimeLeft = document.getElementById('ft-time-left');
  const ftWpm = document.getElementById('ft-wpm');

  // Guard clause: Only run if essential reader elements are present
  if (!rsvpWordDisplay || !readerPassage) {
    return;
  }

  /* -------------------------------------------------------------------------- */
  /* Initialization & Ingestion                                                 */
  /* -------------------------------------------------------------------------- */

  function loadText() {
    const rawText = textInput.value;
    tokens = tokenize(rawText);
    currentIndex = 0;

    // Update word count badge
    if (wordCountBadge) {
      wordCountBadge.textContent = `${tokens.length} word${tokens.length === 1 ? '' : 's'}`;
    }

    // Mount passage in Full Text View
    mountPassage(tokens);

    // Render initial state
    updateViews();
  }

  function mountPassage(newTokens) {
    readerPassage.innerHTML = '';
    wordElements = [];

    const fragment = document.createDocumentFragment();

    newTokens.forEach((token, index) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = token;

      // Allow clicking on any word in full-text mode to seek
      span.addEventListener('click', () => {
        seekTo(index);
      });

      wordElements.push(span);
      fragment.appendChild(span);

      if (index < newTokens.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });

    readerPassage.appendChild(fragment);
  }

  /* -------------------------------------------------------------------------- */
  /* View Synchronization & Rendering                                          */
  /* -------------------------------------------------------------------------- */

  function formatTimeLeft() {
    if (tokens.length === 0) return '< 1 min left';
    const remaining = Math.max(0, tokens.length - currentIndex);
    const minutes = remaining / currentWpm;
    if (minutes < 1) return '< 1 min left';
    return `${Math.ceil(minutes)} min left`;
  }

  function updateViews() {
    if (tokens.length === 0) {
      rsvpWordDisplay.innerHTML = '<span class="orp-anchor">Ready</span>';
      readingStats.textContent = '0 / 0 words · < 1 min left';
      return;
    }

    const currentWord = tokens[currentIndex] || '';
    const orpIdx = getOrpIndex(currentWord);
    const prefix = currentWord.slice(0, orpIdx);
    const anchor = currentWord.charAt(orpIdx);
    const suffix = currentWord.slice(orpIdx + 1);

    // 1. Update RSVP Card with ORP markup
    rsvpWordDisplay.innerHTML = `
      <span class="orp-prefix">${prefix}</span><span class="orp-anchor">${anchor}</span><span class="orp-suffix">${suffix}</span>
    `;

    // 2. Update Full Text highlighting
    wordElements.forEach((el, idx) => {
      if (idx === currentIndex) {
        el.classList.add('active');
        if (currentMode === 'fulltext') {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else {
        el.classList.remove('active');
      }
    });

    // 3. Update Progress Bar & Stats
    const progressPercent = tokens.length > 0 ? (currentIndex / (tokens.length - 1)) * 100 : 0;
    if (ftProgressBar) {
      ftProgressBar.value = Math.round(progressPercent);
    }

    const timeLeftStr = formatTimeLeft();
    const statsText = `${currentIndex + 1} / ${tokens.length} words · ${timeLeftStr}`;
    if (readingStats) readingStats.textContent = statsText;
    if (ftTimeLeft) ftTimeLeft.textContent = timeLeftStr;
  }

  /* -------------------------------------------------------------------------- */
  /* Engine Timing & Playback Lifecycle                                         */
  /* -------------------------------------------------------------------------- */

  function tick() {
    if (!isPlaying) return;

    if (currentIndex >= tokens.length - 1) {
      pause();
      return;
    }

    currentIndex++;
    updateViews();

    const delay = Math.round(60000 / currentWpm);
    timerId = setTimeout(tick, delay);
  }

  function play() {
    if (tokens.length === 0) return;

    // If at end, loop back to start
    if (currentIndex >= tokens.length - 1) {
      currentIndex = 0;
    }

    // Auto-collapse source input smoothly to preserve reading focus
    closeSourceText();

    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
    ftPlayPauseBtn.textContent = 'Pause';

    updateViews();
    const delay = Math.round(60000 / currentWpm);
    timerId = setTimeout(tick, delay);
  }

  function pause() {
    isPlaying = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    playPauseBtn.textContent = 'Play';
    ftPlayPauseBtn.textContent = 'Play';
  }

  function togglePlayPause() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function nextWord() {
    pause();
    if (currentIndex < tokens.length - 1) {
      currentIndex++;
      updateViews();
    }
  }

  function prevWord() {
    pause();
    if (currentIndex > 0) {
      currentIndex--;
      updateViews();
    }
  }

  function seekTo(index) {
    pause();
    currentIndex = Math.max(0, Math.min(tokens.length - 1, index));
    updateViews();
  }

  /* -------------------------------------------------------------------------- */
  /* Speed Controls & Presets                                                   */
  /* -------------------------------------------------------------------------- */

  function setWpm(newWpm) {
    currentWpm = Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(newWpm)));

    if (speedSlider) speedSlider.value = currentWpm;
    if (speedDisplayVal) speedDisplayVal.textContent = currentWpm;
    if (rsvpWpmBadge) rsvpWpmBadge.textContent = `${currentWpm} wpm`;
    if (ftWpm) ftWpm.textContent = `${currentWpm} wpm`;

    // Highlight active preset button if matches
    presetBtns.forEach((btn) => {
      const val = parseInt(btn.dataset.wpm, 10);
      if (val === currentWpm) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update remaining time estimate
    updateViews();
  }

  /* -------------------------------------------------------------------------- */
  /* Mode Switcher (RSVP vs Full Text)                                          */
  /* -------------------------------------------------------------------------- */

  function setMode(mode) {
    if (currentMode === mode || isTransitioningMode) return;
    isTransitioningMode = true;

    // Step 1: Trigger smooth fade-out
    if (readingWorkspace) {
      readingWorkspace.classList.add('fade-out');
    }

    // Step 2: After fade-out completes (150ms), switch modes and fade back in
    setTimeout(() => {
      currentMode = mode;
      if (mode === 'fulltext') {
        body.classList.remove('mode-rsvp');
        body.classList.add('mode-fulltext');
        modeToggleBtn.classList.add('active');
        modeToggleBtn.querySelector('.mode-label').textContent = 'RSVP Mode';
        if (wordElements[currentIndex]) {
          wordElements[currentIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      } else {
        body.classList.remove('mode-fulltext');
        body.classList.add('mode-rsvp');
        modeToggleBtn.classList.remove('active');
        modeToggleBtn.querySelector('.mode-label').textContent = 'Full Text';
      }

      // Step 3: Trigger smooth fade-in
      if (readingWorkspace) {
        readingWorkspace.classList.remove('fade-out');
      }

      // Release transition lock after fade-in
      setTimeout(() => {
        isTransitioningMode = false;
      }, 150);
    }, 150);
  }

  function toggleMode() {
    setMode(currentMode === 'rsvp' ? 'fulltext' : 'rsvp');
  }

  /* -------------------------------------------------------------------------- */
  /* Event Listeners                                                            */
  /* -------------------------------------------------------------------------- */

  // Playback Buttons
  playPauseBtn.addEventListener('click', togglePlayPause);
  ftPlayPauseBtn.addEventListener('click', togglePlayPause);
  prevWordBtn.addEventListener('click', prevWord);
  ftPrevBtn.addEventListener('click', prevWord);
  nextWordBtn.addEventListener('click', nextWord);
  ftNextBtn.addEventListener('click', nextWord);

  // Speed Slider & Steppers
  speedSlider.addEventListener('input', (e) => {
    setWpm(parseInt(e.target.value, 10));
  });

  speedMinusBtn.addEventListener('click', () => {
    setWpm(currentWpm - 25);
  });

  speedPlusBtn.addEventListener('click', () => {
    setWpm(currentWpm + 25);
  });

  // Preset Buttons
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const wpm = parseInt(btn.dataset.wpm, 10);
      setWpm(wpm);
    });
  });

  // Full Text Progress Slider Scrubbing
  ftProgressBar.addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value);
    const targetIdx = Math.round((percent / 100) * (tokens.length - 1));
    seekTo(targetIdx);
  });

  // Mode Switcher
  modeToggleBtn.addEventListener('click', toggleMode);

  // Smooth Source Text Drawer Controls
  function openSourceText() {
    if (sourceCollapsible) {
      sourceCollapsible.classList.add('open');
      if (sourceHeaderBtn) sourceHeaderBtn.setAttribute('aria-expanded', 'true');
      textInput.focus();
    }
  }

  function closeSourceText() {
    if (sourceCollapsible) {
      sourceCollapsible.classList.remove('open');
      if (sourceHeaderBtn) sourceHeaderBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleSourceText() {
    if (sourceCollapsible && sourceCollapsible.classList.contains('open')) {
      closeSourceText();
    } else {
      openSourceText();
    }
  }

  // Header and Collapsible Listeners
  if (sourceHeaderBtn) sourceHeaderBtn.addEventListener('click', toggleSourceText);
  if (sourceToggleBtn) sourceToggleBtn.addEventListener('click', toggleSourceText);
  if (collapseTextBtn) collapseTextBtn.addEventListener('click', closeSourceText);

  loadTextBtn.addEventListener('click', () => {
    loadText();
    closeSourceText();
  });

  textInput.addEventListener('input', () => {
    const count = tokenize(textInput.value).length;
    if (wordCountBadge) {
      wordCountBadge.textContent = `${count} word${count === 1 ? '' : 's'}`;
    }
  });

  // Keyboard Shortcuts (Space, Arrows, F)
  window.addEventListener('keydown', (e) => {
    // Disable shortcuts if user is typing inside text input
    if (document.activeElement === textInput) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevWord();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextWord();
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      setWpm(currentWpm + 25);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      setWpm(currentWpm - 25);
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleMode();
    }
  });

  // Viewport resize pause guard
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 480 && isPlaying) {
      pause();
    }
  });

  // Initial Load
  loadText();
});
