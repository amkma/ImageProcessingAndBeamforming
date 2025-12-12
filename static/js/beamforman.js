// ============================================
// 1. State & Physics Engine Constants
// ============================================
const C = 3e8; // Speed of light

// Main Application State
const appState = {
    N: 8,
    spacing: 0.06, // meters
    globalPhaseDeg: 0,
    geometry: 'linear',
    curvature: 0.2,
    globalFreqGhz: 2.4,
    individualMode: false,
    elements: [],
    // Simulation Grid Config
    gridSizeX: 6, // meters width
    gridSizeY: 6, // meters depth
};

// ============================================
// Physics Core
// ============================================

function initElementState() {
    appState.elements = [];
    for(let i=0; i<appState.N; i++) {
        appState.elements.push({
            xOffset: 0, // Manual X shift
            yOffset: 0, // Manual Y shift
            freqOffsetGhz: 0, // Individual frequency shift
            posX: 0,
            posY: 0,
            actualFreq: 0
        });
    }
    calculatePositions();
}

function calculatePositions() {
    const baseFreq = appState.globalFreqGhz * 1e9;
    const totalWidth = (appState.N - 1) * appState.spacing;

    for(let i=0; i<appState.N; i++) {
        let el = appState.elements[i];

        // Final Frequency
        el.actualFreq = baseFreq + (appState.individualMode ? el.freqOffsetGhz * 1e9 : 0);

        // Normalized index from -0.5 to 0.5 for symmetric placement
        const normalizedIdx = (i / (appState.N - 1 || 1)) - 0.5;

        let baseX = 0, baseY = 0;

        if(appState.geometry === 'linear') {
            baseX = normalizedIdx * totalWidth;
            baseY = 0;
        } else if (appState.geometry === 'curved') {
            // Parabolic arc for curved array
            baseX = normalizedIdx * totalWidth;
            baseY = -4 * appState.curvature * (normalizedIdx * normalizedIdx);
        }

        // Apply manual offsets if mode enabled
        el.posX = baseX + (appState.individualMode ? el.xOffset : 0);
        el.posY = baseY + (appState.individualMode ? el.yOffset : 0);
    }
}

function calculateIntensityAtPoint(targetX, targetY) {
    let sumReal = 0;
    let sumImag = 0;

    const steerRad = (appState.globalPhaseDeg * Math.PI) / 180;

    for(let i=0; i<appState.N; i++) {
        let el = appState.elements[i];
        const k = (2 * Math.PI * el.actualFreq) / C; // Wave number

        const dx = targetX - el.posX;
        const dy = targetY - el.posY;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if(distance < 0.01) continue;

        // 1. Spatial phase due to propagation distance
        const spatialPhase = k * distance;

        // 2. Steering Phase Shift
        let centeredIndex = i - (appState.N-1)/2.0;
        const steeringPhaseShift = k * appState.spacing * centeredIndex * Math.sin(steerRad);

        // Total Phase at target point
        const totalPhase = spatialPhase - steeringPhaseShift;

        // 3. Amplitude decay (1/r approximation)
        const amplitude = 1.0 / Math.sqrt(distance);

        // Coherent summation of fields
        sumReal += amplitude * Math.cos(totalPhase);
        sumImag += amplitude * Math.sin(totalPhase);
    }

    // Intensity ~ |E|^2
    const intensity = sumReal*sumReal + sumImag*sumImag;
    return intensity;
}

// ============================================
// 2. Visualization Renderers
// ============================================

const heatmapCanvas = document.getElementById('heatmapCanvas');
const ctxHeatmap = heatmapCanvas.getContext('2d', { willReadFrequently: true });
let polarChart;

// Helper to map 0-1 intensity to Black->Orange RGB
function getThemeColor(intensity) {
    let clampedInt = Math.min(Math.pow(intensity, 0.6) * 1.5, 1.0);
    const r = Math.floor(255 * clampedInt);
    const g = Math.floor(144 * clampedInt);
    const b = 0;
    return `rgb(${r},${g},${b})`;
}

