/**
 * UIController Class - Encapsulates all UI interactions and updates for multi-array support
 */
class UIController {
    constructor(arrayManager, visualization) {
        // Core components
        this._arrayManager = arrayManager;
        this._viz = visualization;

        // State variables
        this._selectedArrayIndex = 0;
        this._selectedAntenna = 0;
        this._activeScenario = null;
        this._activeScenarioName = 'Custom';
        this._gridSize = 200;
        this._currentFreqRange = null;
        this._updateTimer = null;
        this._isUpdating = false;
        this._rafId = null;
        
        // DOM caches
        this._elements = {};
        
        this._cacheElements();
        this._attachEventListeners();
        this._refreshUI();
        
        console.log('UIController initialized');
    }

    // Getters
    get selectedArrayIndex() { return this._selectedArrayIndex; }
    get selectedAntenna() { return this._selectedAntenna; }
    get activeScenarioName() { return this._activeScenarioName; }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements() {
        // Array Management
        this._elements.arraySelect = document.getElementById('arraySelect');
        this._elements.addArrayBtn = document.getElementById('addArrayBtn');
        this._elements.removeArrayBtn = document.getElementById('removeArrayBtn');
        this._elements.duplicateArrayBtn = document.getElementById('duplicateArrayBtn');
        this._elements.arrayNameInput = document.getElementById('arrayNameInput');

        // Sliders
        this._elements.numElementsSlider = document.getElementById('numElements');
        this._elements.numElementsValue = document.getElementById('numElementsValue');
        this._elements.distanceSlider = document.getElementById('distance');
        this._elements.distanceValue = document.getElementById('distanceValue');
        this._elements.spacingInfo = document.getElementById('spacingInfo');
        this._elements.curvatureSlider = document.getElementById('curvature');
        this._elements.curvatureValue = document.getElementById('curvatureValue');
        this._elements.delaySlider = document.getElementById('delay');
        this._elements.delayValue = document.getElementById('delayValue');
        this._elements.combinedDelaySlider = document.getElementById('combinedDelay');
        this._elements.combinedDelayValue = document.getElementById('combinedDelayValue');
        this._elements.positionXSlider = document.getElementById('arrayPositionX');
        this._elements.positionXValue = document.getElementById('arrayPositionXValue');
        this._elements.positionYSlider = document.getElementById('arrayPositionY');
        this._elements.positionYValue = document.getElementById('arrayPositionYValue');
        this._elements.rotationSlider = document.getElementById('arrayRotation');
        this._elements.rotationValue = document.getElementById('arrayRotationValue');

        // Selects
        this._elements.geometrySelect = document.getElementById('geometry');
        this._elements.antennaSelect = document.getElementById('antennaSelect');
        this._elements.colormapSelect = document.getElementById('colormapSelect');

        // Position sliders
        this._elements.antXSlider = document.getElementById('antX');
        this._elements.antXValue = document.getElementById('antXValue');
        this._elements.antYSlider = document.getElementById('antY');
        this._elements.antYValue = document.getElementById('antYValue');

        // Radio buttons
        this._elements.spacingModeAbsolute = document.getElementById('spacingModeAbsolute');
        this._elements.spacingModeLambda = document.getElementById('spacingModeLambda');

        // Containers
        this._elements.freqContainer = document.getElementById('freqContainer');
        this._elements.curvatureGroup = document.getElementById('curvatureGroup');
        this._elements.arrayInfo = document.getElementById('arrayInfo');

        // Display
        this._elements.currentMode = document.getElementById('currentMode');

        // Buttons
        this._elements.exportBtn = document.getElementById('exportBtn');
        
        console.log('DOM elements cached:', Object.keys(this._elements).length);
    }

    /**
     * Attach all event listeners
     * @private
     */
    _attachEventListeners() {
        this._attachArrayManagementListeners();
        this._attachArrayControlListeners();
        this._attachAntennaControlListeners();
        this._attachVisualizationListeners();
        this._attachWindowListeners();
        
        console.log('Event listeners attached');
    }

