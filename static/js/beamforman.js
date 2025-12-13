/**
 * Beamforming Simulator - Fixed Edition
 * Features:
 * - Active scenario highlighting
 * - Synchronized controller and graph updates
 * - Consistent beam steering in both visualizations
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

        // Track active scenario
        this.activeScenario = null;

        // State for individual antenna properties
        this.antennas = [];

        // UI State
        this.selectedAntennaIndex = 0;

        // DOM Elements
        this.heatmapDiv = document.getElementById('heatmapPlot');
        this.profileDiv = document.getElementById('beamProfilePlot');

        this.init();
    }

    init() {
        this.resetAntennas();
        this.setupCoordinates();
        this.initPlots();
        this.refreshUI();
        this.attachEventListeners();
        this.updatePlots();

        // Responsive resize
        window.addEventListener('resize', () => {
            Plotly.Plots.resize(this.heatmapDiv);
            Plotly.Plots.resize(this.profileDiv);
        });
    }

    resetAntennas() {
        const N = this.config.numAntennas;
        const d = this.config.distance;
        const totalWidth = (N - 1) * d;

        const newAntennas = [];
        for (let i = 0; i < N; i++) {
            const defaultFreq = (this.freqLimits.max + this.freqLimits.min) / 2;
            const existingFreq = (this.antennas[i] && this.antennas[i].freq) ? this.antennas[i].freq : defaultFreq;

            let x = -totalWidth/2 + i * d;
            let y = 0;

            if (this.config.geometry === 'Curved') {
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

        const traceHeatmap = {
            z: [[0]], x: [0], y: [0],
            type: 'heatmap',
            colorscale: 'Jet',
            zsmooth: 'best',
            colorbar: { tickfont: {color:'#ff9000'}, thickness: 10, title: 'dB' }
        };

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

    refreshUI() {
        const select = document.getElementById('antennaSelect');
        select.innerHTML = '';
        this.antennas.forEach((ant, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.text = `Antenna ${idx + 1}`;
            select.appendChild(opt);
        });

        if (this.selectedAntennaIndex >= this.antennas.length) {
            this.selectedAntennaIndex = 0;
        }
        select.value = this.selectedAntennaIndex;

        this.updatePositionSliders();

        const freqContainer = document.getElementById('freqContainer');
        freqContainer.innerHTML = '';

        this.antennas.forEach((ant, idx) => {
            const div = document.createElement('div');
            div.className = 'freq-row';
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

        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                this.antennas[idx].freq = val;
                document.getElementById(`freqVal${idx}`).innerText = val.toExponential(2);
                this.updatePlots();
            });
        });

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

    computePhysics() {
        const speed = this.config.speed;
        const size = this.config.gridSize;
        const delayRad = (this.config.delayDeg * Math.PI) / 180;
        const maxFreq = Math.max(...this.antennas.map(a => a.freq));

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

                    // FIXED: Use consistent phase delay formula
                    const phaseDelay = i * delayRad;
                    const scale = ant.freq / maxFreq;

                    waveSum += scale * Math.cos(k * R + phaseDelay);
                }

                const val = Math.log1p(Math.abs(waveSum));
                if(val < minZ) minZ = val;
                if(val > maxZ) maxZ = val;
                row.push(val);
            }
            zData.push(row);
        }

        const range = maxZ - minZ || 1;
        const normZ = zData.map(row => row.map(v => (v - minZ) / range));

        const beamAngles = [];
        const beamMags = [];

        for(let deg=0; deg<=180; deg++) {
            const rad = (deg * Math.PI) / 180;
            let real = 0, imag = 0;

            for(let i=0; i<this.antennas.length; i++) {
                const ant = this.antennas[i];
                const k = (2 * Math.PI * ant.freq) / speed;

                const phase_geom = k * (ant.x * Math.cos(rad) + ant.y * Math.sin(rad));
                // FIXED: Use same sign convention as heatmap
                const phase_delay = i * delayRad;
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
            x: this.antennas.map(a => a.x),
            y: this.antennas.map(a => a.y),
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#00ff90', size: 10, line: {color: 'black', width: 1} },
            name: 'Antennas',
            hoverinfo: 'x+y'
        }], this.heatmapDiv.layout);

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
        const bindGlobal = (id, key, isFloat) => {
            document.getElementById(id).addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                this.config[key] = val;
                document.getElementById(id+'Value').innerText = val + (id === 'delay' ? '°' : '');

                if(id === 'numElements') {
                    this.resetAntennas();
                    this.refreshUI();
                } else if (id === 'distance' || id === 'curvature') {
                    this.resetAntennas();
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

        document.getElementById('antennaSelect').addEventListener('change', (e) => {
            this.selectedAntennaIndex = parseInt(e.target.value);
            this.updatePositionSliders();
        });

        const bindPos = (axis) => {
            document.getElementById(`ant${axis}`).addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.antennas[this.selectedAntennaIndex][axis.toLowerCase()] = val;
                document.getElementById(`ant${axis}Value`).innerText = val.toFixed(2);
                this.updatePlots();
            });
        };
        bindPos('X');
        bindPos('Y');

        document.getElementById('colormapSelect').addEventListener('change', () => this.updatePlots());

        // Snapshot Button
        document.getElementById('exportBtn').addEventListener('click', async () => {
            try {
                const payload = {
                    action: 'quick_save',
                    name: 'Snapshot ' + new Date().toLocaleTimeString(),
                    array_id: 0,
                    elements: this.antennas.map((ant, idx) => ({
                        index: idx,
                        position_x: ant.x,
                        position_y: ant.y,
                        frequency: ant.freq
                    }))
                };

                await fetch('/api/beamforming/update/', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        action: 'update_array',
                        array_id: 0,
                        num_elements: this.config.numAntennas,
                        frequency: this.freqLimits.max,
                        elements: payload.elements
                    })
                });

                const response = await fetch('/api/beamforming/quick/', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if(data.success) {
                    alert('Snapshot saved to backend: ' + data.save_name);
                }
            } catch(e) {
                console.error('Snapshot failed', e);
            }
        });
    }

    // FIXED: Update active button and sync all controls/graphs
    setActiveScenario(scenarioName) {
        // Remove active class from all buttons
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked button
        const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${scenarioName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        this.activeScenario = scenarioName;
    }

    // FIXED: Properly update all controls and graphs when loading scenario
    loadScenario(type) {
        if(type === '5g') {
            this.config.speed = 3e8;
            this.freqLimits = { min: 1e9, max: 10e9, step: 1e8 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 8;
            this.config.distance = 0.5;
            this.config.geometry = 'Linear';
            this.config.delayDeg = 30;

        } else if (type === 'tumor') {
            this.config.speed = 3e8;
            this.freqLimits = { min: 1e8, max: 5e9, step: 1e8 };
            this.config.extentX = 2;
            this.config.extentY = 4;
            this.config.numAntennas = 16;
            this.config.distance = 0.1;
            this.config.geometry = 'Curved';
            this.config.curvature = 1.5;
            this.config.delayDeg = 0;

        } else if (type === 'ultrasound') {
            this.config.speed = 1540;
            this.freqLimits = { min: 1e5, max: 1e7, step: 1e5 };
            this.config.extentX = 0.2;
            this.config.extentY = 0.4;
            this.config.numAntennas = 32;
            this.config.distance = 0.005;
            this.config.geometry = 'Linear';
            this.config.delayDeg = 0;
        }

        // FIXED: Update all UI controls to match scenario values
        document.getElementById('numElements').value = this.config.numAntennas;
        document.getElementById('numElementsValue').textContent = this.config.numAntennas;

        document.getElementById('distance').value = this.config.distance;
        document.getElementById('distanceValue').textContent = this.config.distance;

        document.getElementById('geometry').value = this.config.geometry;

        document.getElementById('curvature').value = this.config.curvature;
        document.getElementById('curvatureValue').textContent = this.config.curvature;

        document.getElementById('delay').value = this.config.delayDeg;
        document.getElementById('delayValue').textContent = this.config.delayDeg + '°';

        document.getElementById('curvatureGroup').style.display =
            (this.config.geometry === 'Curved') ? 'block' : 'none';

        // FIXED: Mark this scenario as active
        this.setActiveScenario(type);

        // Recalculate everything
        this.setupCoordinates();
        this.resetAntennas();
        this.refreshUI();
        this.updatePlots();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});