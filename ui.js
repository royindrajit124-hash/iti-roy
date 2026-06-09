/**
 * Noise Effect Demonstrator - UI Controller
 * Manages Chart.js instances, simulation loop, UI event handling,
 * canvas animations, theme toggles, and data export features.
 */

// --- Global App State ---
const state = {
    // DSP Config
    N: 512,                  // Number of points (FFT power of 2)
    fs: 512,                 // Sampling rate (512 Hz -> 1Hz frequency bin resolution)
    timeArray: null,         // Floats for time steps
    
    // Signal Params
    signalType: 'sine',
    amplitude: 2.0,
    frequency: 10,
    
    // Noise Params
    noiseType: 'awgn',
    useTargetSNR: true,
    targetSNR: 10.0,
    variance: 0.20,
    temperature: 290,        // Kelvin
    bandwidth: 20,           // MHz
    noiseIntensity: 1.0,     // Height/width scaling
    impulseProbability: 0.05,
    
    // Filter Params
    filterType: 'low_pass',
    cutoffFreq: 15,
    windowSize: 9,           // samples (Moving average)
    lowCutoff: 5,            // Band-pass low cutoff
    highCutoff: 20,          // Band-pass high cutoff
    
    // Simulation Control
    isPlaying: false,
    fps: 25,
    lastFrameTime: 0,
    phaseOffset: 0.0,        // For scrolling wave animation
    
    // Active Tab
    activeTab: 'dashboard'
};

// Arrays to hold computed signal data
const data = {
    t: null,
    original: null,
    noise: null,
    noisy: null,
    recovered: null,
    // Frequency domain
    freqs: null,
    origFFT: null,
    noisyFFT: null,
    recoveredFFT: null
};

// Chart.js references
let charts = {
    original: null,
    noise: null,
    noisy: null,
    recovered: null,
    fft: null,
    comparison: null
};

// Canvas context references for block diagram
let canvases = {
    tx: null,
    channel: null,
    rx: null,
    dest: null
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize time array
    state.timeArray = new Float32Array(state.N);
    for (let i = 0; i < state.N; i++) {
        state.timeArray[i] = i / state.fs; // 0 to 0.998 seconds
    }
    
    // Frequency bins array (single-sided: N/2 points, spacing = fs / N = 1 Hz)
    data.freqs = Array.from({length: state.N / 2}, (_, i) => i * (state.fs / state.N));

    // 2. Set up DOM Event Handlers
    initDOMEvents();

    // 3. Conditional Visibility of control panels
    updateControlVisibility();

    // 4. Initialize charts
    initCharts();

    // 5. Initialize block diagram canvas contexts
    initCanvases();

    // 6. Run initial calculation and render
    recalculateDSP();
    updateCharts();
    drawBlockDiagramWaves();
});

