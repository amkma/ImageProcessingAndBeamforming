/**
 * Beamforming Simulator - Plotly.js Implementation
 * Features:
 * - Logarithmic Heatmap (Waves Sum)
 * - Half-Circle Polar Plot (0-180 deg)
 * - Frequency Scaling
 * - Real-time animation
 */

class BeamformingSimulator {
    constructor() {
        // Core Configuration (matches Python logic)
        this.config = {
            numAntennas: 10,
            distance: 2.0,       // Distance between antennas (m)
            delayDeg: 0,         // Phase delay (degrees)
            speed: 343,          // Propagation speed (m/s) - Default to sound for demo, adjustable
            frequencies: new Array(32).fill(99.99), // Individual antenna frequencies
            geometry: 'Linear',  // 'Linear', 'Curved'
            curvature: 0.5,
            gridSize: 150,       // Heatmap resolution
            extent: 10           // Heatmap physical extent (-10 to 10)
        };

        this.isRunning = true;
        this.time = 0;           // Animation time step
        this.simSpeed = 0.5;     // Simulation speed factor

        // DOM References
        this.heatmapDiv = document.getElementById('heatmapPlot');
        this.profileDiv = document.getElementById('beamProfilePlot');

        this.init();
    }

    init() {
        this.setupCoordinates();
        this.initPlots();
        this.setupDynamicInputs(); // Generate frequency inputs
        this.attachEventListeners();
        this.startLoop();
    }

    setupCoordinates() {
        // Pre-compute grid for Heatmap
        const size = this.config.gridSize;
        const ext = this.config.extent;

        this.xGrid = new Float32Array(size);
        this.yGrid = new Float32Array(size);

        // Linspace logic: x from -10 to 10, y from 0 to 20
        for(let i=0; i<size; i++) {
            this.xGrid[i] = -ext + (i / (size - 1)) * (2 * ext);
            this.yGrid[i] = 0 + (i / (size - 1)) * 20;
        }
    }

