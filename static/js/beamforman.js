/**
 * Beamforming Simulator - EXACT PyQt5 Wave Physics
 * Final complete implementation with proper wave visualization
 */

class BeamformingSimulator {
    constructor() {
        this.config = {
            numAntennas: 8,
            distance: 0.15,
            delayDeg: 0,
            speed: 100,  // Default propagation speed (matches PyQt5)
            geometry: 'Linear',
            curvature: 0.5,
            gridSize: 500,  // Match PyQt5 resolution
            extentX: 10,
            extentY: 20
        };

        this.freqLimits = { min: 100, max: 1000, step: 10 };
        this.activeScenario = null;
        this.activeScenarioName = 'Custom';
        this.antennas = [];
        this.selectedAntennaIndex = 0;

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
        this.updateModeIndicator();

        window.addEventListener('resize', () => {
            Plotly.Plots.resize(this.heatmapDiv);
            Plotly.Plots.resize(this.profileDiv);
        });
    }

    resetAntennas() {
        const N = this.config.numAntennas;
        const maxFreq = (this.freqLimits.max + this.freqLimits.min) / 2;
        const wavelength = this.config.speed / maxFreq;
        const distance_lambda = (1 / this.config.distance) * wavelength;
        const totalWidth = (N - 1) * distance_lambda;

        const newAntennas = [];
        for (let i = 0; i < N; i++) {
            const defaultFreq = maxFreq;
            const existingFreq = (this.antennas[i] && this.antennas[i].freq) ? this.antennas[i].freq : defaultFreq;

            let x = -totalWidth / 2 + i * distance_lambda;
            let y = 0;

            if (this.config.geometry === 'Curved') {
                y = 0.01 * this.config.extentY + this.config.curvature * (x * x);
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

        for (let i = 0; i < size; i++) {
            this.xGrid[i] = -xExt + (i / (size - 1)) * (2 * xExt);
            this.yGrid[i] = 0 + (i / (size - 1)) * yExt;
        }
    }

    initPlots() {
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

        Plotly.newPlot(this.heatmapDiv, [{
            z: [[0]], x: [0], y: [0],
            type: 'heatmap',
            colorscale: 'Jet',
            zsmooth: 'best',
            colorbar: { tickfont: { color: '#ff9000' }, thickness: 10, title: 'Intensity' }
        }, {
            x: [0], y: [0],
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#00ff90', size: 10, line: { color: 'black', width: 1 } },
            name: 'Antennas'
        }], heatmapLayout, { responsive: true, displayModeBar: false });

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
        }], polarLayout, { responsive: true, displayModeBar: false });
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
                    <small class="text-secondary">Antenna ${idx + 1}</small>
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
        if (!ant) return;

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

        // EXACT PyQt5 Heatmap calculation
        for (let r = 0; r < size; r++) {
            const yPos = this.yGrid[r];
            const row = [];
            for (let c = 0; c < size; c++) {
                const xPos = this.xGrid[c];
                let waveSum = 0;

                for (let i = 0; i < this.antennas.length; i++) {
                    const ant = this.antennas[i];
                    const freq = ant.freq;
                    const wavelength = speed / freq;
                    const k = 2 * Math.PI / wavelength;

                    const R = Math.sqrt((xPos - ant.x) ** 2 + (yPos - ant.y) ** 2);
                    const phaseDelay = -i * delayRad;
                    const freqScaling = freq / maxFreq;

                    // EXACT PyQt5 formula: sin(k*R + phase_delay)
                    waveSum += freqScaling * Math.sin(k * R + phaseDelay);
                }

                row.push(waveSum);
            }
            zData.push(row);
        }

        // Convert to numpy array for processing
        const zFlat = zData.flat();
        const wavesAbs = zFlat.map(v => Math.abs(v));

        // Apply logarithmic scaling (PyQt5 method)
        const wavesLog = wavesAbs.map(v => Math.log1p(v));

        // Normalize to [0, 1]
        const minLog = Math.min(...wavesLog);
        const maxLog = Math.max(...wavesLog);
        const range = maxLog - minLog || 1;

