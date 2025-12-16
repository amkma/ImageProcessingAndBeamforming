/**
 * UIController Class - Encapsulates all UI interactions and updates
 * Manages DOM elements, event listeners, and display updates
 */
class UIController {
    constructor(phasedArray, visualization) {
        this._array = phasedArray;
        this._viz = visualization;
        this._selectedAntenna = 0;
        this._activeScenario = null;
        this._activeScenarioName = 'Custom';
        this._gridSize = 200;
        this._currentFreqRange = null; // Store current frequency range

        this._updateTimer = null;
        this._isUpdating = false;
        this._rafId = null;

        this._cacheElements();
        this._attachEventListeners();
        this._refreshUI();
    }

    // Getters
    get selectedAntenna() { return this._selectedAntenna; }
    get activeScenarioName() { return this._activeScenarioName; }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements() {
        // Sliders
        this._numElementsSlider = document.getElementById('numElements');
        this._numElementsValue = document.getElementById('numElementsValue');
        this._distanceSlider = document.getElementById('distance');
        this._distanceValue = document.getElementById('distanceValue');
        this._spacingInfo = document.getElementById('spacingInfo');
        this._curvatureSlider = document.getElementById('curvature');
        this._curvatureValue = document.getElementById('curvatureValue');
        this._delaySlider = document.getElementById('delay');
        this._delayValue = document.getElementById('delayValue');

        // Selects
        this._geometrySelect = document.getElementById('geometry');
        this._antennaSelect = document.getElementById('antennaSelect');
        this._colormapSelect = document.getElementById('colormapSelect');

        // Position sliders
        this._antXSlider = document.getElementById('antX');
        this._antXValue = document.getElementById('antXValue');
        this._antYSlider = document.getElementById('antY');
        this._antYValue = document.getElementById('antYValue');

        // Radio buttons
        this._spacingModeAbsolute = document.getElementById('spacingModeAbsolute');
        this._spacingModeLambda = document.getElementById('spacingModeLambda');

        // Containers
        this._freqContainer = document.getElementById('freqContainer');
        this._curvatureGroup = document.getElementById('curvatureGroup');

        // Display
        this._currentMode = document.getElementById('currentMode');

        // Buttons
        this._exportBtn = document.getElementById('exportBtn');
    }

    /**
     * Attach all event listeners
     * @private
     */
    _attachEventListeners() {
        this._attachArrayControlListeners();
        this._attachAntennaControlListeners();
        this._attachVisualizationListeners();
        this._attachWindowListeners();
    }

