/**
 * Beamforming Simulator - Advanced Plotly Edition
 * Features: Hz Frequencies, Manual Position Control, Antenna Markers, Split Screen
 */

class BeamformingSimulator {
    constructor() {
        this.config = {
            numAntennas: 8,
            distance: 0.15,      // Base spacing
            delayDeg: 0,
            speed: 3e8,          // c
            geometry: 'Linear',
            curvature: 0.5,
            gridSize: 150,
            extentX: 10,
            extentY: 20
        };

        // Current Scenario Limits for Sliders
        this.freqLimits = { min: 1e8, max: 1e10, step: 1e8 };

        // State for individual antenna properties
        // Objects: { x: float, y: float, freq: float (Hz) }
        this.antennas = [];

        // UI State
        this.selectedAntennaIndex = 0;

        // DOM Elements
        this.heatmapDiv = document.getElementById('heatmapPlot');
        this.profileDiv = document.getElementById('beamProfilePlot');

        this.init();
    }

    init() {
        this.resetAntennas(); // Initialize positions based on default config
        this.setupCoordinates();
        this.initPlots();
        this.refreshUI();
        this.attachEventListeners();
        this.updatePlots(); // Initial Draw

        // Responsive resize
        window.addEventListener('resize', () => {
            Plotly.Plots.resize(this.heatmapDiv);
            Plotly.Plots.resize(this.profileDiv);
        });
    }

    /**
     * Resets antenna positions based on current Geometry & Count settings.
     * Called when N or Geometry changes.
     */
    resetAntennas() {
        const N = this.config.numAntennas;
        const d = this.config.distance;
        const totalWidth = (N - 1) * d;

        const newAntennas = [];
        for (let i = 0; i < N; i++) {
            // Keep existing frequency if available, else default middle of range
            const defaultFreq = (this.freqLimits.max + this.freqLimits.min) / 2;
            const existingFreq = (this.antennas[i] && this.antennas[i].freq) ? this.antennas[i].freq : defaultFreq;

            let x = -totalWidth/2 + i * d;
            let y = 0;

            if (this.config.geometry === 'Curved') {
                // Parabolic: y = 0.5 + c * x^2
                // Curvature scale adjusted relative to extent
                y = (this.config.extentY * 0.05) + this.config.curvature * (x * x * 0.5);
            }

            newAntennas.push({ x: x, y: y, freq: existingFreq });
        }
        this.antennas = newAntennas;
    }

    setupCoordinates() {
        const size = this.config.gridSize;
        const xExt = this.config.extentX;
        const yExt = this.config.extentY;

        this.xGrid = new Float32Array(size);
        this.yGrid = new Float32Array(size);

        for(let i=0; i<size; i++) {
            this.xGrid[i] = -xExt + (i / (size - 1)) * (2 * xExt);
            this.yGrid[i] = 0 + (i / (size - 1)) * yExt;
        }
    }