    /**
     * Attach array management listeners
     * @private
     */
    _attachArrayManagementListeners() {
        // Array selection
        if (this._elements.arraySelect) {
            this._elements.arraySelect.addEventListener('change', (e) => {
                this._selectedArrayIndex = parseInt(e.target.value);
                this._arrayManager.activeArrayIndex = this._selectedArrayIndex;
                console.log(`Array selected: ${this._selectedArrayIndex}`);
                this._refreshUI();
                this._scheduleHeavyUpdate();
            });
        }

        // Add array button
        if (this._elements.addArrayBtn) {
            this._elements.addArrayBtn.addEventListener('click', () => {
                const name = this._elements.arrayNameInput?.value || `Array ${this._arrayManager.numArrays + 1}`;
                console.log(`Adding new array: ${name}`);
                this._arrayManager.createArray({
                    name: name,
                    numAntennas: 8,
                    spacing: 0.15,
                    positionX: (this._arrayManager.numArrays - 1) * 2
                });
                this._updateArraySelect();
                this._refreshUI();
                this._scheduleHeavyUpdate();
            });
        }

        // Remove array button
        if (this._elements.removeArrayBtn) {
            this._elements.removeArrayBtn.addEventListener('click', () => {
                if (this._arrayManager.numArrays > 1) {
                    console.log(`Removing array at index ${this._selectedArrayIndex}`);
                    this._arrayManager.removeArray(this._selectedArrayIndex);
                    this._updateArraySelect();
                    this._refreshUI();
                    this._scheduleHeavyUpdate();
                } else {
                    alert("Cannot remove the last array. At least one array must exist.");
                }
            });
        }

        // Duplicate array button
        if (this._elements.duplicateArrayBtn) {
            this._elements.duplicateArrayBtn.addEventListener('click', () => {
                console.log(`Duplicating array at index ${this._selectedArrayIndex}`);
                this._arrayManager.duplicateArray(this._selectedArrayIndex);
                this._updateArraySelect();
                this._refreshUI();
                this._scheduleHeavyUpdate();
            });
        }

        // Array name input
        if (this._elements.arrayNameInput) {
            this._elements.arrayNameInput.addEventListener('change', (e) => {
                const array = this._getActiveArray();
                if (array) {
                    array.name = e.target.value;
                    console.log(`Array renamed to: ${e.target.value}`);
                    this._updateArraySelect();
                    this._updateArrayInfo();
                }
            });
        }
    }