function renderHeatmap() {
    // Resize handling
    const container = heatmapCanvas.parentElement;
    heatmapCanvas.width = container.clientWidth;
    heatmapCanvas.height = container.clientHeight;

    const w = heatmapCanvas.width;
    const h = heatmapCanvas.height;

    ctxHeatmap.clearRect(0, 0, w, h);

    const imgData = ctxHeatmap.createImageData(w, h);
    const pixels = imgData.data;

    // Physical Grid Mapping: Centered on X, 0 to Y_max for depth
    const physicalMinX = -appState.gridSizeX / 2;
    const physicalMaxY = appState.gridSizeY;
    const physicalMinY = -0.5; // Starts slightly behind antennas
    const physicalRangeY = physicalMaxY - physicalMinY;

    let maxComputedIntensity = 0;

    for (let py = 0; py < h; py++) {
        const physicalY = physicalMaxY - (py / h) * physicalRangeY;

        for (let px = 0; px < w; px++) {
            const physicalX = physicalMinX + (px / w) * appState.gridSizeX;

            const intensity = calculateIntensityAtPoint(physicalX, physicalY);
            if(intensity > maxComputedIntensity) maxComputedIntensity = intensity;

            const idx = (py * w + px) * 4;
            // Store intensity temporarily in R channel
            pixels[idx] = intensity;
        }
    }

    // Second pass for normalization and coloring
    const normFactor = maxComputedIntensity > 0 ? 1.0 / maxComputedIntensity : 0;
    for (let i = 0; i < pixels.length; i += 4) {
         const val = pixels[i] * normFactor;
         const rgb = getThemeColor(val).match(/\d+/g).map(Number);
         pixels[i] = rgb[0];   // R
         pixels[i+1] = rgb[1]; // G
         pixels[i+2] = rgb[2]; // B
         pixels[i+3] = 255;    // Alpha
    }

    ctxHeatmap.putImageData(imgData, 0, 0);

    // Draw Antenna positions overlay
    ctxHeatmap.fillStyle = '#ff9000';
    for(let i=0; i<appState.N; i++){
        let el = appState.elements[i];
         // map physical back to pixels
        let pixX = ((el.posX - physicalMinX) / appState.gridSizeX) * w;
        let pixY = h - ((el.posY - physicalMinY) / physicalRangeY) * h;
        ctxHeatmap.beginPath();
        ctxHeatmap.arc(pixX, pixY, 4, 0, 2*Math.PI);
        ctxHeatmap.fill();
    }
}


