/**
 * app.js - Communication Lab Orchestrator & Controller
 * Manages simulation loops, interactive charts, and page tabs
 * for Noise & Filtering, AM Modulation, and FM Modulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Configuration ---
    let activeTab = 'noise'; // 'noise', 'am', 'fm'
    let isRunning = true;
    let baseTime = 0.0;
    let lastTimestamp = 0;
    let animationFrameId = null;

    // --- Tab 1: Noise & Filtering Parameters ---
    const fsNoise = 2000;
    const NNoise = 512;
    const dtNoise = 1.0 / fsNoise;
    const noiseTimeVector = new Float32Array(NNoise);
    for (let i = 0; i < NNoise; i++) {
        noiseTimeVector[i] = i * dtNoise;
    }
    const noiseTimeLabels = Array.from(noiseTimeVector).map(t => (t * 1000).toFixed(1));

    const noiseFreqVector = new Float32Array(NNoise / 2);
    for (let i = 0; i < NNoise / 2; i++) {
        noiseFreqVector[i] = (i * fsNoise) / NNoise;
    }
    const noiseFreqLabels = Array.from(noiseFreqVector).map(f => f.toFixed(0));

    // --- Tab 2: AM Modulation Parameters ---
    const fsAm = 8000;
    const NAm = 1024;
    const dtAm = 1.0 / fsAm;
    const amTimeVector = new Float32Array(NAm);
    for (let i = 0; i < NAm; i++) {
        amTimeVector[i] = i * dtAm;
    }

    const amFreqVector = new Float32Array(NAm / 2);
    for (let i = 0; i < NAm / 2; i++) {
        amFreqVector[i] = (i * fsAm) / NAm;
    }
    // We only display the first 150 bins in the FFT spectrum (up to ~1170 Hz)
    const amFreqLabels = Array.from(amFreqVector.slice(0, 150)).map(f => f.toFixed(0));

    // --- DOM Elements Cache ---
    // Global & Header Elements
    const elThemeToggle = document.getElementById('theme-toggle');
    const elBtnStart = document.getElementById('btn-start');
    const elBtnPause = document.getElementById('btn-pause');
    const elBtnReset = document.getElementById('btn-reset');
    const elBtnExportCsv = document.getElementById('btn-export-csv');
    const elBtnExportImg = document.getElementById('btn-export-img');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // Tab 1: Noise DOM Elements
    const elSignalType = document.getElementById('signal-type');
    const elParamAmp = document.getElementById('param-amplitude');
    const elParamFreq = document.getElementById('param-frequency');
    const elValAmp = document.getElementById('val-amplitude');
    const elValFreq = document.getElementById('val-frequency');
    const elNoiseType = document.getElementById('noise-type');
    const elSnrLock = document.getElementById('snr-lock');
    const elSnrSliderGroup = document.getElementById('snr-slider-group');
    const elParamSnr = document.getElementById('param-snr');
    const elValSnr = document.getElementById('val-snr');
    const elVarianceGroup = document.getElementById('variance-slider-group');
    const elParamVariance = document.getElementById('param-variance');
    const elValVariance = document.getElementById('val-variance');
    const elLblVariance = document.getElementById('lbl-variance');
    const elThermalGroup = document.getElementById('thermal-group');
    const elParamTemp = document.getElementById('param-temp');
    const elValTemp = document.getElementById('val-temp');
    const elParamBandwidth = document.getElementById('param-bandwidth');
    const elValBandwidth = document.getElementById('val-bandwidth');
    const elFilterType = document.getElementById('filter-type');
    const elCutoffGroup = document.getElementById('cutoff-slider-group');
    const elParamCutoff = document.getElementById('param-cutoff');
    const elValCutoff = document.getElementById('val-cutoff');
    const elLblCutoff = document.getElementById('lbl-cutoff');
    const elCutoff2Group = document.getElementById('cutoff2-slider-group');
    const elParamCutoff2 = document.getElementById('param-cutoff2');
    const elValCutoff2 = document.getElementById('val-cutoff2');
    const elMWindowGroup = document.getElementById('m-window-slider-group');
    const elParamMWindow = document.getElementById('param-m-window');
    const elValMWindow = document.getElementById('val-m-window');

    const elMetricSigPower = document.getElementById('metric-sig-power');
    const elMetricNoisePower = document.getElementById('metric-noise-power');
    const elMetricSnr = document.getElementById('metric-snr');
    const elMetricMse = document.getElementById('metric-mse');
    const elMetricPsnr = document.getElementById('metric-psnr');

    const elTxDetail = document.getElementById('tx-detail');
    const elChannelDetail = document.getElementById('channel-detail');
    const elRxDetail = document.getElementById('rx-detail');
    const elFlowTx = document.getElementById('flow-tx');
    const elFlowChannel = document.getElementById('flow-channel');
    const elFlowRx = document.getElementById('flow-rx');
    const elFlowOutput = document.getElementById('flow-output');
    const elArrowTxChannel = document.getElementById('arrow-tx-channel');
    const elArrowChannelRx = document.getElementById('arrow-channel-rx');
    const elArrowRxOutput = document.getElementById('arrow-rx-output');

    const elToggleSigOriginal = document.getElementById('toggle-sig-original');
    const elToggleSigNoise = document.getElementById('toggle-sig-noise');
    const elToggleSigNoisy = document.getElementById('toggle-sig-noisy');
    const elToggleSigRecovered = document.getElementById('toggle-sig-recovered');

    // Tab 2: AM DOM Elements
    const elAmMsgShape = document.getElementById('am-msg-shape');
    const elAmParamAm = document.getElementById('param-am-am');
    const elAmValAm = document.getElementById('val-am-am');
    const elAmParamFm = document.getElementById('param-am-fm');
    const elAmValFm = document.getElementById('val-am-fm');
    const elAmParamAc = document.getElementById('param-am-ac');
    const elAmValAc = document.getElementById('val-am-ac');
    const elAmParamFc = document.getElementById('param-am-fc');
    const elAmValFc = document.getElementById('val-am-fc');
    const elAmType = document.getElementById('am-type');
    const elAmParamMu = document.getElementById('param-am-mu');
    const elAmValMu = document.getElementById('val-am-mu');
    const elMuSliderGroup = document.getElementById('mu-slider-group');
    const elAmParamTscale = document.getElementById('param-am-tscale');
    const elAmValTscale = document.getElementById('val-am-tscale');
    const elAmNoiseToggle = document.getElementById('am-noise-toggle');
    const elAmNoiseIntensityGroup = document.getElementById('am-noise-intensity-group');
    const elAmParamNoise = document.getElementById('param-am-noise');
    const elAmValNoise = document.getElementById('val-am-noise');
    const elAmDemodType = document.getElementById('am-demod-type');
    const elAmParamDemodCutoff = document.getElementById('param-am-demod-cutoff');
    const elAmValDemodCutoff = document.getElementById('val-am-demod-cutoff');
    const elAmLblDemodCutoff = document.getElementById('lbl-am-demod-cutoff');

    const elAmTxMsgDetail = document.getElementById('am-tx-msg-detail');
    const elAmModDetail = document.getElementById('am-mod-detail');
    const elAmChannelDetail = document.getElementById('am-channel-detail');
    const elAmRxDetail = document.getElementById('am-rx-detail');
    const elAmOutDetail = document.getElementById('am-out-detail');

    const elAmStatusBadge = document.getElementById('am-modulation-status-badge');
    const elAmMetricMu = document.getElementById('am-metric-mu');
    const elAmMetricPct = document.getElementById('am-metric-pct');
    const elAmMetricPc = document.getElementById('am-metric-pc');
    const elAmMetricPsb = document.getElementById('am-metric-psb');
    const elAmMetricMse = document.getElementById('am-metric-mse');
    const elAmMetricSnr = document.getElementById('am-metric-snr');
    const elAmWarningBanner = document.getElementById('am-overmod-warning-banner');

    const elAmToggleMsg = document.getElementById('am-toggle-msg');
    const elAmToggleMod = document.getElementById('am-toggle-mod');
    const elAmToggleEnv = document.getElementById('am-toggle-env');
    const elAmToggleDemod = document.getElementById('am-toggle-demod');

    // --- Active Charts Store ---
    let chartTime = null;
    let chartFrequency = null;
    let splitCharts = {};
    let isCompareMode = false;

    let chartAMTime = null;
    let chartAMFrequency = null;
    let chartAMTrapezoid = null;

    // AM Signals Cache
    let amMsgSignal = new Float32Array(NAm);
    let amCarrierSignal = new Float32Array(NAm);
    let amModulatedSignal = new Float32Array(NAm);
    let amRecoveredSignal = new Float32Array(NAm);
    let amEnvPos = new Float32Array(NAm);
    let amEnvNeg = new Float32Array(NAm);

    // Clean signal pointers for T1
    let cleanSignal = new Float32Array(NNoise);
    let noiseSignal = new Float32Array(NNoise);
    let noisySignal = new Float32Array(NNoise);
    let recoveredSignal = new Float32Array(NNoise);

    // --- Design Palette Fetch ---
    function getThemeColors() {
        const style = getComputedStyle(document.body);
        return {
            grid: style.getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.08)',
            text: style.getPropertyValue('--text-secondary').trim() || '#9ca3af',
            primary: style.getPropertyValue('--primary').trim() || '#3b82f6',
            sigClean: style.getPropertyValue('--color-original').trim() || '#06b6d4',
            sigNoise: style.getPropertyValue('--color-noise').trim() || '#f97316',
            sigNoisy: style.getPropertyValue('--color-noisy').trim() || '#eab308',
            sigRecovered: style.getPropertyValue('--color-recovered').trim() || '#a855f7'
        };
    }

    // Chart Configuration Generator
    function createChartOptions(xAxisLabel, yAxisLabel, colors, isFreq = false) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 }, // Set 0 duration for fast rendering loop
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleFont: { family: 'Outfit' },
                    bodyFont: { family: 'JetBrains Mono' }
                }
            },
            scales: {
                x: {
                    grid: { color: colors.grid },
                    ticks: {
                        color: colors.text,
                        font: { family: 'JetBrains Mono', size: 9 },
                        maxTicksLimit: isFreq ? 8 : 12
                    },
                    title: {
                        display: true,
                        text: xAxisLabel,
                        color: colors.text,
                        font: { family: 'Outfit', size: 10, weight: '600' }
                    }
                },
                y: {
                    grid: { color: colors.grid },
                    ticks: {
                        color: colors.text,
                        font: { family: 'JetBrains Mono', size: 9 }
                    },
                    title: {
                        display: true,
                        text: yAxisLabel,
                        color: colors.text,
                        font: { family: 'Outfit', size: 10, weight: '600' }
                    }
                }
            }
        };
    }

    // --- Chart Initializations ---
    function initTab1Charts() {
        const colors = getThemeColors();

        // Time domain chart
        const ctxTime = document.getElementById('chart-time').getContext('2d');
        chartTime = new Chart(ctxTime, {
            type: 'line',
            data: {
                labels: noiseTimeLabels,
                datasets: [
                    { label: 'Original', data: Array(NNoise).fill(0), borderColor: colors.sigClean, borderWidth: 2, pointRadius: 0, fill: false },
                    { label: 'Noise', data: Array(NNoise).fill(0), borderColor: colors.sigNoise, borderWidth: 1, pointRadius: 0, fill: false },
                    { label: 'Noisy', data: Array(NNoise).fill(0), borderColor: colors.sigNoisy, borderWidth: 1.5, pointRadius: 0, fill: false },
                    { label: 'Recovered', data: Array(NNoise).fill(0), borderColor: colors.sigRecovered, borderWidth: 2, pointRadius: 0, fill: false }
                ]
            },
            options: createChartOptions('Time (ms)', 'Amplitude (V)', colors)
        });

        // Set visibility based on checkbox state
        chartTime.setDatasetVisibility(0, elToggleSigOriginal.checked);
        chartTime.setDatasetVisibility(1, elToggleSigNoise.checked);
        chartTime.setDatasetVisibility(2, elToggleSigNoisy.checked);
        chartTime.setDatasetVisibility(3, elToggleSigRecovered.checked);

        // Frequency domain spectrum
        const ctxFreq = document.getElementById('chart-frequency').getContext('2d');
        chartFrequency = new Chart(ctxFreq, {
            type: 'line',
            data: {
                labels: noiseFreqLabels,
                datasets: [
                    { label: 'Original Spectrum', data: Array(NNoise / 2).fill(0), borderColor: colors.sigClean, backgroundColor: 'rgba(6, 182, 212, 0.05)', borderWidth: 2, pointRadius: 0, fill: true },
                    { label: 'Noisy Spectrum', data: Array(NNoise / 2).fill(0), borderColor: colors.sigNoisy, backgroundColor: 'rgba(234, 179, 8, 0.03)', borderWidth: 1.2, pointRadius: 0, fill: true },
                    { label: 'Recovered Spectrum', data: Array(NNoise / 2).fill(0), borderColor: colors.sigRecovered, backgroundColor: 'rgba(168, 85, 247, 0.05)', borderWidth: 2, pointRadius: 0, fill: true }
                ]
            },
            options: createChartOptions('Frequency (Hz)', 'Magnitude', colors, true)
        });

        initSplitCharts();
    }

    function initSplitCharts() {
        const colors = getThemeColors();
        const config = [
            { id: 'chart-split-original', label: 'Original', color: colors.sigClean },
            { id: 'chart-split-noise', label: 'Noise', color: colors.sigNoise },
            { id: 'chart-split-noisy', label: 'Noisy', color: colors.sigNoisy },
            { id: 'chart-split-recovered', label: 'Recovered', color: colors.sigRecovered }
        ];

        config.forEach(cfg => {
            const ctx = document.getElementById(cfg.id).getContext('2d');
            if (splitCharts[cfg.label]) {
                splitCharts[cfg.label].destroy();
            }
            splitCharts[cfg.label] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: noiseTimeLabels,
                    datasets: [{ label: cfg.label, data: Array(NNoise).fill(0), borderColor: cfg.color, borderWidth: 2, pointRadius: 0, fill: false }]
                },
                options: createChartOptions('Time (ms)', 'Amplitude (V)', colors)
            });
        });
    }

    function initTab2Charts() {
        const colors = getThemeColors();

        // 1. AM Time domain oscilloscope
        const ctxAmTime = document.getElementById('chart-am-time').getContext('2d');
        chartAMTime = new Chart(ctxAmTime, {
            type: 'line',
            data: {
                labels: [], // Populated dynamically
                datasets: [
                    { label: 'Message m(t)', data: [], borderColor: colors.sigClean, borderWidth: 2, pointRadius: 0, fill: false },
                    { label: 'AM Wave s(t)', data: [], borderColor: colors.sigNoisy, borderWidth: 1.5, pointRadius: 0, fill: false },
                    { label: '+Envelope', data: [], borderColor: colors.sigNoise, borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
                    { label: '-Envelope', data: [], borderColor: colors.sigNoise, borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
                    { label: 'Demodulated v(t)', data: [], borderColor: colors.sigRecovered, borderWidth: 2, pointRadius: 0, fill: false }
                ]
            },
            options: createChartOptions('Time (ms)', 'Amplitude (V)', colors)
        });

        // Set visibility based on checkbox state
        chartAMTime.setDatasetVisibility(0, elAmToggleMsg.checked);
        chartAMTime.setDatasetVisibility(1, elAmToggleMod.checked);
        chartAMTime.setDatasetVisibility(2, elAmToggleEnv.checked);
        chartAMTime.setDatasetVisibility(3, elAmToggleEnv.checked);
        chartAMTime.setDatasetVisibility(4, elAmToggleDemod.checked);

        // 2. AM Spectrum analyzer FFT chart
        const ctxAmFreq = document.getElementById('chart-am-frequency').getContext('2d');
        chartAMFrequency = new Chart(ctxAmFreq, {
            type: 'line',
            data: {
                labels: amFreqLabels,
                datasets: [
                    { label: 'Spectrum Magnitude', data: Array(150).fill(0), borderColor: colors.sigNoisy, backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 2, pointRadius: 0, fill: true }
                ]
            },
            options: createChartOptions('Frequency (Hz)', 'Magnitude', colors, true)
        });

        // 3. AM Trapezoidal XY loop plot
        const ctxAmTrap = document.getElementById('chart-am-trapezoid').getContext('2d');
        chartAMTrapezoid = new Chart(ctxAmTrap, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'AM vs Msg',
                    data: [], // Filled dynamically with {x, y} coordinate objects
                    borderColor: colors.sigClean,
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    showLine: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        type: 'linear',
                        grid: { color: colors.grid },
                        ticks: { color: colors.text, font: { family: 'JetBrains Mono', size: 9 } },
                        title: { display: true, text: 'Message Voltage m(t)', color: colors.text, font: { family: 'Outfit', size: 10, weight: '600' } }
                    },
                    y: {
                        grid: { color: colors.grid },
                        ticks: { color: colors.text, font: { family: 'JetBrains Mono', size: 9 } },
                        title: { display: true, text: 'AM Wave s(t)', color: colors.text, font: { family: 'Outfit', size: 10, weight: '600' } }
                    }
                }
            }
        });
    }

    function updateAllChartsTheme() {
        const colors = getThemeColors();
        const charts = [chartTime, chartFrequency, chartAMTime, chartAMFrequency, chartAMTrapezoid, ...Object.values(splitCharts)];

        charts.forEach(c => {
            if (!c) return;
            c.options.scales.x.grid.color = colors.grid;
            c.options.scales.y.grid.color = colors.grid;
            c.options.scales.x.ticks.color = colors.text;
            c.options.scales.y.ticks.color = colors.text;
            c.options.scales.x.title.color = colors.text;
            c.options.scales.y.title.color = colors.text;
        });

        // Recolor lines
        if (chartTime) {
            chartTime.data.datasets[0].borderColor = colors.sigClean;
            chartTime.data.datasets[1].borderColor = colors.sigNoise;
            chartTime.data.datasets[2].borderColor = colors.sigNoisy;
            chartTime.data.datasets[3].borderColor = colors.sigRecovered;
            chartTime.update();
        }

        if (chartFrequency) {
            chartFrequency.data.datasets[0].borderColor = colors.sigClean;
            chartFrequency.data.datasets[1].borderColor = colors.sigNoisy;
            chartFrequency.data.datasets[2].borderColor = colors.sigRecovered;
            chartFrequency.update();
        }

        if (chartAMTime) {
            chartAMTime.data.datasets[0].borderColor = colors.sigClean;
            chartAMTime.data.datasets[1].borderColor = colors.sigNoisy;
            chartAMTime.data.datasets[2].borderColor = colors.sigNoise;
            chartAMTime.data.datasets[3].borderColor = colors.sigNoise;
            chartAMTime.data.datasets[4].borderColor = colors.sigRecovered;
            chartAMTime.update();
        }

        if (chartAMFrequency) {
            chartAMFrequency.data.datasets[0].borderColor = colors.sigNoisy;
            chartAMFrequency.update();
        }

        if (chartAMTrapezoid) {
            chartAMTrapezoid.data.datasets[0].borderColor = colors.sigClean;
            chartAMTrapezoid.options.scales.x.grid.color = colors.grid;
            chartAMTrapezoid.options.scales.y.grid.color = colors.grid;
            chartAMTrapezoid.options.scales.x.ticks.color = colors.text;
            chartAMTrapezoid.options.scales.y.ticks.color = colors.text;
            chartAMTrapezoid.update();
        }

        if (splitCharts['Original']) {
            splitCharts['Original'].data.datasets[0].borderColor = colors.sigClean; splitCharts['Original'].update();
            splitCharts['Noise'].data.datasets[0].borderColor = colors.sigNoise; splitCharts['Noise'].update();
            splitCharts['Noisy'].data.datasets[0].borderColor = colors.sigNoisy; splitCharts['Noisy'].update();
            splitCharts['Recovered'].data.datasets[0].borderColor = colors.sigRecovered; splitCharts['Recovered'].update();
        }
    }

    // --- Simulation Processing Loops ---

    // Tab 1: Noise & Filtering Computation Loop
    function performDSPComputation(scrollPhase) {
        const sigType = elSignalType.value;
        const amp = parseFloat(elParamAmp.value);
        const freq = parseFloat(elParamFreq.value);

        const noiseType = elNoiseType.value;
        const snrLocked = elSnrLock.checked;
        const targetSnr = parseFloat(elParamSnr.value);

        let variance = parseFloat(elParamVariance.value);
        const temp = parseFloat(elParamTemp.value);
        const bandwidth = parseFloat(elParamBandwidth.value) * 1e6;

        const filterType = elFilterType.value;
        const cutoff = parseFloat(elParamCutoff.value);
        const cutoff2 = parseFloat(elParamCutoff2.value);
        const mWindow = parseInt(elParamMWindow.value);

        // Update link text
        elTxDetail.innerText = `${sigType.toUpperCase()}, ${freq} Hz, ${amp}V`;

        // Generate clean signal
        const shiftedTime = new Float32Array(NNoise);
        for (let i = 0; i < NNoise; i++) {
            shiftedTime[i] = noiseTimeVector[i] + scrollPhase;
        }
        cleanSignal = DSP.generateSignal(sigType, freq, amp, shiftedTime);

        // Power & SNR Variance
        const signalPower = DSP.metrics.calculatePower(cleanSignal);
        if (snrLocked) {
            const ratio = Math.pow(10.0, targetSnr / 10.0);
            variance = signalPower / ratio;
            elValVariance.innerText = `${variance.toFixed(4)} V²`;
            elParamVariance.value = variance;
        } else {
            elValVariance.innerText = `${variance.toFixed(2)} V²`;
        }

        // Noise Profile
        switch (noiseType) {
            case 'awgn':
                noiseSignal = DSP.noise.generateAWGN(NNoise, variance);
                elChannelDetail.innerText = `AWGN (σ²: ${variance.toFixed(2)})`;
                break;
            case 'thermal':
                noiseSignal = DSP.noise.generateThermal(NNoise, temp, bandwidth);
                elChannelDetail.innerText = `Thermal (T: ${temp}K, B: ${(bandwidth / 1e6).toFixed(1)}MHz)`;
                break;
            case 'impulse':
                const impulseProb = Math.min(variance / 4.0, 0.4);
                noiseSignal = DSP.noise.generateImpulse(NNoise, impulseProb, amp);
                elChannelDetail.innerText = `Impulse (P: ${(impulseProb * 100).toFixed(1)}%)`;
                break;
            case 'uniform':
                noiseSignal = DSP.noise.generateUniform(NNoise, variance);
                elChannelDetail.innerText = `Uniform (σ²: ${variance.toFixed(2)})`;
                break;
        }

        // Apply channel addition
        for (let i = 0; i < NNoise; i++) {
            noisySignal[i] = cleanSignal[i] + noiseSignal[i];
        }

        // Receiver filtering
        if (filterType === 'none') {
            recoveredSignal.set(noisySignal);
            elRxDetail.innerText = 'Pass-through';
        } else if (filterType === 'moving') {
            recoveredSignal.set(DSP.filter.movingAverage(noisySignal, mWindow));
            elRxDetail.innerText = `Moving Avg (M: ${mWindow})`;
        } else {
            let coefs = null;
            if (filterType === 'lpf') {
                coefs = DSP.filter.lowPassCoefficients(cutoff, fsNoise);
                elRxDetail.innerText = `Butter LPF (${cutoff} Hz)`;
            } else if (filterType === 'hpf') {
                coefs = DSP.filter.highPassCoefficients(cutoff, fsNoise);
                elRxDetail.innerText = `Butter HPF (${cutoff} Hz)`;
            } else if (filterType === 'bpf') {
                const f1 = Math.min(cutoff, cutoff2 - 5);
                const f2 = Math.max(cutoff + 5, cutoff2);
                coefs = DSP.filter.bandPassCoefficients(f1, f2, fsNoise);
                elRxDetail.innerText = `Butter BPF (${f1}-${f2} Hz)`;
            }
            recoveredSignal.set(DSP.filter.applyIIR(noisySignal, coefs));
        }

        // Performance metrics
        const metrics = DSP.metrics.calculateAll(cleanSignal, noiseSignal, noisySignal, recoveredSignal, amp);
        elMetricSigPower.innerHTML = `${metrics.signalPower.toFixed(3)} V²`;
        elMetricNoisePower.innerHTML = `${metrics.noisePower.toFixed(3)} V²`;
        elMetricSnr.innerHTML = `${metrics.snr.toFixed(2)} dB`;
        elMetricMse.innerHTML = `${metrics.mse.toFixed(4)} V²`;
        elMetricPsnr.innerHTML = `${metrics.psnr.toFixed(2)} dB`;

        // FFT analysis
        const origSpectrum = DSP.fft.getSpectrum(cleanSignal);
        const noisySpectrum = DSP.fft.getSpectrum(noisySignal);
        const recSpectrum = DSP.fft.getSpectrum(recoveredSignal);

        // Render datasets
        if (isCompareMode) {
            splitCharts['Original'].data.datasets[0].data = Array.from(cleanSignal); splitCharts['Original'].update('none');
            splitCharts['Noise'].data.datasets[0].data = Array.from(noiseSignal); splitCharts['Noise'].update('none');
            splitCharts['Noisy'].data.datasets[0].data = Array.from(noisySignal); splitCharts['Noisy'].update('none');
            splitCharts['Recovered'].data.datasets[0].data = Array.from(recoveredSignal); splitCharts['Recovered'].update('none');
        } else {
            chartTime.data.datasets[0].data = Array.from(cleanSignal);
            chartTime.data.datasets[1].data = Array.from(noiseSignal);
            chartTime.data.datasets[2].data = Array.from(noisySignal);
            chartTime.data.datasets[3].data = Array.from(recoveredSignal);
            chartTime.update('none');
        }

        chartFrequency.data.datasets[0].data = Array.from(origSpectrum);
        chartFrequency.data.datasets[1].data = Array.from(noisySpectrum);
        chartFrequency.data.datasets[2].data = Array.from(recSpectrum);
        chartFrequency.update('none');

        updateNoiseDiagramGlow();
    }

    function updateNoiseDiagramGlow() {
        elFlowTx.classList.add('active');
        elArrowTxChannel.classList.add('active');
        elFlowChannel.classList.add('active');
        elArrowChannelRx.classList.add('active');
        elFlowRx.classList.add('active');
        elArrowRxOutput.classList.add('active');
        elFlowOutput.classList.add('active');
    }

    // Tab 2: Amplitude Modulation Computation Loop
    function performAMComputation(scrollPhase) {
        const amAm = parseFloat(elAmParamAm.value);
        const amFm = parseFloat(elAmParamFm.value);
        const amAc = parseFloat(elAmParamAc.value);
        const amFc = parseFloat(elAmParamFc.value);
        const amType = elAmType.value;
        const amMu = parseFloat(elAmParamMu.value);
        const amTscale = parseFloat(elAmParamTscale.value); // in ms
        const amNoiseEnable = elAmNoiseToggle.checked;
        const amNoiseVar = parseFloat(elAmParamNoise.value);
        const amDemod = elAmDemodType.value;
        const amDemodCutoff = parseFloat(elAmParamDemodCutoff.value);

        // Update labels & link texts
        elAmTxMsgDetail.innerText = `${elAmMsgShape.value.toUpperCase()}, ${amFm} Hz, ${amAm}V`;
        elAmModDetail.innerText = amType === 'dsb-fc' ? `DSB-FC (μ: ${amMu.toFixed(2)})` : `DSB-SC`;
        elAmChannelDetail.innerText = amNoiseEnable ? `AWGN (σ²: ${amNoiseVar.toFixed(2)})` : 'Clean Link';
        elAmRxDetail.innerText = `${amDemod === 'envelope' ? 'Envelope' : 'Coherent'} (${amDemodCutoff}Hz)`;

        // Adjust UI visibility based on AM Type
        if (amType === 'dsb-sc') {
            elMuSliderGroup.style.display = 'none';
        } else {
            elMuSliderGroup.style.display = 'block';
        }

        if (amNoiseEnable) {
            elAmNoiseIntensityGroup.style.display = 'block';
        } else {
            elAmNoiseIntensityGroup.style.display = 'none';
        }

        // Step 1: Modulate signals using scrolling phase accumulator
        const shiftedTime = new Float32Array(NAm);
        for (let i = 0; i < NAm; i++) {
            shiftedTime[i] = amTimeVector[i] + scrollPhase;
        }

        const msgShape = elAmMsgShape.value;
        // Generate normalized message (amplitude = 1.0)
        const msgNorm = DSP.generateSignal(msgShape, amFm, 1.0, shiftedTime);
        for (let i = 0; i < NAm; i++) {
            amMsgSignal[i] = amAm * msgNorm[i];
            amCarrierSignal[i] = amAc * Math.cos(2 * Math.PI * amFc * shiftedTime[i]);
        }

        // Generate Modulated AM wave
        if (amType === 'dsb-fc') {
            amModulatedSignal = DSP.am.generateDSBFC(msgNorm, amAc, amFc, amMu, shiftedTime);
            // Envelope boundaries
            for (let i = 0; i < NAm; i++) {
                amEnvPos[i] = amAc * (1.0 + amMu * msgNorm[i]);
                amEnvNeg[i] = -amAc * (1.0 + amMu * msgNorm[i]);
            }
        } else {
            amModulatedSignal = DSP.am.generateDSBSC(amMsgSignal, 1.0, amFc, shiftedTime);
            // Envelope is absolute magnitude of message
            for (let i = 0; i < NAm; i++) {
                amEnvPos[i] = Math.abs(amMsgSignal[i]);
                amEnvNeg[i] = -Math.abs(amMsgSignal[i]);
            }
        }

        // Step 2: Add Channel Noise
        const cleanModulatedPower = DSP.metrics.calculatePower(amModulatedSignal);
        let noisyAMSignal = new Float32Array(NAm);
        if (amNoiseEnable) {
            const noise = DSP.noise.generateAWGN(NAm, amNoiseVar);
            for (let i = 0; i < NAm; i++) {
                noisyAMSignal[i] = amModulatedSignal[i] + noise[i];
            }
        } else {
            noisyAMSignal.set(amModulatedSignal);
        }

        // Step 3: Demodulate at Receiver
        if (amDemod === 'envelope') {
            // Rectification + charging/discharging exponential decay
            amRecoveredSignal = DSP.am.demodulateEnvelope(noisyAMSignal, dtAm, amDemodCutoff);
            // Apply scale amplification (Envelope tracker loss compensation)
            for (let i = 0; i < NAm; i++) {
                amRecoveredSignal[i] *= 2.0;
            }
        } else {
            // Synchronous detection: multiply by synchronized carrier 2*cos(2*pi*fc*t) and LPF
            amRecoveredSignal = DSP.am.demodulateCoherent(noisyAMSignal, amFc, dtAm, fsAm, shiftedTime, amDemodCutoff);
            for (let i = 0; i < NAm; i++) {
                amRecoveredSignal[i] *= 2.0; // Mix-loss recovery
            }
        }

        // Step 4: Calculate Power, SNR, and MSE metrics
        const sigPower = DSP.metrics.calculatePower(amMsgSignal);
        const amPower = DSP.metrics.calculatePower(amModulatedSignal);
        
        let amPc = 0.0;
        let amPsb = 0.0;
        if (amType === 'dsb-fc') {
            amPc = (amAc * amAc) / 2.0;
            amPsb = (amMu * amMu * amPc) / 2.0;
        } else {
            amPc = 0.0;
            amPsb = amPower;
        }

        // Channel SNR
        let amSnr = Infinity;
        if (amNoiseEnable) {
            amSnr = 10 * Math.log10(cleanModulatedPower / amNoiseVar);
        }

        // Message recovery MSE
        let sumSqr = 0.0;
        for (let i = 0; i < NAm; i++) {
            const diff = amMsgSignal[i] - amRecoveredSignal[i];
            sumSqr += diff * diff;
        }
        const amMse = sumSqr / NAm;

        // Step 5: Update Metrics Dashboard UI
        if (amType === 'dsb-fc') {
            elAmMetricMu.innerText = amMu.toFixed(2);
            elAmMetricPct.innerText = `${Math.round(amMu * 100)}%`;
            
            // Check overmodulation thresholds
            if (amMu > 1.0) {
                elAmStatusBadge.innerText = 'Overmodulated';
                elAmStatusBadge.className = 'chart-badge badge-noise'; // Red tag
                elAmWarningBanner.style.display = 'flex';
            } else if (amMu === 1.0) {
                elAmStatusBadge.innerText = 'Critical';
                elAmStatusBadge.className = 'chart-badge badge-recovered'; // Purple tag
                elAmWarningBanner.style.display = 'none';
            } else {
                elAmStatusBadge.innerText = 'Under';
                elAmStatusBadge.className = 'chart-badge badge-original'; // Cyan tag
                elAmWarningBanner.style.display = 'none';
            }
        } else {
            elAmStatusBadge.innerText = 'Suppressed';
            elAmStatusBadge.className = 'chart-badge badge-original';
            elAmWarningBanner.style.display = 'none';
            elAmMetricMu.innerText = 'N/A';
            elAmMetricPct.innerText = '0%';
        }

        elAmMetricPc.innerHTML = `${amPc.toFixed(2)} V²`;
        elAmMetricPsb.innerHTML = `${amPsb.toFixed(2)} V²`;
        elAmMetricMse.innerHTML = `${amMse.toFixed(4)} V²`;
        elAmMetricSnr.innerHTML = amNoiseEnable ? `${amSnr.toFixed(2)} dB` : '∞ dB';

        // Step 6: Render Charts
        // A. Slice arrays to display exactly the selected time range window on oscilloscope
        const displayPoints = Math.min(NAm, Math.floor((amTscale / 1000.0) / dtAm));
        
        // Generate X-Axis Labels (ms)
        const amTimeSlice = amTimeVector.slice(0, displayPoints);
        const amOscilloscopeLabels = Array.from(amTimeSlice).map(t => (t * 1000).toFixed(2));
        
        chartAMTime.data.labels = amOscilloscopeLabels;
        chartAMTime.data.datasets[0].data = Array.from(amMsgSignal.slice(0, displayPoints));
        chartAMTime.data.datasets[1].data = Array.from(noisyAMSignal.slice(0, displayPoints));
        chartAMTime.data.datasets[2].data = Array.from(amEnvPos.slice(0, displayPoints));
        chartAMTime.data.datasets[3].data = Array.from(amEnvNeg.slice(0, displayPoints));
        chartAMTime.data.datasets[4].data = Array.from(amRecoveredSignal.slice(0, displayPoints));
        chartAMTime.update('none');

        // B. Spectrum FFT spikes
        const amSpectrum = DSP.fft.getSpectrum(noisyAMSignal);
        chartAMFrequency.data.datasets[0].data = Array.from(amSpectrum.slice(0, 150));
        chartAMFrequency.update('none');

        // C. Trapezoidal XY Plot (s(t) vs m(t))
        const xyCoordinates = [];
        for (let i = 0; i < displayPoints; i++) {
            xyCoordinates.push({ x: amMsgSignal[i], y: noisyAMSignal[i] });
        }
        chartAMTrapezoid.data.datasets[0].data = xyCoordinates;
        chartAMTrapezoid.update('none');
    }

    // --- Core Animation Loops ---
    function animationLoop(timestamp) {
        if (!isRunning) return;

        if (!lastTimestamp) lastTimestamp = timestamp;
        const elapsed = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // Speed multiplier is adjusted based on signal frequencies for visually pleasant scroll speed
        const speedFactor = 0.08;
        baseTime += (elapsed / 1000.0) * speedFactor;

        if (activeTab === 'noise') {
            performDSPComputation(baseTime);
        } else if (activeTab === 'am') {
            performAMComputation(baseTime);
        }

        animationFrameId = requestAnimationFrame(animationLoop);
    }

    function runSimulation() {
        if (isRunning) return;
        isRunning = true;
        elBtnStart.disabled = true;
        elBtnPause.disabled = false;
        lastTimestamp = 0;
        animationFrameId = requestAnimationFrame(animationLoop);
    }

    function pauseSimulation() {
        if (!isRunning) return;
        isRunning = false;
        elBtnStart.disabled = false;
        elBtnPause.disabled = true;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    function resetSimulation() {
        const wasRunning = isRunning;
        pauseSimulation();

        baseTime = 0.0;
        lastTimestamp = 0;

        if (activeTab === 'noise') {
            elSignalType.value = 'sine';
            elParamAmp.value = 2.0;
            elParamFreq.value = 50;
            elNoiseType.value = 'awgn';
            elSnrLock.checked = false;
            elParamSnr.value = 10.0;
            elParamVariance.value = 0.50;
            elParamTemp.value = 290;
            elParamBandwidth.value = 1.0;
            elFilterType.value = 'none';
            elParamCutoff.value = 80;
            elParamCutoff2.value = 120;
            elParamMWindow.value = 5;

            updateControlsVisibility();
            updateSliderLabelsLabels();
            performDSPComputation(0.0);
        } else if (activeTab === 'am') {
            elAmMsgShape.value = 'sine';
            elAmParamAm.value = 2.0;
            elAmParamFm.value = 30;
            elAmParamAc.value = 3.0;
            elAmParamFc.value = 300;
            elAmType.value = 'dsb-fc';
            elAmParamMu.value = 0.67;
            elAmParamTscale.value = 15;
            elAmNoiseToggle.checked = false;
            elAmParamNoise.value = 0.10;
            elAmDemodType.value = 'envelope';
            elAmParamDemodCutoff.value = 80;

            updateAMSliderLabels();
            performAMComputation(0.0);
        }

        if (wasRunning) {
            runSimulation();
        }
    }

    // --- Page Tab Toggle Registrations ---
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabTarget = btn.getAttribute('data-tab');

            // Hide all control sidebars & main layout containers
            document.getElementById('noise-sidebar').style.display = 'none';
            document.getElementById('am-sidebar').style.display = 'none';
            document.getElementById('fm-sidebar').style.display = 'none';
            document.getElementById('noise-tab').style.display = 'none';
            document.getElementById('am-tab').style.display = 'none';
            document.getElementById('fm-tab').style.display = 'none';

            // Swap displays and update orchestrator state
            if (tabTarget === 'noise-tab') {
                document.getElementById('noise-sidebar').style.display = 'flex';
                document.getElementById('noise-tab').style.display = 'flex';
                activeTab = 'noise';
                elBtnExportCsv.style.display = 'inline-flex';
                if (!isRunning) performDSPComputation(baseTime);
            } else if (tabTarget === 'am-tab') {
                document.getElementById('am-sidebar').style.display = 'flex';
                document.getElementById('am-tab').style.display = 'flex';
                activeTab = 'am';
                elBtnExportCsv.style.display = 'inline-flex';
                if (!isRunning) performAMComputation(baseTime);
            } else if (tabTarget === 'fm-tab') {
                document.getElementById('fm-sidebar').style.display = 'flex';
                document.getElementById('fm-tab').style.display = 'flex';
                activeTab = 'fm';
                elBtnExportCsv.style.display = 'none'; // Hidden for locked tab
            }
        });
    });

    // --- Control Panels Hiding & Showing Configurations ---
    function updateControlsVisibility() {
        const noiseType = elNoiseType.value;
        const snrLocked = elSnrLock.checked;
        const filterType = elFilterType.value;

        if (snrLocked) {
            elSnrSliderGroup.style.display = 'block';
            elParamVariance.disabled = true;
            elLblVariance.innerText = 'Calculated Variance (σ²)';
        } else {
            elSnrSliderGroup.style.display = 'none';
            elParamVariance.disabled = false;
            elLblVariance.innerText = 'Noise Variance (σ²)';
        }

        if (noiseType === 'impulse') {
            elLblVariance.innerText = 'Impulse Probability (p)';
            elParamVariance.min = '0.00';
            elParamVariance.max = '0.40';
            elParamVariance.step = '0.01';
            if (parseFloat(elParamVariance.value) > 0.40) elParamVariance.value = 0.10;
        } else {
            elParamVariance.min = '0.01';
            elParamVariance.max = '4.00';
            elParamVariance.step = '0.01';
        }

        if (noiseType === 'thermal') {
            elThermalGroup.style.display = 'flex';
            elVarianceGroup.style.display = 'none';
            elSnrLock.disabled = true;
        } else {
            elThermalGroup.style.display = 'none';
            elVarianceGroup.style.display = 'flex';
            elSnrLock.disabled = false;
        }

        if (filterType === 'none') {
            elCutoffGroup.style.display = 'none';
            elCutoff2Group.style.display = 'none';
            elMWindowGroup.style.display = 'none';
        } else if (filterType === 'moving') {
            elCutoffGroup.style.display = 'none';
            elCutoff2Group.style.display = 'none';
            elMWindowGroup.style.display = 'block';
        } else if (filterType === 'bpf') {
            elCutoffGroup.style.display = 'block';
            elCutoff2Group.style.display = 'block';
            elMWindowGroup.style.display = 'none';
            elLblCutoff.innerText = 'Lower Cutoff (fc1)';
        } else {
            elCutoffGroup.style.display = 'block';
            elCutoff2Group.style.display = 'none';
            elMWindowGroup.style.display = 'none';
            elLblCutoff.innerText = 'Cutoff Frequency (fc)';
        }

        if (!isRunning) {
            performDSPComputation(baseTime);
        }
    }

    // --- Slider Label Synchronizations ---
    function updateSliderLabelsLabels() {
        elValAmp.innerText = `${parseFloat(elParamAmp.value).toFixed(1)} V`;
        elValFreq.innerText = `${elParamFreq.value} Hz`;
        elValSnr.innerText = `${parseFloat(elParamSnr.value).toFixed(1)} dB`;

        const noiseType = elNoiseType.value;
        const varianceVal = parseFloat(elParamVariance.value);
        if (noiseType === 'impulse') {
            elValVariance.innerText = `${(varianceVal * 100).toFixed(0)}%`;
        } else {
            elValVariance.innerText = `${varianceVal.toFixed(2)} V²`;
        }

        elValTemp.innerText = `${elParamTemp.value} K`;
        elValBandwidth.innerText = `${parseFloat(elParamBandwidth.value).toFixed(1)} MHz`;
        elValCutoff.innerText = `${elParamCutoff.value} Hz`;
        elValCutoff2.innerText = `${elParamCutoff2.value} Hz`;
        elValMWindow.innerText = `${elParamMWindow.value}`;
    }

    function updateAMSliderLabels() {
        elAmValAm.innerText = `${parseFloat(elAmParamAm.value).toFixed(1)} V`;
        elAmValFm.innerText = `${elAmParamFm.value} Hz`;
        elAmValAc.innerText = `${parseFloat(elAmParamAc.value).toFixed(1)} V`;
        elAmValFc.innerText = `${elAmParamFc.value} Hz`;
        elAmValMu.innerText = parseFloat(elAmParamMu.value).toFixed(2);
        elAmValTscale.innerText = `${elAmParamTscale.value} ms`;
        elAmValNoise.innerText = `${parseFloat(elAmParamNoise.value).toFixed(2)} V²`;
        elAmValDemodCutoff.innerText = `${elAmParamDemodCutoff.value} Hz`;

        const demodType = elAmDemodType.value;
        if (demodType === 'envelope') {
            elAmLblDemodCutoff.innerText = 'Detector Cutoff (RC)';
        } else {
            elAmLblDemodCutoff.innerText = 'LPF Cutoff (fc)';
        }
    }

    function toggleCompareMode() {
        isCompareMode = !isCompareMode;
        const timeDomainCard = document.getElementById('time-domain-card');
        const splitWrapper = document.getElementById('split-wrapper');

        if (isCompareMode) {
            timeDomainCard.style.display = 'none';
            splitWrapper.style.display = 'block';
        } else {
            timeDomainCard.style.display = 'flex';
            splitWrapper.style.display = 'none';
        }

        performDSPComputation(baseTime);
    }

    // --- CSV & Image Exports ---
    function exportToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";

        if (activeTab === 'noise') {
            csvContent += "Index,Time(ms),Original(V),Noise(V),Noisy(V),Recovered(V)\n";
            for (let i = 0; i < NNoise; i++) {
                const tMs = (noiseTimeVector[i] * 1000).toFixed(4);
                const orig = cleanSignal[i].toFixed(5);
                const noise = noiseSignal[i].toFixed(5);
                const noisy = noisySignal[i].toFixed(5);
                const rec = recoveredSignal[i].toFixed(5);
                csvContent += `${i},${tMs},${orig},${noise},${noisy},${rec}\n`;
            }
        } else if (activeTab === 'am') {
            csvContent += "Index,Time(ms),Message(V),Carrier(V),Modulated(V),Recovered(V)\n";
            for (let i = 0; i < NAm; i++) {
                const tMs = (amTimeVector[i] * 1000).toFixed(4);
                const msg = amMsgSignal[i].toFixed(5);
                const carr = amCarrierSignal[i].toFixed(5);
                const mod = amModulatedSignal[i].toFixed(5);
                const rec = amRecoveredSignal[i].toFixed(5);
                csvContent += `${i},${tMs},${msg},${carr},${mod},${rec}\n`;
            }
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `comm_lab_toolbox_${activeTab}_data.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportChartAsImage() {
        let activeCanvas;
        if (activeTab === 'noise') {
            activeCanvas = isCompareMode ? document.getElementById('chart-split-noisy') : document.getElementById('chart-time');
        } else if (activeTab === 'am') {
            activeCanvas = document.getElementById('chart-am-time');
        } else {
            return;
        }

        const link = document.createElement('a');
        link.download = `comm_lab_${activeTab}_oscilloscope.png`;
        link.href = activeCanvas.toDataURL('image/png');
        link.click();
    }

    // --- Educational accordion handles ---
    function initAccordions() {
        const headers = document.querySelectorAll('.edu-header, .am-edu-header');
        headers.forEach(h => {
            h.addEventListener('click', () => {
                const item = h.parentElement;
                const wasExpanded = item.classList.contains('expanded');

                // Collapse siblings
                const siblings = item.parentElement.querySelectorAll('.edu-item');
                siblings.forEach(el => el.classList.remove('expanded'));

                if (!wasExpanded) {
                    item.classList.add('expanded');
                }
            });
        });

        // Expand first for each tab
        const firstNoiseItem = document.querySelector('#noise-tab .edu-item');
        if (firstNoiseItem) firstNoiseItem.classList.add('expanded');

        const firstAmItem = document.querySelector('#am-tab .edu-item');
        if (firstAmItem) firstAmItem.classList.add('expanded');
    }

    // --- Theme toggling handles ---
    elThemeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        setTimeout(updateAllChartsTheme, 80);
    });

    // --- Register Controls Event Listeners ---
    elBtnStart.addEventListener('click', runSimulation);
    elBtnPause.addEventListener('click', pauseSimulation);
    elBtnReset.addEventListener('click', resetSimulation);
    elBtnExportCsv.addEventListener('click', exportToCSV);
    elBtnExportImg.addEventListener('click', exportChartAsImage);

    // Tab 1 UI listeners
    elSignalType.addEventListener('change', updateControlsVisibility);
    elNoiseType.addEventListener('change', updateControlsVisibility);
    elFilterType.addEventListener('change', updateControlsVisibility);
    elSnrLock.addEventListener('change', updateControlsVisibility);

    const noiseSliders = [
        elParamAmp, elParamFreq, elParamSnr, elParamVariance,
        elParamTemp, elParamBandwidth, elParamCutoff, elParamCutoff2, elParamMWindow
    ];
    noiseSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            updateSliderLabelsLabels();
            if (!isRunning) performDSPComputation(baseTime);
        });
    });

    // Dataset line display checkboxes Tab 1
    elToggleSigOriginal.addEventListener('change', () => { chartTime.setDatasetVisibility(0, elToggleSigOriginal.checked); chartTime.update('none'); });
    elToggleSigNoise.addEventListener('change', () => { chartTime.setDatasetVisibility(1, elToggleSigNoise.checked); chartTime.update('none'); });
    elToggleSigNoisy.addEventListener('change', () => { chartTime.setDatasetVisibility(2, elToggleSigNoisy.checked); chartTime.update('none'); });
    elToggleSigRecovered.addEventListener('change', () => { chartTime.setDatasetVisibility(3, elToggleSigRecovered.checked); chartTime.update('none'); });

    // Tab 2 UI listeners
    elAmMsgShape.addEventListener('change', () => { if (!isRunning) performAMComputation(baseTime); });
    elAmType.addEventListener('change', () => { if (!isRunning) performAMComputation(baseTime); });
    elAmNoiseToggle.addEventListener('change', () => { if (!isRunning) performAMComputation(baseTime); });
    elAmDemodType.addEventListener('change', () => { if (!isRunning) performAMComputation(baseTime); });

    const amSliders = [
        elAmParamAm, elAmParamFm, elAmParamAc, elAmParamFc,
        elAmParamMu, elAmParamTscale, elAmParamNoise, elAmParamDemodCutoff
    ];
    amSliders.forEach(slider => {
        slider.addEventListener('input', () => {
            updateAMSliderLabels();
            if (!isRunning) performAMComputation(baseTime);
        });
    });

    // Dataset line display checkboxes Tab 2
    elAmToggleMsg.addEventListener('change', () => { chartAMTime.setDatasetVisibility(0, elAmToggleMsg.checked); chartAMTime.update('none'); });
    elAmToggleMod.addEventListener('change', () => { chartAMTime.setDatasetVisibility(1, elAmToggleMod.checked); chartAMTime.update('none'); });
    elAmToggleEnv.addEventListener('change', () => {
        chartAMTime.setDatasetVisibility(2, elAmToggleEnv.checked);
        chartAMTime.setDatasetVisibility(3, elAmToggleEnv.checked);
        chartAMTime.update('none');
    });
    elAmToggleDemod.addEventListener('change', () => { chartAMTime.setDatasetVisibility(4, elAmToggleDemod.checked); chartAMTime.update('none'); });

    // --- Launch Virtual Lab Dashboard ---
    initTab1Charts();
    initTab2Charts();
    initAccordions();
    updateControlsVisibility();
    updateSliderLabelsLabels();
    updateAMSliderLabels();

    // Start rendering frame clock loop
    animationFrameId = requestAnimationFrame(animationLoop);
});
