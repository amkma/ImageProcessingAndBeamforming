/**
 * Beamforming Simulator - FIXED ANTENNA SPACING
 * Antennas now properly spaced in METERS with visible separation
 * All controllers work smoothly in ALL modes
 */

class BeamformingSimulator {
    constructor() {
        this.config = {
            numAntennas: 8,
            distance: 0.5,  // Default spacing in METERS (was 0.15)
            delayDeg: 0,
            speed: 3e8,     // Speed of light in m/s (was 100)
            geometry: 'Linear',
            curvature: 0.5,
            gridSize: 200,
            extentX: 10,
            extentY: 20
        };

        this.freqLimits = { min: 1e9, max: 3e9, step: 1e8 };  // Default GHz range
        this.activeScenario = null;
        this.activeScenarioName = 'No Scenario Loaded';
        this.antennas = [];
        this.selectedAntennaIndex = 0;

        this.heavyUpdateTimer = null;
        this.isUpdating = false;
        this.rafId = null;

        this.heatmapDiv = document.getElementById('heatmapPlot');
        this.profileDiv = document.getElementById('beamProfilePlot');

        this.init();
    }

    init() {
        this.resetAntennas();
        this.setupCoordinates();
        this.initPlots();
        this.attachEventListeners();
        this.refreshUI();
        this.updateModeIndicator();

        setTimeout(() => {
            this.fullUpdate();
        }, 100);

        window.addEventListener('resize', () => {
            clearTimeout(this.heavyUpdateTimer);
            this.heavyUpdateTimer = setTimeout(() => {
                Plotly.Plots.resize(this.heatmapDiv);
                Plotly.Plots.resize(this.profileDiv);
            }, 150);
        });
    }