    /**
     * Attach array-level control listeners
     * @private
     */
    _attachArrayControlListeners() {
        // Number of elements
        this._elements.numElementsSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this._elements.numElementsValue.textContent = val;
        });

        this._elements.numElementsSlider.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                console.log(`Setting antenna count to: ${val}`);
                array.setAntennaCount(val);
                this._refreshUI();
                this._scheduleHeavyUpdate();
            }
        });

        // Spacing mode
        this._elements.spacingModeAbsolute.addEventListener('change', () => {
            if (this._elements.spacingModeAbsolute.checked) {
                const array = this._getActiveArray();
                if (array) {
                    array.spacingMode = 'absolute';
                    console.log('Spacing mode set to: absolute');
                    this._updateSpacingSliderForAbsolute(array);
                    this._updateSpacingDisplay(array);
                    this._scheduleSmoothUpdate();
                }
            }
        });

        this._elements.spacingModeLambda.addEventListener('change', () => {
            if (this._elements.spacingModeLambda.checked) {
                const array = this._getActiveArray();
                if (array) {
                    array.spacingMode = 'lambda';
                    console.log('Spacing mode set to: lambda');
                    this._updateSpacingSliderForLambda(array);
                    this._updateSpacingDisplay(array);
                    this._scheduleSmoothUpdate();
                }
            }
        });

        // Distance/spacing
        this._elements.distanceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            
            if (array) {
                if (array.spacingMode === 'lambda') {
                    array.lambdaMultiplier = val;
                    console.log(`Lambda multiplier set to: ${val}`);
                } else {
                    array.spacing = val;
                    console.log(`Spacing set to: ${val} m`);
                }

                this._updateSpacingDisplay(array);
                this._updatePositionSliders();
                this._scheduleSmoothUpdate();
            }
        });

        // Curvature
        this._elements.curvatureSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.curvature = val;
                this._elements.curvatureValue.textContent = val.toFixed(1);
                console.log(`Curvature set to: ${val}`);
                this._updatePositionSliders();
                this._scheduleSmoothUpdate();
            }
        });

        // Array delay
        this._elements.delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.delay = val;
                this._elements.delayValue.textContent = val + '°';
                console.log(`Array delay set to: ${val}°`);
                this._scheduleSmoothUpdate();
            }
        });

        // Combined delay (global)
        if (this._elements.combinedDelaySlider) {
            this._elements.combinedDelaySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                this._arrayManager.combinedDelay = val;
                this._elements.combinedDelayValue.textContent = val + '°';
                console.log(`Combined delay set to: ${val}°`);
                this._scheduleSmoothUpdate();
            });
        }

        // Array position and rotation
        this._elements.positionXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.positionX = val;
                this._elements.positionXValue.textContent = val.toFixed(2);
                console.log(`Array X position set to: ${val} m`);
                this._scheduleSmoothUpdate();
            }
        });

        this._elements.positionYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.positionY = val;
                this._elements.positionYValue.textContent = val.toFixed(2);
                console.log(`Array Y position set to: ${val} m`);
                this._scheduleSmoothUpdate();
            }
        });

        this._elements.rotationSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.rotation = val;
                this._elements.rotationValue.textContent = val + '°';
                console.log(`Array rotation set to: ${val}°`);
                this._scheduleSmoothUpdate();
            }
        });

        // Geometry
        this._elements.geometrySelect.addEventListener('change', (e) => {
            const array = this._getActiveArray();
            if (array) {
                array.geometry = e.target.value;
                console.log(`Geometry set to: ${e.target.value}`);
                this._elements.curvatureGroup.style.display =
                    (e.target.value === 'Curved') ? 'block' : 'none';
                this._refreshUI();
                this._scheduleHeavyUpdate();
            }
        });
    }

    /**
     * Attach individual antenna control listeners
     * @private
     */
    _attachAntennaControlListeners() {
        // Antenna selection
        this._elements.antennaSelect.addEventListener('change', (e) => {
            this._selectedAntenna = parseInt(e.target.value);
            console.log(`Antenna selected: ${this._selectedAntenna}`);
            this._updatePositionSliders();
        });

        // X position
        this._elements.antXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.setAntennaPosition(this._selectedAntenna, val,
                    array.getAntenna(this._selectedAntenna).y);
                this._elements.antXValue.textContent = val.toFixed(2);
                console.log(`Antenna ${this._selectedAntenna} X position set to: ${val} m`);
                this._scheduleSmoothUpdate();
            }
        });

        // Y position
        this._elements.antYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            const array = this._getActiveArray();
            if (array) {
                array.setAntennaPosition(this._selectedAntenna,
                    array.getAntenna(this._selectedAntenna).x, val);
                this._elements.antYValue.textContent = val.toFixed(2);
                console.log(`Antenna ${this._selectedAntenna} Y position set to: ${val} m`);
                this._scheduleSmoothUpdate();
            }
        });
    }

    /**
     * Attach visualization control listeners
     * @private
     */
    _attachVisualizationListeners() {
        // Colormap
        this._elements.colormapSelect.addEventListener('change', (e) => {
            this._viz.colormap = e.target.value;
            console.log(`Colormap changed to: ${e.target.value}`);
            this._fullUpdate();
        });

        // Export
        this._elements.exportBtn.addEventListener('click', () => {
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
     * Get active array
     * @private
     */
    _getActiveArray() {
        return this._arrayManager.activeArray;
    }

    /**
     * Update array selection dropdown
     * @private
     */
    _updateArraySelect() {
        if (!this._elements.arraySelect) return;
        
        this._elements.arraySelect.innerHTML = '';
        this._arrayManager.arrays.forEach((array, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.text = array.name;
            opt.selected = (index === this._selectedArrayIndex);
            this._elements.arraySelect.appendChild(opt);
        });
        
        console.log(`Array select updated. Total options: ${this._arrayManager.arrays.length}`);
    }

    /**
     * Update array information display
     * @private
     */
    _updateArrayInfo() {
        if (!this._elements.arrayInfo) return;
        
        const array = this._getActiveArray();
        if (array) {
            const info = `
                <small class="text-secondary">
                    Antennas: ${array.numAntennas} | 
                    Position: (${array.positionX.toFixed(2)}, ${array.positionY.toFixed(2)}) m | 
                    Rotation: ${array.rotation}°
                </small>
            `;
            this._elements.arrayInfo.innerHTML = info;
        }
    }

    /**
     * Update spacing slider for absolute mode
     * @private
     */
    _updateSpacingSliderForAbsolute(array) {
        this._elements.distanceSlider.min = 0;
        this._elements.distanceSlider.max = 5.0;
        this._elements.distanceSlider.step = 0.1;
        this._elements.distanceSlider.value = array.spacing;
    }

    /**
     * Update spacing slider for lambda mode
     * @private
     */
    _updateSpacingSliderForLambda(array) {
        this._elements.distanceSlider.min = 0;
        this._elements.distanceSlider.max = 2.0;
        this._elements.distanceSlider.step = 0.01;
        this._elements.distanceSlider.value = array.lambdaMultiplier;
    }

    /**
     * Update spacing display text
     * @private
     */
    _updateSpacingDisplay(array) {
        if (array.spacingMode === 'lambda') {
            const lambda = array.averageWavelength;
            const effectiveSpacing = array.effectiveSpacing;
            this._elements.distanceValue.textContent = `${array.lambdaMultiplier.toFixed(2)}λ`;
            this._elements.spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                λ = ${(lambda * 1000).toFixed(2)} mm | Actual: ${(effectiveSpacing * 1000).toFixed(2)} mm
            </small>`;
        } else {
            this._elements.distanceValue.textContent = array.spacing.toFixed(2);
            this._elements.spacingInfo.innerHTML = `<small class="text-secondary" style="font-size: 0.65rem;">
                Range: 0.1m - 5.0m (10cm to 5 meters)
            </small>`;
        }
    }

    /**
     * Update position sliders for selected antenna
     * @private
     */
    _updatePositionSliders() {
        const array = this._getActiveArray();
        if (!array) return;

        const ant = array.getAntenna(this._selectedAntenna);
        if (!ant) return;

        this._elements.antXSlider.value = ant.x;
        this._elements.antYSlider.value = ant.y;
        this._elements.antXValue.textContent = ant.x.toFixed(2);
        this._elements.antYValue.textContent = ant.y.toFixed(2);
    }

    /**
     * Refresh entire UI (after major changes)
     * @private
     */
    _refreshUI() {
        const array = this._getActiveArray();
        if (!array) {
            console.warn('No active array found for UI refresh');
            return;
        }

        console.log('Refreshing UI for array:', array.name);

        // Update array controls with ACTUAL values from array object
        this._elements.numElementsSlider.value = array.numAntennas;
        this._elements.numElementsValue.textContent = array.numAntennas;
        
        // Update spacing mode
        if (array.spacingMode === 'lambda') {
            this._elements.spacingModeLambda.checked = true;
            this._elements.spacingModeAbsolute.checked = false;
            this._updateSpacingSliderForLambda(array);
        } else {
            this._elements.spacingModeAbsolute.checked = true;
            this._elements.spacingModeLambda.checked = false;
            this._updateSpacingSliderForAbsolute(array);
        }
        
        // Update spacing value based on mode
        if (array.spacingMode === 'lambda') {
            this._elements.distanceSlider.value = array.lambdaMultiplier;
        } else {
            this._elements.distanceSlider.value = array.spacing;
        }
        this._updateSpacingDisplay(array);
        
        // Update geometry and curvature
        this._elements.geometrySelect.value = array.geometry;
        this._elements.curvatureSlider.value = array.curvature;
        this._elements.curvatureValue.textContent = array.curvature.toFixed(1);
        
        // Update delay
        this._elements.delaySlider.value = array.delay;
        this._elements.delayValue.textContent = array.delay + '°';
        
        // Update position and rotation
        this._elements.positionXSlider.value = array.positionX;
        this._elements.positionXValue.textContent = array.positionX.toFixed(2);
        this._elements.positionYSlider.value = array.positionY;
        this._elements.positionYValue.textContent = array.positionY.toFixed(2);
        this._elements.rotationSlider.value = array.rotation;
        this._elements.rotationValue.textContent = array.rotation + '°';
        
        // Update combined delay
        if (this._elements.combinedDelaySlider) {
            this._elements.combinedDelaySlider.value = this._arrayManager.combinedDelay;
            this._elements.combinedDelayValue.textContent = this._arrayManager.combinedDelay + '°';
        }
        
        // Show/hide curvature based on geometry
        this._elements.curvatureGroup.style.display =
            (array.geometry === 'Curved') ? 'block' : 'none';

        // Update name input
        if (this._elements.arrayNameInput) {
            this._elements.arrayNameInput.value = array.name;
        }

        // Update other UI components
        this._updateAntennaSelect();
        this._updateFrequencyControls();
        this._updatePositionSliderRanges();
        this._updatePositionSliders();
        this._updateArrayInfo();
        
        console.log('UI refresh complete');
    }

    /**
     * Update antenna selection dropdown
     * @private
     */
    _updateAntennaSelect() {
        const array = this._getActiveArray();
        if (!array) return;

        this._elements.antennaSelect.innerHTML = '';
        for (let i = 0; i < array.numAntennas; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = `Antenna ${i + 1}`;
            this._elements.antennaSelect.appendChild(opt);
        }

        if (this._selectedAntenna >= array.numAntennas) {
            this._selectedAntenna = 0;
        }
        this._elements.antennaSelect.value = this._selectedAntenna;
        
        console.log(`Antenna select updated. Total antennas: ${array.numAntennas}`);
    }

    /**
     * Update frequency control sliders
     * @private
     */
    _updateFrequencyControls() {
        const array = this._getActiveArray();
        if (!array) return;

        this._elements.freqContainer.innerHTML = '';

        for (let i = 0; i < array.numAntennas; i++) {
            const freq = array.getAntenna(i).frequency;
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
            this._elements.freqContainer.appendChild(div);
        }

        // Attach frequency slider listeners
        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                const array = this._getActiveArray();
                if (array) {
                    array.setAntennaFrequency(idx, val);

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
                    if (array.spacingMode === 'lambda') {
                        this._updateSpacingDisplay(array);
                    }

                    console.log(`Antenna ${idx} frequency set to: ${val} Hz`);
                    this._scheduleSmoothUpdate();
                }
            });
        });
        
        console.log(`Frequency controls updated for ${array.numAntennas} antennas`);
    }

    /**
     * Get frequency range for sliders
     * @private
     */
    _getFreqRange() {
        if (this._currentFreqRange) {
            return this._currentFreqRange;
        }
        return { min: 100, max: 5e9, step: 1e6 };
    }

    /**
     * Update position slider ranges
     * @private
     */
    _updatePositionSliderRanges() {
        this._elements.antXSlider.min = -this._viz.extents.x;
        this._elements.antXSlider.max = this._viz.extents.x;
        this._elements.antYSlider.min = 0;
        this._elements.antYSlider.max = this._viz.extents.y;
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
            console.log('Performing full visualization update...');
            
            try {
                const heatmapData = this._arrayManager.computeCombinedHeatmap(
                    this._gridSize, this._viz.extents.x, this._viz.extents.y);
                const beamData = this._arrayManager.computeCombinedBeamPattern();
                const positions = this._arrayManager.getAllAntennaPositions();

                this._viz.updateAll(heatmapData, positions, beamData);
                
                console.log('Visualization update complete');
            } catch (error) {
                console.error('Error during visualization update:', error);
            } finally {
                this._isUpdating = false;
                this._rafId = null;
            }
        });
    }

    /**
     * Update mode indicator
     * @private
     */
    _updateModeIndicator() {
        if (this._elements.currentMode) {
            this._elements.currentMode.textContent = this._activeScenarioName;
            console.log(`Mode indicator updated to: ${this._activeScenarioName}`);
        }

        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this._activeScenario !== null) {
            const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${this._activeScenario}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                console.log(`Scenario button activated: ${this._activeScenario}`);
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
            console.log(`Export completed: ${filename}`);
        } catch (e) {
            console.error('Snapshot failed', e);
            alert('Snapshot saved locally');
        }
    }

    /**
     * Update ALL UI controls from scenario configuration
     * @private
     */
    _updateAllUIControlsFromScenario(scenarioConfig) {
        console.log('Updating UI controls from scenario config:', scenarioConfig);
        
        // Update global controls
        if (scenarioConfig.combined_delay !== undefined) {
            this._arrayManager.combinedDelay = scenarioConfig.combined_delay;
            if (this._elements.combinedDelaySlider) {
                this._elements.combinedDelaySlider.value = scenarioConfig.combined_delay;
                this._elements.combinedDelayValue.textContent = scenarioConfig.combined_delay + '°';
            }
        }
        
        if (scenarioConfig.propagation_speed !== undefined) {
            this._arrayManager.propagationSpeed = scenarioConfig.propagation_speed;
        }

        // Update array controls for each array
        const arrays = scenarioConfig.arrays || [scenarioConfig]; // Support both single and multi-array
        
        arrays.forEach((arrayConfig, index) => {
            if (index < this._arrayManager.arrays.length) {
                const array = this._arrayManager.arrays[index];
                
                console.log(`Updating array ${index} with config:`, arrayConfig);
                
                // Update array configuration
                array.loadConfiguration(arrayConfig);
            }
        });
    }

    /**
     * Load scenario (public method)
     * @param {string} scenarioName - Name of scenario
     * @param {object} scenarioConfig - Scenario configuration
     */
    loadScenario(scenarioName, scenarioConfig) {
        console.log('Loading scenario:', scenarioName, scenarioConfig);
        
        clearTimeout(this._updateTimer);
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        // Store frequency range from scenario
        this._currentFreqRange = scenarioConfig.freqRange || null;

        this._arrayManager.loadScenario(scenarioConfig);
        this._selectedArrayIndex = this._arrayManager.activeArrayIndex;
        this._activeScenario = scenarioName;
        this._activeScenarioName = scenarioConfig.name || 
            scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1);

        // FIXED: Update ALL UI controls with scenario values
        this._updateAllUIControlsFromScenario(scenarioConfig);

        this._updateModeIndicator();
        this._refreshUI();

        setTimeout(() => {
            this._fullUpdate();
        }, 50);
        
        console.log(`Scenario "${scenarioName}" loaded successfully`);
    }

    /**
     * Initialize visualization (call after construction)
     */
    initialize() {
        console.log('Initializing UIController...');
        this._updateModeIndicator();
        this._updateArraySelect();
        
        const array = this._getActiveArray();
        if (array) {
            this._updateSpacingDisplay(array);
        }

        setTimeout(() => {
            this._fullUpdate();
        }, 100);
        
        console.log('UIController initialization complete');
    }
}