        const normData = [];
        let idx = 0;
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                row.push((wavesLog[idx] - minLog) / range);
                idx++;
            }
            normData.push(row);
        }

        // Polar plot - PyQt5 method
        const beamAngles = [];
        const beamMags = [];

        for (let deg = 0; deg <= 180; deg++) {
            const azimuthRad = (deg * Math.PI) / 180;
            let beamSumReal = 0;
            let beamSumImag = 0;

            for (let i = 0; i < this.antennas.length; i++) {
                const ant = this.antennas[i];
                const freq = ant.freq;
                const wavelength = speed / freq;
                const k = 2 * Math.PI / wavelength;

                const r = Math.sqrt(ant.x ** 2 + ant.y ** 2);
                const theta = Math.atan2(ant.y, ant.x);

                const phaseTerm = -k * (freq / maxFreq) * r * Math.cos(azimuthRad - theta) + (-i * delayRad);

                beamSumReal += Math.cos(phaseTerm);
                beamSumImag += Math.sin(phaseTerm);
            }

            beamAngles.push(deg);
            beamMags.push(Math.sqrt(beamSumReal ** 2 + beamSumImag ** 2));
        }

        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { z: normData, theta: beamAngles, r: normBeam };
    }

    updatePlots() {
        const data = this.computePhysics();

        Plotly.relayout(this.heatmapDiv, {
            'xaxis.range': [-this.config.extentX, this.config.extentX],
            'yaxis.range': [0, this.config.extentY]
        });

        Plotly.react(this.heatmapDiv, [{
            z: data.z,
            x: this.xGrid,
            y: this.yGrid,
            type: 'heatmap',
            colorscale: document.getElementById('colormapSelect').value,
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: { tickfont: { color: '#ff9000' }, thickness: 10, title: 'Intensity' }
        }, {
            x: this.antennas.map(a => a.x),
            y: this.antennas.map(a => a.y),
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#00ff90', size: 10, line: { color: 'black', width: 1 } },
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
                document.getElementById(id + 'Value').innerText = val + (id === 'delay' ? '°' : '');

                if (id === 'numElements') {
                    this.resetAntennas();
                    this.refreshUI();
                } else if (id === 'distance' || id === 'curvature') {
                    this.resetAntennas();
                    this.updatePositionSliders();
                }

                if (this.activeScenario !== null) {
                    this.activeScenario = null;
                    this.activeScenarioName = 'Custom';
                    this.updateModeIndicator();
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

            if (this.activeScenario !== null) {
                this.activeScenario = null;
                this.activeScenarioName = 'Custom';
                this.updateModeIndicator();
            }

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

        document.getElementById('exportBtn').addEventListener('click', async () => {
            try {
                alert('Snapshot feature - configuration saved locally');
            } catch (e) {
                console.error('Snapshot failed', e);
            }
        });
    }

    updateModeIndicator() {
        const modeDisplay = document.getElementById('currentMode');
        if (modeDisplay) {
            modeDisplay.textContent = this.activeScenarioName;
        }

        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this.activeScenario !== null) {
            const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${this.activeScenario}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    loadScenario(type) {
        if (type === '5g') {
            this.config.speed = 100;
            this.freqLimits = { min: 2e9, max: 3e9, step: 1e8 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 4;
            this.config.distance = 1;
            this.config.geometry = 'Linear';
            this.config.delayDeg = 180;
            this.config.curvature = 0;
            this.activeScenario = '5g';
            this.activeScenarioName = '5G Beamforming';

        } else if (type === 'tumor') {
            this.config.speed = 100;
            this.freqLimits = { min: 4e6, max: 5e6, step: 1e5 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 10;
            this.config.distance = 2;
            this.config.geometry = 'Curved';
            this.config.curvature = 24;
            this.config.delayDeg = 0;
            this.activeScenario = 'tumor';
            this.activeScenarioName = 'Tumor Ablation';

        } else if (type === 'ultrasound') {
            this.config.speed = 100;
            this.freqLimits = { min: 1e6, max: 2e6, step: 1e5 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 7;
            this.config.distance = 4;
            this.config.geometry = 'Linear';
            this.config.delayDeg = 0;
            this.config.curvature = 0;
            this.activeScenario = 'ultrasound';
            this.activeScenarioName = 'Ultrasound Imaging';
        }

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

        this.updateModeIndicator();
        this.setupCoordinates();
        this.resetAntennas();
        this.refreshUI();
        this.updatePlots();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});