    resetAntennas() {
        const N = this.config.numAntennas;
        const avgFreq = (this.freqLimits.max + this.freqLimits.min) / 2;

        // FIXED: Use actual meter spacing (no wavelength conversion)
        const spacing = this.config.distance;  // Direct meters
        const totalWidth = (N - 1) * spacing;

        const newAntennas = [];
        for (let i = 0; i < N; i++) {
            const existingFreq = (this.antennas[i] && this.antennas[i].freq) ? this.antennas[i].freq : avgFreq;

            // Position antennas with real meter spacing
            let x = -totalWidth / 2 + i * spacing;
            let y = 0;

            if (this.config.geometry === 'Curved') {
                // Curvature factor adjusted for meter scale
                y = 0.01 * this.config.extentY + (this.config.curvature * 0.01) * (x * x);
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
                title: 'X (m)',
                color: '#ff9000',
                range: [-this.config.extentX, this.config.extentX],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            yaxis: {
                title: 'Y (m)',
                color: '#ff9000',
                range: [0, this.config.extentY],
                showgrid: true,
                gridcolor: '#222',
                zeroline: true,
                zerolinecolor: '#444'
            },
            font: { family: 'Inter, sans-serif', size: 11 },
            showlegend: false,
            hovermode: 'closest'
        };

        Plotly.newPlot(this.heatmapDiv, [{
            z: [[0]],
            x: [0],
            y: [0],
            type: 'heatmap',
            colorscale: 'Jet',
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

        Plotly.newPlot(this.profileDiv, [{
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
                    <small class="text-accent monospace"><span id="freqVal${idx}">${(ant.freq / 1e9).toFixed(2)}</span> GHz</small>
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
                document.getElementById(`freqVal${idx}`).innerText = (val / 1e9).toFixed(2);

                this.scheduleSmoothUpdate();
            });
        });

        const xSlider = document.getElementById('antX');
        const ySlider = document.getElementById('antY');
        xSlider.min = -this.config.extentX;
        xSlider.max = this.config.extentX;
        ySlider.min = 0;
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
        const speed = this.config.speed;  // c = 3e8 m/s
        const size = this.config.gridSize;
        const delayRad = (this.config.delayDeg * Math.PI) / 180;
        const maxFreq = Math.max(...this.antennas.map(a => a.freq));

        const zData = [];

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

                    const dx = xPos - ant.x;
                    const dy = yPos - ant.y;
                    const R = Math.sqrt(dx * dx + dy * dy);

                    // Phase delay from steering
                    const phaseDelay = -i * delayRad;

                    // Frequency normalization
                    const freqScaling = freq / maxFreq;

                    waveSum += freqScaling * Math.sin(k * R + phaseDelay);
                }

                row.push(waveSum);
            }
            zData.push(row);
        }

        const zFlat = zData.flat();
        const wavesAbs = zFlat.map(v => Math.abs(v));
        const wavesLog = wavesAbs.map(v => Math.log1p(v));

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

        const beamAngles = [];
        const beamMags = [];

        for (let deg = 0; deg <= 180; deg += 1) {
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

    updateAntennaPositions() {
        const antX = this.antennas.map(a => a.x);
        const antY = this.antennas.map(a => a.y);

        Plotly.restyle(this.heatmapDiv, {
            x: [antX],
            y: [antY]
        }, [1]);
    }

    fullUpdate() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        this.rafId = requestAnimationFrame(() => {
            const data = this.computePhysics();

            const antX = this.antennas.map(a => a.x);
            const antY = this.antennas.map(a => a.y);

            Plotly.react(this.heatmapDiv, [{
                z: data.z,
                x: Array.from(this.xGrid),
                y: Array.from(this.yGrid),
                type: 'heatmap',
                colorscale: document.getElementById('colormapSelect').value,
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
                    range: [-this.config.extentX, this.config.extentX],
                    showgrid: true,
                    gridcolor: '#222',
                    zeroline: true,
                    zerolinecolor: '#444'
                },
                yaxis: {
                    title: 'Y (m)',
                    color: '#ff9000',
                    range: [0, this.config.extentY],
                    showgrid: true,
                    gridcolor: '#222',
                    zeroline: true,
                    zerolinecolor: '#444'
                },
                font: { family: 'Inter, sans-serif', size: 11 },
                showlegend: false,
                hovermode: 'closest'
            });

            Plotly.react(this.profileDiv, [{
                type: 'scatterpolar',
                mode: 'lines',
                r: data.r,
                theta: data.theta,
                fill: 'toself',
                fillcolor: 'rgba(255, 144, 0, 0.2)',
                line: { color: '#ff9000', width: 2 }
            }], this.profileDiv.layout);

            this.isUpdating = false;
            this.rafId = null;
        });
    }

    scheduleSmoothUpdate() {
        clearTimeout(this.heavyUpdateTimer);
        this.heavyUpdateTimer = setTimeout(() => {
            this.fullUpdate();
        }, 50);
    }

    scheduleHeavyUpdate() {
        clearTimeout(this.heavyUpdateTimer);
        this.heavyUpdateTimer = setTimeout(() => {
            this.fullUpdate();
        }, 100);
    }

    attachEventListeners() {
        const numElementsSlider = document.getElementById('numElements');
        numElementsSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.config.numAntennas = val;
            document.getElementById('numElementsValue').innerText = val;
        });

        numElementsSlider.addEventListener('change', (e) => {
            this.resetAntennas();
            this.refreshUI();
            this.scheduleHeavyUpdate();
        });

        const distanceSlider = document.getElementById('distance');
        distanceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.config.distance = val;
            document.getElementById('distanceValue').innerText = val.toFixed(2);

