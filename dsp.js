/**
 * Noise Effect Demonstrator - DSP Engine
 * Handles signal generation, noise models, DSP filters, FFT analysis, and statistical calculations.
 * Designed for Analog Communication Engineering educational demonstrations.
 */

// --- Complex Number Class for FFT ---
class Complex {
    constructor(re = 0, im = 0) {
        this.re = re;
        this.im = im;
    }

    add(c) {
        return new Complex(this.re + c.re, this.im + c.im);
    }

    sub(c) {
        return new Complex(this.re - c.re, this.im - c.im);
    }

    mul(c) {
        return new Complex(
            this.re * c.re - this.im * c.im,
            this.re * c.im + this.im * c.re
        );
    }

    magnitude() {
        return Math.sqrt(this.re * this.re + this.im * this.im);
    }
}

// --- Signal Generation ---
function generateSignal(type, amplitude, frequency, timeArray) {
    const N = timeArray.length;
    const signal = new Float32Array(N);

    for (let i = 0; i < N; i++) {
        const t = timeArray[i];
        switch (type) {
            case 'sine':
                signal[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
                break;
            case 'square':
                signal[i] = amplitude * Math.sign(Math.sin(2 * Math.PI * frequency * t));
                break;
            case 'triangle':
                signal[i] = triangleWave(t, frequency, amplitude);
                break;
            default:
                signal[i] = 0;
        }
    }
    return signal;
}

function triangleWave(t, freq, amp) {
    const period = 1 / freq;
    const phase = (t % period) / period; // Normalized phase between 0 and 1
    if (phase < 0.25) {
        return amp * (phase / 0.25);
    } else if (phase < 0.75) {
        return amp * (2 - (phase / 0.25));
    } else {
        return amp * ((phase / 0.25) - 4);
    }
}

// --- Noise Generators ---

// Box-Muller transform for Gaussian Distribution
function randomGaussian(mean = 0, stdDev = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

/**
 * Generate noise based on selected type and parameters
 * @param {string} type - 'awgn', 'thermal', 'impulse', 'uniform'
 * @param {number} size - Number of samples
 * @param {Float32Array} originalSignal - Used for target SNR scaling in AWGN
 * @param {object} params - Noise parameters (variance, intensity, SNR, temperature, bandwidth, impulseProbability)
 */
function generateNoise(type, size, originalSignal, params) {
    const noise = new Float32Array(size);
    
    // Calculate signal power (needed for SNR-based noise generation)
    let signalPower = 0;
    for (let i = 0; i < size; i++) {
        signalPower += originalSignal[i] * originalSignal[i];
    }
    signalPower /= size;
    if (signalPower === 0) signalPower = 0.0001; // Avoid division by zero

    switch (type) {
        case 'awgn':
            if (params.useTargetSNR) {
                // SNR (dB) = 10 * log10(Ps / Pn) -> Pn = Ps / 10^(SNR/10)
                const snrLinear = Math.pow(10, params.targetSNR / 10);
                const noisePower = signalPower / snrLinear;
                const stdDev = Math.sqrt(noisePower);
                for (let i = 0; i < size; i++) {
                    noise[i] = randomGaussian(0, stdDev);
                }
            } else {
                // Manual variance mode: standard deviation = sqrt(variance)
                const stdDev = Math.sqrt(params.variance);
                for (let i = 0; i < size; i++) {
                    noise[i] = randomGaussian(0, stdDev);
                }
            }
            break;

        case 'thermal':
            // Johnson-Nyquist noise approximation: P_n = 4 * k_B * T * B * R.
            // We'll use a normalized model where T (Kelvin) and B (Bandwidth) scale the noise power.
            // Scaling factor chosen to make sliders in user-friendly ranges (T: 0-500K, B: 1-100MHz).
            const k_scaled = 1.38e-4; // Normalized constant
            const thermalNoisePower = k_scaled * params.temperature * (params.bandwidth * 1e6) * 1e-6; 
            const thermalStdDev = Math.sqrt(thermalNoisePower);
            for (let i = 0; i < size; i++) {
                noise[i] = randomGaussian(0, thermalStdDev);
            }
            break;

        case 'impulse':
            // Salt & Pepper or Bernoulli-Gaussian noise
            // Probability represents the density of spikes. Height is controlled by noise intensity.
            const spikeAmplitude = params.intensity * 2.5; // Scale height for visible impact
            for (let i = 0; i < size; i++) {
                if (Math.random() < params.impulseProbability) {
                    noise[i] = (Math.random() > 0.5 ? 1 : -1) * spikeAmplitude;
                } else {
                    noise[i] = 0;
                }
            }
            break;

        case 'uniform':
            // Uniformly distributed noise between [-W, W]
            // Noise power for uniform distribution: W^2 / 3.
            // We scale W directly by noise intensity.
            const width = params.intensity;
            for (let i = 0; i < size; i++) {
                noise[i] = (Math.random() - 0.5) * 2 * width;
            }
            break;

        default:
            // No noise
            break;
    }
    return noise;
}

// --- Digital Filtering Algorithms ---

function applyFilter(type, signal, params) {
    const N = signal.length;
    const fs = params.samplingRate;
    const filtered = new Float32Array(N);

    switch (type) {
        case 'moving_average':
            const M = params.windowSize;
            for (let i = 0; i < N; i++) {
                let sum = 0;
                let count = 0;
                for (let j = 0; j < M; j++) {
                    if (i - j >= 0) {
                        sum += signal[i - j];
                        count++;
                    }
                }
                filtered[i] = sum / count;
            }
            break;

        case 'low_pass':
            // 1st order RC low-pass filter
            // y[n] = alpha * y[n-1] + (1 - alpha) * x[n]
            // alpha = exp(-2 * pi * fc / fs)
            const alphaLP = Math.exp(-2 * Math.PI * params.cutoffFreq / fs);
            filtered[0] = signal[0]; // Avoid starting at zero
            for (let i = 1; i < N; i++) {
                filtered[i] = alphaLP * filtered[i - 1] + (1 - alphaLP) * signal[i];
            }
            break;

        case 'high_pass':
            // 1st order CR high-pass filter
            // y[n] = alpha * y[n-1] + alpha * (x[n] - x[n-1])
            // alpha = exp(-2 * pi * fc / fs)
            const alphaHP = Math.exp(-2 * Math.PI * params.cutoffFreq / fs);
            filtered[0] = signal[0];
            for (let i = 1; i < N; i++) {
                filtered[i] = alphaHP * filtered[i - 1] + alphaHP * (signal[i] - signal[i - 1]);
            }
            break;

        case 'band_pass':
            // Cascade of LPF and HPF
            // High-pass filter removes below lowCutoff, Low-pass filter removes above highCutoff
            const temp = new Float32Array(N);
            
            // 1. Apply High-pass first (low Cutoff frequency)
            const alphaBP_H = Math.exp(-2 * Math.PI * params.lowCutoff / fs);
            temp[0] = signal[0];
            for (let i = 1; i < N; i++) {
                temp[i] = alphaBP_H * temp[i - 1] + alphaBP_H * (signal[i] - signal[i - 1]);
            }

            // 2. Apply Low-pass next (high Cutoff frequency)
            const alphaBP_L = Math.exp(-2 * Math.PI * params.highCutoff / fs);
            filtered[0] = temp[0];
            for (let i = 1; i < N; i++) {
                filtered[i] = alphaBP_L * filtered[i - 1] + (1 - alphaBP_L) * temp[i];
            }
            break;

        case 'none':
        default:
            filtered.set(signal);
            break;
    }
    return filtered;
}

// --- FFT (Fast Fourier Transform) Cooley-Tukey ---
function computeFFT(timeDomainData) {
    const N = timeDomainData.length;
    // Verify power of 2
    if ((N & (N - 1)) !== 0) {
        throw new Error("FFT size must be a power of 2 (current: " + N + ")");
    }

    // Convert input to complex numbers array
    const X = new Array(N);
    for (let i = 0; i < N; i++) {
        X[i] = new Complex(timeDomainData[i], 0);
    }

    // Bit reversal ordering
    let j = 0;
    const bit = N >> 1;
    for (let i = 0; i < N - 1; i++) {
        if (i < j) {
            let temp = X[i];
            X[i] = X[j];
            X[j] = temp;
        }
        let k = bit;
        while (k <= j) {
            j -= k;
            k >>= 1;
        }
        j += k;
    }

    // Cooley-Tukey Radix-2 iterative DIT FFT
    for (let len = 2; len <= N; len <<= 1) {
        const angle = -2 * Math.PI / len;
        const wlen = new Complex(Math.cos(angle), Math.sin(angle));
        for (let i = 0; i < N; i += len) {
            let w = new Complex(1, 0);
            for (let k = 0; k < len / 2; k++) {
                const u = X[i + k];
                const t = X[i + k + len / 2].mul(w);
                X[i + k] = u.add(t);
                X[i + k + len / 2] = u.sub(t);
                w = w.mul(wlen);
            }
        }
    }

    // Compute magnitude spectrum (normalized by N)
    // We only return the single-sided spectrum (first N/2 elements)
    const halfN = N / 2;
    const magnitudes = new Float32Array(halfN);
    for (let i = 0; i < halfN; i++) {
        // Double the magnitude for single-sided spectrum (except DC and Nyquist components)
        const scale = (i === 0 || i === halfN - 1) ? 1.0 / N : 2.0 / N;
        magnitudes[i] = X[i].magnitude() * scale;
    }
    return magnitudes;
}

// --- Signal Metrics ---
function calculateMetrics(original, noise, noisy, recovered) {
    const N = original.length;

    // 1. Signal Power (average squared value)
    let signalPower = 0;
    for (let i = 0; i < N; i++) {
        signalPower += original[i] * original[i];
    }
    signalPower /= N;

    // 2. Noise Power
    let noisePower = 0;
    for (let i = 0; i < N; i++) {
        noisePower += noise[i] * noise[i];
    }
    noisePower /= N;

    // 3. SNR in dB
    // SNR = 10 * log10(Ps / Pn)
    let snrVal = -99; // Default if division by zero or negative
    if (noisePower > 0) {
        snrVal = 10 * Math.log10(signalPower / noisePower);
    } else if (signalPower > 0) {
        snrVal = 99; // Infinite SNR (no noise)
    }

    // 4. Mean Squared Error (MSE) between recovered and original signal
    let mse = 0;
    for (let i = 0; i < N; i++) {
        const error = original[i] - recovered[i];
        mse += error * error;
    }
    mse /= N;

    // 5. Peak Signal-to-Noise Ratio (PSNR)
    // Find peak value of original signal (usually amplitude, but let's calculate from data)
    let peakVal = 0.0001;
    for (let i = 0; i < N; i++) {
        const absVal = Math.abs(original[i]);
        if (absVal > peakVal) peakVal = absVal;
    }
    
    let psnr = -99;
    if (mse > 0) {
        psnr = 10 * Math.log10((peakVal * peakVal) / mse);
    } else {
        psnr = 99; // Perfect recovery
    }

    return {
        signalPower: signalPower,
        noisePower: noisePower,
        snr: snrVal,
        mse: mse,
        psnr: psnr
    };
}
