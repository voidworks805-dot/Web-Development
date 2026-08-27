/**
 * Application Entry Point
 * Structure: DOM Elements -> State -> Functions -> Event Listeners -> Init
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. DOM Elements
    // ==========================================
    const passwordOutput = document.getElementById('password-output');
    const generateBtn = document.getElementById('generate-btn');
    
    const lengthEl = document.getElementById('length');
    const uppercaseEl = document.getElementById('uppercase');
    const lowercaseEl = document.getElementById('lowercase');
    const numbersEl = document.getElementById('numbers');
    const symbolsEl = document.getElementById('symbols');

    // ==========================================
    // 2. Application State / Configuration
    // ==========================================
    const CHAR_SETS = {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
    };

    // ==========================================
    // 3. Helper Functions
    // ==========================================
    
    /**
     * Generates a cryptographically secure random integer between 0 (inclusive) and max (exclusive).
     * Uses rejection sampling to eliminate modulo bias.
     */
    function getSecureRandomInt(max) {
        if (max <= 0) return 0;
        const randomBuffer = new Uint32Array(1);
        // Calculate max allowed value to prevent modulo bias (4294967295 is max Uint32)
        const maxSecureVal = Math.floor(4294967295 / max) * max;
        let randomVal;
        do {
            window.crypto.getRandomValues(randomBuffer);
            randomVal = randomBuffer[0];
        } while (randomVal >= maxSecureVal);
        return randomVal % max;
    }

    /**
     * Shuffles an array in place using a secure Fisher-Yates algorithm.
     */
    function secureShuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = getSecureRandomInt(i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Main generation logic
     */
    function generatePassword() {
        let length = parseInt(lengthEl.value);
        if (isNaN(length)) length = 10;
        
        // Enforce max length
        if (length > 10) length = 10;

        const useUpper = uppercaseEl.checked;
        const useLower = lowercaseEl.checked;
        const useNumbers = numbersEl.checked;
        const useSymbols = symbolsEl.checked;

        const typesCount = useUpper + useLower + useNumbers + useSymbols;

        // Handle Empty State
        if (typesCount === 0) {
            alert('Error: Please select at least one character type.');
            return;
        }

        // Enforce Min Length based on selected types
        if (length < typesCount) {
            length = typesCount;
            lengthEl.value = length; // update UI
            alert(`Length increased to ${length} to fit all selected character types.`);
        }

        let combinedPool = '';
        const generatedChars = [];

        // 1. Guarantee inclusion of selected types
        if (useUpper) {
            generatedChars.push(CHAR_SETS.uppercase[getSecureRandomInt(CHAR_SETS.uppercase.length)]);
            combinedPool += CHAR_SETS.uppercase;
        }
        if (useLower) {
            generatedChars.push(CHAR_SETS.lowercase[getSecureRandomInt(CHAR_SETS.lowercase.length)]);
            combinedPool += CHAR_SETS.lowercase;
        }
        if (useNumbers) {
            generatedChars.push(CHAR_SETS.numbers[getSecureRandomInt(CHAR_SETS.numbers.length)]);
            combinedPool += CHAR_SETS.numbers;
        }
        if (useSymbols) {
            generatedChars.push(CHAR_SETS.symbols[getSecureRandomInt(CHAR_SETS.symbols.length)]);
            combinedPool += CHAR_SETS.symbols;
        }

        // 2. Fill the rest
        const remainingLength = length - typesCount;
        for (let i = 0; i < remainingLength; i++) {
            generatedChars.push(combinedPool[getSecureRandomInt(combinedPool.length)]);
        }

        // 3. Securely shuffle the result so guaranteed chars aren't always first
        secureShuffle(generatedChars);

        // 4. Output to DOM
        passwordOutput.value = generatedChars.join('');
        
        // 5. Allow user editing after first generation
        passwordOutput.removeAttribute('readonly');
    }

    function init() {
        console.log('Application initialized.');
    }

    // ==========================================
    // 4. Event Listeners
    // ==========================================
    if (generateBtn) {
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            generatePassword();
        });
    }

    if (passwordOutput) {
        passwordOutput.addEventListener('input', (e) => {
            if (e.target.value === '') {
                e.target.setAttribute('readonly', 'true');
            }
        });
    }

    // ==========================================
    // 5. Initialize
    // ==========================================
    init();
});
