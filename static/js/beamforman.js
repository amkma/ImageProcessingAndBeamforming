/**
 * Beamforming Simulator - Static Plotly Edition
 * Synchronized with user input (No Animation loop)
 */

class BeamformingSimulator {
    constructor() {
        this.config = {
            numAntennas: 10,
            distance: 2.0,       // Spacing in meters
            delayDeg: 0,
            speed: 3e8,          // Speed of light
            frequencies: new Array(32).fill(1e9), // Default 1GHz
            geometry: 'Linear',
            curvature: 0.5,
            gridSize: 150,       // Resolution
            extent: 10           // +/- 10 meters
        };

        // DOM Elements
        this.heatmapDiv = document.getElementById('heatmapPlot');
        this.profileDiv = document.getElementById('beamProfilePlot');

        // Initialize
        this.init();
    }

    init() {
        this.setupCoordinates();
        this.initPlots();
        this.setupDynamicFreqSliders();
        this.attachEventListeners();

        // Initial Calculation
        this.updatePlots();

        // Handle window resize for Plotly responsiveness
        window.addEventListener('resize', () => {
            Plotly.Plots.resize(this.heatmapDiv);
            Plotly.Plots.resize(this.profileDiv);
        });
    }

    setupCoordinates() {
        // Pre-compute grid for Heatmap
        const size = this.config.gridSize;
        const ext = this.config.extent;

        this.xGrid = new Float32Array(size);
        this.yGrid = new Float32Array(size);

        for(let i=0; i<size; i++) {
            this.xGrid[i] = -ext + (i / (size - 1)) * (2 * ext);
            this.yGrid[i] = 0 + (i / (size - 1)) * 20;
        }
    }

    initPlots() {
        // --- Heatmap Setup ---
        const heatmapLayout = {
            margin: { t: 10, b: 30, l: 40, r: 10 }, // Tight margins for compact view
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'Cross-Range (m)', color: '#ff9000',
                showgrid: false, zeroline: false
            },
            yaxis: {
                title: 'Range (m)', color: '#ff9000',
                showgrid: false, zeroline: false
            },
            font: { family: 'Inter, sans-serif', size: 11 }
        };

        Plotly.newPlot(this.heatmapDiv, [{
            z: [[0]],
            type: 'heatmap',
            colorscale: 'Jet',
            zsmooth: 'best',
            colorbar: {
                tickfont: {color: '#ff9000', size: 10},
                thickness: 10
            }
        }], heatmapLayout, {responsive: true, displayModeBar: false});

        // --- Polar Setup ---
        const polarLayout = {
            margin: { t: 20, b: 20, l: 30, r: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#ff9000', family: 'Inter, sans-serif', size: 11 },
            polar: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                sector: [0, 180], // Half Circle
                radialaxis: {
                    visible: true,
                    showticklabels: false,
                    gridcolor: '#444'
                },
                angularaxis: {
                    rotation: 0,
                    direction: "counterclockwise",
                    gridcolor: '#444',
                    tickcolor: '#ff9000',
                    tickvals: [0, 45, 90, 135, 180],
                    ticktext: ['0°', '45°', '90°', '135°', '180°']
                }
            }
        };

