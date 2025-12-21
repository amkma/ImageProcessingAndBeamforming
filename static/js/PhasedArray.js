/**
 * ArrayManager Class - Manages multiple independent phased arrays
 * Handles array geometry, positioning, and all mathematical calculations
 */
class ArrayManager {
    constructor(propagationSpeed = 3e8) {
        this._arrays = []; // Array of PhasedArray objects
        this._activeArrayIndex = 0; // Currently selected array
        this._propagationSpeed = propagationSpeed;
        this._combinedDelay = 0; // Global phase delay for combination
    }

    // Getters
    get arrays() { return this._arrays; }
    get activeArray() { 
        return this._arrays[this._activeArrayIndex] || null; 
    }
    get activeArrayIndex() { return this._activeArrayIndex; }
    get numArrays() { return this._arrays.length; }
    get propagationSpeed() { return this._propagationSpeed; }
    get combinedDelay() { return this._combinedDelay; }

    // Setters
    set activeArrayIndex(index) { 
        if (index >= 0 && index < this._arrays.length) {
            this._activeArrayIndex = index;
        }
    }
    set propagationSpeed(value) { this._propagationSpeed = value; }
    set combinedDelay(value) { this._combinedDelay = value; }

    /**
     * Create a new phased array
     * @param {object} config - Array configuration
     * @returns {PhasedArray} The created array
     */
    createArray(config = {}) {
        console.log('Creating array with config:', config);
        
        const defaultConfig = {
            name: `Array ${this._arrays.length + 1}`,
            numAntennas: 8,
            spacing: 0.15,
            delay: 0,
            geometry: 'Linear',
            curvature: 1.0,
            spacingMode: 'absolute',
            lambdaMultiplier: 0.5,
            positionX: 0,
            positionY: 0,
            rotation: 0
        };

        const mergedConfig = { ...defaultConfig, ...config };
        const newArray = new PhasedArray(
            mergedConfig.numAntennas,
            mergedConfig.spacing,
            this._propagationSpeed
        );

        // Apply configuration
        newArray.name = mergedConfig.name;
        newArray.delay = mergedConfig.delay;
        newArray.geometry = mergedConfig.geometry;
        newArray.curvature = mergedConfig.curvature;
        newArray.spacingMode = mergedConfig.spacingMode;
        newArray.lambdaMultiplier = mergedConfig.lambdaMultiplier;
        newArray.positionX = mergedConfig.positionX;
        newArray.positionY = mergedConfig.positionY;
        newArray.rotation = mergedConfig.rotation;
        
        // Set default frequency
        const defaultFreq = 2400000000;
        newArray.setAllFrequencies(defaultFreq);
        
        this._arrays.push(newArray);
        this._activeArrayIndex = this._arrays.length - 1;
        
        console.log(`Array created. Total arrays: ${this._arrays.length}`);
        return newArray;
    }

    /**
     * Remove an array
     * @param {number} index - Index of array to remove
     */
    removeArray(index) {
        if (index >= 0 && index < this._arrays.length) {
            console.log(`Removing array at index ${index}: ${this._arrays[index].name}`);
            this._arrays.splice(index, 1);
            if (this._activeArrayIndex >= this._arrays.length) {
                this._activeArrayIndex = Math.max(0, this._arrays.length - 1);
            }
            console.log(`Array removed. Total arrays: ${this._arrays.length}`);
        }
    }

    /**
     * Get array by index
     * @param {number} index - Array index
     * @returns {PhasedArray} The array
     */
    getArray(index) {
        return this._arrays[index];
    }

    /**
     * Get all arrays
     * @returns {PhasedArray[]} All arrays
     */
    getAllArrays() {
        return this._arrays;
    }

    /**
     * Duplicate an array
     * @param {number} index - Index of array to duplicate
     * @returns {PhasedArray} The duplicated array
     */
    duplicateArray(index) {
        if (index >= 0 && index < this._arrays.length) {
            const sourceArray = this._arrays[index];
            console.log(`Duplicating array: ${sourceArray.name}`);
            const clonedArray = sourceArray.clone();
            clonedArray.name = `${sourceArray.name} Copy`;
            clonedArray.positionX += 1; // Offset slightly
            this._arrays.push(clonedArray);
            this._activeArrayIndex = this._arrays.length - 1;
            console.log(`Array duplicated. Total arrays: ${this._arrays.length}`);
            return clonedArray;
        }
        return null;
    }

