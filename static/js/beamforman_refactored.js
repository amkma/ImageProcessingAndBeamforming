/**
 * Main Application - Beamforming Simulator
 * Minimal main code - all logic encapsulated in classes
 */
// Scenario Configurations
const SCENARIOS = {
    '5g': {
        num_antennas: 4,
        distance_m: 1.0,
        delay_deg: 180,
        array_geometry: 'Linear',
        curvature: 0,
        frequencies: [2500000000.00, 2500000000.00, 2500000000.00, 2500000000.00],
        propagation_speed: 300000000,
        freqRange: { min: 1000000000, max: 5000000000, step: 10000000 }, // 1GHz to 5GHz
        spacing_mode: 'absolute'
    },
    'ultrasound': {
        num_antennas: 7,
        distance_m: 4.0,
        delay_deg: 0,
        frequencies: [1000000.00, 1000000.00, 1000000.00, 1000000.00, 1000000.00, 1000000.00, 1000000.00],
        array_geometry: 'Linear',
        curvature: 0,
        propagation_speed: 120000,
        freqRange: { min: 100000, max: 5000000, step: 10000 }, // 100kHz to 5MHz
        spacing_mode: 'absolute'
    },
    'tumor': {
        num_antennas: 10,
        distance_m: 2.0,
        delay_deg: 0,
        frequencies: [4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00, 4500000.00],
        array_geometry: 'Curved',
        curvature: 24,
        propagation_speed: 540000,
        freqRange: { min: 1000000, max: 10000000, step: 50000 }, // 1MHz to 10MHz
        spacing_mode: 'absolute'
    }
};

/**
 * BeamformingSimulator - Main Application Class
 * Coordinates between PhasedArray, Visualization, and UIController
 */
class BeamformingSimulator {
    constructor() {
        // Create core components
        this._phasedArray = new PhasedArray(8, 0.15, 3e8);
        this._visualization = new Visualization('heatmapPlot', 'beamProfilePlot');
        this._uiController = new UIController(this._phasedArray, this._visualization);

        // Store scenarios
        this._scenarios = SCENARIOS;

        // Expose to window for button onclick handlers
        window.simulator = this;
    }

    /**
     * Load a predefined scenario
     * @param {string} scenarioType - '5g', 'ultrasound', or 'tumor'
     */
    loadScenario(scenarioType) {
        const scenario = this._scenarios[scenarioType];
        if (!scenario) {
            console.error(`Unknown scenario: ${scenarioType}`);
            return;
        }

        this._uiController.loadScenario(scenarioType, scenario);
    }

    /**
     * Get phased array instance (for debugging/testing)
     */
    get array() {
        return this._phasedArray;
    }

    /**
     * Get visualization instance (for debugging/testing)
     */
    get visualization() {
        return this._visualization;
    }

    /**
     * Get UI controller instance (for debugging/testing)
     */
    get controller() {
        return this._uiController;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new BeamformingSimulator();
    simulator.controller.initialize();
});