// --- Event Handlers Setup ---
function initDOMEvents() {
    // Simulation controls
    document.getElementById('startBtn').addEventListener('click', startSimulation);
    document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    document.getElementById('newNoiseBtn').addEventListener('click', () => {
        recalculateDSP(true); // Force new noise generation
        updateCharts();
        drawBlockDiagramWaves();
    });

    // Theme toggle
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Educational Hub Navigation
    document.querySelectorAll('.edu-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const articleId = e.target.dataset.edu;
            switchEduArticle(articleId);
        });
    });

    // Inputs: Signal
    connectSlider('amplitudeSlider', 'amplitudeVal', ' V', (val) => {
        state.amplitude = val;
    });
    connectSlider('frequencySlider', 'frequencyVal', ' Hz', (val) => {
        state.frequency = val;
    });
    document.getElementById('signalType').addEventListener('change', (e) => {
        state.signalType = e.target.value;
        document.getElementById('origBadge').innerText = `${capitalize(state.signalType)} (${state.frequency}Hz)`;
        triggerImmediateUpdate();
    });

    // Inputs: Noise
    document.getElementById('noiseType').addEventListener('change', (e) => {
        state.noiseType = e.target.value;
        document.getElementById('noiseBadge').innerText = getNoiseBadgeText();
        updateControlVisibility();
        triggerImmediateUpdate();
    });
    
    // AWGN Inputs
    document.getElementById('modeSnr').addEventListener('change', (e) => {
        if (e.target.checked) {
            state.useTargetSNR = true;
            document.getElementById('targetSnrGroup').style.display = 'block';
            document.getElementById('varianceGroup').style.display = 'none';
            triggerImmediateUpdate();
        }
    });
    document.getElementById('modeVariance').addEventListener('change', (e) => {
        if (e.target.checked) {
            state.useTargetSNR = false;
            document.getElementById('targetSnrGroup').style.display = 'none';
            document.getElementById('varianceGroup').style.display = 'block';
            triggerImmediateUpdate();
        }
    });

    connectSlider('targetSnrSlider', 'targetSnrVal', ' dB', (val) => {
        state.targetSNR = val;
    });
    connectSlider('varianceSlider', 'varianceVal', '', (val) => {
        state.variance = val;
    });

    // Thermal Inputs
    connectSlider('tempSlider', 'tempVal', ' K', (val) => {
        state.temperature = val;
    });
    connectSlider('bandwidthSlider', 'bandwidthVal', ' MHz', (val) => {
        state.bandwidth = val;
    });

    // Impulse/Uniform Inputs
    connectSlider('impulseProbSlider', 'impulseProbVal', '%', (val) => {
        state.impulseProbability = val;
    }, true); // format as percentage
    connectSlider('noiseIntensitySlider', 'noiseIntensityVal', '', (val) => {
        state.noiseIntensity = val;
    });

    // Inputs: Filter
    document.getElementById('filterType').addEventListener('change', (e) => {
        state.filterType = e.target.value;
        document.getElementById('recoveredBadge').innerText = getFilterBadgeText();
        updateControlVisibility();
        triggerImmediateUpdate();
    });
    connectSlider('cutoffFreqSlider', 'cutoffFreqVal', ' Hz', (val) => {
        state.cutoffFreq = val;
    });
    connectSlider('windowSizeSlider', 'windowSizeVal', ' samples', (val) => {
        state.windowSize = val;
    });
    connectSlider('lowCutoffSlider', 'lowCutoffVal', ' Hz', (val) => {
        state.lowCutoff = val;
        validateBandpass();
    });
    connectSlider('highCutoffSlider', 'highCutoffVal', ' Hz', (val) => {
        state.highCutoff = val;
        validateBandpass();
    });

    // Simulation Speed
    connectSlider('simSpeedSlider', 'simSpeedVal', ' fps', (val) => {
        state.fps = val;
    });

    // Export files
    document.getElementById('downloadCsvBtn').addEventListener('click', downloadCSVData);
    document.getElementById('exportDashboardCharts').addEventListener('click', exportChartsAsPNG);
    document.getElementById('exportCompChart').addEventListener('click', exportComparisonChartAsPNG);
}

// Slider helper connecting input events to state and view
function connectSlider(sliderId, valId, unit, callback, isPercent = false) {
    const slider = document.getElementById(sliderId);
    const valSpan = document.getElementById(valId);
    
    slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        callback(val);
        if (isPercent) {
            valSpan.innerText = `${Math.round(val * 100)}${unit}`;
        } else {
            valSpan.innerText = `${val}${unit}`;
        }
        triggerImmediateUpdate();
    });
}

function validateBandpass() {
    if (state.lowCutoff >= state.highCutoff) {
        state.highCutoff = state.lowCutoff + 2;
        const slider = document.getElementById('highCutoffSlider');
        slider.value = state.highCutoff;
        document.getElementById('highCutoffVal').innerText = `${state.highCutoff} Hz`;
    }
}

// Redraw immediately if paused
function triggerImmediateUpdate() {
    if (!state.isPlaying) {
        recalculateDSP(false); // don't force new noise realization unless sliding noise params
        updateCharts();
        drawBlockDiagramWaves();
    }
}