    /**
     * Compute combined heatmap from all arrays
     * @param {number} gridSize - Resolution of grid
     * @param {number} extentX - Horizontal extent
     * @param {number} extentY - Vertical extent
     * @returns {object} {z: [][], x: [], y: []}
     */
    computeCombinedHeatmap(gridSize = 200, extentX = 10, extentY = 20) {
        if (this._arrays.length === 0) {
            // Return empty heatmap if no arrays
            const xs = Array(gridSize).fill().map((_, i) => -extentX + (i / (gridSize - 1)) * (2 * extentX));
            const ys = Array(gridSize).fill().map((_, i) => 0 + (i / (gridSize - 1)) * extentY);
            const zData = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
            return { z: zData, x: xs, y: ys };
        }

        // Generate coordinate arrays
        const xs = [];
        const ys = [];
        for (let i = 0; i < gridSize; i++) {
            xs.push(-extentX + (i / (gridSize - 1)) * (2 * extentX));
            ys.push(0 + (i / (gridSize - 1)) * extentY);
        }

        // Initialize combined field
        const combinedField = Array(gridSize).fill().map(() => Array(gridSize).fill(0));

        // Sum contributions from all arrays
        this._arrays.forEach((array, arrayIndex) => {
            const maxFreq = array.maxFrequency;
            const arrayDelayRad = array.delayRadians + (this._combinedDelay * Math.PI / 180);

            for (let r = 0; r < gridSize; r++) {
                const yPos = ys[r];
                for (let c = 0; c < gridSize; c++) {
                    const xPos = xs[c];
                    let waveSum = 0;

                    // Apply array transformation (position and rotation)
                    const transformedX = this._transformPoint(xPos, yPos, array, true);
                    const transformedY = this._transformPoint(xPos, yPos, array, false);

                    // Sum contributions from all antennas in this array
                    for (let i = 0; i < array.numAntennas; i++) {
                        const phaseDelay = -i * arrayDelayRad;
                        waveSum += array._antennas[i].calculateWaveContribution(
                            transformedX, transformedY, phaseDelay, this._propagationSpeed, maxFreq
                        );
                    }

                    combinedField[r][c] += waveSum;
                }
            }
        });

        // Normalize combined field
        return this._normalizeHeatmap(combinedField, xs, ys);
    }

    /**
     * Transform point based on array position and rotation
     * @private
     */
    _transformPoint(x, y, array, getX = true) {
        // Translate to array position
        let tx = x - array.positionX;
        let ty = y - array.positionY;
        
        // Apply rotation (negative for coordinate transformation)
        const rad = -array.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        if (getX) {
            return tx * cos - ty * sin;
        } else {
            return tx * sin + ty * cos;
        }
    }

    /**
     * Normalize heatmap data with log scale and gamma correction
     * @private
     */
    _normalizeHeatmap(zData, xs, ys) {
        const zFlat = zData.flat();
        const wavesAbs = zFlat.map(v => Math.abs(v));
        const wavesPower = wavesAbs.map(v => v * v);
        const wavesLog = wavesPower.map(v => Math.log1p(v * 10));

        const minLog = Math.min(...wavesLog);
        const maxLog = Math.max(...wavesLog);
        const range = maxLog - minLog || 1;

        const normData = [];
        let idx = 0;
        for (let r = 0; r < zData.length; r++) {
            const row = [];
            for (let c = 0; c < zData[0].length; c++) {
                const normalized = (wavesLog[idx] - minLog) / range;
                const gammaCorrected = Math.pow(normalized, 0.5);
                row.push(gammaCorrected);
                idx++;
            }
            normData.push(row);
        }

        return { z: normData, x: xs, y: ys };
    }

    /**
     * Compute combined beam pattern from all arrays
     * @returns {object} {theta: [], r: []}
     */
    computeCombinedBeamPattern() {
        const beamAngles = [];
        const beamMags = [];

        for (let deg = 0; deg <= 180; deg += 1) {
            const azimuthRad = (deg * Math.PI) / 180;
            let combinedReal = 0;
            let combinedImag = 0;

            // Sum contributions from all arrays
            this._arrays.forEach(array => {
                const maxFreq = array.maxFrequency;
                const arrayDelayRad = array.delayRadians + (this._combinedDelay * Math.PI / 180);

                // Calculate array factor contribution
                const arrayFactor = this._calculateArrayFactor(array, azimuthRad, arrayDelayRad, maxFreq);
                
                // Apply array position phase shift
                const posPhase = this._calculatePositionPhase(array, azimuthRad);
                
                combinedReal += arrayFactor.real * Math.cos(posPhase) - arrayFactor.imag * Math.sin(posPhase);
                combinedImag += arrayFactor.real * Math.sin(posPhase) + arrayFactor.imag * Math.cos(posPhase);
            });

            beamAngles.push(deg);
            beamMags.push(Math.sqrt(combinedReal ** 2 + combinedImag ** 2));
        }

        // Normalize
        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { theta: beamAngles, r: normBeam };
    }

