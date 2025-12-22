/**
 * UIController Class - Encapsulates all UI interactions and updates for multi-array support
 */
class UIController {
    constructor(arrayManager, visualization) {
        // Private properties with proper encapsulation
        this._arrayManager = arrayManager;
        this._visualization = visualization;

        // State management
        this._selectedArrayIndex = 0;
        this._selectedAntenna = 0;
        this._activeScenario = null;
        this._activeScenarioName = 'Custom';
        this._gridSize = 200;
        this._currentFreqRange = null;
        this._updateTimer = null;
        this._isUpdating = false;
        this._rafId = null;
        this._newArrayName = '';

        // DOM elements cache
        this._elements = {};

        this._initialize();
    }

    // ==================== PUBLIC GETTERS AND SETTERS ====================

    get selectedArrayIndex() {
        return this._selectedArrayIndex;
    }

    set selectedArrayIndex(value) {
        const oldValue = this._selectedArrayIndex;
        this._selectedArrayIndex = value;
        this._arrayManager.activeArrayIndex = value;

        if (oldValue !== value) {
            console.log(`Array index changed from ${oldValue} to ${value}`);
            this._onArraySelectionChanged();
        }
    }

    get selectedAntenna() {
        return this._selectedAntenna;
    }

    set selectedAntenna(value) {
        const oldValue = this._selectedAntenna;
        this._selectedAntenna = value;

        if (oldValue !== value) {
            console.log(`Selected antenna changed from ${oldValue} to ${value}`);
            this._onAntennaSelectionChanged();
        }
    }

    get activeScenarioName() {
        return this._activeScenarioName;
    }

    set activeScenarioName(value) {
        this._activeScenarioName = value;
        this._updateModeIndicator();
    }

    get activeScenario() {
        return this._activeScenario;
    }

    set activeScenario(value) {
        this._activeScenario = value;
    }

    get arrayManager() {
        return this._arrayManager;
    }

    get visualization() {
        return this._visualization;
    }

    get gridSize() {
        return this._gridSize;
    }

    set gridSize(value) {
        this._gridSize = value;
    }

    get currentFreqRange() {
        return this._currentFreqRange || { min: 100, max: 5e9, step: 1e6 };
    }