// Show/hide sections in controls based on selections
function updateControlVisibility() {
    const noise = state.noiseType;
    const filter = state.filterType;

    // Noise display logic
    document.getElementById('awgnControls').style.display = (noise === 'awgn') ? 'block' : 'none';
    document.getElementById('thermalControls').style.display = (noise === 'thermal') ? 'block' : 'none';
    document.getElementById('impulseControls').style.display = (noise === 'impulse') ? 'block' : 'none';
    document.getElementById('noiseIntensityGroup').style.display = (noise === 'impulse' || noise === 'uniform') ? 'block' : 'none';

    // Filter display logic
    document.getElementById('cutoffFreqGroup').style.display = (filter === 'low_pass' || filter === 'high_pass') ? 'block' : 'none';
    document.getElementById('windowSizeGroup').style.display = (filter === 'moving_average') ? 'block' : 'none';
    document.getElementById('bandPassGroup').style.display = (filter === 'band_pass') ? 'block' : 'none';
}

function getNoiseBadgeText() {
    switch (state.noiseType) {
        case 'awgn': return 'AWGN (Gaussian)';
        case 'thermal': return 'Thermal Noise';
        case 'impulse': return 'Impulse Noise';
        case 'uniform': return 'Uniform Noise';
        case 'none':
        default: return 'No Noise';
    }
}

function getFilterBadgeText() {
    switch (state.filterType) {
        case 'low_pass': return `LPF (${state.cutoffFreq}Hz)`;
        case 'high_pass': return `HPF (${state.cutoffFreq}Hz)`;
        case 'band_pass': return `BPF (${state.lowCutoff}-${state.highCutoff}Hz)`;
        case 'moving_average': return `MA (${state.windowSize}pts)`;
        case 'none':
        default: return 'No Filter';
    }
}

// --- Digital Signal Processing Execution ---
// Cached noise vector so it doesn't flicker wildly unless animating
let cachedNoise = null;

function recalculateDSP(forceNewNoise = false) {
    // 1. Shift time for rolling wave animation if playing
    // Shift is calculated based on phaseOffset
    const timeShift = state.phaseOffset / (2 * Math.PI * state.frequency);
    
    // Shifted time array for signal generation
    const shiftedTime = new Float32Array(state.N);
    for (let i = 0; i < state.N; i++) {
        shiftedTime[i] = state.timeArray[i] - timeShift;
    }

    // 2. Generate original signal
    data.original = generateSignal(state.signalType, state.amplitude, state.frequency, shiftedTime);

    // 3. Generate noise signal
    // In animation mode (playing), we generate new noise on every frame.
    // In paused mode, we use cached noise unless forced to regenerate.
    if (state.isPlaying || !cachedNoise || forceNewNoise) {
        const noiseParams = {
            useTargetSNR: state.useTargetSNR,
            targetSNR: state.targetSNR,
            variance: state.variance,
            temperature: state.temperature,
            bandwidth: state.bandwidth,
            intensity: state.noiseIntensity,
            impulseProbability: state.impulseProbability
        };
        cachedNoise = generateNoise(state.noiseType, state.N, data.original, noiseParams);
    }
    data.noise = cachedNoise;

    // 4. Combine: Noisy = Original + Noise
    data.noisy = new Float32Array(state.N);
    for (let i = 0; i < state.N; i++) {
        data.noisy[i] = data.original[i] + data.noise[i];
    }

    // 5. Apply receiver filtering
    const filterParams = {
        samplingRate: state.fs,
        cutoffFreq: state.cutoffFreq,
        windowSize: state.windowSize,
        lowCutoff: state.lowCutoff,
        highCutoff: state.highCutoff
    };
    data.recovered = applyFilter(state.filterType, data.noisy, filterParams);

    // 6. Compute FFT Spectrum for Original, Noisy, and Recovered
    data.origFFT = computeFFT(data.original);
    data.noisyFFT = computeFFT(data.noisy);
    data.recoveredFFT = computeFFT(data.recovered);

    // 7. Calculate Statistical Metrics
    const metrics = calculateMetrics(data.original, data.noise, data.noisy, data.recovered);
    updateMetricsUI(metrics);

    // Update details panel in pipeline
    updatePipelineDetails(metrics);
}

