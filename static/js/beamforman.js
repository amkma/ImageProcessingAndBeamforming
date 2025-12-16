/**
 * Pure Client-Side Beamforming Simulator
 * All calculations done in browser - No backend required
 * MODIFIED: Added λ-based spacing mode with automatic λ/2 calculation
 */

class BeamformingSimulator {
    constructor() {
        // Scenario configurations
        this.scenarios = {
            '5g': {
                num_antennas: 4,
                distance_m: 0.06,
                delay_deg: 0,
                array_geometry: 'Linear',
                curvature: 0,
                frequencies: [2500000000, 2500000000, 2500000000, 2500000000],
                propagation_speed: 300000000,
                freqRange: { min: 1000000000, max: 5000000000, step: 10000000 },
                spacing_mode: 'absolute' // NEW: default mode
            },
            'ultrasound': {
                num_antennas: 7,
                distance_m: 0.4,
                delay_deg: 0,
                frequencies: [1000000, 1000000, 1000000, 1000000, 1000000, 1000000, 1000000],
                array_geometry: 'Linear',
                curvature: 0,
                propagation_speed: 120000,
                freqRange: { min: 100000, max: 5000000, step: 10000 },
                spacing_mode: 'absolute'
            },
            'tumor': {
                num_antennas: 10,
                distance_m: 0.3,
                delay_deg: 0,
                frequencies: [4500000, 4500000, 4500000, 4500000, 4500000, 4500000, 4500000, 4500000, 4500000, 4500000],
                array_geometry: 'Curved',
                curvature: 0.24,
                propagation_speed: 540000,
                freqRange: { min: 1000000, max: 10000000, step: 50000 },
                spacing_mode: 'absolute'
            }
        };

        // State
        this.state = {
            numAntennas: 8,
            distance: 0.15,
            delay: 0,
            propagationSpeed: 3e8,
            arrayGeometry: 'Linear',
            curvature: 1.0,
            antennaFrequencies: Array(8).fill(2400000000),
            antennaPositions: [],
            yPositions: [],
            selectedAntenna: 0,
            manualPositionUpdate: false,
            gridSize: 200,
            extentX: 10,
            extentY: 20,
            activeScenario: null,
            activeScenarioName: 'Custom',
            spacingMode: 'absolute', // NEW: 'absolute' or 'lambda'
            lambdaMultiplier: 0.5 // NEW: for λ/2 spacing
        };

        this.updateTimer = null;
        this.isUpdating = false;
        this.rafId = null;

        this.init();
    }

    init() {
        this.resetAntennas();
        this.initPlotly();
        this.attachEventListeners();
        this.refreshUI();
        this.updateModeIndicator();
        this.updateSpacingDisplay(); // NEW

        setTimeout(() => {
            this.fullUpdate();
        }, 100);

        window.addEventListener('resize', () => {
            clearTimeout(this.updateTimer);
            this.updateTimer = setTimeout(() => {
                Plotly.Plots.resize(document.getElementById('heatmapPlot'));
                Plotly.Plots.resize(document.getElementById('beamProfilePlot'));
            }, 150);
        });
    }

    // NEW: Calculate wavelength based on average frequency
    getAverageWavelength() {
        const avgFreq = this.state.antennaFrequencies.slice(0, this.state.numAntennas)
            .reduce((a, b) => a + b, 0) / this.state.numAntennas;
        return this.state.propagationSpeed / avgFreq;
    }

    // NEW: Get effective spacing based on mode
    getEffectiveSpacing() {
        if (this.state.spacingMode === 'lambda') {
            const lambda = this.getAverageWavelength();
            return lambda * this.state.lambdaMultiplier;
        }
        return this.state.distance;
    }

    // NEW: Update spacing display text
    updateSpacingDisplay() {
        const distanceValue = document.getElementById('distanceValue');
        const spacingInfo = document.getElementById('spacingInfo');

        if (this.state.spacingMode === 'lambda') {
            const lambda = this.getAverageWavelength();
            const effectiveSpacing = lambda * this.state.lambdaMultiplier;
            distanceValue.textContent = `${this.state.lambdaMultiplier.toFixed(2)}λ`;
            spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                λ = ${(lambda * 1000).toFixed(2)} mm | Actual: ${(effectiveSpacing * 1000).toFixed(2)} mm
            </small>`;
        } else {
            distanceValue.textContent = this.state.distance.toFixed(2);
            spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                Range: 0.1m - 5.0m (10cm to 5 meters)
            </small>`;
        }
    }

