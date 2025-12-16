/**
 * PhasedArray Class - Encapsulates entire antenna array
 * Handles array geometry, positioning, and all mathematical calculations
 */
class PhasedArray {
    constructor(numAntennas = 8, spacing = 0.15, propagationSpeed = 3e8) {
        this._antennas = [];
        this._spacing = spacing;
        this._propagationSpeed = propagationSpeed;
        this._delay = 0; // Phase delay in degrees
        this._geometry = 'Linear';
        this._curvature = 1.0;
        this._spacingMode = 'absolute'; // 'absolute' or 'lambda'
        this._lambdaMultiplier = 0.5;

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
    get maxFrequency() {
        return Math.max(...this._antennas.map(a => a.frequency));
    }
    get averageWavelength() {
        const avgFreq = this._antennas.reduce((sum, a) => sum + a.frequency, 0) / this.numAntennas;
        return this._propagationSpeed / avgFreq;
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

    /**
     * Initialize antennas with default frequency
     * @private
     */
    _initializeAntennas(count) {
        this._antennas = [];
        const defaultFreq = 2400000000; // 2.4 GHz
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

        if (count > this.numAntennas) {
            // Add new antennas
            const lastFreq = this._antennas[0].frequency;
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
        frequencies.forEach((freq, idx) => {
            if (idx < this.numAntennas) {
                this._antennas[idx].frequency = freq;
            }
        });
    }

    /**
     * Compute heatmap of field intensity across 2D space
     * @param {number} gridSize - Resolution of grid
     * @param {number} extentX - Horizontal extent
     * @param {number} extentY - Vertical extent
     * @returns {object} {z: [][], x: [], y: []}
     */
    computeHeatmap(gridSize = 200, extentX = 10, extentY = 20) {
        // Generate coordinate arrays
        const xs = [];
        const ys = [];
        for (let i = 0; i < gridSize; i++) {
            xs.push(-extentX + (i / (gridSize - 1)) * (2 * extentX));
            ys.push(0 + (i / (gridSize - 1)) * extentY);
        }

        const maxFreq = this.maxFrequency;
        const delayRad = this.delayRadians;
        const zData = [];

        // Calculate wave interference at each grid point
        for (let r = 0; r < gridSize; r++) {
            const yPos = ys[r];
            const row = [];

            for (let c = 0; c < gridSize; c++) {
                const xPos = xs[c];
                let waveSum = 0;

                // Sum contributions from all antennas
                for (let i = 0; i < this.numAntennas; i++) {
                    const phaseDelay = -i * delayRad;
                    waveSum += this._antennas[i].calculateWaveContribution(
                        xPos, yPos, phaseDelay, this._propagationSpeed, maxFreq
                    );
                }

                row.push(waveSum);
            }
            zData.push(row);
        }

        // Normalize and apply transformations
        return this._normalizeHeatmap(zData, xs, ys);
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
     * Compute polar beam pattern (0° to 180°)
     * @returns {object} {theta: [], r: []}
     */
    computeBeamPattern() {
        const maxFreq = this.maxFrequency;
        const delayRad = this.delayRadians;
        const beamAngles = [];
        const beamMags = [];

        for (let deg = 0; deg <= 180; deg += 1) {
            const azimuthRad = (deg * Math.PI) / 180;
            let beamSumReal = 0;
            let beamSumImag = 0;

            // Sum contributions from all antennas
            for (let i = 0; i < this.numAntennas; i++) {
                const phaseDelay = -i * delayRad;
                const contribution = this._antennas[i].calculateBeamContribution(
                    azimuthRad, phaseDelay, this._propagationSpeed, maxFreq
                );

                beamSumReal += contribution.real;
                beamSumImag += contribution.imag;
            }

            beamAngles.push(deg);
            beamMags.push(Math.sqrt(beamSumReal ** 2 + beamSumImag ** 2));
        }

        // Normalize
        const maxBeam = Math.max(...beamMags) || 1;
        const normBeam = beamMags.map(m => m / maxBeam);

        return { theta: beamAngles, r: normBeam };
    }

    /**
     * Load scenario configuration
     * @param {object} config - Scenario configuration
     */
    loadScenario(config) {
        this.setAntennaCount(config.num_antennas);
        this._spacing = config.distance_m;
        this._delay = config.delay_deg;
        this._geometry = config.array_geometry;
        this._curvature = config.curvature;
        this._propagationSpeed = config.propagation_speed;
        this._spacingMode = config.spacing_mode || 'absolute';
        this.loadFrequencies(config.frequencies);
        this._recalculatePositions();
    }

    /**
     * Get current configuration as object
     * @returns {object} Current array configuration
     */
    getConfiguration() {
        return {
            num_antennas: this.numAntennas,
            distance_m: this._spacing,
            delay_deg: this._delay,
            array_geometry: this._geometry,
            curvature: this._curvature,
            propagation_speed: this._propagationSpeed,
            frequencies: this.getFrequencies(),
            spacing_mode: this._spacingMode,
            lambda_multiplier: this._lambdaMultiplier
        };
    }

    /**
     * Clone this phased array
     * @returns {PhasedArray} New instance with same configuration
     */
    clone() {
        const newArray = new PhasedArray(this.numAntennas, this._spacing, this._propagationSpeed);
        newArray._delay = this._delay;
        newArray._geometry = this._geometry;
        newArray._curvature = this._curvature;
        newArray._spacingMode = this._spacingMode;
        newArray._lambdaMultiplier = this._lambdaMultiplier;
        newArray.loadFrequencies(this.getFrequencies());
        return newArray;
    }
}