        Plotly.newPlot(this.profileDiv, [{
            type: 'scatterpolar',
            mode: 'lines',
            fill: 'toself',
            r: [0], theta: [0],
            line: { color: '#ff9000', width: 2, shape: 'spline' },
            fillcolor: 'rgba(255, 144, 0, 0.2)'
        }], polarLayout, {responsive: true, displayModeBar: false});
    }

    setupDynamicFreqSliders() {
        const container = document.getElementById('freqContainer');
        container.innerHTML = ''; // Clear existing

        for (let i = 0; i < this.config.numAntennas; i++) {
            const div = document.createElement('div');
            div.className = 'freq-row';

            // Convert current freq (Hz) to GHz for display
            const freqGHz = (this.config.frequencies[i] / 1e9).toFixed(2);

            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-secondary">Antenna ${i+1}</small>
                    <small class="text-accent monospace"><span id="freqVal${i}">${freqGHz}</span> GHz</small>
                </div>
                <input type="range" class="form-range freq-slider" 
                       data-index="${i}" 
                       min="0.1" max="5.0" step="0.05" 
                       value="${freqGHz}">
            `;
            container.appendChild(div);
        }

        // Attach listeners to new sliders
        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const valGHz = parseFloat(e.target.value);

                // Update Model
                this.config.frequencies[idx] = valGHz * 1e9;

                // Update Label
                document.getElementById(`freqVal${idx}`).innerText = valGHz.toFixed(2);

                // Trigger Calculation
                this.updatePlots();
            });
        });
    }

    /**
     * Compute Physics logic (Heatmap Z & Polar R)
     */
    computePhysics() {
        const N = this.config.numAntennas;
        const d = this.config.distance;
        const delayRad = (this.config.delayDeg * Math.PI) / 180;
        const speed = this.config.speed;
        const frequencies = this.config.frequencies;
        const maxFreq = Math.max(...frequencies.slice(0, N));

        // 1. Calculate Antenna Positions
        const antennas = [];
        const totalWidth = (N - 1) * d;
        for(let i=0; i<N; i++) {
            const x = -totalWidth/2 + i * d;
            let y = 0;
            if(this.config.geometry === 'Curved') {
                y = 0.5 + this.config.curvature * (x * x * 0.1);
            }
            antennas.push({x, y});
        }

        // 2. Heatmap Calculation
        const size = this.config.gridSize;
        const zData = [];
        let minZ = Infinity, maxZ = -Infinity;

        for(let r=0; r<size; r++) { // Y axis
            const yPos = this.yGrid[r];
            const row = [];
            for(let c=0; c<size; c++) { // X axis
                const xPos = this.xGrid[c];
                let waveSum = 0;

                for(let i=0; i<N; i++) {
                    const ant = antennas[i];
                    const freq = frequencies[i];
                    const k = (2 * Math.PI * freq) / speed;

                    const R = Math.sqrt((xPos - ant.x)**2 + (yPos - ant.y)**2);
                    const phase = -i * delayRad;
                    const scale = freq / maxFreq;

                    // Static Wave Equation (No time 't')
                    waveSum += scale * Math.sin(k * R + phase);
                }

                // Log intensity
                const val = Math.log1p(Math.abs(waveSum));
                if(val < minZ) minZ = val;
                if(val > maxZ) maxZ = val;
                row.push(val);
            }
            zData.push(row);
        }

        // Normalize Heatmap 0-1
        const range = maxZ - minZ || 1;
        const normZ = zData.map(row => row.map(v => (v - minZ) / range));

        // 3. Beam Profile Calculation
        const beamAngles = [];
        const beamMags = [];
        for(let deg=0; deg<=180; deg++) {
            const az = (deg * Math.PI) / 180;
            let real = 0, imag = 0;

            for(let i=0; i<N; i++) {
                const ant = antennas[i];
                const freq = frequencies[i];
                const k = (2 * Math.PI * freq) / speed;

                const r_ant = Math.sqrt(ant.x**2 + ant.y**2);
                const theta_ant = Math.atan2(ant.y, ant.x);
                const phase_i = -i * delayRad;

                const term = -k * (freq/maxFreq) * r_ant * Math.cos(az - theta_ant) + phase_i;

                real += Math.cos(term);
                imag += Math.sin(term);
            }
            beamAngles.push(deg);
            beamMags.push(Math.sqrt(real**2 + imag**2));
        }

        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { z: normZ, theta: beamAngles, r: normBeam };
    }

    updatePlots() {
        const data = this.computePhysics();

        // Update Heatmap
        Plotly.react(this.heatmapDiv, [{
            z: data.z,
            type: 'heatmap',
            colorscale: document.getElementById('colormapSelect').value,
            zsmooth: 'best',
            showscale: true,
            colorbar: {
                tickfont: {color: '#ff9000'},
                thickness: 10
            }
        }], this.heatmapDiv.layout);

        // Update Polar
        Plotly.react(this.profileDiv, [{
            type: 'scatterpolar',
            mode: 'lines',
            r: data.r,
            theta: data.theta,
            fill: 'toself',
            fillcolor: 'rgba(255, 144, 0, 0.2)',
            line: { color: '#ff9000', width: 2 }
        }], this.profileDiv.layout);
    }

    attachEventListeners() {
        // Helper to bind sliders
        const bind = (id, key, isFloat=false) => {
            const el = document.getElementById(id);
            const disp = document.getElementById(id + 'Value');
            el.addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                this.config[key] = val;
                if(disp) disp.innerText = val + (id === 'delay' ? '°' : '');

                if(id === 'numElements') {
                    this.setupDynamicFreqSliders();
                }

                // Trigger update
                this.updatePlots();
            });
        };

        bind('numElements', 'numAntennas');
        bind('distance', 'distance', true);
        bind('delay', 'delayDeg');
        bind('curvature', 'curvature', true);

        // Dropdowns
        document.getElementById('geometry').addEventListener('change', (e) => {
            this.config.geometry = e.target.value;
            document.getElementById('curvatureGroup').style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';
            this.updatePlots();
        });

        document.getElementById('colormapSelect').addEventListener('change', () => {
            this.updatePlots();
        });
    }

    loadScenario(type) {
        if(type === '5g') {
            this.setControl('numElements', 8);
            this.setControl('distance', 0.5);
            this.config.geometry = 'Linear';
            this.setControl('delay', 30);
        } else if (type === 'tumor') {
            this.setControl('numElements', 16);
            this.setControl('distance', 0.1);
            this.config.geometry = 'Curved';
            this.setControl('curvature', 1.5);
        } else if (type === 'ultrasound') {
            this.setControl('numElements', 32);
            this.setControl('distance', 0.05);
            this.config.geometry = 'Linear';
            this.setControl('delay', 0);
        }

        // Update UI state
        document.getElementById('geometry').value = this.config.geometry;
        document.getElementById('curvatureGroup').style.display =
            (this.config.geometry === 'Curved') ? 'block' : 'none';

        this.setupDynamicFreqSliders();
        this.updatePlots();
    }

    setControl(id, value) {
        const el = document.getElementById(id);
        el.value = value;
        // Update the display text manually since we are bypassing the input event
        const disp = document.getElementById(id + 'Value');
        if(disp) disp.innerText = value + (id === 'delay' ? '°' : '');
        this.config[id === 'numElements' ? 'numAntennas' : (id === 'delay' ? 'delayDeg' : id)] = value;
    }
}

// Start Application
document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});