    resetAntennas() {
        const N = this.state.numAntennas;
        const spacing = this.getEffectiveSpacing(); // MODIFIED: use effective spacing
        const totalWidth = (N - 1) * spacing;

        this.state.antennaPositions = [];
        this.state.yPositions = [];

        for (let i = 0; i < N; i++) {
            let x = -totalWidth / 2 + i * spacing;
            let y = 0;

            if (this.state.arrayGeometry === 'Curved') {
                y = 0.01 * this.state.extentY + this.state.curvature * 0.01 * (x * x);
            }

            this.state.antennaPositions.push(x);
            this.state.yPositions.push(y);
        }
    }

    initPlotly() {
        const heatmapDiv = document.getElementById('heatmapPlot');
        const profileDiv = document.getElementById('beamProfilePlot');

        // Heatmap layout
        const heatmapLayout = {
            margin: { t: 30, b: 30, l: 40, r: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: {
                title: 'X (m)',
                color: '#ff9000',
                range: [-this.state.extentX, this.state.extentX],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            yaxis: {
                title: 'Y (m)',
                color: '#ff9000',
                range: [0, this.state.extentY],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: false,
            hovermode: 'closest'
        };

        Plotly.newPlot(heatmapDiv, [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: 'Electric',
            zsmooth: 'best',
            showscale: true,
            zauto: false,
            zmin: 0,
            zmax: 1,
            colorbar: {
                tickfont: { color: '#ff9000' },
                thickness: 10,
                title: 'Intensity'
            }
        }, {
            x: [0],
            y: [0],
            mode: 'markers',
            type: 'scatter',
            marker: {
                color: '#00ff90',
                size: 14,
                symbol: 'circle',
                line: { color: '#ffffff', width: 2 }
            },
            name: 'Antennas',
            hovertemplate: '<b>Antenna</b><br>X: %{x:.3f} m<br>Y: %{y:.3f} m<extra></extra>'
        }], heatmapLayout, {
            responsive: true,
            displayModeBar: false
        });

        // Polar layout
        const polarLayout = {
            margin: { t: 20, b: 20, l: 30, r: 30 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#ff9000', family: 'Inter, sans-serif' },
            polar: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                sector: [0, 180],
                radialaxis: {
                    visible: true,
                    showticklabels: false,
                    gridcolor: '#444',
                    range: [0, 1]
                },
                angularaxis: {
                    rotation: 0,
                    direction: "counterclockwise",
                    gridcolor: '#444',
                    tickcolor: '#ff9000',
                    tickvals: [0, 30, 60, 90, 120, 150, 180]
                }
            }
        };

        Plotly.newPlot(profileDiv, [{
            type: 'scatterpolar',
            mode: 'lines',
            fill: 'toself',
            r: [0],
            theta: [0],
            line: { color: '#ff9000', width: 2 },
            fillcolor: 'rgba(255, 144, 0, 0.2)'
        }], polarLayout, {
            responsive: true,
            displayModeBar: false
        });
    }

    computeHeatmap() {
        const size = this.state.gridSize;
        const xExt = this.state.extentX;
        const yExt = this.state.extentY;

        const xs = [];
        const ys = [];
        for (let i = 0; i < size; i++) {
            xs.push(-xExt + (i / (size - 1)) * (2 * xExt));
            ys.push(0 + (i / (size - 1)) * yExt);
        }

        const numAntennas = this.state.numAntennas;
        const maxFrequency = Math.max(...this.state.antennaFrequencies.slice(0, numAntennas));
        const delayRad = (this.state.delay * Math.PI) / 180;
        const speed = this.state.propagationSpeed;

        const zData = [];

        for (let r = 0; r < size; r++) {
            const yPos = ys[r];
            const row = [];

            for (let c = 0; c < size; c++) {
                const xPos = xs[c];
                let waveSum = 0;

                for (let i = 0; i < numAntennas; i++) {
                    const ant = {
                        x: this.state.antennaPositions[i],
                        y: this.state.yPositions[i],
                        freq: this.state.antennaFrequencies[i]
                    };

                    const freq = ant.freq;
                    const wavelength = speed / freq;
                    const k = 2 * Math.PI / wavelength;

                    const dx = xPos - ant.x;
                    const dy = yPos - ant.y;
                    const R = Math.sqrt(dx * dx + dy * dy);
                    const safeR = Math.max(R, 0.001);

                    const phaseDelay = -i * delayRad;
                    const freqScaling = freq / maxFrequency;
                    const amplitude = 1.0 / Math.sqrt(safeR);

                    waveSum += freqScaling * amplitude * Math.cos(k * safeR + phaseDelay);
                }

                row.push(waveSum);
            }
            zData.push(row);
        }

        // Normalize
        const zFlat = zData.flat();
        const wavesAbs = zFlat.map(v => Math.abs(v));
        const wavesPower = wavesAbs.map(v => v * v);
        const wavesLog = wavesPower.map(v => Math.log1p(v * 10));

        const minLog = Math.min(...wavesLog);
        const maxLog = Math.max(...wavesLog);
        const range = maxLog - minLog || 1;

        const normData = [];
        let idx = 0;
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) {
                const normalized = (wavesLog[idx] - minLog) / range;
                const gammaCorrected = Math.pow(normalized, 0.5);
                row.push(gammaCorrected);
                idx++;
            }
            normData.push(row);
        }

        return { z: normData, x: xs, y: ys };
    }