function initPolarChart() {
    const ctxPolar = document.getElementById('polarChartCanvas').getContext('2d');
    Chart.defaults.color = '#ff9000';
    Chart.defaults.borderColor = '#b36b00';

    polarChart = new Chart(ctxPolar, {
        type: 'polarArea',
        data: {
            labels: [],
            datasets: [{
                label: 'Beam Pattern',
                data: [],
                backgroundColor: 'rgba(255, 144, 0, 0.5)',
                borderColor: '#ff9000',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: '#b36b00' },
                    grid: { color: '#b36b00' },
                    pointLabels: { color: '#ff9000', font: {size: 14} },
                    ticks: { display: false, backdropColor: 'transparent' },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function updatePolarChart() {
    const angles = [];
    const data = [];
    const numSteps = 72; // Every 5 degrees
    const farFieldDistance = 100;

    let maxInt = 0;
    for(let i=0; i<numSteps; i++) {
        const angleDeg = (i * (360/numSteps));
        // Map angle 0° to vertical
        const trigAngleRad = (angleDeg - 90) * (Math.PI/180);

        const targetX = farFieldDistance * Math.cos(trigAngleRad);
        const targetY = farFieldDistance * Math.sin(trigAngleRad);

        let intensity = 0;
        // Only calculate forward hemisphere
        if (angleDeg > 270 || angleDeg < 90) {
             intensity = calculateIntensityAtPoint(targetX, targetY);
             intensity *= (farFieldDistance * farFieldDistance);
        }

        if(intensity > maxInt) maxInt = intensity;

        angles.push(angleDeg + "°");
        data.push(intensity);
    }

    const normalizedData = data.map(d => maxInt > 0 ? d / maxInt : 0);

    polarChart.data.labels = angles;
    polarChart.data.datasets[0].data = normalizedData;
    polarChart.update('none');
}

// Main update loop
function updateSimulation() {
    calculatePositions();
    renderHeatmap();
    updatePolarChart();
}

// ============================================
// 3. Controller Logic
// ============================================

function bindSlider(id, stateKey, displayId, isInt=false, suffix='') {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    if(!slider) return;

    slider.addEventListener('input', (e) => {
        let val = isInt ? parseInt(e.target.value) : parseFloat(e.target.value);

        if (stateKey === 'N' && val !== appState.N) {
            appState.N = val;
            initElementState();
            rebuildIndividualControls();
        } else {
            appState[stateKey] = val;
        }
        display.innerText = val + suffix;
        updateSimulation();
    });
}

function rebuildIndividualControls() {
    const indContainer = document.getElementById('individual-controls-container');
    if(!indContainer) return;
    indContainer.innerHTML = '';

    for(let i=0; i<appState.N; i++) {
        const elDiv = document.createElement('div');
        elDiv.innerHTML = `<h3>Antenna ${i+1}</h3>`;
        elDiv.style.borderBottom = '1px solid var(--theme-accent-dim)';
        elDiv.style.marginBottom = '10px';

        elDiv.appendChild(createIndSlider(i, 'xOffset', 'X Off (m)', -0.5, 0.5, 0.01, 'm'));
        elDiv.appendChild(createIndSlider(i, 'yOffset', 'Y Off (m)', -0.5, 0.5, 0.01, 'm'));
        elDiv.appendChild(createIndSlider(i, 'freqOffsetGhz', 'Frq Off (GHz)', -1, 1, 0.1, ' GHz'));

        indContainer.appendChild(elDiv);
    }
}

function createIndSlider(idx, key, labelStr, min, max, step, suffix) {
    const container = document.createElement('div');
    container.className = 'slider-container slider-label';
    container.style.fontSize = '0.8em';

    const lbl = document.createElement('span');
    lbl.innerText = labelStr;
    container.appendChild(lbl);

    const sld = document.createElement('input');
    sld.type = 'range';
    sld.min = min; sld.max = max; sld.step = step;
    sld.value = appState.elements[idx][key];

    const valDisp = document.createElement('span');
    valDisp.className = 'slider-val';
    valDisp.innerText = sld.value + suffix;

    sld.addEventListener('input', (e) => {
         appState.elements[idx][key] = parseFloat(e.target.value);
         valDisp.innerText = e.target.value + suffix;
         updateSimulation();
    });

    container.appendChild(sld);
    container.appendChild(valDisp);
    return container;
}

function loadScenario(type) {
    appState.individualMode = false;
    document.getElementById('enableIndividual').checked = false;
    document.getElementById('individual-controls-container').style.display = 'none';
    appState.curvature = 0;

    switch(type) {
        case '5g':
            appState.N = 8;
            appState.spacing = 0.06;
            appState.globalFreqGhz = 2.5;
            appState.globalPhaseDeg = 30;
            appState.geometry = 'linear';
            break;
        case 'tumor':
            appState.N = 16;
            appState.spacing = 0.02;
            appState.globalFreqGhz = 6.0;
            appState.globalPhaseDeg = 0;
            appState.geometry = 'curved';
            appState.curvature = 0.6;
            break;
        case 'ultrasound':
            appState.N = 32;
            appState.spacing = 0.01;
            appState.globalFreqGhz = 1.0;
            appState.globalPhaseDeg = -15;
            appState.geometry = 'linear';
            break;
    }

    // Update UI inputs
    document.getElementById('numElements').value = appState.N;
    document.getElementById('val-numElements').innerText = appState.N;
    document.getElementById('spacing').value = appState.spacing;
    document.getElementById('val-spacing').innerText = appState.spacing + 'm';
    document.getElementById('globalFreq').value = appState.globalFreqGhz;
    document.getElementById('val-globalFreq').innerText = appState.globalFreqGhz + ' GHz';
    document.getElementById('globalPhase').value = appState.globalPhaseDeg;
    document.getElementById('val-globalPhase').innerText = appState.globalPhaseDeg + '°';
    document.getElementById('geometrySelect').value = appState.geometry;
    document.getElementById('curvature').value = appState.curvature;

    document.getElementById('curvature-group').style.display = appState.geometry === 'curved' ? 'flex' : 'none';

    initElementState();
    rebuildIndividualControls();
    updateSimulation();
}

// ============================================
// 4. Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Bind Global Controls
    bindSlider('numElements', 'N', 'val-numElements', true);
    bindSlider('spacing', 'spacing', 'val-spacing', false, 'm');
    bindSlider('globalPhase', 'globalPhaseDeg', 'val-globalPhase', true, '°');
    bindSlider('curvature', 'curvature', 'val-curvature');
    bindSlider('globalFreq', 'globalFreqGhz', 'val-globalFreq', false, ' GHz');

    // 2. Geometry Selector
    const geoSelect = document.getElementById('geometrySelect');
    const curveGroup = document.getElementById('curvature-group');
    geoSelect.addEventListener('change', (e) => {
        appState.geometry = e.target.value;
        curveGroup.style.display = appState.geometry === 'curved' ? 'flex' : 'none';
        updateSimulation();
    });

    // 3. Individual Mode Toggle
    const indToggle = document.getElementById('enableIndividual');
    const indContainer = document.getElementById('individual-controls-container');
    indToggle.addEventListener('change', (e) => {
        appState.individualMode = e.target.checked;
        indContainer.style.display = appState.individualMode ? 'block' : 'none';
        updateSimulation();
    });

    // 4. Scenario Buttons
    document.getElementById('load5g').addEventListener('click', () => loadScenario('5g'));
    document.getElementById('loadTumor').addEventListener('click', () => loadScenario('tumor'));
    document.getElementById('loadUltrasound').addEventListener('click', () => loadScenario('ultrasound'));

    // 5. Initial State Setup
    initElementState();
    rebuildIndividualControls();
    initPolarChart();

    setTimeout(updateSimulation, 100);

    // 6. Handle window resize
    window.addEventListener('resize', updateSimulation);
});