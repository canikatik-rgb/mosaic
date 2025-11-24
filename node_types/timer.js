// node_types/timer.js

/**
 * Timer Node Type
 * Creates a node with countdown timer functionality.
 */

// --- Text Definitions for Timer Node ---
/*
const timerTexts = {
    nodeName: {
        en: 'Timer',
        tr: 'Zamanlayıcı',
        es: 'Temporizador',
        fr: 'Minuteur',
        de: 'Timer'
    },
    setTargetTimeLabel: {
        en: 'Set Target Date & Time:',
        tr: 'Hedef Tarih ve Saati Ayarla:',
        es: 'Establecer Fecha y Hora Objetivo:',
        fr: 'Définir Date et Heure Cibles:',
        de: 'Zieldatum und -zeit festlegen:'
    },
    setTimeButton: {
        en: 'Start Timer',
        tr: 'Zamanlayıcıyı Başlat',
        es: 'Iniciar Temporizador',
        fr: 'Démarrer Minuterie',
        de: 'Timer starten'
    },
    changeTimeButton: {
        en: 'Change Time',
        tr: 'Zamanı Değiştir',
        es: 'Cambiar Hora',
        fr: 'Changer Heure',
        de: 'Zeit ändern'
    },
    pauseButton: {
        en: 'Pause',
        tr: 'Duraklat',
        es: 'Pausar',
        fr: 'Pause',
        de: 'Pause'
    },
    resumeButton: {
        en: 'Resume',
        tr: 'Devam Et',
        es: 'Reanudar',
        fr: 'Reprendre',
        de: 'Fortsetzen'
    },
    daysLabel: { en: 'Days', tr: 'Gün', es: 'Días', fr: 'Jours', de: 'Tage' },
    hoursLabel: { en: 'Hours', tr: 'Saat', es: 'Horas', fr: 'Heures', de: 'Stunden' },
    minutesLabel: { en: 'Minutes', tr: 'Dakika', es: 'Minutos', fr: 'Minutes', de: 'Minuten' },
    secondsLabel: { en: 'Seconds', tr: 'Saniye', es: 'Segundos', fr: 'Secondes', de: 'Sekunden' },
    expiredLabel: { en: 'Time Expired!', tr: 'Süre Doldu!', es: '¡Tiempo Expirado!', fr: 'Temps Écoulé!', de: 'Zeit Abgelaufen!' }
};
*/

// Helper to get text based on current language - REMOVED
/*
function getTimerText(key, lang) {
    const currentLang = lang || window.currentLanguage || 'en';
    return timerTexts[key]?.[currentLang] || timerTexts[key]?.['en'] || key; // Fallback to English or key
}
*/

// Function to get localized texts for this node type (used by node type switcher) - REPLACED
/*
function getTimerTextsForSwitcher() {
    // Use the global getText function from ui.js
    // Node name needs separate structure for node type switcher
    const nodeNameTexts = {
        en: getText('timerNodeName') || 'Timer',
        es: getText('timerNodeName') || 'Temporizador',
        fr: getText('timerNodeName') || 'Minuteur',
        de: getText('timerNodeName') || 'Timer',
        tr: getText('timerNodeName') || 'Zamanlayıcı'
    };
    return {
        nodeName: nodeNameTexts, // Keep this structure
        setTime: getText('timerSetTime') || 'Set Time',
        changeTime: getText('timerChangeTime') || 'Change Time',
        pause: getText('timerPause') || 'Pause',
        resume: getText('timerResume') || 'Resume',
        expired: getText('timerExpired') || 'Time's Up!',
        days: getText('timerDays') || 'Days',
        hours: getText('timerHours') || 'Hours',
        minutes: getText('timerMinutes') || 'Mins',
        seconds: getText('timerSeconds') || 'Secs'
    };
}
*/

