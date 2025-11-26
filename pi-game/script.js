document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const CONFIG = {
        PI_DIGITS: "1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094",
        MAX_LIMIT: 400,
        MIN_LIMIT: 5,
        AUDIO_BASE_FREQ: 220,
        AUDIO_STEP: 5
    };

    // --- DOM Cache ---
    const ui = {
        limitSlider: document.getElementById('limitSlider'),
        limitInput: document.getElementById('limitInput'),
        btnGo: document.getElementById('btnGo'),
        voxelBox: document.getElementById('voxelBox'),
        ribbon: document.getElementById('ribbon'),
        xpBar: document.getElementById('xpBar'),
        hiddenInput: document.getElementById('hiddenInput'),
        timerEl: document.getElementById('timer'),
        btnGame: document.getElementById('btnGame'),
        btnPractice: document.getElementById('btnPractice'),
        ribbonContainer: document.getElementById('ribbonContainer'),
        toast: document.getElementById('toast'),
    };

    // --- State ---
    let state = {
        limit: CONFIG.MAX_LIMIT,
        index: 0,
        isPractice: false,
        startTime: null,
        timerInterval: null,
        finished: false
    };

    // --- Audio System ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(freq, type = 'square', duration = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    function showToast(msg = "Max 400!") {
        ui.toast.textContent = msg;
        ui.toast.style.display = 'block';
        setTimeout(() => ui.toast.style.display = 'none', 1500);
    }

    // --- Core Logic ---
    function init() {
        renderDigits();
        setupEventListeners();
        ui.hiddenInput.focus();
    }

    function setupEventListeners() {
        // Slider: Visual update only
        ui.limitSlider.addEventListener('input', (e) => {
            ui.limitInput.value = parseInt(e.target.value);
        });

        // Slider: Commit on change (Mouse Up)
        ui.limitSlider.addEventListener('change', (e) => {
            updateLimit(parseInt(e.target.value));
        });

        // Text Input: Validation only
        ui.limitInput.addEventListener('input', (e) => {
            let val = e.target.value;
            if (val === '') return;

            let num = parseInt(val);
            if (num > CONFIG.MAX_LIMIT) {
                e.target.value = CONFIG.MAX_LIMIT;
                showToast();
                ui.limitInput.classList.add('input-error');
                setTimeout(() => ui.limitInput.classList.remove('input-error'), 500);
            }
        });

        // Text Input: Commit on Enter
        ui.limitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyManualInput();
            }
        });

        // GO Button: Commit
        ui.btnGo.addEventListener('click', applyManualInput);

        // Global Focus Trap (Robust)
        document.addEventListener('click', handleGlobalClick);

        // UI Interactions
        ui.voxelBox.addEventListener('click', () => ui.hiddenInput.focus());

        // Game Input
        ui.hiddenInput.addEventListener('keydown', handleKeydown);
        ui.hiddenInput.addEventListener('input', handleInput);

        // Modes
        ui.btnGame.addEventListener('click', () => setMode(false));
        ui.btnPractice.addEventListener('click', () => setMode(true));
    }

    function handleGlobalClick(e) {
        // ROBUST CHECK: Check if the clicked target OR any parent is interactive
        if (e.target.closest('button, input, a, [role="button"]')) return;

        // Check for text selection
        if (window.getSelection().toString().length > 0) return;

        // Force Focus
        ui.hiddenInput.focus();
    }

    function applyManualInput() {
        let val = parseInt(ui.limitInput.value);
        if (isNaN(val) || val < CONFIG.MIN_LIMIT) val = CONFIG.MIN_LIMIT;
        if (val > CONFIG.MAX_LIMIT) val = CONFIG.MAX_LIMIT;

        ui.limitInput.value = val;
        ui.limitSlider.value = val;
        updateLimit(val);
    }

    function setMode(isPracticeMode) {
        state.isPractice = isPracticeMode;
        document.body.className = isPracticeMode ? 'mode-practice' : 'mode-game';

        ui.btnGame.classList.toggle('selected', !isPracticeMode);
        ui.btnGame.setAttribute('aria-pressed', !isPracticeMode);

        ui.btnPractice.classList.toggle('selected', isPracticeMode);
        ui.btnPractice.setAttribute('aria-pressed', isPracticeMode);

        resetGame();
    }

    function updateLimit(val) {
        if (!val || isNaN(val) || val < CONFIG.MIN_LIMIT) return;
        state.limit = val;
        resetGame();
    }

    function renderDigits() {
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < CONFIG.MAX_LIMIT; i++) {
            const s = document.createElement('span');
            s.className = 'digit';

            if (i < state.index) {
                s.classList.add('revealed');
                if (i === state.index - 1) s.classList.add('latest');
            }
            s.textContent = CONFIG.PI_DIGITS[i];

            if (i >= state.limit) {
                s.style.display = 'none';
            }
            fragment.appendChild(s);
        }

        ui.ribbon.innerHTML = '';
        ui.ribbon.appendChild(fragment);
    }

    function handleKeydown(e) {
        const k = e.key;
        if (!e.metaKey && !e.ctrlKey && k.length === 1 && (k < '0' || k > '9')) {
            e.preventDefault();
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) {
            e.preventDefault();
        }
    }

    function handleInput(e) {
        if (state.finished) return;

        const val = e.data || ui.hiddenInput.value.slice(-1);
        ui.hiddenInput.value = '';

        if (!val) return;

        const expected = CONFIG.PI_DIGITS[state.index];

        if (val === expected) {
            handleCorrectInput(val);
        } else {
            handleIncorrectInput();
        }
    }

    function handleCorrectInput(digit) {
        if (state.index === 0) startTimer();

        ui.voxelBox.textContent = digit;
        ui.voxelBox.classList.remove('active');
        void ui.voxelBox.offsetWidth;
        ui.voxelBox.classList.add('active');

        playSound(CONFIG.AUDIO_BASE_FREQ + (state.index * CONFIG.AUDIO_STEP));

        const spans = ui.ribbon.children;
        const currentSpan = spans[state.index];

        if (currentSpan) {
            currentSpan.classList.add('revealed');
            if (state.index > 0) spans[state.index - 1].classList.remove('latest');
            currentSpan.classList.add('latest');
        }

        state.index++;

        let pct = (state.index / state.limit * 100);
        if (pct > 100) pct = 100;
        ui.xpBar.style.width = `${pct}%`;

        if (state.index >= state.limit) {
            winGame();
        }

        setTimeout(() => {
            if (state.index < state.limit && !state.finished) {
                ui.voxelBox.textContent = '';
            }
        }, 150);
    }

    function handleIncorrectInput() {
        ui.voxelBox.classList.remove('error');
        void ui.voxelBox.offsetWidth;
        ui.voxelBox.classList.add('error');
    }

    function startTimer() {
        if (state.timerInterval) return;
        state.startTime = Date.now();
        state.timerInterval = setInterval(() => {
            const t = (Date.now() - state.startTime) / 1000;
            ui.timerEl.textContent = t.toFixed(1) + 's';
        }, 100);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function resetGame() {
        state.index = 0;
        state.finished = false;
        stopTimer();

        ui.timerEl.textContent = '0.0s';
        ui.xpBar.style.width = '0%';
        ui.voxelBox.textContent = '';
        ui.voxelBox.classList.remove('active', 'error');

        renderDigits();

        // FOCUS FIX: Force blur slider to prevent focus stealing
        if (document.activeElement === ui.limitSlider) {
            ui.limitSlider.blur();
        }
        setTimeout(() => {
            ui.hiddenInput.focus();
        }, 10);
    }

    function winGame() {
        stopTimer();
        state.finished = true;
        ui.voxelBox.textContent = '★';

        setTimeout(() => playSound(440), 0);
        setTimeout(() => playSound(554), 100);
        setTimeout(() => playSound(659), 200);

        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#55efc4', '#74b9ff', '#ffeaa7'],
                zIndex: 9999
            });
        }
    }

    init();
});