// --- Metrics Formatting and Updating ---
function updateMetricsUI(metrics) {
    document.getElementById('signalPowerMetric').innerText = `${metrics.signalPower.toFixed(2)} W`;
    document.getElementById('noisePowerMetric').innerText = `${metrics.noisePower.toFixed(3)} W`;
    
    if (metrics.snr === 99) {
        document.getElementById('snrMetric').innerText = '∞ dB';
    } else if (metrics.snr === -99) {
        document.getElementById('snrMetric').innerText = 'N/A';
    } else {
        document.getElementById('snrMetric').innerText = `${metrics.snr.toFixed(1)} dB`;
    }

    document.getElementById('mseMetric').innerText = metrics.mse.toFixed(4);

    if (metrics.psnr === 99) {
        document.getElementById('psnrMetric').innerText = '∞ dB';
    } else {
        document.getElementById('psnrMetric').innerText = `${metrics.psnr.toFixed(1)} dB`;
    }
}

function updatePipelineDetails(metrics) {
    document.getElementById('pipeTxParams').innerText = `${capitalize(state.signalType)}, ${state.amplitude.toFixed(1)}V @ ${state.frequency}Hz`;
    
    const noiseLabel = capitalize(state.noiseType);
    if (state.noiseType === 'none') {
        document.getElementById('pipeChannelParams').innerText = 'Clean (No Noise)';
        document.getElementById('channelNoiseLabel').innerText = 'Clean Channel';
    } else if (state.noiseType === 'awgn' && state.useTargetSNR) {
        document.getElementById('pipeChannelParams').innerText = `AWGN, SNR: ${state.targetSNR}dB`;
        document.getElementById('channelNoiseLabel').innerText = `AWGN (SNR: ${state.targetSNR}dB)`;
    } else {
        document.getElementById('pipeChannelParams').innerText = `${noiseLabel}, Pn: ${metrics.noisePower.toFixed(3)}W`;
        document.getElementById('channelNoiseLabel').innerText = `${noiseLabel} Added`;
    }

    const filterLabel = getFilterBadgeText();
    document.getElementById('rxFilterLabel').innerText = filterLabel;
    document.getElementById('pipeRxParams').innerText = `MSE: ${metrics.mse.toFixed(3)} | PSNR: ${metrics.psnr.toFixed(1)}dB`;
}