    /**
     * Calculate array factor for a specific array
     * @private
     */
    _calculateArrayFactor(array, azimuthRad, arrayDelayRad, maxFreq) {
        let realSum = 0;
        let imagSum = 0;

        for (let i = 0; i < array.numAntennas; i++) {
            const phaseDelay = -i * arrayDelayRad;
            const contribution = array._antennas[i].calculateBeamContribution(
                azimuthRad, phaseDelay, this._propagationSpeed, maxFreq
            );
            realSum += contribution.real;
            imagSum += contribution.imag;
        }

        return { real: realSum, imag: imagSum };
    }

    /**
     * Calculate phase shift due to array position
     * @private
     */
    _calculatePositionPhase(array, azimuthRad) {
        const avgFreq = array._antennas.reduce((sum, a) => sum + a.frequency, 0) / array.numAntennas;
        const k = 2 * Math.PI / (this._propagationSpeed / avgFreq);
        const dx = array.positionX * Math.cos(azimuthRad);
        const dy = array.positionY * Math.sin(azimuthRad);
        return k * (dx + dy);
    }

    /**
     * Get all antenna positions from all arrays (for visualization)
     * @returns {object} {x: [], y: [], colors: []}
     */
    getAllAntennaPositions() {
        const positions = { x: [], y: [], colors: [] };
        
        this._arrays.forEach((array, arrayIndex) => {
            const arrayPositions = array.getPositions();
            const color = this._getArrayColor(arrayIndex);
            
            // Transform each antenna position by array position and rotation
            arrayPositions.x.forEach((antX, antIndex) => {
                const antY = arrayPositions.y[antIndex];
                const transformed = this._transformAntennaPosition(antX, antY, array);
                
                positions.x.push(transformed.x);
                positions.y.push(transformed.y);
                positions.colors.push(color);
            });
        });
        
        return positions;
    }

    /**
     * Transform antenna position based on array transformation
     * @private
     */
    _transformAntennaPosition(antX, antY, array) {
        // Apply array rotation
        const rad = array.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const rotatedX = antX * cos - antY * sin;
        const rotatedY = antX * sin + antY * cos;
        
        // Apply array translation
        return {
            x: rotatedX + array.positionX,
            y: rotatedY + array.positionY
        };
    }

    /**
     * Get color for array based on index
     * @private
     */
    _getArrayColor(index) {
        const colors = [
            '#00ff90', // Green
            '#ff9000', // Orange
            '#0088ff', // Blue
            '#ff00ff', // Magenta
            '#ffff00', // Yellow
            '#00ffff', // Cyan
            '#ff8800', // Dark orange
            '#aa00ff'  // Purple
        ];
        return colors[index % colors.length];
    }

    /**
     * Load scenario configuration for all arrays
     * @param {object} config - Scenario configuration
     */
    loadScenario(config) {
        console.log('ArrayManager loading scenario:', config);
        
        // Clear existing arrays
        this._arrays = [];
        
        // Set global properties
        if (config.propagation_speed !== undefined) {
            this._propagationSpeed = config.propagation_speed;
        }
        if (config.combined_delay !== undefined) {
            this._combinedDelay = config.combined_delay;
        }
        
        // Create arrays based on scenario
        if (config.arrays && Array.isArray(config.arrays)) {
            console.log(`Creating ${config.arrays.length} arrays from scenario`);
            config.arrays.forEach((arrayConfig, index) => {
                console.log(`Creating array ${index + 1}:`, arrayConfig);
                this.createArray({
                    name: arrayConfig.name || `Array ${index + 1}`,
                    numAntennas: arrayConfig.num_antennas || 8,
                    spacing: arrayConfig.distance_m || 0.15,
                    delay: arrayConfig.delay_deg || 0,
                    geometry: arrayConfig.array_geometry || 'Linear',
                    curvature: arrayConfig.curvature || 0,
                    spacingMode: arrayConfig.spacing_mode || 'absolute',
                    positionX: arrayConfig.positionX || 0,
                    positionY: arrayConfig.positionY || 0,
                    rotation: arrayConfig.rotation || 0
                });
                
                // Load frequencies if specified
                if (arrayConfig.frequencies && this._arrays[index]) {
                    this._arrays[index].loadFrequencies(arrayConfig.frequencies);
                }
            });
        } else {
            // Legacy single-array support
            console.log('Creating single array from legacy config');
            const arrayConfig = {
                name: config.name || 'Main Array',
                numAntennas: config.num_antennas || 8,
                spacing: config.distance_m || 0.15,
                delay: config.delay_deg || 0,
                geometry: config.array_geometry || 'Linear',
                curvature: config.curvature || 0,
                spacingMode: config.spacing_mode || 'absolute',
                positionX: config.positionX || 0,
                positionY: config.positionY || 0,
                rotation: config.rotation || 0
            };
            this.createArray(arrayConfig);
            
            if (config.frequencies) {
                this.activeArray.loadFrequencies(config.frequencies);
            }
        }
        
        console.log(`Scenario loaded. Total arrays: ${this._arrays.length}`);
    }