// --- Main Function to Create Timer Node HTML --- 
function createTimerNodeHTML(id, x, y, content, stripColor) {
    const currentLang = window.currentLanguage || 'en';
    const node = document.createElement('div');
    node.className = 'node node-timer'; // Specific class
    node.id = id;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;

    let targetTime = null; // Store target time as Date object or null
    let timerInterval = null; // Store interval ID
    let isPaused = false;

    // --- Standard Node Structure --- 
    const strip = document.createElement('div');
    strip.className = 'strip';
    if (stripColor) strip.style.backgroundColor = stripColor;
    // Add type switch icon - REMOVED
    // Add delete button - REMOVED

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.contentEditable = 'false';

    const leftPin = document.createElement('div');
    leftPin.className = 'pin left';

    const rightPin = document.createElement('div');
    rightPin.className = 'pin right';

    node.appendChild(strip);
    node.appendChild(contentDiv);
    node.appendChild(leftPin);
    node.appendChild(rightPin);

    // --- Timer Specific Elements --- 
    const timerDisplay = document.createElement('div');
    timerDisplay.className = 'timer-display';
    timerDisplay.innerHTML = `
        <div class="time-segment days">
            <span class="value">--</span>
            <span class="label">${getText('timerDays') || 'Days'}</span>
        </div>
        <div class="time-segment hours">
            <span class="value">--</span>
            <span class="label">${getText('timerHours') || 'Hours'}</span>
        </div>
        <div class="time-segment minutes">
            <span class="value">--</span>
            <span class="label">${getText('timerMinutes') || 'Mins'}</span>
        </div>
        <div class="time-segment seconds">
            <span class="value">--</span>
            <span class="label">${getText('timerSeconds') || 'Secs'}</span>
        </div>
        <div class="timer-expired expired-message" style="display: none;">${getText('timerExpired') || 'Time Expired!'}</div>
    `;

    const timerControls = document.createElement('div');
    timerControls.className = 'timer-controls';

    const setTimeArea = document.createElement('div');
    setTimeArea.className = 'set-time-area';
    setTimeArea.style.display = 'none'; // Initially hidden
    setTimeArea.innerHTML = `
        <label>${getText('timerSetTargetLabel') || 'Set Target Date & Time:'}</label>
        <input type="datetime-local" class="target-datetime">
        <button class="set-time-btn">${getText('timerSetTime') || 'Start Timer'}</button>
    `;

    const runningControls = document.createElement('div');
    runningControls.className = 'running-controls';
    runningControls.style.display = 'none'; // Initially hidden
    runningControls.innerHTML = `
        <button class="pause-resume-btn">${getText('timerPause') || 'Pause'}</button>
        <button class="change-time-btn">${getText('timerChangeTime') || 'Change Time'}</button>
    `;

    timerControls.appendChild(setTimeArea);
    timerControls.appendChild(runningControls);

    contentDiv.appendChild(timerDisplay);
    contentDiv.appendChild(timerControls);

    // --- Timer Logic --- 
    const daysVal = timerDisplay.querySelector('.days .value');
    const hoursVal = timerDisplay.querySelector('.hours .value');
    const minutesVal = timerDisplay.querySelector('.minutes .value');
    const secondsVal = timerDisplay.querySelector('.seconds .value');
    const expiredMsg = timerDisplay.querySelector('.timer-expired');

    const dateTimeInput = setTimeArea.querySelector('.target-datetime');
    const setTimeBtn = setTimeArea.querySelector('.set-time-btn');
    const pauseResumeBtn = runningControls.querySelector('.pause-resume-btn');
    const changeTimeBtn = runningControls.querySelector('.change-time-btn');

    function updateDisplay() {
        if (!targetTime || isPaused) return;

        const now = Date.now();
        const diff = targetTime.getTime() - now;

        if (diff <= 0) {
            daysVal.textContent = '00';
            hoursVal.textContent = '00';
            minutesVal.textContent = '00';
            secondsVal.textContent = '00';
            expiredMsg.style.display = 'block';
            clearInterval(timerInterval);
            timerInterval = null;
            pauseResumeBtn.textContent = getText('timerResume') || 'Resume';
            pauseResumeBtn.disabled = true;
            return;
        } else {
            expiredMsg.style.display = 'none';
            pauseResumeBtn.disabled = false;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        daysVal.textContent = String(days).padStart(2, '0');
        hoursVal.textContent = String(hours).padStart(2, '0');
        minutesVal.textContent = String(minutes).padStart(2, '0');
        secondsVal.textContent = String(seconds).padStart(2, '0');
    }

    function startTimer() {
        if (!targetTime) return;
        clearInterval(timerInterval);
        isPaused = false;
        setTimeArea.style.display = 'none';
        runningControls.style.display = 'flex';
        pauseResumeBtn.textContent = getText('timerPause') || 'Pause';
        pauseResumeBtn.disabled = false;

        updateDisplay();
        timerInterval = setInterval(updateDisplay, 1000);
        console.log(`Timer ${id} started for target:`, targetTime);
    }

    function pauseTimer() {
        if (!timerInterval) return;
        clearInterval(timerInterval);
        timerInterval = null;
        isPaused = true;
        pauseResumeBtn.textContent = getText('timerResume') || 'Resume';
        console.log(`Timer ${id} paused.`);
    }

    function resumeTimer() {
        if (!targetTime || timerInterval) return;
        isPaused = false;
        pauseResumeBtn.textContent = getText('timerPause') || 'Pause';
        startTimer();
        console.log(`Timer ${id} resumed.`);
    }

    function showSetTimeUI() {
        clearInterval(timerInterval);
        timerInterval = null;
        isPaused = false;
        runningControls.style.display = 'none';
        setTimeArea.style.display = 'block';
        if (targetTime) {
            const year = targetTime.getFullYear();
            const month = String(targetTime.getMonth() + 1).padStart(2, '0');
            const day = String(targetTime.getDate()).padStart(2, '0');
            const hours = String(targetTime.getHours()).padStart(2, '0');
            const minutes = String(targetTime.getMinutes()).padStart(2, '0');
            dateTimeInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        } else {
            dateTimeInput.value = '';
        }
    }

    // --- Event Listeners --- 
    setTimeBtn.addEventListener('click', () => {
        const inputValue = dateTimeInput.value;
        if (!inputValue) {
            alert('Please select a valid date and time.'); // Maybe use a non-blocking notification?
            return;
        }
        const newTarget = new Date(inputValue);
        if (isNaN(newTarget.getTime())) {
            alert('Invalid date format.');
            return;
        }
        targetTime = newTarget;
        if (window.saveNodeContentChange) {
            window.saveNodeContentChange(node);
        }
        startTimer();
    });

    pauseResumeBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });

    changeTimeBtn.addEventListener('click', showSetTimeUI);

    // --- Initial Load Logic --- 
    function loadInitialState() {
        const placeholder = getPlaceholderText();
        if (content && content !== placeholder && content.includes('T')) { // Basic check for ISO string
            try {
                const loadedDate = new Date(content);
                if (!isNaN(loadedDate.getTime())) {
                    targetTime = loadedDate;
                    startTimer();
                } else {
                    console.warn(`Timer node ${id} loaded invalid date content:`, content);
                    showSetTimeUI();
                }
            } catch (e) {
                console.error(`Error parsing timer content for node ${id}:`, e);
                showSetTimeUI();
            }
        } else {
            showSetTimeUI();
        }
    }

    contentDiv.addEventListener('dblclick', (e) => {
        e.stopPropagation();
    });

    function getContentData() {
        return targetTime ? targetTime.toISOString() : '';
    }

    node.getContentData = getContentData;

    loadInitialState();

    node.cleanupTimer = () => {
        clearInterval(timerInterval);
        console.log(`Timer interval cleared for node ${id}`);
    };

    return node;
}

// --- Expose Texts and Register Loader --- 

// Expose the texts for the switcher
createTimerNodeHTML.getTexts = () => {
    // Need to return the structure expected by the switcher
    const currentLang = window.currentLanguage || 'en';
    return {
        nodeName: {
            en: getText('timerNodeName') || 'Timer',
            es: getText('timerNodeName') || 'Temporizador',
            fr: getText('timerNodeName') || 'Minuteur',
            de: getText('timerNodeName') || 'Timer',
            tr: getText('timerNodeName') || 'Zamanlayıcı'
        }
    };
};

// Register this node type loader *after* the function definition
if (typeof window !== 'undefined') {
    window.nodeTypeLoaders = window.nodeTypeLoaders || {};
    window.nodeTypeLoaders['timer'] = createTimerNodeHTML;
} else {
    // module.exports = createTimerNodeHTML; // Remove CommonJS export if not needed
} 