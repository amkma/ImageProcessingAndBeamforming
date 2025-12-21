/**
 * Main Application - Multi-Array Beamforming Simulator
 */
// Enhanced Scenario Configurations with multiple arrays
const SCENARIOS = {
    '5g': {
        name: '5G Base Station',
        arrays: [
            {
                name: 'Main 5G Array',
                num_antennas: 4,
                distance_m: 1.0,
                delay_deg: 180,
                array_geometry: 'Linear',
                curvature: 0,
                frequencies: [2500000000, 2500000000, 2500000000, 2500000000],
                spacing_mode: 'absolute',
                positionX: 0,
                positionY: 0,
                rotation: 0
            },
        
        ],
        propagation_speed: 300000000,
        combined_delay: 0,
        freqRange: { min: 1000000000, max: 5000000000, step: 10000000 }
    },
    'ultrasound': {
        name: 'Ultrasound Imaging',
        arrays: [
            {
                name: 'Ultrasound Transducer',
                num_antennas: 7,
                distance_m: 4.0,
                delay_deg: 0,
                frequencies: Array(7).fill(1000000),
                array_geometry: 'Linear',
                curvature: 0,
                spacing_mode: 'absolute',
                positionX: 0,
                positionY: 0,
                rotation: 0
            }
        ],
        propagation_speed: 120000,
        combined_delay: 0,
        freqRange: { min: 100000, max: 5000000, step: 10000 }
    },
    'tumor': {
        name: 'Tumor Detection',
        arrays: [
            {
                name: 'Ring Array 1',
                num_antennas: 10,
                distance_m: 2.0,
                delay_deg: 0,
                frequencies: Array(8).fill(4500000),
                array_geometry: 'Curved',
                curvature: 24,
                spacing_mode: 'absolute',
                positionX: 0,
                positionY: 0,
                rotation: 0
            },
         
        ],
        propagation_speed: 540000,
        combined_delay: 0,
        freqRange: { min: 1000000, max: 10000000, step: 50000 }
    },
    'custom': {
        name: 'Custom Configuration',
        arrays: [
            {
                name: 'Array 1',
                num_antennas: 8,
                distance_m: 0.15,
                delay_deg: 0,
                frequencies: Array(8).fill(2400000000),
                array_geometry: 'Linear',
                curvature: 0,
                spacing_mode: 'absolute',
                positionX: 0,
                positionY: 0,
                rotation: 0
            }
        ],
        propagation_speed: 300000000,
        combined_delay: 0,
        freqRange: { min: 100, max: 5e9, step: 1e6 }
    }
};

/**
 * BeamformingSimulator - Main Application Class
 * Coordinates between ArrayManager, Visualization, and UIController
 */
class BeamformingSimulator {
    constructor() {
        // Create core components
        this._arrayManager = new ArrayManager(3e8);
        this._visualization = new Visualization('heatmapPlot', 'beamProfilePlot');
        this._uiController = new UIController(this._arrayManager, this._visualization);

        // Store scenarios
        this._scenarios = SCENARIOS;

        // Create initial array
        this._arrayManager.createArray({
            name: 'Array 1',
            numAntennas: 8,
            spacing: 0.15
        });

        // Expose to window for button onclick handlers
        window.simulator = this;
        
        // Debug logging
        console.log('BeamformingSimulator initialized');
        console.log('Available scenarios:', Object.keys(this._scenarios));
        Object.entries(this._scenarios).forEach(([name, config]) => {
            console.log(`Scenario "${name}":`, config);
        });
    }

    /**
     * Load a predefined scenario
     * @param {string} scenarioType - '5g', 'ultrasound', 'tumor', or 'custom'
     */
    loadScenario(scenarioType) {
        console.log(`Attempting to load scenario: ${scenarioType}`);
        const scenario = this._scenarios[scenarioType];
        if (!scenario) {
            console.error(`Unknown scenario: ${scenarioType}`);
            console.log('Available scenarios:', Object.keys(this._scenarios));
            alert(`Unknown scenario: ${scenarioType}`);
            return;
        }

        console.log(`Loading scenario config:`, scenario);
        this._uiController.loadScenario(scenarioType, scenario);
    }

    /**
     * Get array manager instance
     */
    get arrayManager() {
        return this._arrayManager;
    }

    /**
     * Get visualization instance
     */
    get visualization() {
        return this._visualization;
    }

    /**
     * Get UI controller instance
     */
    get controller() {
        return this._uiController;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new BeamformingSimulator();
    simulator.controller.initialize();
    console.log('Application fully loaded and initialized');
});