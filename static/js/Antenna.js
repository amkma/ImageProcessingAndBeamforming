/**
 * Antenna Class - Encapsulates single antenna element
 * Handles all antenna-specific properties and calculations
 */
class Antenna {
    constructor(index, frequency = 2400000000, x = 0, y = 0) {
        this._index = index;
        this._frequency = frequency;
        this._x = x;
        this._y = y;
        this._propagationSpeed = 3e8; // Default propagation speed
    }

    // Getters
    get index() { return this._index; }
    get frequency() { return this._frequency; }
    get x() { return this._x; }
    get y() { return this._y; }
    get wavelength() { return this._propagationSpeed / this._frequency; }
    get position() { return { x: this._x, y: this._y }; }
    get propagationSpeed() { return this._propagationSpeed; }

    // Setters
    set index(value) { this._index = value; }
    set frequency(freq) { this._frequency = freq; }
    set x(value) { this._x = value; }
    set y(value) { this._y = value; }
    set position(pos) {
        this._x = pos.x;
        this._y = pos.y;
    }
    set propagationSpeed(value) { this._propagationSpeed = value; }

    /**
     * Calculate wave contribution at a specific point in space
     * @param {number} targetX - X coordinate of target point
     * @param {number} targetY - Y coordinate of target point
     * @param {number} phaseDelay - Phase delay in radians
     * @param {number} propagationSpeed - Wave propagation speed
     * @param {number} maxFrequency - Maximum frequency for normalization
     * @returns {number} Wave amplitude at target point
     */
    calculateWaveContribution(targetX, targetY, phaseDelay, propagationSpeed, maxFrequency) {
        const wavelength = propagationSpeed / this.frequency;
        const k = 2 * Math.PI / wavelength;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const safeDistance = Math.max(distance, 0.001);

        const freqScaling = this.frequency / maxFrequency;
        const amplitude = 1.0 / Math.sqrt(safeDistance);

        return freqScaling * amplitude * Math.cos(k * safeDistance + phaseDelay);
    }

    /**
     * Calculate beam pattern contribution for a specific angle
     * @param {number} azimuthRad - Azimuth angle in radians
     * @param {number} phaseDelay - Phase delay in radians
     * @param {number} propagationSpeed - Wave propagation speed
     * @param {number} maxFrequency - Maximum frequency for normalization
     * @returns {object} Real and imaginary components
     */
    calculateBeamContribution(azimuthRad, phaseDelay, propagationSpeed, maxFrequency) {
        const wavelength = propagationSpeed / this.frequency;
        const k = 2 * Math.PI / wavelength;

        const r = Math.sqrt(this.x ** 2 + this.y ** 2);
        const theta = Math.atan2(this.y, this.x);

        const freqScaling = this.frequency / maxFrequency;
        const phaseTerm = -k * r * Math.cos(azimuthRad - theta) + phaseDelay;

        return {
            real: freqScaling * Math.cos(phaseTerm),
            imag: freqScaling * Math.sin(phaseTerm)
        };
    }

    /**
     * Clone this antenna
     * @returns {Antenna} New antenna instance with same properties
     */
    clone() {
        const cloned = new Antenna(this.index, this.frequency, this.x, this.y);
        cloned.propagationSpeed = this.propagationSpeed;
        return cloned;
    }

    /**
     * Get antenna data as plain object
     * @returns {object} Antenna properties
     */
    toJSON() {
        return {
            index: this.index,
            frequency: this.frequency,
            x: this.x,
            y: this.y
        };
    }
}