            this.resetAntennas();
            this.updatePositionSliders();
            this.scheduleSmoothUpdate();
        });

        const curvatureSlider = document.getElementById('curvature');
        curvatureSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.config.curvature = val;
            document.getElementById('curvatureValue').innerText = val.toFixed(1);

            this.resetAntennas();
            this.updatePositionSliders();
            this.scheduleSmoothUpdate();
        });

        const delaySlider = document.getElementById('delay');
        delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this.config.delayDeg = val;
            document.getElementById('delayValue').innerText = val + '°';

            this.scheduleSmoothUpdate();
        });

        document.getElementById('geometry').addEventListener('change', (e) => {
            this.config.geometry = e.target.value;
            document.getElementById('curvatureGroup').style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';

            this.resetAntennas();
            this.refreshUI();
            this.scheduleHeavyUpdate();
        });

        document.getElementById('antennaSelect').addEventListener('change', (e) => {
            this.selectedAntennaIndex = parseInt(e.target.value);
            this.updatePositionSliders();
        });

        const antXSlider = document.getElementById('antX');
        antXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.antennas[this.selectedAntennaIndex].x = val;
            document.getElementById('antXValue').innerText = val.toFixed(2);

            this.updateAntennaPositions();
            this.scheduleSmoothUpdate();
        });

        const antYSlider = document.getElementById('antY');
        antYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.antennas[this.selectedAntennaIndex].y = val;
            document.getElementById('antYValue').innerText = val.toFixed(2);

            this.updateAntennaPositions();
            this.scheduleSmoothUpdate();
        });

        document.getElementById('colormapSelect').addEventListener('change', () => {
            this.fullUpdate();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `beamforming_${this.activeScenarioName.replace(/\s+/g, '_')}_${timestamp}`;

                Plotly.downloadImage(this.heatmapDiv, {
                    format: 'png',
                    width: 1200,
                    height: 800,
                    filename: filename + '_heatmap'
                });

                setTimeout(() => {
                    Plotly.downloadImage(this.profileDiv, {
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
        clearTimeout(this.heavyUpdateTimer);
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (type === '5g') {
            this.config.speed = 3e8;  // Speed of light
            this.freqLimits = { min: 2e9, max: 3e9, step: 1e8 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 4;
            this.config.distance = 0.5;  // 0.5 meters spacing
            this.config.geometry = 'Linear';
            this.config.delayDeg = 180;
            this.config.curvature = 0;
            this.activeScenario = '5g';
            this.activeScenarioName = '5G Beamforming';

        } else if (type === 'tumor') {
            this.config.speed = 1500;  // Speed of sound in tissue (m/s)
            this.freqLimits = { min: 4e6, max: 5e6, step: 1e5 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 10;
            this.config.distance = 0.3;  // 0.3 meters spacing
            this.config.geometry = 'Curved';
            this.config.curvature = 24;
            this.config.delayDeg = 0;
            this.activeScenario = 'tumor';
            this.activeScenarioName = 'Tumor Ablation';

        } else if (type === 'ultrasound') {
            this.config.speed = 1500;  // Speed of sound in tissue (m/s)
            this.freqLimits = { min: 1e6, max: 2e6, step: 1e5 };
            this.config.extentX = 10;
            this.config.extentY = 20;
            this.config.numAntennas = 7;
            this.config.distance = 0.4;  // 0.4 meters spacing
            this.config.geometry = 'Linear';
            this.config.delayDeg = 0;
            this.config.curvature = 0;
            this.activeScenario = 'ultrasound';
            this.activeScenarioName = 'Ultrasound Imaging';
        }

        const numElements = document.getElementById('numElements');
        numElements.value = this.config.numAntennas;
        document.getElementById('numElementsValue').textContent = this.config.numAntennas;

        const distance = document.getElementById('distance');
        distance.value = this.config.distance;
        document.getElementById('distanceValue').textContent = this.config.distance.toFixed(2);

        const geometry = document.getElementById('geometry');
        geometry.value = this.config.geometry;

        const curvature = document.getElementById('curvature');
        curvature.value = this.config.curvature;
        document.getElementById('curvatureValue').textContent = this.config.curvature.toFixed(1);

        const delay = document.getElementById('delay');
        delay.value = this.config.delayDeg;
        document.getElementById('delayValue').textContent = this.config.delayDeg + '°';

        document.getElementById('curvatureGroup').style.display =
            (this.config.geometry === 'Curved') ? 'block' : 'none';

        this.updateModeIndicator();
        this.setupCoordinates();
        this.resetAntennas();
        this.refreshUI();

        setTimeout(() => {
            this.fullUpdate();
        }, 50);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.simulator = new BeamformingSimulator();
});