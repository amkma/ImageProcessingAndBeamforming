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
                num_antennas: 64,
                distance_m: 20,
                delay_deg: 64,
                array_geometry: 'Linear',
                curvature: 0,
                frequencies: [2500000000, 2500000000, 2500000000, 2500000000],
                spacing_mode: 'lambda',
                positionX: 0,
                positionY: 0,
                rotation: 0
            },
        
        ],
        propagation_speed: 300000000,
        combined_delay: 0,
        freqRange: { min: 1000000000, max: 3500000000, step: 10000000 }
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
                spacing_mode: 'lambda',
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
                frequencies: Array(10).fill(4500000),
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
        
        // Initialize scenario buttons after DOM is ready
        this._initScenarioButtons();
    }

    /**
     * Initialize scenario button event listeners
     * @private
     */
    _initScenarioButtons() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._attachScenarioButtons();
                this._logScenarioDetails();
            });
        } else {
            this._attachScenarioButtons();
            this._logScenarioDetails();
        }
    }

    /**
     * Attach scenario button event listeners
     * @private
     */
    _attachScenarioButtons() {
        const scenarioButtons = document.querySelectorAll('.scenario-btn');
        
        if (scenarioButtons.length === 0) {
            console.warn('No scenario buttons found in DOM');
            // Create fallback buttons if they don't exist
            this._createFallbackButtons();
            return;
        }
        
        console.log(`Found ${scenarioButtons.length} scenario buttons`);
        
        scenarioButtons.forEach(button => {
            const scenario = button.dataset.scenario;
            if (scenario && this._scenarios[scenario]) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log(`Scenario button clicked: ${scenario}`);
                    this.loadScenario(scenario);
                });
                
                // Add tooltip
                button.title = `Load ${this._scenarios[scenario].name} scenario`;
                console.log(`Attached listener to ${scenario} button`);
            } else {
                console.warn(`Button has invalid scenario: ${scenario}`);
            }
        });
    }

    /**
     * Create fallback scenario buttons if not found in DOM
     * @private
     */
    _createFallbackButtons() {
        console.log('Creating fallback scenario buttons');
        
        // Find scenario button container
        const scenarioContainer = document.querySelector('.btn-group.w-100');
        if (!scenarioContainer) {
            console.error('Scenario button container not found');
            return;
        }
        
        // Clear existing buttons
        scenarioContainer.innerHTML = '';
        
        // Create buttons for each scenario
        Object.keys(this._scenarios).forEach(scenarioKey => {
            const button = document.createElement('button');
            button.className = 'btn btn-simulator-secondary btn-sm scenario-btn';
            button.dataset.scenario = scenarioKey;
            
            // Set button content based on scenario
            let icon, text;
            switch(scenarioKey) {
                case '5g':
                    icon = 'fas fa-signal';
                    text = '5G';
                    break;
                case 'tumor':
                    icon = 'fas fa-heartbeat';
                    text = 'Tumor';
                    break;
                case 'ultrasound':
                    icon = 'fas fa-wave-square';
                    text = 'Ultrasound';
                    break;
                case 'custom':
                    icon = 'fas fa-sliders';
                    text = 'Custom';
                    break;
                default:
                    icon = 'fas fa-cog';
                    text = scenarioKey;
            }
            
            button.innerHTML = `<i class="${icon} me-1"></i> ${text}`;
            button.title = `Load ${this._scenarios[scenarioKey].name} scenario`;
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`Fallback button clicked: ${scenarioKey}`);
                this.loadScenario(scenarioKey);
            });
            
            scenarioContainer.appendChild(button);
        });
        
        console.log('Fallback scenario buttons created');
    }

    /**
     * Log scenario details for debugging
     * @private
     */
    _logScenarioDetails() {
        Object.entries(this._scenarios).forEach(([name, config]) => {
            console.log(`Scenario "${name}":`, {
                name: config.name,
                arrays: config.arrays?.length || 1,
                propagation_speed: config.propagation_speed,
                frequencies: config.arrays?.[0]?.frequencies?.length || config.frequencies?.length || 0
            });
        });
    }

    /**
     * Load a predefined scenario
     * @param {string} scenarioType - '5g', 'ultrasound', 'tumor', or 'custom'
     */
    loadScenario(scenarioType) {
        console.log(`\n=== LOADING SCENARIO: ${scenarioType.toUpperCase()} ===`);
        
        const scenario = this._scenarios[scenarioType];
        if (!scenario) {
            console.error(`Unknown scenario: ${scenarioType}`);
            console.log('Available scenarios:', Object.keys(this._scenarios));
            
            // Show user-friendly error
            this._showError(`Scenario "${scenarioType}" not found. Available scenarios: ${Object.keys(this._scenarios).join(', ')}`);
            return;
        }

        console.log(`Loading scenario config:`, scenario);
        
        try {
            // Update button states
            this._updateScenarioButtonStates(scenarioType);
            
            // Load the scenario through UI controller
            this._uiController.loadScenario(scenarioType, scenario);
            
            console.log(`✓ Scenario "${scenarioType}" loaded successfully`);
            
            // Show success notification
            this._showSuccess(`${scenario.name} loaded successfully!`);
            
        } catch (error) {
            console.error(`Error loading scenario "${scenarioType}":`, error);
            this._showError(`Failed to load scenario "${scenarioType}": ${error.message}`);
        }
    }

    /**
     * Update scenario button active states
     * @private
     */
    _updateScenarioButtonStates(activeScenario) {
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            const scenario = btn.dataset.scenario;
            if (scenario === activeScenario) {
                btn.classList.add('active');
                btn.classList.remove('btn-simulator-secondary');
                btn.classList.add('btn-simulator');
                console.log(`Button ${scenario} activated`);
            } else {
                btn.classList.remove('active');
                btn.classList.remove('btn-simulator');
                btn.classList.add('btn-simulator-secondary');
            }
        });
    }

    /**
     * Show error message to user
     * @private
     */
    _showError(message) {
        // Create or show error notification
        let errorDiv = document.getElementById('error-notification');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-notification';
            errorDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: #ff4757;
                color: white;
                padding: 12px 20px;
                border-radius: 5px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                font-family: inherit;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        errorDiv.style.display = 'flex';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
        
        // Also log to console
        console.error('User error:', message);
    }

    /**
     * Show success message to user
     * @private
     */
    _showSuccess(message) {
        // Create or show success notification
        let successDiv = document.getElementById('success-notification');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'success-notification';
            successDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: #00b894;
                color: white;
                padding: 12px 20px;
                border-radius: 5px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                font-family: inherit;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            document.body.appendChild(successDiv);
        }
        
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        successDiv.style.display = 'flex';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
        
        console.log('User success:', message);
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

    /**
     * Export current configuration as JSON
     */
    exportConfiguration() {
        const config = this._arrayManager.getConfiguration();
        const scenarioName = this._uiController.activeScenarioName;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `beamforming_config_${scenarioName}_${timestamp}.json`;
        
        const dataStr = JSON.stringify(config, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', filename);
        linkElement.click();
        
        console.log(`Configuration exported: ${filename}`);
        this._showSuccess(`Configuration exported as ${filename}`);
    }

    /**
     * Import configuration from JSON
     * @param {File} file - JSON configuration file
     */
    importConfiguration(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                console.log('Importing configuration:', config);
                
                // Load the configuration
                this._arrayManager.loadScenario(config);
                this._uiController._refreshUI();
                this._uiController._fullUpdate();
                
                this._showSuccess('Configuration imported successfully!');
            } catch (error) {
                console.error('Error importing configuration:', error);
                this._showError(`Failed to import configuration: ${error.message}`);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Reset to default configuration
     */
    resetToDefault() {
        if (confirm('Are you sure you want to reset to default configuration? All current settings will be lost.')) {
            console.log('Resetting to default configuration');
            
            // Clear array manager
            this._arrayManager._arrays = [];
            this._arrayManager._activeArrayIndex = 0;
            
            // Create default array
            this._arrayManager.createArray({
                name: 'Array 1',
                numAntennas: 8,
                spacing: 0.15
            });
            
            // Reset UI
            this._uiController._activeScenario = null;
            this._uiController._activeScenarioName = 'Custom';
            this._uiController._refreshUI();
            this._uiController._fullUpdate();
            
            // Reset button states
            this._updateScenarioButtonStates(null);
            
            this._showSuccess('Reset to default configuration');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing BeamformingSimulator...');
    
    try {
        const simulator = new BeamformingSimulator();
        
        // Initialize UI controller
        simulator.controller.initialize();
        
        // Add keyboard shortcuts
        simulator._addKeyboardShortcuts();
        
        console.log('Application fully loaded and initialized');
        
        // Show welcome message
        setTimeout(() => {
            simulator._showSuccess('Beamforming Simulator Ready! Click scenario buttons to load configurations.');
        }, 1000);
        
    } catch (error) {
        console.error('Failed to initialize BeamformingSimulator:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 71, 87, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;
        errorDiv.innerHTML = `
            <h3 style="margin-top: 0;">Initialization Error</h3>
            <p>Failed to initialize the Beamforming Simulator:</p>
            <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; text-align: left; font-size: 12px;">${error.message}</pre>
            <p>Please check the browser console for details and refresh the page.</p>
            <button onclick="location.reload()" style="
                background: white;
                color: #ff4757;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 15px;
                font-weight: bold;
            ">Refresh Page</button>
        `;
        document.body.appendChild(errorDiv);
    }
});

/**
 * Add keyboard shortcuts for the simulator
 */
BeamformingSimulator.prototype._addKeyboardShortcuts = function() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S: Export configuration
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.exportConfiguration();
            console.log('Keyboard shortcut: Export configuration');
        }
        
        // Ctrl/Cmd + R: Reset to default
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            this.resetToDefault();
            console.log('Keyboard shortcut: Reset to default');
        }
        
        // Ctrl/Cmd + 1-4: Load scenarios
        if (e.ctrlKey || e.metaKey) {
            const scenarioMap = {
                '1': '5g',
                '2': 'ultrasound',
                '3': 'tumor',
                '4': 'custom'
            };
            
            if (scenarioMap[e.key]) {
                e.preventDefault();
                this.loadScenario(scenarioMap[e.key]);
                console.log(`Keyboard shortcut: Load ${scenarioMap[e.key]} scenario`);
            }
        }
        
        // Escape: Clear notifications
        if (e.key === 'Escape') {
            const notifications = document.querySelectorAll('[id$="-notification"]');
            notifications.forEach(notification => {
                notification.style.display = 'none';
            });
        }
    });
    
    console.log('Keyboard shortcuts initialized');
};

// Make simulator globally available for debugging
window.BeamformingSimulator = BeamformingSimulator;