/**
 * Pure function to sanitize and tokenize raw text into an array of words.
 *
 * @param {string} rawText - The unformatted string input from the user.
 * @returns {string[]} An array of clean word tokens.
 */
function tokenize(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }
  return rawText.trim().match(/\S+/g) || [];
}

// Reader Engine State
let tokens = [];
let wordElements = [];
let currentIndex = 0;
let isPlaying = false;
let timerId = null;
let currentWpm = 300;
const MIN_WPM = 60;
const MAX_WPM = 900;

document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('text-input');
  const readerPassage = document.getElementById('reader-passage');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const wpmDecBtn = document.getElementById('wpm-dec');
  const wpmIncBtn = document.getElementById('wpm-inc');
  const wpmDisplay = document.getElementById('wpm-display');

  /**
   * Mounts all tokens into the passage container as pre-defined spans.
   * Enables the user to view and skim the full text at once.
   */
  function mountPassage(newTokens) {
    readerPassage.innerHTML = '';
    wordElements = [];

    const fragment = document.createDocumentFragment();

    newTokens.forEach((token, index) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = token;

      wordElements.push(span);
      fragment.appendChild(span);

      // Add whitespace between words to preserve passage readability
      if (index < newTokens.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });

    readerPassage.appendChild(fragment);
  }

  /**
   * Recursive timeout function for pacing words across the entire passage.
   * Toggles the pre-defined .active CSS class on the span without injecting inline styles.
   */
  function playNextWord() {
    if (!isPlaying) return;

    if (currentIndex >= wordElements.length) {
      pauseReader();
      return;
    }

    // Remove active class from the previous word
    if (currentIndex > 0 && wordElements[currentIndex - 1]) {
      wordElements[currentIndex - 1].classList.remove('active');
    }

    // Apply active class to the current word
    const currentSpan = wordElements[currentIndex];
    if (currentSpan) {
      currentSpan.classList.add('active');
      currentSpan.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    currentIndex++;

    // Base delay calculation: 60,000 ms / WPM
    const delay = Math.round(60000 / currentWpm);
    timerId = setTimeout(playNextWord, delay);
  }

  function startReader() {
    const rawText = textInput.value;
    const freshTokens = tokenize(rawText);

    if (freshTokens.length === 0) {
      readerPassage.innerHTML = '<em>Please enter some text in the box above to begin reading.</em>';
      return;
    }

    // Re-mount passage if text changed or if never mounted
    const hasTextChanged = freshTokens.join(' ') !== tokens.join(' ');
    if (hasTextChanged || wordElements.length === 0) {
      tokens = freshTokens;
      mountPassage(tokens);
      currentIndex = 0;
    } else if (currentIndex >= wordElements.length) {
      // Clear trailing highlight and restart from index 0
      if (wordElements[wordElements.length - 1]) {
        wordElements[wordElements.length - 1].classList.remove('active');
      }
      currentIndex = 0;
    }

    isPlaying = true;
    playPauseBtn.textContent = 'Pause';
    playNextWord();
  }

  function pauseReader() {
    isPlaying = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    playPauseBtn.textContent = 'Play';
  }

  function resetReader() {
    pauseReader();
    // Remove active class from all spans
    wordElements.forEach((el) => el.classList.remove('active'));
    currentIndex = 0;
    if (wordElements.length > 0) {
      wordElements[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Adjusts WPM ensuring it never exceeds MAX_WPM (900).
   * @param {number} delta - Amount to change WPM by.
   */
  function adjustWpm(delta) {
    const nextWpm = currentWpm + delta;
    currentWpm = Math.min(MAX_WPM, Math.max(MIN_WPM, nextWpm));
    wpmDisplay.textContent = `${currentWpm} WPM`;
  }

  // Event Listeners
  playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
      pauseReader();
    } else {
      startReader();
    }
  });

  resetBtn.addEventListener('click', resetReader);
  wpmDecBtn.addEventListener('click', () => adjustWpm(-50));
  wpmIncBtn.addEventListener('click', () => adjustWpm(50));

  // Automatically pause if resized below the 480px breakpoint
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 480 && isPlaying) {
      pauseReader();
    }
  });
});