// --- Chart.js Configuration & Management ---
function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#9ca3af' : '#475569';

    // Chart.js base layout settings
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Turn off transitions for real-time fluid rendering
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: 'Outfit', size: 9 } }
            },
            y: {
                grid: { color: gridColor },
                ticks: { color: textColor, font: { family: 'Outfit', size: 9 } }
            }
        }
    };

    // 1. Original Signal Chart
    charts.original = new Chart(document.getElementById('originalChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: state.N}, (_, i) => (i / state.fs).toFixed(3)),
            datasets: [{
                data: [],
                borderColor: '#06b6d4',
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: -5.5, max: 5.5 }
            }
        }
    });

    // 2. Noise Chart
    charts.noise = new Chart(document.getElementById('noiseChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: state.N}, (_, i) => (i / state.fs).toFixed(3)),
            datasets: [{
                data: [],
                borderColor: '#f97316',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: -5.5, max: 5.5 }
            }
        }
    });

    // 3. Noisy Signal Chart
    charts.noisy = new Chart(document.getElementById('noisyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: state.N}, (_, i) => (i / state.fs).toFixed(3)),
            datasets: [{
                data: [],
                borderColor: '#eab308',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: -8.0, max: 8.0 }
            }
        }
    });

    // 4. Recovered Signal Chart
    charts.recovered = new Chart(document.getElementById('recoveredChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: state.N}, (_, i) => (i / state.fs).toFixed(3)),
            datasets: [{
                data: [],
                borderColor: '#a855f7',
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: { ...commonOptions.scales.y, min: -5.5, max: 5.5 }
            }
        }
    });

    // 5. Frequency Spectrum Chart
    charts.fft = new Chart(document.getElementById('fftChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: data.freqs,
            datasets: [
                {
                    label: 'Original S(f)',
                    data: [],
                    borderColor: '#06b6d4',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Noisy Sn(f)',
                    data: [],
                    borderColor: 'rgba(234, 179, 8, 0.35)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Recovered R(f)',
                    data: [],
                    borderColor: '#a855f7',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: textColor, font: { family: 'Outfit', size: 10 } }
                }
            },
            scales: {
                x: {
                    ...commonOptions.scales.x,
                    title: { display: true, text: 'Frequency (Hz)', color: textColor },
                    max: 100 // Cap frequency chart visual limit to 100Hz since fs/2 = 256Hz but our signal is low-frequency
                },
                y: {
                    ...commonOptions.scales.y,
                    title: { display: true, text: 'Magnitude', color: textColor },
                    min: 0
                }
            }
        }
    });

    // 6. Large Comparison Chart
    charts.comparison = new Chart(document.getElementById('comparisonChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({length: state.N}, (_, i) => (i / state.fs).toFixed(3)),
            datasets: [
                {
                    label: 'Original Signal s(t)',
                    data: [],
                    borderColor: '#06b6d4',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Noisy Channel s(t)+n(t)',
                    data: [],
                    borderColor: 'rgba(234, 179, 8, 0.25)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Recovered Signal r(t)',
                    data: [],
                    borderColor: '#a855f7',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            ...commonOptions,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: textColor, font: { family: 'Outfit', size: 10 } }
                }
            },
            scales: {
                x: {
                    ...commonOptions.scales.x,
                    title: { display: true, text: 'Time (seconds)', color: textColor }
                },
                y: {
                    ...commonOptions.scales.y,
                    title: { display: true, text: 'Amplitude (Volts)', color: textColor },
                    min: -6.0,
                    max: 6.0
                }
            }
        }
    });
}

function updateCharts() {
    // 1. Time charts updates
    charts.original.data.datasets[0].data = Array.from(data.original);
    charts.original.update('none');

    charts.noise.data.datasets[0].data = Array.from(data.noise);
    charts.noise.update('none');

    charts.noisy.data.datasets[0].data = Array.from(data.noisy);
    charts.noisy.update('none');

    charts.recovered.data.datasets[0].data = Array.from(data.recovered);
    charts.recovered.update('none');

    // 2. Frequency chart updates
    charts.fft.data.datasets[0].data = Array.from(data.origFFT);
    charts.fft.data.datasets[1].data = Array.from(data.noisyFFT);
    charts.fft.data.datasets[2].data = Array.from(data.recoveredFFT);
    charts.fft.update('none');

    // 3. Comparison chart updates
    charts.comparison.data.datasets[0].data = Array.from(data.original);
    charts.comparison.data.datasets[1].data = Array.from(data.noisy);
    charts.comparison.data.datasets[2].data = Array.from(data.recovered);
    charts.comparison.update('none');
}

// Adapt gridlines and text colors dynamically when theme shifts
function updateChartsTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#9ca3af' : '#475569';

    Object.values(charts).forEach(chart => {
        if (!chart) return;
        
        // Update scales configuration
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
        
        // Update title colors if they exist
        if (chart.options.scales.x.title) {
            chart.options.scales.x.title.color = textColor;
        }
        if (chart.options.scales.y.title) {
            chart.options.scales.y.title.color = textColor;
        }
        
        // Update legends
        if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        
        chart.update();
    });
}

// --- Animation Loop ---
function startSimulation() {
    if (state.isPlaying) return;
    
    state.isPlaying = true;
    state.lastFrameTime = performance.now();
    
    // Toggle UI buttons
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    animationLoop();
}