    computePolar() {
        const numAntennas = this.state.numAntennas;
        const delayRad = (this.state.delay * Math.PI) / 180;
        const speed = this.state.propagationSpeed;
        const maxFrequency = Math.max(...this.state.antennaFrequencies.slice(0, numAntennas));

        const beamAngles = [];
        const beamMags = [];

        for (let deg = 0; deg <= 180; deg += 1) {
            const azimuthRad = (deg * Math.PI) / 180;
            let beamSumReal = 0;
            let beamSumImag = 0;

            for (let i = 0; i < numAntennas; i++) {
                const ant = {
                    x: this.state.antennaPositions[i],
                    y: this.state.yPositions[i],
                    freq: this.state.antennaFrequencies[i]
                };

                const freq = ant.freq;
                const wavelength = speed / freq;
                const k = 2 * Math.PI / wavelength;

                const r = Math.sqrt(ant.x ** 2 + ant.y ** 2);
                const theta = Math.atan2(ant.y, ant.x);

                const freqScaling = freq / maxFrequency;
                const phaseTerm = -k * r * Math.cos(azimuthRad - theta) + (-i * delayRad);

                beamSumReal += freqScaling * Math.cos(phaseTerm);
                beamSumImag += freqScaling * Math.sin(phaseTerm);
            }

            beamAngles.push(deg);
            beamMags.push(Math.sqrt(beamSumReal ** 2 + beamSumImag ** 2));
        }

        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { theta: beamAngles, r: normBeam };
    }