    initPlots() {
        // --- 1. Heatmap Layout ---
        const heatmapLayout = {
            margin: { t: 30, b: 40, l: 50, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            title: { text: '', font: {color: '#fff'} },
            xaxis: {
                title: 'Cross-Range (m)', color: '#ff9000',
                showgrid: false, zeroline: false
            },
            yaxis: {
                title: 'Range (m)', color: '#ff9000',
                showgrid: false, zeroline: false
            },
            font: { family: 'Inter, sans-serif' }
        };

        // Initialize with dummy data
        Plotly.newPlot(this.heatmapDiv, [{
            z: [[0]],
            type: 'heatmap',
            colorscale: 'Jet',
            zmin: 0, zmax: 1,
            colorbar: {
                title: 'Intensity',
                tickfont: {color: '#ff9000'},
                titlefont: {color: '#ff9000'}
            }
        }], heatmapLayout, {responsive: true, displayModeBar: false});

        // --- 2. Beam Profile Layout (Half Circle) ---
        const polarLayout = {
            margin: { t: 30, b: 30, l: 40, r: 40 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#ff9000', family: 'Inter, sans-serif' },
            polar: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                sector: [0, 180], // SHOW UPPER HALF ONLY
                radialaxis: {
                    visible: true,
                    showticklabels: false,
                    gridcolor: '#333'
                },
                angularaxis: {
                    rotation: 0, // 0 degrees at 3 o'clock (standard math)
                    direction: "counterclockwise",
                    gridcolor: '#333',
                    tickcolor: '#ff9000',
                    tickmode: 'array',
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
            line: { color: '#ff9000', width: 3, shape: 'spline' },
            fillcolor: 'rgba(255, 144, 0, 0.2)'
        }], polarLayout, {responsive: true, displayModeBar: false});
    }

    /**
     * Calculate Antenna Positions (X, Y)
     * Mirrors Python: self.y_positions calculations based on geometry
     */
    calculateAntennaPositions() {
        const N = this.config.numAntennas;
        const d = this.config.distance; // meters

        // Use max freq to approximate wavelength for spacing logic if needed,
        // or strictly follow python: dist_lambda = (1/distance_m) * wavelength?
        // The python code says: distance_lambda = (1 / distance_m) * wavelength
        // This implies spacing changes with frequency.
        // For simulation stability, let's calculate positions in physical meters relative to spacing.

        const positions = [];
        const totalWidth = (N - 1) * d;

        for(let i=0; i<N; i++) {
            // Centered around 0
            const x = -totalWidth/2 + i * d;
            let y = 0;

            if(this.config.geometry === 'Curved') {
                // Quadratic curve: y = 0.01*maxY + curvature * x^2
                // Simplified for visualization scaling:
                y = 0.5 + this.config.curvature * (x * x * 0.1);
            }

            positions.push({ x: x, y: y });
        }
        return positions;
    }

    /**
     * Physics Loop: Heatmap & Beam Profile
     */
    computePhysics() {
        const antennas = this.calculateAntennaPositions();
        const N = this.config.numAntennas;
        const frequencies = this.config.frequencies;
        const maxFreq = Math.max(...frequencies.slice(0, N));
        const delayRad = (this.config.delayDeg * Math.PI) / 180;
        const speed = this.config.speed;

        // --- 1. HEATMAP CALCULATION (Logarithmic + Normalization) ---
        const size = this.config.gridSize;
        const zData = []; // Rows

        // Time evolution factor
        this.time += this.simSpeed;

        for(let r=0; r<size; r++) { // y rows
            const yPos = this.yGrid[r];
            const rowData = [];

            for(let c=0; c<size; c++) { // x cols
                const xPos = this.xGrid[c];
                let waveSum = 0;

                for(let i=0; i<N; i++) {
                    const ant = antennas[i];
                    const freq = frequencies[i];
                    const wavelength = speed / freq;
                    const k = 2 * Math.PI / wavelength;

                    // Distance
                    const R = Math.sqrt((xPos - ant.x)**2 + (yPos - ant.y)**2);

                    // Phase Delay: -i * delay_rad
                    const phaseDelay = -i * delayRad;

                    // Frequency Scaling
                    const freqScale = freq / maxFreq;

                    // Wave calculation with time component: sin(kR + phase - wt)
                    // Adding time makes the waves move visually
                    waveSum += freqScale * Math.sin(k * R + phaseDelay - this.time);
                }

                // Logarithmic Scaling: log1p(abs(sum))
                let val = Math.log1p(Math.abs(waveSum));
                rowData.push(val);
            }
            zData.push(rowData);
        }

        // Normalize Z Data to 0-1
        let minZ = Infinity, maxZ = -Infinity;
        for(let r=0; r<size; r++) {
            for(let c=0; c<size; c++) {
                if(zData[r][c] < minZ) minZ = zData[r][c];
                if(zData[r][c] > maxZ) maxZ = zData[r][c];
            }
        }
        const range = maxZ - minZ || 1;
        const normZ = zData.map(row => row.map(v => (v - minZ) / range));


        // --- 2. BEAM PROFILE CALCULATION (Polar 0-180) ---
        const beamAngles = []; // Theta
        const beamMags = [];   // R
        const numPoints = 180; // 1 degree steps

        for(let angleIdx = 0; angleIdx <= numPoints; angleIdx++) {
            const deg = angleIdx; // 0 to 180
            const azimuthRad = (deg * Math.PI) / 180; // Theta

            let realSum = 0;
            let imagSum = 0;

            for(let i=0; i<N; i++) {
                const ant = antennas[i];
                const freq = frequencies[i];
                const wavelength = speed / freq;
                const k = 2 * Math.PI / wavelength;

                // Polar conversion of antenna pos
                const r_ant = Math.sqrt(ant.x**2 + ant.y**2);
                const theta_ant = Math.atan2(ant.y, ant.x);

                const phase_i = -i * delayRad;

                // Phase Term: -k * (f_i/f_max) * r * cos(azimuth - theta_ant) + phase
                // Note: Python used f_i / f_max scaling inside the phase term
                const phaseTerm = -k * (freq/maxFreq) * r_ant * Math.cos(azimuthRad - theta_ant) + phase_i;

                realSum += Math.cos(phaseTerm);
                imagSum += Math.sin(phaseTerm);
            }

            const magnitude = Math.sqrt(realSum**2 + imagSum**2);

            beamAngles.push(deg);
            beamMags.push(magnitude);
        }

        // Normalize Beam Profile (Optional, for better visual fit)
        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { z: normZ, beamTheta: beamAngles, beamR: normBeam };
    }

    startLoop() {
        const update = () => {
            if(!this.isRunning) {
                requestAnimationFrame(update);
                return;
            }

            const data = this.computePhysics();

            // Efficient Plotly Updates
            Plotly.react(this.heatmapDiv, [{
                z: data.z,
                type: 'heatmap',
                colorscale: document.getElementById('colormapSelect').value,
                zsmooth: 'best',
                showscale: true,
                colorbar: {
                    title: 'Intensity',
                    tickcolor: '#ff9000',
                    tickfont: {color: '#ff9000'},
                    titlefont: {color: '#ff9000'}
                }
            }], this.heatmapDiv.layout);

            Plotly.react(this.profileDiv, [{
                type: 'scatterpolar',
                mode: 'lines',
                fill: 'toself',
                r: data.beamR,
                theta: data.beamTheta,
                line: { color: '#ff9000', width: 3, shape: 'spline' },
                fillcolor: 'rgba(255, 144, 0, 0.2)'
            }], this.profileDiv.layout);

            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // --- UI Logic ---

    setupDynamicInputs() {
        const container = document.getElementById('freqContainer');
        container.innerHTML = '';

        for(let i=0; i<this.config.numAntennas; i++) {
            const div = document.createElement('div');
            div.className = 'd-flex align-items-center mb-2';
            div.innerHTML = `
                <small class="text-secondary me-2" style="width: 80px">Antenna ${i+1}</small>
                <input type="number" class="form-control form-control-custom form-control-sm freq-input" 
                       data-index="${i}" value="${this.config.frequencies[i]}">
            `;
            container.appendChild(div);
        }

        // Attach listeners to new inputs
        document.querySelectorAll('.freq-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.config.frequencies[idx] = parseFloat(e.target.value);
            });
        });
    }