    set currentFreqRange(value) {
        this._currentFreqRange = value;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Initialize the controller
     * @private
     */
    _initialize() {
        this._cacheElements();
        this._attachEventListeners();
        this._refreshUI();
        console.log('UIController initialized');
    }

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
        this._elements.renameArrayBtn = document.getElementById('renameArrayBtn');

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
                this.selectedArrayIndex = parseInt(e.target.value);
            });
        }

        // Add array button
        if (this._elements.addArrayBtn) {
            this._elements.addArrayBtn.addEventListener('click', () => {
                this._addArray();
            });
        }

        // Remove array button
        if (this._elements.removeArrayBtn) {
            this._elements.removeArrayBtn.addEventListener('click', () => {
                this._removeCurrentArray();
            });
        }

        // Duplicate array button
        if (this._elements.duplicateArrayBtn) {
            this._elements.duplicateArrayBtn.addEventListener('click', () => {
                this._duplicateCurrentArray();
            });
        }

        // Array name input
        if (this._elements.arrayNameInput) {
            this._elements.arrayNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._renameCurrentArray();
                }
            });

            this._elements.arrayNameInput.addEventListener('input', (e) => {
                this._newArrayName = e.target.value.trim();
            });
        }

        // Rename button
        if (this._elements.renameArrayBtn) {
            this._elements.renameArrayBtn.addEventListener('click', () => {
                this._renameCurrentArray();
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
            this._setAntennaCount(val);
        });

        // Spacing mode
        this._elements.spacingModeAbsolute.addEventListener('change', () => {
            if (this._elements.spacingModeAbsolute.checked) {
                this._setSpacingMode('absolute');
            }
        });

        this._elements.spacingModeLambda.addEventListener('change', () => {
            if (this._elements.spacingModeLambda.checked) {
                this._setSpacingMode('lambda');
            }
        });

        // Distance/spacing
        this._elements.distanceSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._updateSpacingValue(val);
        });

        // Curvature
        this._elements.curvatureSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._setCurvature(val);
        });

        // Array delay
        this._elements.delaySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this._setArrayDelay(val);
        });

        // Combined delay (global)
        if (this._elements.combinedDelaySlider) {
            this._elements.combinedDelaySlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                this._setCombinedDelay(val);
            });
        }

        // Array position and rotation
        this._elements.positionXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._setArrayPositionX(val);
        });

        this._elements.positionYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._setArrayPositionY(val);
        });

        this._elements.rotationSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            this._setArrayRotation(val);
        });

        // Geometry
        this._elements.geometrySelect.addEventListener('change', (e) => {
            this._setGeometry(e.target.value);
        });
    }

    /**
     * Attach individual antenna control listeners
     * @private
     */
    _attachAntennaControlListeners() {
        // Antenna selection
        this._elements.antennaSelect.addEventListener('change', (e) => {
            this.selectedAntenna = parseInt(e.target.value);
        });

        // X position
        this._elements.antXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._setAntennaXPosition(val);
        });

        // Y position
        this._elements.antYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this._setAntennaYPosition(val);
        });
    }

    /**
     * Attach visualization control listeners
     * @private
     */
    _attachVisualizationListeners() {
        // Colormap
        this._elements.colormapSelect.addEventListener('change', (e) => {
            this.visualization.colormap = e.target.value;
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
                this.visualization.resize();
            }, 150);
        });
    }

    // ==================== ARRAY MANAGEMENT METHODS ====================

    /**
     * Get the active array
     * @private
     * @returns {PhasedArray|null}
     */
    _getActiveArray() {
        return this.arrayManager.activeArray;
    }

    /**
     * Get array name from input field
     * @private
     * @returns {string}
     */
    _getArrayNameInput() {
        if (!this._elements.arrayNameInput) return '';
        return this._elements.arrayNameInput.value.trim();
    }

    /**
     * Clear array name input field
     * @private
     */
    _clearArrayNameInput() {
        if (this._elements.arrayNameInput) {
            this._elements.arrayNameInput.value = '';
            this._newArrayName = '';
        }
    }

    /**
     * Add a new array
     * @private
     */
    _addArray() {
        const name = this._getArrayNameInput() || `Array ${this.arrayManager.numArrays + 1}`;
        console.log(`Adding new array: ${name}`);

        this.arrayManager.createArray({
            name: name,
            numAntennas: 8,
            spacing: 0.15,
            positionX: (this.arrayManager.numArrays) * 2
        });

        this.selectedArrayIndex = this.arrayManager.numArrays - 1;

        // Clear input after adding
        this._clearArrayNameInput();

        this._updateArraySelect();
        this._refreshUI();
        this._scheduleHeavyUpdate();
    }

    /**
     * Remove the current array
     * @private
     */
    _removeCurrentArray() {
        if (this.arrayManager.numArrays > 1) {
            const arrayName = this._getActiveArray()?.name || `Array ${this.selectedArrayIndex + 1}`;

            if (confirm(`Are you sure you want to remove "${arrayName}"?`)) {
                console.log(`Removing array at index ${this.selectedArrayIndex}: ${arrayName}`);
                this.arrayManager.removeArray(this.selectedArrayIndex);
                this.selectedArrayIndex = Math.min(this.selectedArrayIndex, this.arrayManager.numArrays - 1);
                this._updateArraySelect();
                this._refreshUI();
                this._scheduleHeavyUpdate();
            }
        } else {
            alert("Cannot remove the last array. At least one array must exist.");
        }
    }

    /**
     * Duplicate the current array
     * @private
     */
    _duplicateCurrentArray() {
        const sourceArray = this._getActiveArray();
        if (sourceArray) {
            console.log(`Duplicating array: ${sourceArray.name}`);
            this.arrayManager.duplicateArray(this.selectedArrayIndex);
            this.selectedArrayIndex = this.arrayManager.numArrays - 1;
            this._updateArraySelect();
            this._refreshUI();
            this._scheduleHeavyUpdate();
        }
    }

    /**
     * Rename the current array
     * @private
     */
    _renameCurrentArray() {
        const array = this._getActiveArray();
        const newName = this._getArrayNameInput();

        if (!array || !newName) return;

        if (newName !== array.name) {
            console.log(`Renaming array from "${array.name}" to "${newName}"`);
            array.name = newName;
            this._updateArraySelect();
            this._updateArrayInfo();

            // Clear input after rename
            this._clearArrayNameInput();
        }
    }

    /**
     * Handle array selection change
     * @private
     */
    _onArraySelectionChanged() {
        console.log(`Array selected: ${this.selectedArrayIndex} - ${this._getActiveArray()?.name}`);
        this._refreshUI();
        this._scheduleHeavyUpdate();
    }

    /**
     * Handle antenna selection change
     * @private
     */
    _onAntennaSelectionChanged() {
        console.log(`Antenna selected: ${this.selectedAntenna}`);
        this._updatePositionSliders();
    }

    // ==================== ARRAY PROPERTY SETTERS ====================

    /**
     * Set antenna count for active array
     * @private
     * @param {number} count
     */
    _setAntennaCount(count) {
        const array = this._getActiveArray();
        if (array) {
            console.log(`Setting antenna count to: ${count}`);
            array.setAntennaCount(count);
            this._refreshUI();
            this._scheduleHeavyUpdate();
        }
    }

    /**
     * Set spacing mode for active array
     * @private
     * @param {string} mode - 'absolute' or 'lambda'
     */
    _setSpacingMode(mode) {
        const array = this._getActiveArray();
        if (array) {
            array.spacingMode = mode;
            console.log(`Spacing mode set to: ${mode}`);

            if (mode === 'absolute') {
                this._updateSpacingSliderForAbsolute(array);
            } else {
                this._updateSpacingSliderForLambda(array);
            }

            this._updateSpacingDisplay(array);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Update spacing value
     * @private
     * @param {number} value
     */
    _updateSpacingValue(value) {
        const array = this._getActiveArray();
        if (array) {
            if (array.spacingMode === 'lambda') {
                array.lambdaMultiplier = value;
                console.log(`Lambda multiplier set to: ${value}`);
            } else {
                array.spacing = value;
                console.log(`Spacing set to: ${value} m`);
            }

            this._updateSpacingDisplay(array);
            this._updatePositionSliders();
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set curvature for active array
     * @private
     * @param {number} value
     */
    _setCurvature(value) {
        const array = this._getActiveArray();
        if (array) {
            array.curvature = value;
            this._elements.curvatureValue.textContent = value.toFixed(1);
            console.log(`Curvature set to: ${value}`);
            this._updatePositionSliders();
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set array delay for active array
     * @private
     * @param {number} value
     */
    _setArrayDelay(value) {
        const array = this._getActiveArray();
        if (array) {
            array.delay = value;
            this._elements.delayValue.textContent = value + '°';
            console.log(`Array delay set to: ${value}°`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set combined delay for all arrays
     * @private
     * @param {number} value
     */
    _setCombinedDelay(value) {
        this.arrayManager.combinedDelay = value;
        this._elements.combinedDelayValue.textContent = value + '°';
        console.log(`Combined delay set to: ${value}°`);
        this._scheduleSmoothUpdate();
    }

    /**
     * Set array X position
     * @private
     * @param {number} value
     */
    _setArrayPositionX(value) {
        const array = this._getActiveArray();
        if (array) {
            array.positionX = value;
            this._elements.positionXValue.textContent = value.toFixed(2);
            console.log(`Array X position set to: ${value} m`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set array Y position
     * @private
     * @param {number} value
     */
    _setArrayPositionY(value) {
        const array = this._getActiveArray();
        if (array) {
            array.positionY = value;
            this._elements.positionYValue.textContent = value.toFixed(2);
            console.log(`Array Y position set to: ${value} m`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set array rotation
     * @private
     * @param {number} value
     */
    _setArrayRotation(value) {
        const array = this._getActiveArray();
        if (array) {
            array.rotation = value;
            this._elements.rotationValue.textContent = value + '°';
            console.log(`Array rotation set to: ${value}°`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set geometry for active array
     * @private
     * @param {string} value
     */
    _setGeometry(value) {
        const array = this._getActiveArray();
        if (array) {
            array.geometry = value;
            console.log(`Geometry set to: ${value}`);

            this._elements.curvatureGroup.style.display =
                (value === 'Curved') ? 'block' : 'none';

            this._refreshUI();
            this._scheduleHeavyUpdate();
        }
    }

    /**
     * Set antenna X position
     * @private
     * @param {number} value
     */
    _setAntennaXPosition(value) {
        const array = this._getActiveArray();
        if (array) {
            const currentY = array.getAntenna(this.selectedAntenna).y;
            array.setAntennaPosition(this.selectedAntenna, value, currentY);
            this._elements.antXValue.textContent = value.toFixed(2);
            console.log(`Antenna ${this.selectedAntenna} X position set to: ${value} m`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Set antenna Y position
     * @private
     * @param {number} value
     */
    _setAntennaYPosition(value) {
        const array = this._getActiveArray();
        if (array) {
            const currentX = array.getAntenna(this.selectedAntenna).x;
            array.setAntennaPosition(this.selectedAntenna, currentX, value);
            this._elements.antYValue.textContent = value.toFixed(2);
            console.log(`Antenna ${this.selectedAntenna} Y position set to: ${value} m`);
            this._scheduleSmoothUpdate();
        }
    }

    // ==================== UI UPDATE METHODS ====================

    /**
     * Refresh entire UI
     * @private
     */
    _refreshUI() {
        this._updateArraySelect();

        const array = this._getActiveArray();
        if (!array) {
            console.warn('No active array found for UI refresh');

            if (this.arrayManager.numArrays === 0) {
                console.error('CRITICAL: No arrays exist!');
                if (this._elements.arrayInfo) {
                    this._elements.arrayInfo.innerHTML = `
                        <small class="text-danger">
                            <i class="fas fa-exclamation-triangle"></i> No arrays exist!
                        </small>
                    `;
                }
            }
            return;
        }

        console.log('Refreshing UI for array:', array.name);

        // Update array controls
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

        // Update spacing value
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
            this._elements.combinedDelaySlider.value = this.arrayManager.combinedDelay;
            this._elements.combinedDelayValue.textContent = this.arrayManager.combinedDelay + '°';
        }

        // Show/hide curvature based on geometry
        this._elements.curvatureGroup.style.display =
            (array.geometry === 'Curved') ? 'block' : 'none';

        // Update name input
        if (this._elements.arrayNameInput) {
            this._elements.arrayNameInput.placeholder = `"${array.name}" - Type to rename`;

            if (!this._newArrayName) {
                this._elements.arrayNameInput.value = '';
            }
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
     * Update array selection dropdown
     * @private
     */
    _updateArraySelect() {
        if (!this._elements.arraySelect) {
            console.error('arraySelect element not found!');
            return;
        }

        console.log('Updating array select. Total arrays:', this.arrayManager.numArrays);

        // Clear existing options
        this._elements.arraySelect.innerHTML = '';

        // Add options for each array
        this.arrayManager.arrays.forEach((array, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = array.name || `Array ${index + 1}`;
            opt.selected = (index === this.selectedArrayIndex);
            this._elements.arraySelect.appendChild(opt);
        });

        // If no arrays, add a default option
        if (this.arrayManager.numArrays === 0) {
            const opt = document.createElement('option');
            opt.value = 0;
            opt.textContent = 'No arrays';
            opt.disabled = true;
            this._elements.arraySelect.appendChild(opt);
        }

        console.log(`Array select updated with ${this.arrayManager.numArrays} options, selected: ${this.selectedArrayIndex}`);
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
            opt.textContent = `Antenna ${i + 1}`;
            this._elements.antennaSelect.appendChild(opt);
        }

        if (this.selectedAntenna >= array.numAntennas) {
            this.selectedAntenna = 0;
        }
        this._elements.antennaSelect.value = this.selectedAntenna;

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
                       min="${this.currentFreqRange.min}" 
                       max="${this.currentFreqRange.max}" 
                       step="${this.currentFreqRange.step}" 
                       value="${freq}">
            `;
            this._elements.freqContainer.appendChild(div);
        }

        // Attach frequency slider listeners
        document.querySelectorAll('.freq-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                this._onFrequencySliderChanged(e);
            });
        });

        console.log(`Frequency controls updated for ${array.numAntennas} antennas`);
    }

    /**
     * Handle frequency slider change
     * @private
     * @param {Event} e
     */
    _onFrequencySliderChanged(e) {
        const idx = parseInt(e.target.dataset.index);
        const val = parseFloat(e.target.value);
        const array = this._getActiveArray();

        if (array) {
            array.setAntennaFrequency(idx, val);

            // Update display
            this._updateFrequencyDisplay(idx, val);

            // Update spacing display in lambda mode
            if (array.spacingMode === 'lambda') {
                this._updateSpacingDisplay(array);
            }

            console.log(`Antenna ${idx} frequency set to: ${val} Hz`);
            this._scheduleSmoothUpdate();
        }
    }

    /**
     * Update frequency display
     * @private
     * @param {number} index
     * @param {number} value
     */
    _updateFrequencyDisplay(index, value) {
        let freqDisplay, freqUnit;

        if (value >= 1e9) {
            freqDisplay = (value / 1e9).toFixed(3);
            freqUnit = 'GHz';
        } else if (value >= 1e6) {
            freqDisplay = (value / 1e6).toFixed(2);
            freqUnit = 'MHz';
        } else if (value >= 1e3) {
            freqDisplay = (value / 1e3).toFixed(1);
            freqUnit = 'kHz';
        } else {
            freqDisplay = value.toFixed(0);
            freqUnit = 'Hz';
        }

        const freqSpan = document.getElementById(`freqVal${index}`);
        if (freqSpan) {
            freqSpan.innerText = freqDisplay;
            freqSpan.parentElement.innerHTML = `<span id="freqVal${index}">${freqDisplay}</span> ${freqUnit}`;
        }
    }

    /**
     * Update spacing slider for absolute mode
     * @private
     * @param {PhasedArray} array
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
     * @param {PhasedArray} array
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
     * @param {PhasedArray} array
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
     * Update position slider ranges
     * @private
     */
    _updatePositionSliderRanges() {
        this._elements.antXSlider.min = -this.visualization.extents.x;
        this._elements.antXSlider.max = this.visualization.extents.x;
        this._elements.antYSlider.min = 0;
        this._elements.antYSlider.max = this.visualization.extents.y;
    }

    /**
     * Update position sliders for selected antenna
     * @private
     */
    _updatePositionSliders() {
        const array = this._getActiveArray();
        if (!array) return;

        const ant = array.getAntenna(this.selectedAntenna);
        if (!ant) return;

        this._elements.antXSlider.value = ant.x;
        this._elements.antYSlider.value = ant.y;
        this._elements.antXValue.textContent = ant.x.toFixed(2);
        this._elements.antYValue.textContent = ant.y.toFixed(2);
    }

    // ==================== UPDATE SCHEDULING ====================

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
                const heatmapData = this.arrayManager.computeCombinedHeatmap(
                    this.gridSize, this.visualization.extents.x, this.visualization.extents.y);
                const beamData = this.arrayManager.computeCombinedBeamPattern();
                const positions = this.arrayManager.getAllAntennaPositions();

                this.visualization.updateAll(heatmapData, positions, beamData);

                console.log('Visualization update complete');
            } catch (error) {
                console.error('Error during visualization update:', error);
            } finally {
                this._isUpdating = false;
                this._rafId = null;
            }
        });
    }

    // ==================== SCENARIO MANAGEMENT ====================

    /**
     * Update mode indicator
     * @private
     */
    _updateModeIndicator() {
        if (this._elements.currentMode) {
            this._elements.currentMode.textContent = this.activeScenarioName;
            console.log(`Mode indicator updated to: ${this.activeScenarioName}`);
        }

        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (this.activeScenario !== null) {
            const activeBtn = document.querySelector(`.scenario-btn[data-scenario="${this.activeScenario}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                console.log(`Scenario button activated: ${this.activeScenario}`);
            }
        }
    }

    /**
     * Load scenario configuration
     * @public
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

        this.activeScenario = scenarioName;
        this.activeScenarioName = scenarioConfig.name ||
            scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1);

        // Update all UI controls with scenario values
        this._updateAllUIControlsFromScenario(scenarioConfig);

        this._updateModeIndicator();
        this._refreshUI();

        setTimeout(() => {
            this._fullUpdate();
        }, 50);

        console.log(`Scenario "${scenarioName}" loaded successfully`);
    }

    /**
     * Update ALL UI controls from scenario configuration
     * @private
     * @param {object} scenarioConfig
     */
    _updateAllUIControlsFromScenario(scenarioConfig) {
        console.log('Updating UI controls from scenario config:', scenarioConfig);

        // Store frequency range from scenario
        this.currentFreqRange = scenarioConfig.freqRange || null;

        // Clear existing arrays
        this.arrayManager._arrays = [];

        // Set global properties
        if (scenarioConfig.propagation_speed !== undefined) {
            this.arrayManager.propagationSpeed = scenarioConfig.propagation_speed;
        }
        if (scenarioConfig.combined_delay !== undefined) {
            this.arrayManager.combinedDelay = scenarioConfig.combined_delay;
        }

        // Create arrays based on scenario
        if (scenarioConfig.arrays && Array.isArray(scenarioConfig.arrays)) {
            console.log(`Creating ${scenarioConfig.arrays.length} arrays from scenario`);
            scenarioConfig.arrays.forEach((arrayConfig, index) => {
                this._createArrayFromConfig(arrayConfig, index);
            });

            // Set active array index
            this.selectedArrayIndex = 0;
            this.arrayManager._activeArrayIndex = 0;

            console.log(`Arrays created: ${this.arrayManager._arrays.length}`);
        } else {
            // Legacy single-array support
            this._createLegacyArrayFromConfig(scenarioConfig);
        }

        // Update combined delay slider
        if (this._elements.combinedDelaySlider) {
            this._elements.combinedDelaySlider.value = this.arrayManager.combinedDelay;
            this._elements.combinedDelayValue.textContent = this.arrayManager.combinedDelay + '°';
        }

        // Clear any pending array name input
        this._clearArrayNameInput();

        console.log('Scenario arrays loaded:', this.arrayManager._arrays);
    }

    /**
     * Create array from configuration
     * @private
     * @param {object} arrayConfig
     * @param {number} index
     */
    _createArrayFromConfig(arrayConfig, index) {
        console.log(`Creating array ${index + 1}:`, arrayConfig);

        const newArray = new PhasedArray(
            arrayConfig.num_antennas || 8,
            arrayConfig.distance_m || 0.15,
            this.arrayManager.propagationSpeed
        );

        // Apply configuration
        newArray.name = arrayConfig.name || `Array ${index + 1}`;
        newArray.delay = arrayConfig.delay_deg || 0;
        newArray.geometry = arrayConfig.array_geometry || 'Linear';
        newArray.curvature = arrayConfig.curvature || 0;
        newArray.spacingMode = arrayConfig.spacing_mode || 'absolute';
        newArray.lambdaMultiplier = arrayConfig.lambda_multiplier || 0.5;
        newArray.positionX = arrayConfig.positionX || 0;
        newArray.positionY = arrayConfig.positionY || 0;
        newArray.rotation = arrayConfig.rotation || 0;

        // Load frequencies if specified
        if (arrayConfig.frequencies) {
            newArray.loadFrequencies(arrayConfig.frequencies);
        }

        // Add to array manager
        this.arrayManager._arrays.push(newArray);
    }

    /**
     * Create legacy single array from configuration
     * @private
     * @param {object} scenarioConfig
     */
    _createLegacyArrayFromConfig(scenarioConfig) {
        console.log('Creating single array from legacy config');
        const newArray = new PhasedArray(
            scenarioConfig.num_antennas || 8,
            scenarioConfig.distance_m || 0.15,
            this.arrayManager.propagationSpeed
        );

        newArray.name = scenarioConfig.name || 'Main Array';
        newArray.delay = scenarioConfig.delay_deg || 0;
        newArray.geometry = scenarioConfig.array_geometry || 'Linear';
        newArray.curvature = scenarioConfig.curvature || 0;
        newArray.spacingMode = scenarioConfig.spacing_mode || 'absolute';
        newArray.positionX = scenarioConfig.positionX || 0;
        newArray.positionY = scenarioConfig.positionY || 0;
        newArray.rotation = scenarioConfig.rotation || 0;

        if (scenarioConfig.frequencies) {
            newArray.loadFrequencies(scenarioConfig.frequencies);
        }

        this.arrayManager._arrays = [newArray];
        this.selectedArrayIndex = 0;
        this.arrayManager._activeArrayIndex = 0;
    }

    // ==================== EXPORT FUNCTIONALITY ====================

    /**
     * Handle export button click
     * @private
     */
    _handleExport() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `beamforming_${this.activeScenarioName.replace(/\s+/g, '_')}_${timestamp}`;

            this.visualization.exportBoth(filename);
            alert(`Snapshots saved: ${filename}`);
            console.log(`Export completed: ${filename}`);
        } catch (e) {
            console.error('Snapshot failed', e);
            alert('Snapshot saved locally');
        }
    }

    /**
     * Initialize visualization (call after construction)
     * @public
     */
    initialize() {
        console.log('Initializing UIController...');
        this._refreshUI();
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