    /**
     * Get current configuration as object
     * @returns {object} Current arrays configuration
     */
    getConfiguration() {
        return {
            arrays: this._arrays.map(array => array.getConfiguration()),
            propagation_speed: this._propagationSpeed,
            combined_delay: this._combinedDelay
        };
    }
}

/**
 * PhasedArray Class - Individual array (modified for multi-array support)
 */
class PhasedArray {
    constructor(numAntennas = 8, spacing = 0.15, propagationSpeed = 3e8) {
        this._antennas = [];
        this._spacing = spacing;
        this._propagationSpeed = propagationSpeed;
        this._delay = 0;
        this._geometry = 'Linear';
        this._curvature = 1.0;
        this._spacingMode = 'absolute';
        this._lambdaMultiplier = 0.5;
        this._positionX = 0;
        this._positionY = 0;
        this._rotation = 0;
        this._name = 'Array';

        this._initializeAntennas(numAntennas);
    }

    // Getters
    get antennas() { return this._antennas; }
    get numAntennas() { return this._antennas.length; }
    get spacing() { return this._spacing; }
    get propagationSpeed() { return this._propagationSpeed; }
    get delay() { return this._delay; }
    get delayRadians() { return (this._delay * Math.PI) / 180; }
    get geometry() { return this._geometry; }
    get curvature() { return this._curvature; }
    get spacingMode() { return this._spacingMode; }
    get lambdaMultiplier() { return this._lambdaMultiplier; }
    get positionX() { return this._positionX; }
    get positionY() { return this._positionY; }
    get rotation() { return this._rotation; }
    get name() { return this._name; }
    get maxFrequency() {
        return this._antennas.length > 0 ? 
            Math.max(...this._antennas.map(a => a.frequency)) : 2400000000;
    }
    get averageFrequency() {
        return this._antennas.length > 0 ?
            this._antennas.reduce((sum, a) => sum + a.frequency, 0) / this.numAntennas : 2400000000;
    }
    get averageWavelength() {
        return this._propagationSpeed / this.averageFrequency;
    }
    get effectiveSpacing() {
        if (this._spacingMode === 'lambda') {
            return this.averageWavelength * this._lambdaMultiplier;
        }
        return this._spacing;
    }

    // Setters
    set spacing(value) {
        this._spacing = value;
        this._recalculatePositions();
    }
    set propagationSpeed(value) {
        this._propagationSpeed = value;
    }
    set delay(value) {
        this._delay = value;
    }
    set geometry(value) {
        this._geometry = value;
        this._recalculatePositions();
    }
    set curvature(value) {
        this._curvature = value;
        this._recalculatePositions();
    }
    set spacingMode(value) {
        this._spacingMode = value;
        this._recalculatePositions();
    }
    set lambdaMultiplier(value) {
        this._lambdaMultiplier = value;
        this._recalculatePositions();
    }
    set positionX(value) { this._positionX = value; }
    set positionY(value) { this._positionY = value; }
    set rotation(value) { this._rotation = value; }
    set name(value) { this._name = value; }

    /**
     * Initialize antennas with default frequency
     * @private
     */
    _initializeAntennas(count) {
        this._antennas = [];
        const defaultFreq = 2400000000;
        for (let i = 0; i < count; i++) {
            this._antennas.push(new Antenna(i, defaultFreq));
        }
        this._recalculatePositions();
    }

    /**
     * Recalculate all antenna positions based on geometry
     * @private
     */
    _recalculatePositions() {
        const spacing = this.effectiveSpacing;
        const totalWidth = (this.numAntennas - 1) * spacing;

        for (let i = 0; i < this.numAntennas; i++) {
            let x = -totalWidth / 2 + i * spacing;
            let y = 0;

            if (this._geometry === 'Curved') {
                y = 0.01 * 20 + this._curvature * 0.01 * (x * x);
            }

            this._antennas[i].position = { x, y };
        }
    }