function pauseSimulation() {
    if (!state.isPlaying) return;
    
    state.isPlaying = false;
    
    // Toggle UI buttons
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
}

function resetSimulation() {
    pauseSimulation();
    
    // Reset state values to defaults
    state.amplitude = 2.0;
    state.frequency = 10;
    state.noiseType = 'awgn';
    state.useTargetSNR = true;
    state.targetSNR = 10;
    state.variance = 0.2;
    state.temperature = 290;
    state.bandwidth = 20;
    state.noiseIntensity = 1.0;
    state.impulseProbability = 0.05;
    state.filterType = 'low_pass';
    state.cutoffFreq = 15;
    state.windowSize = 9;
    state.lowCutoff = 5;
    state.highCutoff = 20;
    state.phaseOffset = 0.0;
    state.fps = 25;

    // Reset controls UI element values
    document.getElementById('amplitudeSlider').value = 2.0;
    document.getElementById('amplitudeVal').innerText = '2.0 V';
    document.getElementById('frequencySlider').value = 10;
    document.getElementById('frequencyVal').innerText = '10 Hz';
    document.getElementById('noiseType').value = 'awgn';
    document.getElementById('noiseBadge').innerText = 'AWGN (Gaussian)';
    document.getElementById('modeSnr').checked = true;
    document.getElementById('targetSnrSlider').value = 10;
    document.getElementById('targetSnrVal').innerText = '10 dB';
    document.getElementById('varianceSlider').value = 0.2;
    document.getElementById('varianceVal').innerText = '0.20';
    document.getElementById('tempSlider').value = 290;
    document.getElementById('tempVal').innerText = '290 K';
    document.getElementById('bandwidthSlider').value = 20;
    document.getElementById('bandwidthVal').innerText = '20 MHz';
    document.getElementById('impulseProbSlider').value = 0.05;
    document.getElementById('impulseProbVal').innerText = '5%';
    document.getElementById('noiseIntensitySlider').value = 1.0;
    document.getElementById('noiseIntensityVal').innerText = '1.0';
    document.getElementById('filterType').value = 'low_pass';
    document.getElementById('recoveredBadge').innerText = 'LPF (15Hz)';
    document.getElementById('cutoffFreqSlider').value = 15;
    document.getElementById('cutoffFreqVal').innerText = '15 Hz';
    document.getElementById('windowSizeSlider').value = 9;
    document.getElementById('windowSizeVal').innerText = '9 samples';
    document.getElementById('lowCutoffSlider').value = 5;
    document.getElementById('lowCutoffVal').innerText = '5 Hz';
    document.getElementById('highCutoffSlider').value = 20;
    document.getElementById('highCutoffVal').innerText = '20 Hz';
    document.getElementById('simSpeedSlider').value = 25;
    document.getElementById('simSpeedVal').innerText = '25 fps';

    updateControlVisibility();
    recalculateDSP(true);
    updateCharts();
    drawBlockDiagramWaves();
}

function animationLoop(timestamp) {
    if (!state.isPlaying) return;
    
    requestAnimationFrame(animationLoop);
    
    // Control FPS
    const elapsed = timestamp - state.lastFrameTime;
    const frameInterval = 1000 / state.fps;
    
    if (elapsed >= frameInterval) {
        state.lastFrameTime = timestamp - (elapsed % frameInterval);
        
        // Advance phase for rolling waves.
        // Scroll speed proportional to signal frequency so waves look visually stable and constant.
        state.phaseOffset += (2 * Math.PI * state.frequency) * (0.015);
        if (state.phaseOffset > 2 * Math.PI * 100) {
            state.phaseOffset -= 2 * Math.PI * 100;
        }

        recalculateDSP();
        updateCharts();
        drawBlockDiagramWaves();
    }
}