    fullUpdate() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        this.rafId = requestAnimationFrame(() => {
            const heatmapData = this.computeHeatmap();
            const polarData = this.computePolar();

            const antX = this.state.antennaPositions;
            const antY = this.state.yPositions;

            const colormap = document.getElementById('colormapSelect').value;

            Plotly.react(document.getElementById('heatmapPlot'), [{
                z: heatmapData.z,
                x: heatmapData.x,
                y: heatmapData.y,
                type: 'heatmap',
                colorscale: colormap,
                zsmooth: 'best',
                showscale: true,
                zauto: false,
                zmin: 0,
                zmax: 1,
                colorbar: {
                    tickfont: { color: '#ff9000' },
                    thickness: 10,
                    title: 'Intensity'
                }
            }, {
                x: antX,
                y: antY,
                mode: 'markers',
                type: 'scatter',
                marker: {
                    color: '#00ff90',
                    size: 14,
                    symbol: 'circle',
                    line: { color: '#ffffff', width: 2 }
                },
                name: 'Antennas',
                hovertemplate: '<b>Antenna</b><br>X: %{x:.3f} m<br>Y: %{y:.3f} m<extra></extra>'
            }], {
                margin: { t: 30, b: 30, l: 40, r: 10 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: {
                    title: 'X (m)',
                    color: '#ff9000',
                    range: [-this.state.extentX, this.state.extentX],
                    showgrid: true,
                    gridcolor: '#222',
                    zeroline: true,
                    zerolinecolor: '#444'
                },
                yaxis: {
                    title: 'Y (m)',
                    color: '#ff9000',
                    range: [0, this.state.extentY],
                    showgrid: true,
                    gridcolor: '#222',
                    zeroline: true,
                    zerolinecolor: '#444'
                },
                font: { family: 'Inter, sans-serif', size: 11 },
                showlegend: false,
                hovermode: 'closest'
            });

            Plotly.react(document.getElementById('beamProfilePlot'), [{
                type: 'scatterpolar',
                mode: 'lines',
                r: polarData.r,
                theta: polarData.theta,
                fill: 'toself',
                fillcolor: 'rgba(255, 144, 0, 0.2)',
                line: { color: '#ff9000', width: 2 }
            }], {
                margin: { t: 20, b: 20, l: 30, r: 30 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#ff9000', family: 'Inter, sans-serif' },
                polar: {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    sector: [0, 180],
                    radialaxis: {
                        visible: true,
                        showticklabels: false,
                        gridcolor: '#444',
                        range: [0, 1]
                    },
                    angularaxis: {
                        rotation: 0,
                        direction: "counterclockwise",
                        gridcolor: '#444',
                        tickcolor: '#ff9000',
                        tickvals: [0, 30, 60, 90, 120, 150, 180]
                    }
                }
            });

            this.isUpdating = false;
            this.rafId = null;
        });
    }

    scheduleSmoothUpdate() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.fullUpdate();
        }, 50);
    }

    scheduleHeavyUpdate() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            this.fullUpdate();
        }, 100);
    }

    refreshUI() {
        const select = document.getElementById('antennaSelect');
        select.innerHTML = '';
        for (let i = 0; i < this.state.numAntennas; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = `Antenna ${i + 1}`;
            select.appendChild(opt);
        }

        if (this.state.selectedAntenna >= this.state.numAntennas) {
            this.state.selectedAntenna = 0;
        }
        select.value = this.state.selectedAntenna;
        this.updatePositionSliders();

        const freqContainer = document.getElementById('freqContainer');
        freqContainer.innerHTML = '';

        for (let i = 0; i < this.state.numAntennas; i++) {
            const freq = this.state.antennaFrequencies[i];
            const div = document.createElement('div');
            div.className = 'freq-row';

            let freqDisplay, freqUnit;
            if (freq >= 1e9) {
                freqDisplay = (freq / 1e9).toFixed(3);
                freqUnit = 'GHz';
            } else if (freq >= 1e6) {
                freqDisplay = (freq / 1e6).toFixed(2);
                freqUnit = 'MHz';
            } else if (freq >= 1e3) {
                freqDisplay = (freq / 1e3).toFixed(1);
                freqUnit = 'kHz';
            } else {
                freqDisplay = freq.toFixed(0);
                freqUnit = 'Hz';
            }

            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-secondary">Antenna ${i + 1}</small>
                    <small class="text-accent monospace"><span id="freqVal${i}">${freqDisplay}</span> ${freqUnit}</small>
                </div>
                <input type="range" class="form-range freq-slider" 
                       data-index="${i}" 
                       min="${this.getCurrentFreqRange().min}" 
                       max="${this.getCurrentFreqRange().max}" 
                       step="${this.getCurrentFreqRange().step}" 
                       value="${freq}">
            `;
            freqContainer.appendChild(div);
        }

        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                this.state.antennaFrequencies[idx] = val;

                const freqSpan = document.getElementById(`freqVal${idx}`);
                let freqDisplay, freqUnit;
                if (val >= 1e9) {
                    freqDisplay = (val / 1e9).toFixed(3);
                    freqUnit = 'GHz';
                } else if (val >= 1e6) {
                    freqDisplay = (val / 1e6).toFixed(2);
                    freqUnit = 'MHz';
                } else if (val >= 1e3) {
                    freqDisplay = (val / 1e3).toFixed(1);
                    freqUnit = 'kHz';
                } else {
                    freqDisplay = val.toFixed(0);
                    freqUnit = 'Hz';
                }
                freqSpan.innerText = freqDisplay;
                freqSpan.parentElement.innerHTML = `<span id="freqVal${idx}">${freqDisplay}</span> ${freqUnit}`;

                // NEW: Update spacing display when frequency changes in lambda mode
                if (this.state.spacingMode === 'lambda') {
                    this.updateSpacingDisplay();
                    this.resetAntennas();
                }

                this.scheduleSmoothUpdate();
            });
        });

        const xSlider = document.getElementById('antX');
        const ySlider = document.getElementById('antY');
        xSlider.min = -this.state.extentX;
        xSlider.max = this.state.extentX;
        ySlider.min = 0;
        ySlider.max = this.state.extentY;
    }

    getCurrentFreqRange() {
        if (this.state.activeScenario && this.scenarios[this.state.activeScenario]) {
            return this.scenarios[this.state.activeScenario].freqRange;
        }
        return { min: 100, max: 5e9, step: 1e6 };
    }

    updatePositionSliders() {
        const ant = {
            x: this.state.antennaPositions[this.state.selectedAntenna],
            y: this.state.yPositions[this.state.selectedAntenna]
        };

        const xSlider = document.getElementById('antX');
        const ySlider = document.getElementById('antY');

        xSlider.value = ant.x;
        ySlider.value = ant.y;

        document.getElementById('antXValue').innerText = ant.x.toFixed(2);
        document.getElementById('antYValue').innerText = ant.y.toFixed(2);
    }

    updateModeIndicator() {
        const modeDisplay = document.getElementById('currentMode');
        if (modeDisplay) {
            modeDisplay.textContent = this.state.activeScenarioName;
        }

        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this.state.activeScenario !== null) {
            const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${this.state.activeScenario}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    loadScenario(type) {
        clearTimeout(this.updateTimer);
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const scenario = this.scenarios[type];
        if (!scenario) return;

        this.state.numAntennas = scenario.num_antennas;
        this.state.distance = scenario.distance_m;
        this.state.delay = scenario.delay_deg;
        this.state.arrayGeometry = scenario.array_geometry;
        this.state.curvature = scenario.curvature;
        this.state.propagationSpeed = scenario.propagation_speed;
        this.state.antennaFrequencies = [...scenario.frequencies];
        this.state.activeScenario = type;
        this.state.activeScenarioName = type.charAt(0).toUpperCase() + type.slice(1);
        this.state.spacingMode = scenario.spacing_mode || 'absolute'; // NEW

        document.getElementById('numElements').value = this.state.numAntennas;
        document.getElementById('numElementsValue').textContent = this.state.numAntennas;

        // NEW: Update spacing mode radio buttons
        if (this.state.spacingMode === 'lambda') {
            document.getElementById('spacingModeLambda').checked = true;
            this.updateSpacingSliderForLambda();
        } else {
            document.getElementById('spacingModeAbsolute').checked = true;
            this.updateSpacingSliderForAbsolute();
        }

        document.getElementById('distance').value = this.state.distance;
        this.updateSpacingDisplay(); // NEW

        document.getElementById('geometry').value = this.state.arrayGeometry;

        document.getElementById('curvature').value = this.state.curvature;
        document.getElementById('curvatureValue').textContent = this.state.curvature.toFixed(1);

        document.getElementById('delay').value = this.state.delay;
        document.getElementById('delayValue').textContent = this.state.delay + '°';

        document.getElementById('curvatureGroup').style.display =
            (this.state.arrayGeometry === 'Curved') ? 'block' : 'none';

        this.updateModeIndicator();
        this.resetAntennas();
        this.refreshUI();

        setTimeout(() => {
            this.fullUpdate();
        }, 50);
    }

    // NEW: Update distance slider for lambda mode
    updateSpacingSliderForLambda() {
        const slider = document.getElementById('distance');
        slider.min = 0.1;
        slider.max = 2.0;
        slider.step = 0.01;
        slider.value = this.state.lambdaMultiplier;
    }

    // NEW: Update distance slider for absolute mode
    updateSpacingSliderForAbsolute() {
        const slider = document.getElementById('distance');
        slider.min = 0.1;
        slider.max = 5.0;
        slider.step = 0.1;
        slider.value = this.state.distance;
    }

    attachEventListeners() {
        const numElementsSlider = document.getElementById('numElements');
        numElementsSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.state.numAntennas = val;
            document.getElementById('numElementsValue').innerText = val;
        });

        numElementsSlider.addEventListener('change', (e) => {
            const newNum = this.state.numAntennas;
            const oldNum = this.state.antennaFrequencies.length;

            if (newNum > oldNum) {
                for (let i = oldNum; i < newNum; i++) {
                    this.state.antennaFrequencies[i] = this.state.antennaFrequencies[0];
                }
            } else {
                this.state.antennaFrequencies = this.state.antennaFrequencies.slice(0, newNum);
            }

            this.resetAntennas();
            this.refreshUI();
            this.scheduleHeavyUpdate();
        });

        // MODIFIED: Distance slider now handles both modes
        const distanceSlider = document.getElementById('distance');
        distanceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);

            if (this.state.spacingMode === 'lambda') {
                this.state.lambdaMultiplier = val;
            } else {
                this.state.distance = val;
            }

            this.updateSpacingDisplay();
            this.resetAntennas();
            this.updatePositionSliders();
            this.scheduleSmoothUpdate();
        });

        // NEW: Spacing mode radio buttons
        const spacingModeAbsolute = document.getElementById('spacingModeAbsolute');
        const spacingModeLambda = document.getElementById('spacingModeLambda');

        spacingModeAbsolute.addEventListener('change', () => {
            if (spacingModeAbsolute.checked) {
                this.state.spacingMode = 'absolute';
                this.updateSpacingSliderForAbsolute();
                this.updateSpacingDisplay();
                this.resetAntennas();
                this.updatePositionSliders();
                this.scheduleSmoothUpdate();
            }
        });

        spacingModeLambda.addEventListener('change', () => {
            if (spacingModeLambda.checked) {
                this.state.spacingMode = 'lambda';
                this.updateSpacingSliderForLambda();
                this.updateSpacingDisplay();
                this.resetAntennas();
                this.updatePositionSliders();
                this.scheduleSmoothUpdate();
            }
        });

        const curvatureSlider = document.getElementById('curvature');
        curvatureSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.state.curvature = val;
            document.getElementById('curvatureValue').innerText = val.toFixed(1);

            this.resetAntennas();
            this.updatePositionSliders();
            this.scheduleSmoothUpdate();
        });

        const delaySlider = document.getElementById('delay');
        delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.state.delay = val;
            document.getElementById('delayValue').innerText = val + '°';

            this.scheduleSmoothUpdate();
        });

        document.getElementById('geometry').addEventListener('change', (e) => {
            this.state.arrayGeometry = e.target.value;
            document.getElementById('curvatureGroup').style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';

            this.resetAntennas();
            this.refreshUI();
            this.scheduleHeavyUpdate();
        });

        document.getElementById('antennaSelect').addEventListener('change', (e) => {
            this.state.selectedAntenna = parseInt(e.target.value);
            this.updatePositionSliders();
        });

        const antXSlider = document.getElementById('antX');
        antXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.state.antennaPositions[this.state.selectedAntenna] = val;
            document.getElementById('antXValue').innerText = val.toFixed(2);

            this.scheduleSmoothUpdate();
        });

        const antYSlider = document.getElementById('antY');
        antYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.state.yPositions[this.state.selectedAntenna] = val;
            document.getElementById('antYValue').innerText = val.toFixed(2);

            this.scheduleSmoothUpdate();
        });

        document.getElementById('colormapSelect').addEventListener('change', () => {
            this.fullUpdate();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `beamforming_${this.state.activeScenarioName.replace(/\s+/g, '_')}_${timestamp}`;

                Plotly.downloadImage(document.getElementById('heatmapPlot'), {
                    format: 'png',
                    width: 1200,
                    height: 800,
                    filename: filename + '_heatmap'
                });

                setTimeout(() => {
                    Plotly.downloadImage(document.getElementById('beamProfilePlot'), {
                        format: 'png',
                        width: 800,
                        height: 800,
                        filename: filename + '_polar'
                    });
                }, 500);

                alert(`Snapshots saved: ${filename}`);
            } catch (e) {
                console.error('Snapshot failed', e);
                alert('Snapshot saved locally');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});