    /**
     * Set number of antennas (resize array)
     * @param {number} count - New number of antennas
     */
    setAntennaCount(count) {
        if (count === this.numAntennas) return;

        console.log(`Setting antenna count from ${this.numAntennas} to ${count}`);

        if (count > this.numAntennas) {
            // Add new antennas
            const lastFreq = this._antennas.length > 0 ? this._antennas[0].frequency : 2400000000;
            for (let i = this.numAntennas; i < count; i++) {
                this._antennas.push(new Antenna(i, lastFreq));
            }
        } else {
            // Remove excess antennas
            this._antennas = this._antennas.slice(0, count);
        }

        // Reindex
        this._antennas.forEach((ant, idx) => ant._index = idx);
        this._recalculatePositions();
    }

    /**
     * Get specific antenna by index
     * @param {number} index - Antenna index
     * @returns {Antenna} Antenna instance
     */
    getAntenna(index) {
        return this._antennas[index];
    }

    /**
     * Set frequency for specific antenna
     * @param {number} index - Antenna index
     * @param {number} frequency - New frequency in Hz
     */
    setAntennaFrequency(index, frequency) {
        if (index >= 0 && index < this.numAntennas) {
            this._antennas[index].frequency = frequency;
        }
    }

    /**
     * Set position for specific antenna
     * @param {number} index - Antenna index
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    setAntennaPosition(index, x, y) {
        if (index >= 0 && index < this.numAntennas) {
            this._antennas[index].position = { x, y };
        }
    }

    /**
     * Get all antenna positions as arrays
     * @returns {object} {x: [], y: []}
     */
    getPositions() {
        return {
            x: this._antennas.map(a => a.x),
            y: this._antennas.map(a => a.y)
        };
    }

    /**
     * Get all antenna frequencies
     * @returns {number[]} Array of frequencies
     */
    getFrequencies() {
        return this._antennas.map(a => a.frequency);
    }

    /**
     * Set all antennas to same frequency
     * @param {number} frequency - Frequency in Hz
     */
    setAllFrequencies(frequency) {
        this._antennas.forEach(ant => ant.frequency = frequency);
    }

    /**
     * Load frequency array
     * @param {number[]} frequencies - Array of frequencies
     */
    loadFrequencies(frequencies) {
        console.log(`Loading ${frequencies.length} frequencies:`, frequencies);
        frequencies.forEach((freq, idx) => {
            if (idx < this.numAntennas) {
                this._antennas[idx].frequency = freq;
            }
        });
    }

    /**
     * Load array configuration
     * @param {object} config - Array configuration
     */
    loadConfiguration(config) {
        console.log('PhasedArray loading configuration:', config);
        
        if (config.num_antennas !== undefined) {
            this.setAntennaCount(config.num_antennas);
        }
        if (config.distance_m !== undefined) {
            this._spacing = config.distance_m;
        }
        if (config.delay_deg !== undefined) {
            this._delay = config.delay_deg;
        }
        if (config.array_geometry !== undefined) {
            this._geometry = config.array_geometry;
        }
        if (config.curvature !== undefined) {
            this._curvature = config.curvature;
        }
        if (config.spacing_mode !== undefined) {
            this._spacingMode = config.spacing_mode;
        }
        if (config.lambda_multiplier !== undefined) {
            this._lambdaMultiplier = config.lambda_multiplier;
        }
        if (config.positionX !== undefined) {
            this._positionX = config.positionX;
        }
        if (config.positionY !== undefined) {
            this._positionY = config.positionY;
        }
        if (config.rotation !== undefined) {
            this._rotation = config.rotation;
        }
        if (config.name !== undefined) {
            this._name = config.name;
        }
        
        if (config.frequencies) {
            this.loadFrequencies(config.frequencies);
        }
        
        this._recalculatePositions();
    }

    /**
     * Get current configuration as object
     * @returns {object} Current array configuration
     */
    getConfiguration() {
        return {
            name: this._name,
            num_antennas: this.numAntennas,
            distance_m: this._spacing,
            delay_deg: this._delay,
            array_geometry: this._geometry,
            curvature: this._curvature,
            spacing_mode: this._spacingMode,
            lambda_multiplier: this._lambdaMultiplier,
            positionX: this._positionX,
            positionY: this._positionY,
            rotation: this._rotation,
            frequencies: this.getFrequencies()
        };
    }

    /**
     * Clone this phased array
     * @returns {PhasedArray} New instance with same configuration
     */
    clone() {
        console.log(`Cloning array: ${this.name}`);
        const newArray = new PhasedArray(this.numAntennas, this._spacing, this._propagationSpeed);
        newArray.loadConfiguration(this.getConfiguration());
        return newArray;
    }
}