    initPlots() {
        // --- 1. Heatmap with Antenna Markers ---
        const heatmapLayout = {
            margin: { t: 30, b: 30, l: 40, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'X (m)', color: '#ff9000',
                range: [-this.config.extentX, this.config.extentX],
                showgrid: false, zeroline: false
            },
            yaxis: {
                title: 'Y (m)', color: '#ff9000',
                range: [0, this.config.extentY],
                showgrid: false, zeroline: false
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: false
        };

        // Trace 0: The Heatmap
        const traceHeatmap = {
            z: [[0]], x: [0], y: [0],
            type: 'heatmap',
            colorscale: 'Jet',
            zsmooth: 'best',
            colorbar: { tickfont: {color:'#ff9000'}, thickness: 10, title: 'dB' }
        };

        // Trace 1: Antenna Markers (Scatter)
        const traceAntennas = {
            x: [0], y: [0],
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#00ff90', size: 10, line: {color: 'black', width: 1} },
            name: 'Antennas'
        };

        Plotly.newPlot(this.heatmapDiv, [traceHeatmap, traceAntennas], heatmapLayout, {responsive: true, displayModeBar: false});

        // --- 2. Polar Plot ---
        const polarLayout = {
            margin: { t: 20, b: 20, l: 30, r: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#ff9000', family: 'Inter, sans-serif' },
            polar: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                sector: [0, 180],
                radialaxis: { visible: true, showticklabels: false, gridcolor: '#444' },
                angularaxis: {
                    rotation: 0, direction: "counterclockwise",
                    gridcolor: '#444', tickcolor: '#ff9000',
                    tickvals: [0, 30, 60, 90, 120, 150, 180]
                }
            }
        };

        Plotly.newPlot(this.profileDiv, [{
            type: 'scatterpolar', mode: 'lines', fill: 'toself',
            r: [0], theta: [0],
            line: { color: '#ff9000', width: 2 },
            fillcolor: 'rgba(255, 144, 0, 0.2)'
        }], polarLayout, {responsive: true, displayModeBar: false});
    }

    /**
     * Re-generates dynamic UI elements (Antenna Select, Freq Sliders)
     */
    refreshUI() {
        // 1. Antenna Selector
        const select = document.getElementById('antennaSelect');
        select.innerHTML = '';
        this.antennas.forEach((ant, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.text = `Antenna ${idx + 1}`;
            select.appendChild(opt);
        });

        // Restore selected index if valid, else 0
        if (this.selectedAntennaIndex >= this.antennas.length) {
            this.selectedAntennaIndex = 0;
        }
        select.value = this.selectedAntennaIndex;

        // 2. Update Position Sliders for selected antenna
        this.updatePositionSliders();

        // 3. Frequency Controls
        const freqContainer = document.getElementById('freqContainer');
        freqContainer.innerHTML = '';

        this.antennas.forEach((ant, idx) => {
            const div = document.createElement('div');
            div.className = 'freq-row';
            // Display Hz in scientific notation
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-secondary">Antenna ${idx+1}</small>
                    <small class="text-accent monospace"><span id="freqVal${idx}">${ant.freq.toExponential(2)}</span> Hz</small>
                </div>
                <input type="range" class="form-range freq-slider" 
                       data-index="${idx}" 
                       min="${this.freqLimits.min}" 
                       max="${this.freqLimits.max}" 
                       step="${this.freqLimits.step}" 
                       value="${ant.freq}">
            `;
            freqContainer.appendChild(div);
        });

        // Re-bind Freq Sliders
        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                this.antennas[idx].freq = val;
                document.getElementById(`freqVal${idx}`).innerText = val.toExponential(2);
                this.updatePlots();
            });
        });

        // Update Position Slider Limits based on Scale
        const xSlider = document.getElementById('antX');
        const ySlider = document.getElementById('antY');
        xSlider.min = -this.config.extentX;
        xSlider.max = this.config.extentX;
        ySlider.max = this.config.extentY;
    }

    updatePositionSliders() {
        const ant = this.antennas[this.selectedAntennaIndex];
        if(!ant) return;

        const xSlider = document.getElementById('antX');
        const ySlider = document.getElementById('antY');

        xSlider.value = ant.x;
        ySlider.value = ant.y;

        document.getElementById('antXValue').innerText = ant.x.toFixed(2);
        document.getElementById('antYValue').innerText = ant.y.toFixed(2);
    }

    /**
     * Compute Heatmap and Beam Profile based on `this.antennas`
     */
    computePhysics() {
        const speed = this.config.speed;
        const size = this.config.gridSize;
        const delayRad = (this.config.delayDeg * Math.PI) / 180;
        const maxFreq = Math.max(...this.antennas.map(a => a.freq));

        // --- 1. Heatmap ---
        const zData = [];
        let minZ = Infinity, maxZ = -Infinity;

        for(let r=0; r<size; r++) {
            const yPos = this.yGrid[r];
            const row = [];
            for(let c=0; c<size; c++) {
                const xPos = this.xGrid[c];
                let waveSum = 0;

                for(let i=0; i<this.antennas.length; i++) {
                    const ant = this.antennas[i];
                    const k = (2 * Math.PI * ant.freq) / speed;
                    const R = Math.sqrt((xPos - ant.x)**2 + (yPos - ant.y)**2);

                    const phaseDelay = -i * delayRad;
                    const scale = ant.freq / maxFreq; // Scale contribution by freq

                    // Static Interference: sum( A * cos(kR + phase) )
                    waveSum += scale * Math.cos(k * R + phaseDelay);
                }

                const val = Math.log1p(Math.abs(waveSum));
                if(val < minZ) minZ = val;
                if(val > maxZ) maxZ = val;
                row.push(val);
            }
            zData.push(row);
        }

        // Normalize Z
        const range = maxZ - minZ || 1;
        const normZ = zData.map(row => row.map(v => (v - minZ) / range));

        // --- 2. Beam Profile (0-180) ---
        const beamAngles = [];
        const beamMags = [];

        // Calculate Far Field Pattern
        for(let deg=0; deg<=180; deg++) {
            const rad = (deg * Math.PI) / 180;
            let real = 0, imag = 0;

            for(let i=0; i<this.antennas.length; i++) {
                const ant = this.antennas[i];
                const k = (2 * Math.PI * ant.freq) / speed;

                // Project position onto angle direction (Standard Array Factor)
                const phase_geom = k * (ant.x * Math.cos(rad) + ant.y * Math.sin(rad));
                const phase_delay = -i * delayRad;
                const scale = ant.freq / maxFreq;

                real += scale * Math.cos(phase_geom + phase_delay);
                imag += scale * Math.sin(phase_geom + phase_delay);
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

        // 1. Update Heatmap Surface & Axes Ranges
        const axisUpdate = {
            'xaxis.range': [-this.config.extentX, this.config.extentX],
            'yaxis.range': [0, this.config.extentY]
        };
        Plotly.relayout(this.heatmapDiv, axisUpdate);

        Plotly.react(this.heatmapDiv, [{
            z: data.z,
            x: this.xGrid,
            y: this.yGrid,
            type: 'heatmap',
            colorscale: document.getElementById('colormapSelect').value,
            zsmooth: 'best',
            showscale: true,
            colorbar: { tickfont: {color:'#ff9000'}, thickness: 10, title: 'dB' }
        }, {
            // 2. Update Antenna Markers Trace (The Circles)
            x: this.antennas.map(a => a.x),
            y: this.antennas.map(a => a.y),
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#00ff90', size: 10, line: {color: 'black', width: 1} },
            name: 'Antennas',
            hoverinfo: 'x+y'
        }], this.heatmapDiv.layout);

        // 3. Update Polar
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
        // Global Config Sliders (Trigger Reset)
        const bindGlobal = (id, key, isFloat) => {
            document.getElementById(id).addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                this.config[key] = val;
                document.getElementById(id+'Value').innerText = val + (id === 'delay' ? '°' : '');

                if(id === 'numElements') {
                    this.resetAntennas();
                    this.refreshUI();
                } else if (id === 'distance' || id === 'curvature') {
                    // Re-calculate basic formation positions
                    this.resetAntennas();
                    // Don't need full refreshUI, just update sliders if selection didn't change
                    this.updatePositionSliders();
                }
                this.updatePlots();
            });
        };

        bindGlobal('numElements', 'numAntennas', false);
        bindGlobal('distance', 'distance', true);
        bindGlobal('curvature', 'curvature', true);
        bindGlobal('delay', 'delayDeg', false);

        document.getElementById('geometry').addEventListener('change', (e) => {
            this.config.geometry = e.target.value;
            document.getElementById('curvatureGroup').style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';
            this.resetAntennas();
            this.refreshUI();
            this.updatePlots();
        });

        // Individual Antenna Controls
        document.getElementById('antennaSelect').addEventListener('change', (e) => {
            this.selectedAntennaIndex = parseInt(e.target.value);
            this.updatePositionSliders();
        });

        // Manual Position Sliders (X/Y) - Update specific antenna instantly
        const bindPos = (axis) => {
            document.getElementById(`ant${axis}`).addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                // Update Model
                this.antennas[this.selectedAntennaIndex][axis.toLowerCase()] = val;
                // Update UI Label
                document.getElementById(`ant${axis}Value`).innerText = val.toFixed(2);
                // Update Plots (Real-time marker movement)
                this.updatePlots();
            });
        };
        bindPos('X');
        bindPos('Y');

        // Misc
        document.getElementById('colormapSelect').addEventListener('change', () => this.updatePlots());
    }

    loadScenario(type) {
        // Mode-Specific Settings: Range, Speed, Grid Scale
        if(type === '5g') {
            this.config.speed = 3e8; // Light
            this.freqLimits = { min: 1e9, max: 10e9, step: 1e8 }; // 1-10 GHz
            this.config.extentX = 10; this.config.extentY = 20; // Meters

            // Preset Values
            this.config.numAntennas = 8;
            this.config.distance = 0.5;
            this.config.geometry = 'Linear';
            this.config.delayDeg = 30;

        } else if (type === 'tumor') {
            this.config.speed = 3e8;
            this.freqLimits = { min: 1e8, max: 5e9, step: 1e8 }; // 100MHz - 5GHz
            this.config.extentX = 2; this.config.extentY = 4; // Zoom in (2m box)

            this.config.numAntennas = 16;
            this.config.distance = 0.1;
            this.config.geometry = 'Curved';
            this.config.curvature = 1.5;
            this.config.delayDeg = 0;

        } else if (type === 'ultrasound') {
            this.config.speed = 1540; // Sound
            this.freqLimits = { min: 1e5, max: 1e7, step: 1e5 }; // 100kHz - 10MHz
            this.config.extentX = 0.2; this.config.extentY = 0.4; // Zoom in (20cm box)

            this.config.numAntennas = 32;
            this.config.distance = 0.005; // 5mm
            this.config.geometry = 'Linear';
            this.config.delayDeg = 0;
        }

        // Apply UI Updates
        document.getElementById('numElements').value = this.config.numAntennas;
        document.getElementById('distance').value = this.config.distance;
        document.getElementById('geometry').value = this.config.geometry;
        document.getElementById('curvature').value = this.config.curvature;
        document.getElementById('delay').value = this.config.delayDeg;

        document.getElementById('curvatureGroup').style.display =
            (this.config.geometry === 'Curved') ? 'block' : 'none';

        // Re-generate grid based on new extent
        this.setupCoordinates();

        // Reset and Draw
        this.resetAntennas();
        this.refreshUI();
        this.updatePlots();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});