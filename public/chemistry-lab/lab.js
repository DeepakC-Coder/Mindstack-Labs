/**
 * Ultra-Realistic Virtual Chemistry Laboratory
 * EDTA Titration Experiment
 */

// ============= SOUND MANAGER =============
class SoundManager {
    constructor() {
        this.enabled = true;
        this.audioContext = null;
    }

    initContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio not supported');
            }
        }
        // Resume context (required after user interaction)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    // Play a pleasant tone
    playNote(freq, duration, volume = 0.15) {
        if (!this.enabled) return;
        this.initContext();
        if (!this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // Smooth envelope
        const t = this.audioContext.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.03);
        gain.gain.setValueAtTime(volume, t + duration * 0.7);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(t);
        osc.stop(t + duration);
    }

    // Gentle drop sound
    playDrop() {
        this.playNote(392, 0.1, 0.12); // G4
    }

    // Splash - disabled during titration
    playSplash() {
        // Disabled
    }

    // Pour sound
    playPour() {
        this.playNote(262, 0.3, 0.1); // C4
    }

    // Success melody
    playSuccess() {
        this.playNote(523, 0.15, 0.15); // C5
        setTimeout(() => this.playNote(659, 0.15, 0.15), 150); // E5
        setTimeout(() => this.playNote(784, 0.25, 0.15), 300); // G5
    }

    // Click sound
    playClick() {
        this.playNote(440, 0.08, 0.1); // A4
    }

    // Soft water swirling/shaking sound - gentle and pleasant
    playSwirl() {
        if (!this.enabled) return;
        this.initContext();
        if (!this.audioContext) return;

        const t = this.audioContext.currentTime;
        const duration = 0.25;

        // Create gentle water shimmer using filtered noise
        const bufferSize = this.audioContext.sampleRate * duration;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        // Generate soft pink-ish noise
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.3;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        // Bandpass filter for water-like sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        // Very soft gain with fade
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.015, t + 0.03);
        gain.gain.setValueAtTime(0.015, t + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        noise.start(t);
        noise.stop(t + duration);
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// ============= POINT-OUT TUTORIAL MANAGER =============
class TutorialManager {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.spotlight = null;
        this.tooltip = null;
        this.arrow = null;

        // Point-out tutorial steps with target elements
        this.steps = [
            {
                title: 'Welcome to EDTA Titration Lab',
                target: '.lab-header',
                position: 'bottom',
                content: '👋 This virtual lab simulates water hardness testing. You will perform TWO titrations and find the average for accurate results.'
            },
            {
                title: '👤 Enter Your Details',
                target: '#studentForm',
                position: 'right',
                content: '📝 Fill in your name and roll number here. This information will appear on your PDF report.'
            },
            {
                title: '⚗️ Experiment Parameters',
                target: '#parametersSection',
                position: 'right',
                content: '🔬 Adjust EDTA concentration (0.01M), buffer pH (10), and sample volume (25mL) as needed.'
            },
            {
                title: '🧪 Water Sample Bottle',
                target: '#sampleBottle',
                position: 'right',
                content: '💧 Click this bottle to add 25mL water sample to the flask. This is Step 1 of the experiment.'
            },
            {
                title: '🧴 Buffer Solution',
                target: '#bufferBottle',
                position: 'right',
                content: '⚗️ Add buffer solution (pH 10) to maintain optimal conditions for EDTA complexation.'
            },
            {
                title: '🔴 EBT Indicator',
                target: '#indicatorBottle',
                position: 'right',
                content: '🎨 Add Eriochrome Black T indicator. The solution turns WINE-RED with Ca²⁺/Mg²⁺ ions.'
            },
            {
                title: '💙 EDTA Solution',
                target: '#edtaBottle',
                position: 'right',
                content: '🧪 Click to fill the burette with EDTA solution for titration.'
            },
            {
                title: '📏 Burette',
                target: '#buretteAssembly',
                position: 'left',
                content: '📊 The burette dispenses EDTA solution. Watch the reading as you add drops.'
            },
            {
                title: '🔬 Conical Flask',
                target: '#flaskAssembly',
                position: 'left',
                content: '🌈 Watch the color change here: Wine Red → Purple → BLUE. YOU decide when the endpoint is reached!'
            },
            {
                title: '📊 Observations Panel',
                target: '.right-panel',
                position: 'left',
                content: '📈 Monitor your titration readings, results, and export your PDF report from here.'
            },
            {
                title: '✅ Ready to Start!',
                target: '#startBtn',
                position: 'top',
                content: '🚀 Enter your details and click "Start Experiment" to begin. Good luck!'
            }
        ];

        this.init();
    }

    init() {
        // Create spotlight overlay
        this.spotlight = document.createElement('div');
        this.spotlight.className = 'tutorial-spotlight';
        this.spotlight.style.display = 'none';
        document.body.appendChild(this.spotlight);

        // Create tooltip
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tutorial-tooltip';
        this.tooltip.style.display = 'none';
        this.tooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-step"></span>
                <span class="tooltip-title"></span>
                <button class="tooltip-close">×</button>
            </div>
            <div class="tooltip-content"></div>
            <div class="tooltip-footer">
                <button class="tooltip-prev">← Previous</button>
                <span class="tooltip-progress"></span>
                <button class="tooltip-next">Next →</button>
            </div>
        `;
        document.body.appendChild(this.tooltip);

        // Create pointer arrow
        this.arrow = document.createElement('div');
        this.arrow.className = 'tutorial-arrow';
        this.arrow.style.display = 'none';
        document.body.appendChild(this.arrow);

        // Bind events
        this.tooltip.querySelector('.tooltip-close').addEventListener('click', () => this.hide());
        this.tooltip.querySelector('.tooltip-prev').addEventListener('click', () => this.prev());
        this.tooltip.querySelector('.tooltip-next').addEventListener('click', () => this.next());
        this.spotlight.addEventListener('click', () => this.hide());
    }

    show() {
        this.isActive = true;
        this.currentStep = 0;
        this.spotlight.style.display = 'block';
        this.tooltip.style.display = 'block';
        this.arrow.style.display = 'block';
        document.body.classList.add('tutorial-active');
        this.render();
    }

    hide() {
        this.isActive = false;
        this.spotlight.style.display = 'none';
        this.tooltip.style.display = 'none';
        this.arrow.style.display = 'none';
        document.body.classList.remove('tutorial-active');

        // Remove any highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }

    render() {
        const step = this.steps[this.currentStep];
        const target = document.querySelector(step.target);

        // Remove previous highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        // Update tooltip content
        this.tooltip.querySelector('.tooltip-step').textContent = `Step ${this.currentStep + 1}`;
        this.tooltip.querySelector('.tooltip-title').textContent = step.title;
        this.tooltip.querySelector('.tooltip-content').textContent = step.content;
        this.tooltip.querySelector('.tooltip-progress').textContent = `${this.currentStep + 1} / ${this.steps.length}`;

        // Update buttons
        const prevBtn = this.tooltip.querySelector('.tooltip-prev');
        const nextBtn = this.tooltip.querySelector('.tooltip-next');
        prevBtn.disabled = this.currentStep === 0;
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? '✅ Finish' : 'Next →';

        if (target) {
            // Add highlight to target
            target.classList.add('tutorial-highlight');

            // Get target position
            const rect = target.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            // Position tooltip based on specified position
            const tooltipRect = this.tooltip.getBoundingClientRect();
            let tooltipX, tooltipY, arrowX, arrowY, arrowRotation;

            switch (step.position) {
                case 'right':
                    tooltipX = rect.right + scrollLeft + 20;
                    tooltipY = rect.top + scrollTop + (rect.height / 2) - (tooltipRect.height / 2);
                    arrowX = rect.right + scrollLeft + 5;
                    arrowY = rect.top + scrollTop + (rect.height / 2) - 10;
                    arrowRotation = 'rotate(-90deg)';
                    break;
                case 'left':
                    tooltipX = rect.left + scrollLeft - tooltipRect.width - 20;
                    tooltipY = rect.top + scrollTop + (rect.height / 2) - (tooltipRect.height / 2);
                    arrowX = rect.left + scrollLeft - 25;
                    arrowY = rect.top + scrollTop + (rect.height / 2) - 10;
                    arrowRotation = 'rotate(90deg)';
                    break;
                case 'top':
                    tooltipX = rect.left + scrollLeft + (rect.width / 2) - (tooltipRect.width / 2);
                    tooltipY = rect.top + scrollTop - tooltipRect.height - 20;
                    arrowX = rect.left + scrollLeft + (rect.width / 2) - 10;
                    arrowY = rect.top + scrollTop - 25;
                    arrowRotation = 'rotate(180deg)';
                    break;
                case 'bottom':
                default:
                    tooltipX = rect.left + scrollLeft + (rect.width / 2) - (tooltipRect.width / 2);
                    tooltipY = rect.bottom + scrollTop + 20;
                    arrowX = rect.left + scrollLeft + (rect.width / 2) - 10;
                    arrowY = rect.bottom + scrollTop + 5;
                    arrowRotation = 'rotate(0deg)';
                    break;
            }

            // Keep tooltip on screen
            tooltipX = Math.max(10, Math.min(tooltipX, window.innerWidth - tooltipRect.width - 10));
            tooltipY = Math.max(10, tooltipY);

            this.tooltip.style.left = tooltipX + 'px';
            this.tooltip.style.top = tooltipY + 'px';

            // Position arrow
            this.arrow.style.left = arrowX + 'px';
            this.arrow.style.top = arrowY + 'px';
            this.arrow.style.transform = arrowRotation;

            // Scroll target into view if needed
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.render();
        } else {
            this.hide();
        }
    }
}

// ============= MAIN LAB CLASS =============
class VirtualLab {
    constructor() {
        this.soundManager = new SoundManager();
        this.state = {
            step: 0,
            studentName: '',
            rollNo: '',
            expId: '',
            buretteReading: 0,
            initialReading: 0,
            dropsAdded: 0,
            flaskColor: 'clear',
            endpointReached: false,
            targetHardness: null,
            isTitrating: false,
            // Experiment parameters
            edtaConcentration: 0.01,   // M (mol/L)
            bufferPH: 10.0,
            sampleVolume: 25,          // mL
            // Two-titration system
            currentTitration: 1,
            titration1Volume: null,
            titration2Volume: null,
            averageVolume: null,
            // Lab report inputs
            reportAim: '',
            reportProcedure: '',
            reportResult: ''
        };

        // Steps without suggestions - fully manual operation
        this.steps = [
            { title: 'Enter Your Details', desc: 'Fill in your name and roll number.' },
            { title: 'Add Water Sample', desc: 'Add the water sample to the flask.' },
            { title: 'Add Buffer Solution', desc: 'Add buffer solution to the flask.' },
            { title: 'Add Indicator', desc: 'Add EBT indicator to the flask.' },
            { title: 'Fill the Burette', desc: 'Fill the burette with EDTA solution.' },
            { title: 'Perform Titration', desc: 'Perform the titration manually.' },
            { title: 'Second Titration', desc: 'Repeat the titration for accuracy.' },
            { title: 'Complete!', desc: 'Enter report details and export PDF.' }
        ];

        this.tutorialManager = new TutorialManager();
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.simulateLoading();

        // Initialize 3D toggle
        if (typeof Lab3DToggle !== 'undefined') {
            this.lab3DToggle = new Lab3DToggle();
            this.lab3DToggle.init();
        }
    }

    // Helper to call 3D renderer if in 3D mode
    call3D(method, ...args) {
        if (this.lab3DToggle && this.lab3DToggle.is3DMode && window.lab3D) {
            if (typeof window.lab3D[method] === 'function') {
                window.lab3D[method](...args);
            }
        }
    }

    cacheElements() {
        // Loading
        this.loadingScreen = document.getElementById('loadingScreen');

        // Student form
        this.studentNameInput = document.getElementById('studentName');
        this.rollNoInput = document.getElementById('rollNo');
        this.startBtn = document.getElementById('startBtn');
        this.studentForm = document.getElementById('studentForm');
        this.studentDisplay = document.getElementById('studentDisplay');

        // Display elements
        this.displayName = document.getElementById('displayName');
        this.displayRoll = document.getElementById('displayRoll');
        this.expIdEl = document.getElementById('expId');

        // Step elements
        this.stepBadge = document.getElementById('stepBadge');
        this.stepTitle = document.getElementById('stepTitle');
        this.stepDescription = document.getElementById('stepDescription');

        // Equipment
        this.burette = document.getElementById('burette');
        this.buretteLiquid = document.getElementById('buretteLiquid');
        this.buretteTap = document.getElementById('buretteTap');
        this.buretteReadingEl = document.getElementById('buretteReading');
        this.flaskLiquid = document.getElementById('flaskLiquid');
        this.dropsContainer = document.getElementById('dropsContainer');

        // Reagent bottles
        this.sampleBottle = document.getElementById('sampleBottle');
        this.bufferBottle = document.getElementById('bufferBottle');
        this.indicatorBottle = document.getElementById('indicatorBottle');
        this.edtaBottle = document.getElementById('edtaBottle');

        // Controls
        this.titrationControls = document.getElementById('titrationControls');
        this.dropBtn = document.getElementById('dropBtn');
        this.stopBtn = document.getElementById('stopBtn');

        // Observations
        this.obsInitial = document.getElementById('obsInitial');
        this.obsCurrent = document.getElementById('obsCurrent');
        this.obsVolume = document.getElementById('obsVolume');

        // Titration indicator and results
        this.titrationBadge = document.getElementById('titrationBadge');
        this.titrationResults = document.getElementById('titrationResults');
        this.titration1Vol = document.getElementById('titration1Vol');
        this.titration2Vol = document.getElementById('titration2Vol');
        this.averageVol = document.getElementById('averageVol');

        // Results
        this.resultsGroup = document.getElementById('resultsGroup');
        this.hardnessResult = document.getElementById('hardnessResult');
        this.accuracyResult = document.getElementById('accuracyResult');
        this.calcSection = document.getElementById('calcSection');
        this.calcContent = document.getElementById('calcContent');

        // Lab Report inputs
        this.labReportSection = document.getElementById('labReportSection');
        this.reportAimInput = document.getElementById('reportAim');
        this.reportProcedureInput = document.getElementById('reportProcedure');
        this.reportResultInput = document.getElementById('reportResult');
        this.procedureWordCount = document.getElementById('procedureWordCount');

        // Parameter controls
        this.edtaConcSelect = document.getElementById('edtaConc');
        this.bufferPHSelect = document.getElementById('bufferPH');
        this.sampleVolumeInput = document.getElementById('sampleVolume');
        this.dispEdta = document.getElementById('dispEdta');
        this.dispPH = document.getElementById('dispPH');
        this.dispVol = document.getElementById('dispVol');

        // Buttons
        this.soundBtn = document.getElementById('soundBtn');
        this.helpBtn = document.getElementById('helpBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.tutorialBtn = document.getElementById('tutorialBtn');
    }

    bindEvents() {
        // Start button
        this.startBtn.addEventListener('click', () => this.startExperiment());

        // Reagent bottles
        this.sampleBottle.addEventListener('click', () => this.handleBottleClick('sample'));
        this.bufferBottle.addEventListener('click', () => this.handleBottleClick('buffer'));
        this.indicatorBottle.addEventListener('click', () => this.handleBottleClick('indicator'));
        this.edtaBottle.addEventListener('click', () => this.handleBottleClick('edta'));

        // Titration controls
        this.dropBtn.addEventListener('click', () => this.addDrop());
        this.dropBtn.addEventListener('mousedown', () => this.startContinuousDrop());
        this.dropBtn.addEventListener('mouseup', () => this.stopContinuousDrop());
        this.dropBtn.addEventListener('mouseleave', () => this.stopContinuousDrop());
        this.stopBtn.addEventListener('click', () => this.endTitration());

        // Header buttons
        this.soundBtn.addEventListener('click', () => this.toggleSound());
        this.resetBtn.addEventListener('click', () => this.resetExperiment());
        this.exportBtn.addEventListener('click', () => this.exportPDF());
        this.tutorialBtn.addEventListener('click', () => this.tutorialManager.show());

        // Parameter control events
        this.edtaConcSelect.addEventListener('change', () => this.updateParameters());
        this.bufferPHSelect.addEventListener('change', () => this.updateParameters());
        this.sampleVolumeInput.addEventListener('change', () => this.updateParameters());

        // Lab report input events
        this.reportProcedureInput.addEventListener('input', () => this.updateWordCount());
        this.reportAimInput.addEventListener('change', () => {
            this.state.reportAim = this.reportAimInput.value;
        });
        this.reportProcedureInput.addEventListener('change', () => {
            this.state.reportProcedure = this.reportProcedureInput.value;
        });
        this.reportResultInput.addEventListener('change', () => {
            this.state.reportResult = this.reportResultInput.value;
        });

        // Enter key for form
        this.rollNoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startExperiment();
        });

        // Keyboard controls for titration
        // Arrow Down = Add Drop, Enter = End Titration
        document.addEventListener('keydown', (e) => {
            // Only respond when titration is active
            if (!this.state.isTitrating || this.state.endpointReached === 'complete') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault(); // Prevent page scrolling
                this.addDrop();
                // Visual feedback on button
                this.dropBtn.classList.add('key-pressed');
                setTimeout(() => this.dropBtn.classList.remove('key-pressed'), 100);
            } else if (e.key === 'Enter' && this.state.step >= 5) {
                e.preventDefault();
                this.endTitration();
            }
        });

        // Arrow key held down for continuous drops
        let arrowHoldInterval = null;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' && this.state.isTitrating && !arrowHoldInterval) {
                arrowHoldInterval = setInterval(() => this.addDrop(), 200);
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowDown' && arrowHoldInterval) {
                clearInterval(arrowHoldInterval);
                arrowHoldInterval = null;
            }
        });
    }

    // Update word count for procedure
    updateWordCount() {
        const text = this.reportProcedureInput.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        this.procedureWordCount.textContent = words;

        const countEl = this.procedureWordCount.parentElement;
        countEl.classList.remove('warning', 'over');
        if (words > 30) {
            countEl.classList.add('over');
        } else if (words > 25) {
            countEl.classList.add('warning');
        }
    }

    // Update experiment parameters
    updateParameters() {
        this.state.edtaConcentration = parseFloat(this.edtaConcSelect.value);
        this.state.bufferPH = parseFloat(this.bufferPHSelect.value);
        this.state.sampleVolume = parseFloat(this.sampleVolumeInput.value) || 25;

        // Update display spans
        this.dispEdta.textContent = this.state.edtaConcentration;
        this.dispPH.textContent = this.state.bufferPH;
        this.dispVol.textContent = this.state.sampleVolume;

        // Update bottle labels in 2D view
        this.updateBottleLabels();

        // Update 3D bottle labels if in 3D mode
        this.call3D('updateBottleLabels', {
            edta: this.state.edtaConcentration + 'M',
            buffer: 'pH ' + this.state.bufferPH
        });
    }

    // Update 2D bottle labels
    updateBottleLabels() {
        const edtaLabel = this.edtaBottle.querySelector('.bottle-label');
        if (edtaLabel) {
            edtaLabel.innerHTML = `EDTA<br>${this.state.edtaConcentration}M`;
        }

        const bufferLabel = this.bufferBottle.querySelector('.bottle-label');
        if (bufferLabel) {
            bufferLabel.innerHTML = `Buffer<br>pH ${this.state.bufferPH}`;
        }
    }

    simulateLoading() {
        setTimeout(() => {
            this.loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
            }, 500);
        }, 2000);
    }

    // ============= EXPERIMENT FLOW =============
    startExperiment() {
        const name = this.studentNameInput.value.trim();
        const roll = this.rollNoInput.value.trim();

        if (!name || !roll) {
            alert('Please enter both name and roll number');
            return;
        }

        this.state.studentName = name;
        this.state.rollNo = roll;
        this.state.expId = 'EXP-' + Date.now().toString().slice(-6);
        // 12 preset hardness combinations - randomly selected each run
        const hardnessPresets = [85, 95, 110, 125, 140, 155, 170, 185, 200, 215, 230, 245];
        this.state.targetHardness = hardnessPresets[Math.floor(Math.random() * hardnessPresets.length)];

        // Update display
        this.displayName.textContent = name;
        this.displayRoll.textContent = roll;
        this.expIdEl.textContent = this.state.expId;

        this.studentForm.style.display = 'none';
        this.studentDisplay.style.display = 'block';

        this.soundManager.playClick();
        this.nextStep();
    }

    nextStep() {
        this.state.step++;
        this.updateStepDisplay();
        this.enableCurrentBottle();
    }

    updateStepDisplay() {
        const step = this.steps[this.state.step];
        if (!step) return;

        this.stepBadge.textContent = this.state.step + 1;
        this.stepTitle.textContent = step.title;
        this.stepDescription.textContent = step.desc;
    }

    enableCurrentBottle() {
        // Disable all bottles first
        [this.sampleBottle, this.bufferBottle, this.indicatorBottle, this.edtaBottle].forEach(b => {
            b.classList.add('disabled');
        });

        // Enable current bottle based on step
        switch (this.state.step) {
            case 1:
                this.sampleBottle.classList.remove('disabled');
                break;
            case 2:
                this.bufferBottle.classList.remove('disabled');
                break;
            case 3:
                this.indicatorBottle.classList.remove('disabled');
                break;
            case 4:
                this.edtaBottle.classList.remove('disabled');
                break;
        }
    }

    handleBottleClick(reagent) {
        // Prevent rapid double-clicks causing issues
        if (this._bottleClickLock) return;
        this._bottleClickLock = true;
        setTimeout(() => { this._bottleClickLock = false; }, 500);
        
        switch (reagent) {
            case 'sample':
                if (this.state.step === 1) this.addSample();
                break;
            case 'buffer':
                if (this.state.step === 2) this.addBuffer();
                break;
            case 'indicator':
                if (this.state.step === 3) this.addIndicator();
                break;
            case 'edta':
                if (this.state.step === 4) this.fillBurette();
                break;
        }
    }

    async addSample() {
        this.sampleBottle.classList.add('active');
        this.soundManager.playPour();

       // Fill flask with water sample - show immediately
       this.flaskLiquid.style.background = 'linear-gradient(0deg, rgba(224, 242, 254, 0.9) 0%, rgba(240, 248, 255, 0.8) 100%)';
       this.flaskLiquid.style.height = '25%';
       await this.sleep(800);

        // Sync 3D
        this.call3D('animateBottle', 'sample');
       this.call3D('fillFlask', 25, 0xe0f2fe);

        this.sampleBottle.classList.remove('active');
        this.sampleBottle.classList.add('disabled');

        this.nextStep();
    }

    async addBuffer() {
        this.bufferBottle.classList.add('active');
        this.soundManager.playPour();

       // Add buffer - increase liquid level
       this.flaskLiquid.style.height = '35%';
       await this.sleep(800);

        // Sync 3D
        this.call3D('animateBottle', 'buffer');
       this.call3D('fillFlask', 35);

        this.bufferBottle.classList.remove('active');
        this.bufferBottle.classList.add('disabled');

        this.nextStep();
    }

    async addIndicator() {
        this.indicatorBottle.classList.add('active');

        // Create indicator drops falling into flask
        for (let i = 0; i < 3; i++) {
            await this.sleep(300);
            this.createIndicatorDrop();
        }

        await this.sleep(500);

        // Change flask color to wine-red
        this.flaskLiquid.style.background = 'linear-gradient(0deg, rgba(153, 27, 27, 0.9) 0%, rgba(185, 28, 28, 0.85) 100%)';
       this.flaskLiquid.style.height = '40%';
        this.state.flaskColor = 'wine-red';

        // Sync 3D
        this.call3D('animateBottle', 'indicator');
        this.call3D('setFlaskColor', 0x991b1b);

        this.indicatorBottle.classList.remove('active');
        this.indicatorBottle.classList.add('disabled');

        this.nextStep();
    }

    createIndicatorDrop() {
        const drop = document.createElement('div');
        drop.className = 'drop';
        drop.style.background = 'radial-gradient(ellipse at 30% 30%, rgba(239, 68, 68, 0.9) 0%, rgba(185, 28, 28, 0.95) 100%)';

        // Position drop at flask location
        const flaskRect = document.querySelector('.flask-assembly').getBoundingClientRect();
        const containerRect = this.dropsContainer.getBoundingClientRect();
        drop.style.left = (flaskRect.left - containerRect.left + flaskRect.width / 2 - 4) + 'px';
        drop.style.top = '50px';

        this.dropsContainer.appendChild(drop);
        this.soundManager.playDrop();

        setTimeout(() => drop.remove(), 800);
    }

    async fillBurette() {
        this.edtaBottle.classList.add('active');
        this.soundManager.playPour();

        // Animate burette filling
        this.buretteLiquid.style.transition = 'height 1.5s ease-out';
        this.buretteLiquid.style.height = '100%';

        // Sync 3D
        this.call3D('animateBottle', 'edta');
        this.call3D('fillBurette', 100);

        await this.sleep(1500);

        this.edtaBottle.classList.remove('active');
        this.edtaBottle.classList.add('disabled');

        // Show titration controls
        this.titrationControls.style.display = 'block';
        this.state.isTitrating = true;

        this.nextStep();
    }

    // ============= TITRATION =============
    addDrop() {
        if (!this.state.isTitrating || this.state.endpointReached) return;

        // No sound during titration - user preference

        // Create drop
        this.createTitrationDrop();

        // Create 3D drop
        this.call3D('createDrop');

        // Update readings
        this.state.dropsAdded++;
        this.state.buretteReading = (this.state.dropsAdded * 0.05).toFixed(2);

        this.updateBuretteDisplay();
        this.updateFlaskLevel(); // Update flask liquid level
        this.updateFlaskColor();

        // Sync 3D burette level
        const liquidPercent = Math.max(0, 100 - (parseFloat(this.state.buretteReading) * 1));
        this.call3D('setBuretteLiquidLevel', liquidPercent);
        this.call3D('shakeFlask');
    }

    createTitrationDrop() {
        const drop = document.createElement('div');
        drop.className = 'drop';

        // Position at burette tip
        const buretteRect = this.burette.getBoundingClientRect();
        const containerRect = this.dropsContainer.getBoundingClientRect();

        // Use the flask body for more reliable positioning
        const flaskBody = document.querySelector('.flask-body');
        const flaskBodyRect = flaskBody.getBoundingClientRect();

        // Calculate starting position (burette tip)
        const startX = buretteRect.left - containerRect.left + buretteRect.width / 2 - 4;
        const startY = buretteRect.bottom - containerRect.top;

        // Calculate current liquid surface position
        // The liquid level is a percentage of the flask body height
        const liquidLevelPercent = parseFloat(this.flaskLiquid.style.height) || 0;
        const flaskTopRelative = flaskBodyRect.top - containerRect.top;
        const flaskHeight = flaskBodyRect.height;

        // Calculate Y coordinate of the liquid surface (distance from container top)
        // Level is measured from bottom, so surface is height * (1 - percent/100)
        const surfaceY = flaskTopRelative + flaskHeight * (1 - (liquidLevelPercent / 100));

        let fallDistance = surfaceY - startY;

        // Ensure minimum fall distance is positive and reasonable
        if (fallDistance < 20) fallDistance = 60;

        drop.style.left = startX + 'px';
        drop.style.top = startY + 'px';

        // Set the fall distance as CSS variable for the animation
        drop.style.setProperty('--fall-distance', fallDistance + 'px');

        this.dropsContainer.appendChild(drop);

        // Animation duration set to 600ms in CSS
        // Removing at 580ms ensures it disappears exactly as it hits the surface
        setTimeout(() => {
            this.createRipple(surfaceY);
            this.shakeFlask();
            drop.remove();
        }, 580);
    }

    shakeFlask() {
        const flask = document.querySelector('.flask-assembly');
        flask.style.animation = 'none';
        flask.offsetHeight; // Trigger reflow
        flask.style.animation = 'flaskShake 0.3s ease-out';
    }

    createRipple(surfaceY) {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';

        // Position at flask center horizontally
        const flaskBody = document.querySelector('.flask-body');
        const flaskRect = flaskBody.getBoundingClientRect();
        const containerRect = this.dropsContainer.getBoundingClientRect();

        ripple.style.left = (flaskRect.left - containerRect.left + flaskRect.width / 2 - 10) + 'px';

        // Use the provided surfaceY or calculate it if not provided
        if (surfaceY) {
            ripple.style.top = surfaceY + 'px';
        } else {
            const liquidLevelPercent = parseFloat(this.flaskLiquid.style.height) || 0;
            const flaskTopRelative = flaskRect.top - containerRect.top;
            const flaskHeight = flaskRect.height;
            const calculatedSurfaceY = flaskTopRelative + flaskHeight * (1 - (liquidLevelPercent / 100));
            ripple.style.top = calculatedSurfaceY + 'px';
        }

        this.dropsContainer.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    }

    updateBuretteDisplay() {
        const reading = parseFloat(this.state.buretteReading);

        // Update liquid level (decrease from 100%)
        const liquidPercent = Math.max(0, 100 - (reading * 1));
        this.buretteLiquid.style.height = liquidPercent + '%';

        // Update readings
        this.buretteReadingEl.textContent = reading.toFixed(1) + ' mL';
        this.obsCurrent.textContent = reading.toFixed(1) + ' mL';
        this.obsVolume.textContent = reading.toFixed(1) + ' mL';
    }

    updateFlaskLevel() {
        // Increase flask liquid as drops are added
        // Starting from 40% (after reagents), increase by 0.1% per drop (slower fill)
        const baseLevel = 40;
        const addedLevel = this.state.dropsAdded * 0.1;
        const newLevel = Math.min(75, baseLevel + addedLevel);
        this.flaskLiquid.style.height = newLevel + '%';

        // Sync 3D flask level
        this.call3D('setFlaskLevel', newLevel);
    }

    updateFlaskColor() {
        // Calculate target EDTA volume for endpoint based on:
        // targetHardness = (V_EDTA × M × 100000) / sampleVolume
        // So: V_EDTA = (targetHardness × sampleVolume) / (M × 100000)
        const M = this.state.edtaConcentration;
        const sampleVol = this.state.sampleVolume;
        const targetVolume = (this.state.targetHardness * sampleVol) / (M * 100000);

        const currentVolume = parseFloat(this.state.buretteReading);
        const progress = currentVolume / targetVolume;

        if (progress >= 0.95 && !this.state.endpointReached) {
            // Near endpoint - transition to blue (visual feedback only, NO SOUND)
            // User manually decides when to end titration
            this.flaskLiquid.style.background = 'linear-gradient(0deg, rgba(30, 64, 175, 0.9) 0%, rgba(59, 130, 246, 0.85) 100%)';
            this.state.flaskColor = 'blue';
            this.state.endpointReached = true;

            // Sync 3D
            this.call3D('setFlaskColor', 0x1e40af);

            // NO automatic sound - user decides endpoint manually
            // Just highlight the stop button visually
            this.stopBtn.classList.add('endpoint-ready');
            this.stopBtn.style.animation = 'btnPulse 0.5s ease-in-out infinite';
        } else if (progress > 0.7 && !this.state.endpointReached) {
            // Approaching endpoint - purple transition
            this.flaskLiquid.style.background = 'linear-gradient(0deg, rgba(88, 28, 135, 0.9) 0%, rgba(126, 34, 206, 0.85) 100%)';
            this.state.flaskColor = 'purple';

            // Sync 3D purple color
            this.call3D('setFlaskColor', 0x7c3aed);
        }
    }

    startContinuousDrop() {
        this.dropInterval = setInterval(() => this.addDrop(), 250); // Slower to prevent sound overlap
    }

    stopContinuousDrop() {
        if (this.dropInterval) {
            clearInterval(this.dropInterval);
            this.dropInterval = null;
        }
    }

    endTitration() {
        this.state.isTitrating = false;
        this.stopContinuousDrop();
        this.titrationControls.style.display = 'none';

        const volumeUsed = parseFloat(this.state.buretteReading);

        if (this.state.currentTitration === 1) {
            // First titration complete
            this.state.titration1Volume = volumeUsed;
            this.titration1Vol.textContent = volumeUsed.toFixed(2) + ' mL';
            this.titrationResults.style.display = 'block';

            // Update badge for second titration
            this.state.currentTitration = 2;
            this.titrationBadge.textContent = 'Titration 2 of 2';

            // Reset for second titration
            this.resetForSecondTitration();
            this.nextStep(); // Go to step 6 (Second Titration)

        } else {
            // Second titration complete
            this.state.titration2Volume = volumeUsed;
            this.titration2Vol.textContent = volumeUsed.toFixed(2) + ' mL';

            // Calculate average
            this.state.averageVolume = (this.state.titration1Volume + this.state.titration2Volume) / 2;
            this.averageVol.textContent = this.state.averageVolume.toFixed(2) + ' mL';

            // Calculate final results using average
            this.calculateResults();
            this.nextStep(); // Go to Complete step
        }
    }

    // Reset apparatus for second titration
    resetForSecondTitration() {
        // Reset state
        this.state.buretteReading = 0;
        this.state.dropsAdded = 0;
        this.state.endpointReached = false;
        this.state.flaskColor = 'wine-red';

        // Reset 2D visuals
        this.buretteLiquid.style.height = '100%';
        this.buretteReadingEl.textContent = '0.0 mL';
        this.obsInitial.textContent = '0.0 mL';
        this.obsCurrent.textContent = '0.0 mL';
        this.obsVolume.textContent = '0.0 mL';

        // Reset flask to wine-red
        this.flaskLiquid.style.background = 'linear-gradient(0deg, rgba(153, 27, 27, 0.9) 0%, rgba(185, 28, 28, 0.85) 100%)';
       this.flaskLiquid.style.height = '35%';

        // Reset stop button appearance
        this.stopBtn.classList.remove('endpoint-ready');
        this.stopBtn.style.animation = '';

        // Sync 3D resets
        this.call3D('fillBurette', 100);
        this.call3D('setFlaskColor', 0x991b1b);

        // Show controls again
        this.titrationControls.style.display = 'block';
        this.state.isTitrating = true;
    }

    calculateResults() {
        const volumeUsed = this.state.averageVolume;
        const M = this.state.edtaConcentration;  // Molarity
        const V = this.state.sampleVolume;       // Sample volume in mL

        // Proper hardness formula: Hardness (mg/L as CaCO3) = (EDTA Vol × M × 1000 × 100) / Sample Vol
        // Simplified: Hardness = (EDTA Vol × M × 100000) / Sample Vol
        const calculatedHardness = (volumeUsed * M * 100000) / V;

        // Store the formula parts for display
        this.state.formulaDisplay = {
            edtaVol: volumeUsed,
            molarity: M,
            sampleVol: V,
            hardness: calculatedHardness
        };

        // Calculate accuracy based on expected target
        const error = Math.abs(calculatedHardness - this.state.targetHardness);
        const accuracyPercent = Math.max(0, 100 - (error / this.state.targetHardness * 100));

        // Display results
        this.resultsGroup.style.display = 'block';
        this.hardnessResult.textContent = calculatedHardness.toFixed(1) + ' ppm';

        if (accuracyPercent >= 95) {
            this.accuracyResult.textContent = 'Excellent (' + accuracyPercent.toFixed(0) + '%)';
            this.accuracyResult.className = 'obs-value excellent';
        } else if (accuracyPercent >= 80) {
            this.accuracyResult.textContent = 'Good (' + accuracyPercent.toFixed(0) + '%)';
            this.accuracyResult.className = 'obs-value good';
        } else {
            this.accuracyResult.textContent = accuracyPercent.toFixed(0) + '%';
        }

        // Show calculation section with both titrations
        this.calcSection.style.display = 'block';
        this.calcContent.innerHTML = `
            <div class="calc-formula">
                <p><strong>Titration Results:</strong></p>
                <p class="formula">Titration 1: ${this.state.titration1Volume.toFixed(2)} mL</p>
                <p class="formula">Titration 2: ${this.state.titration2Volume.toFixed(2)} mL</p>
                <p class="formula">Average: ${volumeUsed.toFixed(2)} mL</p>
                <hr style="margin: 10px 0; border-color: #e2e8f0;">
                <p><strong>Formula:</strong></p>
                <p class="formula">Hardness = (V<sub>EDTA</sub> × M × 100000) / V<sub>sample</sub></p>
                <p><strong>Substitution:</strong></p>
                <p class="formula">= (${volumeUsed.toFixed(2)} × ${M} × 100000) / ${V}</p>
                <p class="formula">= <strong>${calculatedHardness.toFixed(1)} mg/L as CaCO₃</strong></p>
            </div>
        `;

        // Show lab report section
        this.labReportSection.style.display = 'block';
        this.exportBtn.disabled = false;

        this.state.calculatedHardness = calculatedHardness;
        this.state.accuracy = accuracyPercent;
    }

    // ============= UTILITIES =============
    async animateFlaskFill(targetPercent, color) {
        this.flaskLiquid.style.background = color;
        this.flaskLiquid.style.height = targetPercent + '%';
        await this.sleep(800);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    toggleSound() {
        const enabled = this.soundManager.toggle();
        this.soundBtn.textContent = enabled ? '🔊' : '🔇';
    }

    resetExperiment() {
        if (confirm('Reset the experiment? All progress will be lost.')) {
            location.reload();
        }
    }

    exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        // Get user inputs - use realtime state values
        const aim = this.reportAimInput?.value?.trim() || 'To determine the total hardness of water sample using EDTA titrimetric method.';
        const procedure = this.reportProcedureInput?.value?.trim() || `Pipette ${this.state.sampleVolume}mL water sample into flask, add buffer (pH ${this.state.bufferPH}) and EBT indicator, titrate with ${this.state.edtaConcentration}M EDTA until blue endpoint.`;
        const result = this.reportResultInput?.value?.trim() || `The hardness of the given water sample is ${this.state.calculatedHardness?.toFixed(1) || 0} mg/L as CaCO₃.`;

        // Validate state data exists
        if (!this.state.titration1Volume || !this.state.titration2Volume || !this.state.averageVolume) {
            alert('Please complete both titrations before exporting the PDF.');
            return;
        }

        // Header with gradient-style bar
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('Lab Report', pageWidth / 2, 18, { align: 'center' });

        doc.setFontSize(14);
        doc.text('EDTA Titration - Water Hardness Determination', pageWidth / 2, 30, { align: 'center' });

        y = 55;

        // Student Information Section
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Student Details', 20, y);
        doc.setDrawColor(30, 64, 175);
        doc.line(20, y + 2, 190, y + 2);

        y += 12;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.text(`Student Name: ${this.state.studentName}`, 25, y);
        doc.text(`Roll Number: ${this.state.rollNo}`, 120, y);
        y += 8;
        doc.text(`Experiment ID: ${this.state.expId}`, 25, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 120, y);
        y += 8;
        doc.text(`Time: ${new Date().toLocaleTimeString()}`, 25, y);

        // AIM Section
        y += 18;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Aim', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        const aimLines = doc.splitTextToSize(aim, 165);
        doc.text(aimLines, 25, y);
        y += aimLines.length * 6;

        // Apparatus Section
        y += 10;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Apparatus Required', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.text('Burette (50mL), Conical Flask (250mL), Pipette (25mL), Stand with Clamp', 25, y);
        y += 6;
        doc.text('EDTA Solution, Buffer Solution (pH 10), EBT Indicator, Water Sample', 25, y);

        // Procedure Section
        y += 14;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Procedure', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        const procLines = doc.splitTextToSize(procedure, 165);
        doc.text(procLines, 25, y);
        y += procLines.length * 6;

        // Observations Table
        y += 12;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Observations', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.autoTable({
            startY: y,
            head: [['S.No', 'Parameter', 'Titration 1', 'Titration 2']],
            body: [
                ['1', 'Initial Burette Reading (mL)', '0.00', '0.00'],
                ['2', 'Final Burette Reading (mL)', (this.state.titration1Volume || 0).toFixed(2), (this.state.titration2Volume || 0).toFixed(2)],
                ['3', 'Volume of EDTA Used (mL)', (this.state.titration1Volume || 0).toFixed(2), (this.state.titration2Volume || 0).toFixed(2)],
                ['4', 'EDTA Concentration', `${this.state.edtaConcentration} M`, `${this.state.edtaConcentration} M`],
                ['5', 'Sample Volume', `${this.state.sampleVolume} mL`, `${this.state.sampleVolume} mL`],
                ['6', 'Buffer pH', `${this.state.bufferPH}`, `${this.state.bufferPH}`],
                ['7', 'Endpoint Color', 'Wine Red → Blue', 'Wine Red → Blue']
            ],
            theme: 'grid',
            headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
            bodyStyles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 70 },
                2: { cellWidth: 40 },
                3: { cellWidth: 40 }
            },
            margin: { left: 25, right: 25 }
        });

        y = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text(`Average Volume of EDTA = (${(this.state.titration1Volume || 0).toFixed(2)} + ${(this.state.titration2Volume || 0).toFixed(2)}) / 2 = ${(this.state.averageVolume || 0).toFixed(2)} mL`, 25, y);

        // Calculations Section
        y += 14;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Calculations', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 12;
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.text('Formula: Hardness (mg/L as CaCO₃) = (V_EDTA × M × 100000) / V_sample', 25, y);
        y += 8;
        doc.text(`Where: V_EDTA = ${(this.state.averageVolume || 0).toFixed(2)} mL, M = ${this.state.edtaConcentration} M, V_sample = ${this.state.sampleVolume} mL`, 25, y);
        y += 8;
        doc.text(`Substitution: = (${(this.state.averageVolume || 0).toFixed(2)} × ${this.state.edtaConcentration} × 100000) / ${this.state.sampleVolume}`, 25, y);
        y += 10;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Hardness = ${(this.state.calculatedHardness || 0).toFixed(2)} mg/L as CaCO₃`, 25, y);

        // Result Section
        y += 16;
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.setFont(undefined, 'bold');
        doc.text('Result', 20, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        const resultLines = doc.splitTextToSize(result, 165);
        doc.text(resultLines, 25, y);
        y += resultLines.length * 6;

        y += 4;
        doc.text(`Expected Hardness: ${this.state.targetHardness || 'N/A'} ppm  |  Accuracy: ${(this.state.accuracy || 0).toFixed(1)}%`, 25, y);

        // Signature Section
        y += 25;
        doc.setDrawColor(100);
        doc.line(25, y, 85, y);
        doc.line(125, y, 185, y);
        y += 5;
        doc.setFontSize(10);
        doc.text('Student Signature', 40, y);
        doc.text('Instructor Signature', 140, y);

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(128);
        // doc.text('Generated by Virtual Chemistry Lab - MindStacks ChemLab', pageWidth / 2, 285, { align: 'center' });

        // Save
        doc.save(`Lab_Report_${this.state.expId}.pdf`);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.lab = new VirtualLab();
    
    // ============= BURETTE DRAG FUNCTIONALITY =============
    const buretteAssembly = document.getElementById('buretteAssembly');
    const equipmentArea = document.querySelector('.equipment-area');
    
    if (buretteAssembly && equipmentArea) {
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;
        
        // Get initial position
        const rect = buretteAssembly.getBoundingClientRect();
        const parentRect = equipmentArea.getBoundingClientRect();
        
        buretteAssembly.addEventListener('mousedown', (e) => {
            // Don't drag when clicking on controls
            if (e.target.closest('.titration-controls') || e.target.closest('.burette-tap')) {
                return;
            }
            
            isDragging = true;
            buretteAssembly.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            
            const computedStyle = window.getComputedStyle(buretteAssembly);
            initialLeft = parseInt(computedStyle.left) || 0;
            initialTop = parseInt(computedStyle.top) || 0;
            
            // If using right positioning, convert to left
            if (computedStyle.right !== 'auto') {
                const parentWidth = equipmentArea.offsetWidth;
                initialLeft = parentWidth - buretteAssembly.offsetWidth - parseInt(computedStyle.right);
                buretteAssembly.style.right = 'auto';
                buretteAssembly.style.left = initialLeft + 'px';
            }
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;
            
            // Constrain within equipment area
            const maxLeft = equipmentArea.offsetWidth - buretteAssembly.offsetWidth;
            const maxTop = equipmentArea.offsetHeight - buretteAssembly.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            buretteAssembly.style.left = newLeft + 'px';
            buretteAssembly.style.top = newTop + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                buretteAssembly.classList.remove('dragging');
            }
        });
    }
});
