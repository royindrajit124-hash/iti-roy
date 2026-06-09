/**
 * dsp.js - Digital Signal Processing Engine
 * Handles signal generation, noise simulation, IIR filtering, and FFT analysis.
 * Part of the "Noise Effect Demonstrator" web application.
 */

const DSP = {
    // Generate original clean signals
    generateSignal(type, frequency, amplitude, timeArray) {
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
                    // Triangle wave with period T = 1/f
                    // Form: A * (2/pi) * arcsin(sin(2*pi*f*t))
                    signal[i] = amplitude * (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * frequency * t));
                    break;
                default:
                    signal[i] = 0;
            }
        }
        return signal;
    },

    // Noise Generators
    noise: {
        // Additive White Gaussian Noise using Box-Muller Transform
        generateAWGN(length, variance) {
            const noise = new Float32Array(length);
            const stdDev = Math.sqrt(variance);
            
            for (let i = 0; i < length; i += 2) {
                let u1 = Math.random();
                let u2 = Math.random();
                
                // Avoid log(0)
                while (u1 <= 1e-15) u1 = Math.random();
                
                const r = Math.sqrt(-2.0 * Math.log(u1));
                const theta = 2.0 * Math.PI * u2;
                
                const z0 = r * Math.cos(theta) * stdDev;
                const z1 = r * Math.sin(theta) * stdDev;
                
                noise[i] = z0;
                if (i + 1 < length) {
                    noise[i + 1] = z1;
                }
            }
            return noise;
        },

        // Thermal Noise: Variance depends on Temperature (T) and Bandwidth (B)
        // Physically: σ² = 4 * k_B * T * B * R.
        // We'll scale this physical equation to reasonable simulator values:
        // k_B = 1.38e-23, R = 50 Ohms, and scale up for visualization visibility.
        generateThermal(length, temperature, bandwidth) {
            const kB = 1.38e-23;
            const R = 50.0; // Standard 50 ohm impedance
            // Scaling factor to map thermal noise to range 0.0 to 2.0 V RMS for visibility
            const scaleFactor = 1.0e17; 
            const variance = 4.0 * kB * temperature * bandwidth * R * scaleFactor;
            return this.generateAWGN(length, variance);
        },

        // Impulse Noise (Salt & Pepper / Click noise)
        // Spikes occurring with probability p (intensity), with random polarities and max amplitude
        generateImpulse(length, intensity, maxAmplitude) {
            const noise = new Float32Array(length);
            for (let i = 0; i < length; i++) {
                if (Math.random() < intensity) {
                    // Random polarity (+1 or -1) times signal amplitude scale
                    noise[i] = (Math.random() > 0.5 ? 1 : -1) * maxAmplitude * (0.8 + Math.random() * 0.4);
                } else {
                    noise[i] = 0.0;
                }
            }
            return noise;
        },

        // Uniform Noise
        // Distributed uniformly between -W and +W. Variance of uniform noise is W²/3.
        // So given variance V, W = sqrt(3 * V).
        generateUniform(length, variance) {
            const noise = new Float32Array(length);
            const w = Math.sqrt(3.0 * variance);
            for (let i = 0; i < length; i++) {
                noise[i] = (Math.random() * 2.0 - 1.0) * w;
            }
            return noise;
        }
    },

    // Filter Coefficients Generators (2nd-Order Butterworth)
    // Dynamic generation based on cutoff frequency and sample rate fs
    filter: {
        // Moving Average Filter
        movingAverage(signal, windowSize) {
            const N = signal.length;
            const output = new Float32Array(N);
            
            for (let i = 0; i < N; i++) {
                let sum = 0;
                let count = 0;
                for (let k = 0; k < windowSize; k++) {
                    if (i - k >= 0) {
                        sum += signal[i - k];
                        count++;
                    }
                }
                output[i] = sum / count;
            }
            return output;
        },

        // 2nd Order Butterworth Lowpass Filter
        // y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
        lowPassCoefficients(fc, fs) {
            const theta = 2 * Math.PI * fc / fs;
            const K = Math.tan(theta / 2);
            const D = 1.0 + Math.sqrt(2.0) * K + K * K;
            
            return {
                b0: (K * K) / D,
                b1: (2.0 * K * K) / D,
                b2: (K * K) / D,
                a1: (2.0 * (K * K - 1.0)) / D,
                a2: (1.0 - Math.sqrt(2.0) * K + K * K) / D
            };
        },

        // 2nd Order Butterworth Highpass Filter
        highPassCoefficients(fc, fs) {
            const theta = 2 * Math.PI * fc / fs;
            const K = Math.tan(theta / 2);
            const D = 1.0 + Math.sqrt(2.0) * K + K * K;
            
            return {
                b0: 1.0 / D,
                b1: -2.0 / D,
                b2: 1.0 / D,
                a1: (2.0 * (K * K - 1.0)) / D,
                a2: (1.0 - Math.sqrt(2.0) * K + K * K) / D
            };
        },

        // 2nd Order Butterworth Bandpass Filter
        bandPassCoefficients(f1, f2, fs) {
            const omega1 = Math.tan(Math.PI * f1 / fs);
            const omega2 = Math.tan(Math.PI * f2 / fs);
            const omega0Sq = omega1 * omega2;
            const W = omega2 - omega1;
            const D = 1.0 + W + omega0Sq;
            
            return {
                b0: W / D,
                b1: 0.0,
                b2: -W / D,
                a1: (2.0 * (omega0Sq - 1.0)) / D,
                a2: (1.0 - W + omega0Sq) / D
            };
        },

        // Apply 2nd order IIR filter coefficients to signal
        applyIIR(signal, coef) {
            const N = signal.length;
            const output = new Float32Array(N);
            
            // Initial state variables
            let x1 = 0, x2 = 0; // Inputs x[n-1], x[n-2]
            let y1 = 0, y2 = 0; // Outputs y[n-1], y[n-2]
            
            for (let i = 0; i < N; i++) {
                const x0 = signal[i];
                // Difference equation
                const y0 = coef.b0 * x0 + coef.b1 * x1 + coef.b2 * x2 - coef.a1 * y1 - coef.a2 * y2;
                
                // Shift states
                x2 = x1;
                x1 = x0;
                y2 = y1;
                y1 = y0;
                
                output[i] = y0;
            }
            return output;
        }
    },

    // FFT Cooley-Tukey Radix-2 Implementation
    fft: {
        bitReverse(x, n) {
            let rev = 0;
            const logN = Math.log2(n);
            for (let i = 0; i < logN; i++) {
                if ((x & (1 << i)) !== 0) {
                    rev |= 1 << (logN - 1 - i);
                }
            }
            return rev;
        },

        // In-place Radix-2 Decimation-in-Time FFT
        compute(re, im) {
            const n = re.length;
            
            // Bit-reversal permutation
            for (let i = 0; i < n; i++) {
                const j = this.bitReverse(i, n);
                if (i < j) {
                    let temp = re[i]; re[i] = re[j]; re[j] = temp;
                    temp = im[i]; im[i] = im[j]; im[j] = temp;
                }
            }
            
            // Cooley-Tukey core loop
            for (let len = 2; len <= n; len <<= 1) {
                const angle = -2.0 * Math.PI / len;
                const wlen_re = Math.cos(angle);
                const wlen_im = Math.sin(angle);
                
                for (let i = 0; i < n; i += len) {
                    let w_re = 1.0;
                    let w_im = 0.0;
                    const halfLen = len >> 1;
                    
                    for (let j = 0; j < halfLen; j++) {
                        const u_re = re[i + j];
                        const u_im = im[i + j];
                        const target_re = re[i + j + halfLen];
                        const target_im = im[i + j + halfLen];
                        
                        // Complex multiplication: t = w * A[i + j + halfLen]
                        const t_re = target_re * w_re - target_im * w_im;
                        const t_im = target_re * w_im + target_im * w_re;
                        
                        re[i + j] = u_re + t_re;
                        im[i + j] = u_im + t_im;
                        re[i + j + halfLen] = u_re - t_re;
                        im[i + j + halfLen] = u_im - t_im;
                        
                        // Multiply w by wlen
                        const next_w_re = w_re * wlen_re - w_im * wlen_im;
                        const next_w_im = w_re * wlen_im + w_im * wlen_re;
                        w_re = next_w_re;
                        w_im = next_w_im;
                    }
                }
            }
        },

        // Get FFT Magnitude spectrum
        getSpectrum(signal) {
            const N = signal.length;
            const re = new Float32Array(signal);
            const im = new Float32Array(N); // Imaginary part initialized to 0
            
            this.compute(re, im);
            
            // Compute magnitude for first half (positive frequencies)
            const halfN = N / 2;
            const magnitude = new Float32Array(halfN);
            
            for (let i = 0; i < halfN; i++) {
                // Magnitude normalized by N
                const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / N;
                // Double it for single-sided spectrum (except DC and Nyquist components)
                magnitude[i] = (i === 0 || i === halfN - 1) ? mag : mag * 2.0;
            }
            
            return magnitude;
        }
    },

    // DSP Metrics Engine
    metrics: {
        // Signal Power = 1/N * sum(s_i^2)
        calculatePower(signal) {
            const N = signal.length;
            let sumSq = 0.0;
            for (let i = 0; i < N; i++) {
                sumSq += signal[i] * signal[i];
            }
            return sumSq / N;
        },

        // Calculate actual signal power, noise power, SNR, MSE, and PSNR
        calculateAll(original, noise, noisy, recovered, peakAmp) {
            const N = original.length;
            const sigPower = this.calculatePower(original);
            const noisePower = this.calculatePower(noise);
            
            // SNR = 10 * log10(Ps / Pn)
            let snr = 0.0;
            if (noisePower > 0.0) {
                snr = 10.0 * Math.log10(sigPower / noisePower);
            } else {
                snr = 99.9; // Arbitrary high limit when there's no noise
            }

            // MSE = 1/N * sum( (original_i - recovered_i)^2 )
            let sumMSE = 0.0;
            for (let i = 0; i < N; i++) {
                const diff = original[i] - recovered[i];
                sumMSE += diff * diff;
            }
            const mse = sumMSE / N;

            // PSNR = 10 * log10(Peak^2 / MSE)
            let psnr = 0.0;
            if (mse > 0.0) {
                psnr = 10.0 * Math.log10((peakAmp * peakAmp) / mse);
            } else {
                psnr = 99.9; // Perfect recovery
            }

            return {
                signalPower: sigPower,
                noisePower: noisePower,
                snr: snr,
                mse: mse,
                psnr: psnr
            };
        }
    },

    // AM Modulation & Demodulation Engine
    am: {
        // Generate Standard AM (DSB-FC)
        // s(t) = Ac * (1 + mu * msg(t)) * cos(2*pi*fc*t)
        // message is assumed to be normalized between -1.0 and 1.0 (or normalized by its amplitude in the loop)
        generateDSBFC(message, carrierAmp, carrierFreq, mu, timeArray) {
            const N = timeArray.length;
            const output = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                const t = timeArray[i];
                output[i] = carrierAmp * (1.0 + mu * message[i]) * Math.cos(2 * Math.PI * carrierFreq * t);
            }
            return output;
        },

        // Generate DSB-SC (Double Sideband Suppressed Carrier)
        // s(t) = m(t) * Ac * cos(2*pi*fc*t)
        generateDSBSC(message, carrierAmp, carrierFreq, timeArray) {
            const N = timeArray.length;
            const output = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                const t = timeArray[i];
                output[i] = message[i] * carrierAmp * Math.cos(2 * Math.PI * carrierFreq * t);
            }
            return output;
        },

        // Simple Diode Envelope Detector (Half-wave rectifier + RC discharge filter)
        demodulateEnvelope(modulatedSignal, dt, cutoffFreq) {
            const N = modulatedSignal.length;
            const rectified = new Float32Array(N);
            const output = new Float32Array(N);

            // 1. Half Wave Rectification (diode passes positive polarity)
            for (let i = 0; i < N; i++) {
                rectified[i] = Math.max(0.0, modulatedSignal[i]);
            }

            // 2. RC Filter charging/discharging
            // RC time constant: RC = 1 / (2 * pi * cutoffFreq)
            const rc = 1.0 / (2.0 * Math.PI * cutoffFreq);
            const dischargeFactor = Math.exp(-dt / rc);

            let capVoltage = 0.0;
            for (let i = 0; i < N; i++) {
                if (rectified[i] > capVoltage) {
                    capVoltage = rectified[i]; // Charge instantly
                } else {
                    capVoltage = capVoltage * dischargeFactor; // Discharge exponentially
                }
                output[i] = capVoltage;
            }

            // 3. DC Blocker: Remove DC average component to center the recovered signal at 0.0
            let sum = 0.0;
            for (let i = 0; i < N; i++) {
                sum += output[i];
            }
            const avg = sum / N;
            
            const cleanOutput = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                cleanOutput[i] = output[i] - avg;
            }

            return cleanOutput;
        },

        // Coherent Detector (Multiplication by carrier + Low Pass Filtering)
        demodulateCoherent(modulatedSignal, carrierFreq, dt, fs, timeArray, lpfCutoff) {
            const N = modulatedSignal.length;
            const mixed = new Float32Array(N);
            
            // 1. Multiply by local synchronized carrier: 2 * cos(2 * pi * fc * t)
            for (let i = 0; i < N; i++) {
                const t = timeArray[i];
                mixed[i] = modulatedSignal[i] * 2.0 * Math.cos(2 * Math.PI * carrierFreq * t);
            }

            // 2. Pass through 2nd order Butterworth Lowpass Filter
            const coefs = DSP.filter.lowPassCoefficients(lpfCutoff, fs);
            return DSP.filter.applyIIR(mixed, coefs);
        }
    }
};

// Export to window object for browser access
window.DSP = DSP;