    /**
     * Attach array-level control listeners
     * @private
     */
    _attachArrayControlListeners() {
        // Number of elements
        this._numElementsSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this._numElementsValue.textContent = val;
        });

        this._numElementsSlider.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            this._array.setAntennaCount(val);
            this._refreshUI();
            this._scheduleHeavyUpdate();
        });

        // Spacing mode
        this._spacingModeAbsolute.addEventListener('change', () => {
            if (this._spacingModeAbsolute.checked) {
                this._array.spacingMode = 'absolute';
                this._updateSpacingSliderForAbsolute();
                this._updateSpacingDisplay();
                this._scheduleSmoothUpdate();
            }
        });

        this._spacingModeLambda.addEventListener('change', () => {
            if (this._spacingModeLambda.checked) {
                this._array.spacingMode = 'lambda';
                this._updateSpacingSliderForLambda();
                this._updateSpacingDisplay();
                this._scheduleSmoothUpdate();
            }
        });

        // Distance/spacing
        this._distanceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);

            if (this._array.spacingMode === 'lambda') {
                this._array.lambdaMultiplier = val;
            } else {
                this._array.spacing = val;
            }

            this._updateSpacingDisplay();
            this._updatePositionSliders();
            this._scheduleSmoothUpdate();
        });

        // Curvature
        this._curvatureSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._array.curvature = val;
            this._curvatureValue.textContent = val.toFixed(1);
            this._updatePositionSliders();
            this._scheduleSmoothUpdate();
        });

        // Delay
        this._delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this._array.delay = val;
            this._delayValue.textContent = val + '°';
            this._scheduleSmoothUpdate();
        });

        // Geometry
        this._geometrySelect.addEventListener('change', (e) => {
            this._array.geometry = e.target.value;
            this._curvatureGroup.style.display =
                (e.target.value === 'Curved') ? 'block' : 'none';
            this._refreshUI();
            this._scheduleHeavyUpdate();
        });
    }

    /**
     * Attach individual antenna control listeners
     * @private
     */
    _attachAntennaControlListeners() {
        // Antenna selection
        this._antennaSelect.addEventListener('change', (e) => {
            this._selectedAntenna = parseInt(e.target.value);
            this._updatePositionSliders();
        });

        // X position
        this._antXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._array.setAntennaPosition(this._selectedAntenna, val,
                this._array.getAntenna(this._selectedAntenna).y);
            this._antXValue.textContent = val.toFixed(2);
            this._scheduleSmoothUpdate();
        });

        // Y position
        this._antYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._array.setAntennaPosition(this._selectedAntenna,
                this._array.getAntenna(this._selectedAntenna).x, val);
            this._antYValue.textContent = val.toFixed(2);
            this._scheduleSmoothUpdate();
        });
    }

    /**
     * Attach visualization control listeners
     * @private
     */
    _attachVisualizationListeners() {
        // Colormap
        this._colormapSelect.addEventListener('change', (e) => {
            this._viz.colormap = e.target.value;
            this._fullUpdate();
        });

        // Export
        this._exportBtn.addEventListener('click', () => {
            this._handleExport();
        });
    }

    /**
     * Attach window-level listeners
     * @private
     */
    _attachWindowListeners() {
        window.addEventListener('resize', () => {
            clearTimeout(this._updateTimer);
            this._updateTimer = setTimeout(() => {
                this._viz.resize();
            }, 150);
        });
    }

    /**
     * Update spacing slider for absolute mode
     * @private
     */
    _updateSpacingSliderForAbsolute() {
        this._distanceSlider.min = 0.1;
        this._distanceSlider.max = 5.0;
        this._distanceSlider.step = 0.1;
        this._distanceSlider.value = this._array.spacing;
    }

    /**
     * Update spacing slider for lambda mode
     * @private
     */
    _updateSpacingSliderForLambda() {
        this._distanceSlider.min = 0.1;
        this._distanceSlider.max = 2.0;
        this._distanceSlider.step = 0.01;
        this._distanceSlider.value = this._array.lambdaMultiplier;
    }

    /**
     * Update spacing display text
     * @private
     */
    _updateSpacingDisplay() {
        if (this._array.spacingMode === 'lambda') {
            const lambda = this._array.averageWavelength;
            const effectiveSpacing = this._array.effectiveSpacing;
            this._distanceValue.textContent = `${this._array.lambdaMultiplier.toFixed(2)}λ`;
            this._spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                λ = ${(lambda * 1000).toFixed(2)} mm | Actual: ${(effectiveSpacing * 1000).toFixed(2)} mm
            </small>`;
        } else {
            this._distanceValue.textContent = this._array.spacing.toFixed(2);
            this._spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                Range: 0.1m - 5.0m (10cm to 5 meters)
            </small>`;
        }
    }

    /**
     * Update position sliders for selected antenna
     * @private
     */
    _updatePositionSliders() {
        const ant = this._array.getAntenna(this._selectedAntenna);

        this._antXSlider.value = ant.x;
        this._antYSlider.value = ant.y;
        this._antXValue.textContent = ant.x.toFixed(2);
        this._antYValue.textContent = ant.y.toFixed(2);
    }

    /**
     * Refresh entire UI (after major changes)
     * @private
     */
    _refreshUI() {
        this._updateAntennaSelect();
        this._updateFrequencyControls();
        this._updatePositionSliderRanges();
        this._updatePositionSliders();
    }

    /**
     * Update antenna selection dropdown
     * @private
     */
    _updateAntennaSelect() {
        this._antennaSelect.innerHTML = '';
        for (let i = 0; i < this._array.numAntennas; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = `Antenna ${i + 1}`;
            this._antennaSelect.appendChild(opt);
        }

        if (this._selectedAntenna >= this._array.numAntennas) {
            this._selectedAntenna = 0;
        }
        this._antennaSelect.value = this._selectedAntenna;
    }

    /**
     * Update frequency control sliders
     * @private
     */
    _updateFrequencyControls() {
        this._freqContainer.innerHTML = '';

        for (let i = 0; i < this._array.numAntennas; i++) {
            const freq = this._array.getAntenna(i).frequency;
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
                       min="${this._getFreqRange().min}" 
                       max="${this._getFreqRange().max}" 
                       step="${this._getFreqRange().step}" 
                       value="${freq}">
            `;
            this._freqContainer.appendChild(div);
        }

        // Attach frequency slider listeners
        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                this._array.setAntennaFrequency(idx, val);

                // Update display
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

                // Update spacing display in lambda mode
                if (this._array.spacingMode === 'lambda') {
                    this._updateSpacingDisplay();
                }

                this._scheduleSmoothUpdate();
            });
        });
    }

    /**
     * Get frequency range for sliders
     * @private
     */
    _getFreqRange() {
        // Return stored frequency range from active scenario, or default
        if (this._currentFreqRange) {
            return this._currentFreqRange;
        }
        // Default range
        return { min: 100, max: 5e9, step: 1e6 };
    }

    /**
     * Update position slider ranges
     * @private
     */
    _updatePositionSliderRanges() {
        this._antXSlider.min = -this._viz.extents.x;
        this._antXSlider.max = this._viz.extents.x;
        this._antYSlider.min = 0;
        this._antYSlider.max = this._viz.extents.y;
    }

    /**
     * Schedule smooth update (short delay)
     * @private
     */
    _scheduleSmoothUpdate() {
        clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this._fullUpdate();
        }, 50);
    }

    /**
     * Schedule heavy update (longer delay)
     * @private
     */
    _scheduleHeavyUpdate() {
        clearTimeout(this._updateTimer);
        this._updateTimer = setTimeout(() => {
            this._fullUpdate();
        }, 100);
    }

    /**
     * Perform full visualization update
     * @private
     */
    _fullUpdate() {
        if (this._isUpdating) return;
        this._isUpdating = true;

        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
        }

        this._rafId = requestAnimationFrame(() => {
            const heatmapData = this._array.computeHeatmap(this._gridSize,
                this._viz.extents.x, this._viz.extents.y);
            const beamData = this._array.computeBeamPattern();
            const positions = this._array.getPositions();

            this._viz.updateAll(heatmapData, positions, beamData);

            this._isUpdating = false;
            this._rafId = null;
        });
    }

    /**
     * Update mode indicator
     * @private
     */
    _updateModeIndicator() {
        if (this._currentMode) {
            this._currentMode.textContent = this._activeScenarioName;
        }

        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this._activeScenario !== null) {
            const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${this._activeScenario}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    /**
     * Handle export button click
     * @private
     */
    _handleExport() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `beamforming_${this._activeScenarioName.replace(/\s+/g, '_')}_${timestamp}`;

            this._viz.exportBoth(filename);
            alert(`Snapshots saved: ${filename}`);
        } catch (e) {
            console.error('Snapshot failed', e);
            alert('Snapshot saved locally');
        }
    }

    /**
     * Load scenario (public method)
     * @param {string} scenarioName - Name of scenario
     * @param {object} scenarioConfig - Scenario configuration
     */
    loadScenario(scenarioName, scenarioConfig) {
        clearTimeout(this._updateTimer);
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        // Store frequency range from scenario
        this._currentFreqRange = scenarioConfig.freqRange || null;

        this._array.loadScenario(scenarioConfig);
        this._activeScenario = scenarioName;
        this._activeScenarioName = scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1);

        // Update UI controls
        this._numElementsSlider.value = this._array.numAntennas;
        this._numElementsValue.textContent = this._array.numAntennas;

        // Update spacing mode
        if (this._array.spacingMode === 'lambda') {
            this._spacingModeLambda.checked = true;
            this._updateSpacingSliderForLambda();
        } else {
            this._spacingModeAbsolute.checked = true;
            this._updateSpacingSliderForAbsolute();
        }

        this._distanceSlider.value = this._array.spacing;
        this._updateSpacingDisplay();

        this._geometrySelect.value = this._array.geometry;
        this._curvatureSlider.value = this._array.curvature;
        this._curvatureValue.textContent = this._array.curvature.toFixed(1);
        this._delaySlider.value = this._array.delay;
        this._delayValue.textContent = this._array.delay + '°';

        this._curvatureGroup.style.display =
            (this._array.geometry === 'Curved') ? 'block' : 'none';

        this._updateModeIndicator();
        this._refreshUI();

        setTimeout(() => {
            this._fullUpdate();
        }, 50);
    }

    /**
     * Initialize visualization (call after construction)
     */
    initialize() {
        this._updateModeIndicator();
        this._updateSpacingDisplay();

        setTimeout(() => {
            this._fullUpdate();
        }, 100);
    }
}