// --- Block Diagram Waveform Canvas Drawer ---
function initCanvases() {
    canvases.tx = document.getElementById('canvasTxWave').getContext('2d');
    canvases.channel = document.getElementById('canvasChannelWave').getContext('2d');
    canvases.rx = document.getElementById('canvasRxWave').getContext('2d');
    canvases.dest = document.getElementById('canvasDestWave').getContext('2d');
}

function drawBlockDiagramWaves() {
    if (!canvases.tx) return;

    // Dimensions of small canvas nodes
    const w = document.getElementById('canvasTxWave').clientWidth;
    const h = document.getElementById('canvasTxWave').clientHeight;
    
    // Synchronize actual drawing dimensions with display sizes
    Object.values(canvases).forEach(ctx => {
        ctx.canvas.width = w;
        ctx.canvas.height = h;
    });

    // Color systems
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = isDark ? '#131b31' : '#ffffff';

    // Helper drawing a single array waveform
    const drawWave = (ctx, signalData, color) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        const length = signalData.length;
        const step = length / w;
        
        for (let x = 0; x < w; x++) {
            const index = Math.floor(x * step);
            const yVal = signalData[index];
            // Map [-5.0, 5.0] to [height, 0]
            const y = h / 2 - (yVal / 5.0) * (h / 2 * 0.8);
            
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    };

    // Draw signals into each pipeline block
    drawWave(canvases.tx, data.original, '#06b6d4');
    drawWave(canvases.channel, data.noisy, '#eab308');
    
    // Filter node representation (low cutoff vs wave smoothing)
    drawWave(canvases.rx, data.recovered, '#a855f7');
    drawWave(canvases.dest, data.recovered, '#10b981'); // show green recovered for output success
}

// --- Navigation Operations ---
function switchTab(tabName) {
    state.activeTab = tabName;

    // Toggle tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Toggle tab sections
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Redraw graphs when tabs change to fit size
    Object.values(charts).forEach(chart => {
        if (chart) chart.resize();
    });

    if (tabName === 'pipeline') {
        setTimeout(drawBlockDiagramWaves, 10);
    }
}

function switchEduArticle(articleId) {
    document.querySelectorAll('.edu-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.edu === articleId);
    });
    document.querySelectorAll('.edu-article').forEach(art => {
        art.classList.toggle('active', art.id === `edu-${articleId}`);
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update colors on charts
    updateChartsTheme();
    
    // Redraw canvas waves
    drawBlockDiagramWaves();
}

// --- Data Export Utilities ---

// Download Signal Data as CSV
function downloadCSVData() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Time (s),Original s(t) (V),Noise n(t) (V),Noisy s(t)+n(t) (V),Recovered r(t) (V)\r\n';
    
    for (let i = 0; i < state.N; i++) {
        const timeVal = (i / state.fs).toFixed(6);
        const origVal = data.original[i].toFixed(6);
        const noiseVal = data.noise[i].toFixed(6);
        const noisyVal = data.noisy[i].toFixed(6);
        const recVal = data.recovered[i].toFixed(6);
        
        csvContent += `${timeVal},${origVal},${noiseVal},${noisyVal},${recVal}\r\n`;
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/T|:/g, '-');
    link.setAttribute('download', `Noise_Simulation_Data_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Download Active Charts as Image
function exportChartsAsPNG() {
    // In Dashboard view, we can download the FFT Spectrum chart or individual charts.
    // Let's create an easy download trigger for the FFT chart or loop and download visible charts.
    if (state.activeTab === 'dashboard') {
        const url = charts.fft.toBase64Image();
        triggerDownload(url, 'Frequency_Spectrum_FFT.png');
    } else if (state.activeTab === 'comparison') {
        exportComparisonChartAsPNG();
    } else {
        alert('Please go to Dashboard or Comparison tab to export charts.');
    }
}

function exportComparisonChartAsPNG() {
    const url = charts.comparison.toBase64Image();
    triggerDownload(url, 'Signal_Overlay_Comparison.png');
}

function triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- General Utility Functions ---
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace('_', ' ');
}