    attachEventListeners() {
        // Sliders
        const bindSlider = (id, key, isFloat=false) => {
            const el = document.getElementById(id);
            const disp = document.getElementById(id + 'Value');
            el.addEventListener('input', (e) => {
                let val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                this.config[key] = val;
                if(disp) disp.innerText = val + (id === 'delay' ? '°' : '');

                // Specific updates
                if(id === 'numElements') this.setupDynamicInputs();
            });
        };

        bindSlider('numElements', 'numAntennas');
        bindSlider('distance', 'distance', true);
        bindSlider('delay', 'delayDeg');
        bindSlider('curvature', 'curvature', true);
        bindSlider('simSpeed', 'simSpeed', true); // Visual speed only

        // Selects
        document.getElementById('geometry').addEventListener('change', (e) => {
            this.config.geometry = e.target.value;
            document.getElementById('curvatureGroup').style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';
        });

        // Speed adjustment logic
        document.getElementById('simSpeed').addEventListener('input', (e) => {
            this.simSpeed = parseInt(e.target.value) / 100;
        });

        // Play/Pause
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.isRunning = !this.isRunning;
            const icon = document.querySelector('#playPauseBtn i');
            icon.className = this.isRunning ? 'fas fa-pause' : 'fas fa-play';
        });

        // Window Resize
        window.addEventListener('resize', () => {
            Plotly.Plots.resize(this.heatmapDiv);
            Plotly.Plots.resize(this.profileDiv);
        });
    }

    loadScenario(type) {
        if(type === '5g') {
            this.updateControl('numElements', 8);
            this.updateControl('distance', 0.5);
            this.config.geometry = 'Linear';
            this.updateControl('delay', 30);
        } else if (type === 'tumor') {
            this.updateControl('numElements', 16);
            this.updateControl('distance', 0.1);
            this.config.geometry = 'Curved';
            this.updateControl('curvature', 1.5);
        }

        // Reflect geometry in UI
        document.getElementById('geometry').value = this.config.geometry;
        document.getElementById('curvatureGroup').style.display =
            (this.config.geometry === 'Curved') ? 'block' : 'none';
    }

    updateControl(id, value) {
        const el = document.getElementById(id);
        el.value = value;
        el.dispatchEvent(new Event('input'));
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});