class BeamformingSimulator {
    constructor() {
        this.arrays = [];
        this.currentArrayIndex = 0;
        this.isRunning = true;
        this.animationId = null;
        this.lastUpdate = 0;
        this.updateInterval = 16; // ~60 FPS
        
        // Visualization contexts
        this.heatmapCtx = null;
        this.polarCtx = null;
        this.arrayCtx = null;
        this.phaseCtx = null;
        this.previewCtx = null;
        
        // Charts
        this.polarChart = null;
        this.phaseChart = null;
        
        // Color gradients for heatmap
        this.heatmapGradient = null;
        
        // Default configuration
        this.defaultConfig = {
            numElements: 8,
            geometry: 'linear',
            curvature: 1.0,
            spacing: 0.5,
            frequency: 2400, // MHz
            posX: 0,
            posY: 0,
            rotation: 0,
            steeringAngle: 0,
            focusDistance: 5,
            beamWidth: 30,
            phaseProfile: 'linear',
            phaseSlope: 0,
            applyDelays: false
        };
        
        // Predefined scenarios
        this.scenarios = {
            '5g': {
                name: '5G Beam Steering',
                description: '64-element linear array for 5G beamforming',
                numElements: 64,
                geometry: 'linear',
                spacing: 0.5,
                frequency: 3500,
                steeringAngle: 30,
                phaseProfile: 'linear',
                beamWidth: 15,
                color: '#3b82f6'
            },
            'ultrasound': {
                name: 'Ultrasound Imaging',
                description: '128-element curved array for medical imaging',
                numElements: 128,
                geometry: 'curved',
                curvature: 0.3,
                spacing: 0.25,
                frequency: 5, // MHz
                focusDistance: 0.1,
                phaseProfile: 'quadratic',
                beamWidth: 5,
                color: '#10b981'
            },
            'ablation': {
                name: 'Tumor Ablation',
                description: '256-element array for high-intensity focused ultrasound',
                numElements: 256,
                geometry: 'circular',
                spacing: 0.2,
                frequency: 1, // MHz
                focusDistance: 0.05,
                phaseProfile: 'quadratic',
                beamWidth: 2,
                color: '#ef4444'
            }
        };
        
        // Quick saves
        this.quickSaves = [];
        this.maxQuickSaves = 10;
        
        // API endpoint
        this.apiEndpoint = '/api/beamforming/';
        
        // Auto-save interval
        this.autoSaveInterval = null;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.initializeCanvases();
        await this.loadFromBackend();
        this.updateAllVisualizations();
        this.startAnimation();
        this.setupPresetButtons();
        this.startAutoSave();
    }
    
    setupEventListeners() {
        // Array configuration controls
        this.setupSlider('numElements', async (value) => {
            this.currentArray.numElements = parseInt(value);
            await this.updateBackend();
            this.updateArrayElements();
            this.updateAllVisualizations();
        });
        
        this.setupSelect('geometryType', async (value) => {
            this.currentArray.geometry = value;
            document.getElementById('curvatureControl').style.display = 
                value === 'curved' ? 'block' : 'none';
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('curvature', async (value) => {
            this.currentArray.curvature = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('elementSpacing', async (value) => {
            this.currentArray.spacing = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('frequency', async (value) => {
            this.currentArray.frequency = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        // Position controls
        this.setupSlider('posX', async (value) => {
            this.currentArray.posX = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('posY', async (value) => {
            this.currentArray.posY = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('rotation', async (value) => {
            this.currentArray.rotation = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        // Beam controls
        this.setupSlider('steeringAngle', async (value) => {
            this.currentArray.steeringAngle = parseFloat(value);
            await this.updateBackend();
            this.calculatePhases();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('focusDistance', async (value) => {
            this.currentArray.focusDistance = parseFloat(value);
            await this.updateBackend();
            this.calculatePhases();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('beamWidth', async (value) => {
            this.currentArray.beamWidth = parseFloat(value);
            await this.updateBackend();
            this.updateAllVisualizations();
        });
        
        // Phase controls
        this.setupSelect('phaseProfile', async (value) => {
            this.currentArray.phaseProfile = value;
            await this.updateBackend();
            this.calculatePhases();
            this.updateAllVisualizations();
        });
        
        this.setupSlider('phaseSlope', async (value) => {
            this.currentArray.phaseSlope = parseFloat(value);
            await this.updateBackend();
            this.calculatePhases();
            this.updateAllVisualizations();
        });
        
        // Element controls
        document.getElementById('selectedElement').addEventListener('change', (e) => {
            const elementIndex = parseInt(e.target.value);
            this.updateElementControls(elementIndex);
        });
        
        this.setupSlider('elementPhase', async (value) => {
            const elementIndex = parseInt(document.getElementById('selectedElement').value);
            if (this.currentArray.elements[elementIndex]) {
                this.currentArray.elements[elementIndex].phase = parseFloat(value);
                await this.updateBackend();
                this.updateAllVisualizations();
            }
        });
        
        this.setupSlider('elementAmplitude', async (value) => {
            const elementIndex = parseInt(document.getElementById('selectedElement').value);
            if (this.currentArray.elements[elementIndex]) {
                this.currentArray.elements[elementIndex].amplitude = parseFloat(value);
                await this.updateBackend();
                this.updateAllVisualizations();
            }
        });
        
        // Buttons
        document.getElementById('addArrayBtn').addEventListener('click', () => this.addArray());
        document.getElementById('removeArrayBtn').addEventListener('click', () => this.removeArray());
        document.getElementById('resetPhasesBtn').addEventListener('click', () => this.resetPhases());
        document.getElementById('applyToAllBtn').addEventListener('click', () => this.applyToAllElements());
        document.getElementById('saveScenarioBtn').addEventListener('click', () => this.saveScenario());
        document.getElementById('resetScenarioBtn').addEventListener('click', () => this.resetScenario());
        document.getElementById('pauseSimBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('snapshotBtn').addEventListener('click', () => this.takeSnapshot());
        document.getElementById('exportHeatmapBtn').addEventListener('click', () => this.exportHeatmap());
        document.getElementById('quickSaveBtn').addEventListener('click', () => this.quickSave());
        document.getElementById('quickLoadBtn').addEventListener('click', () => this.showQuickLoadMenu());
        document.getElementById('loadCustomBtn').addEventListener('click', () => this.loadCustomScenario());
        
        // Array selection
        document.getElementById('arraySelect').addEventListener('change', (e) => {
            this.currentArrayIndex = parseInt(e.target.value);
            this.currentArray = this.arrays[this.currentArrayIndex];
            this.updateUIFromArray();
            this.updateAllVisualizations();
        });
        
        // Array name
        document.getElementById('arrayName').addEventListener('change', (e) => {
            this.currentArray.name = e.target.value;
            this.updateBackend();
            this.updateArraySelect();
        });
        
        // Scenario name
        document.getElementById('scenarioName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveScenario();
            }
        });
        
        // Update rate indicator
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 1000);
        
        // Handle keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    setupSlider(sliderId, callback) {
        const slider = document.getElementById(sliderId);
        const valueElement = document.getElementById(sliderId + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            const suffix = sliderId.includes('Angle') || 
                          sliderId.includes('rotation') || 
                          sliderId.includes('phase') ? '°' : '';
            
            if (valueElement) {
                valueElement.textContent = value + suffix;
            }
            
            callback(value);
        });
        
        // Add double-click to reset
        slider.addEventListener('dblclick', (e) => {
            const defaultValue = this.getDefaultValue(sliderId);
            e.target.value = defaultValue;
            const suffix = sliderId.includes('Angle') || 
                          sliderId.includes('rotation') || 
                          sliderId.includes('phase') ? '°' : '';
            
            if (valueElement) {
                valueElement.textContent = defaultValue + suffix;
            }
            
            callback(defaultValue);
        });
    }
    
    setupSelect(selectId, callback) {
        const select = document.getElementById(selectId);
        select.addEventListener('change', (e) => {
            callback(e.target.value);
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when user is typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case 's':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.quickSave();
                    }
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.resetPhases();
                    }
                    break;
                case 'Escape':
                    this.hideAllMenus();
                    break;
            }
        });
    }
    
    getDefaultValue(sliderId) {
        const defaults = {
            'numElements': '8',
            'curvature': '1.0',
            'elementSpacing': '0.5',
            'frequency': '2400',
            'posX': '0',
            'posY': '0',
            'rotation': '0',
            'steeringAngle': '0',
            'focusDistance': '5',
            'beamWidth': '30',
            'phaseSlope': '0',
            'elementPhase': '0',
            'elementAmplitude': '1.0'
        };
        
        return defaults[sliderId] || '0';
    }
    
    setupPresetButtons() {
        const presets = [
            { label: 'Broadside', steeringAngle: 0, beamWidth: 30 },
            { label: '30° Scan', steeringAngle: 30, beamWidth: 25 },
            { label: '60° Scan', steeringAngle: 60, beamWidth: 20 },
            { label: 'Focus 2m', focusDistance: 2, phaseProfile: 'quadratic' },
            { label: 'Focus 10m', focusDistance: 10, phaseProfile: 'quadratic' }
        ];
        
        const container = document.createElement('div');
        container.className = 'preset-buttons d-flex flex-wrap gap-2 mt-3';
        
        presets.forEach(preset => {
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-simulator-secondary';
            button.textContent = preset.label;
            button.addEventListener('click', async () => {
                Object.keys(preset).forEach(key => {
                    if (key !== 'label' && this.currentArray[key] !== undefined) {
                        this.currentArray[key] = preset[key];
                    }
                });
                this.calculatePhases();
                this.updateUIFromArray();
                await this.updateBackend();
                this.updateAllVisualizations();
                this.showNotification(`Applied ${preset.label} preset`);
            });
            container.appendChild(button);
        });
        
        document.querySelector('#beam-config .card-body').appendChild(container);
    }
    
    initializeCanvases() {
        // Get canvas contexts
        this.heatmapCtx = document.getElementById('heatmapCanvas').getContext('2d');
        this.polarCtx = document.getElementById('polarCanvas').getContext('2d');
        this.arrayCtx = document.getElementById('arrayCanvas').getContext('2d');
        this.phaseCtx = document.getElementById('phaseCanvas').getContext('2d');
        
        // Create heatmap gradient
        this.createHeatmapGradient();
        
        // Initialize polar chart
        this.initPolarChart();
        
        // Initialize phase chart
        this.initPhaseChart();
        
        // Set canvas sizes
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
    }
    
    resizeCanvases() {
        const canvases = ['heatmapCanvas', 'polarCanvas', 'arrayCanvas', 'phaseCanvas'];
        canvases.forEach(canvasId => {
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                const container = canvas.parentElement;
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        });
    }
    
    async loadFromBackend() {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'get_status'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.simulator) {
                    // Load arrays from backend
                    // Note: In a real implementation, you would parse the data
                    // For now, create default array
                    this.createDefaultArray();
                }
            } else {
                console.warn('Failed to load from backend, using default');
                this.createDefaultArray();
            }
        } catch (error) {
            console.error('Error loading from backend:', error);
            this.createDefaultArray();
        }
    }
    
    async updateBackend() {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'update_array',
                    array_id: this.currentArray.id || 0,
                    ...this.currentArray,
                    elements: this.currentArray.elements.map(e => ({
                        index: e.index,
                        phase: e.phase,
                        amplitude: e.amplitude
                    }))
                })
            });
            
            if (!response.ok) {
                console.error('Failed to update backend:', await response.text());
            }
        } catch (error) {
            console.error('Error updating backend:', error);
        }
    }
    
    getCsrfToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }
    
    createDefaultArray() {
        const array = {
            id: this.arrays.length,
            name: `Array ${this.arrays.length + 1}`,
            ...this.defaultConfig,
            elements: [],
            phaseSlope: 0
        };
        
        this.arrays.push(array);
        this.currentArray = array;
        this.updateArrayElements();
        this.calculatePhases();
        this.updateArraySelect();
    }
    
    updateArrayElements() {
        this.currentArray.elements = [];
        const numElements = this.currentArray.numElements;
        
        for (let i = 0; i < numElements; i++) {
            this.currentArray.elements.push({
                index: i,
                phase: 0,
                amplitude: 1.0,
                delay: 0,
                position: { x: 0, y: 0 }
            });
        }
        
        // Update element selection dropdown
        this.updateElementSelect();
    }
    
    calculatePhases() {
        const elements = this.currentArray.elements;
        const numElements = elements.length;
        const steeringAngle = this.currentArray.steeringAngle;
        const focusDistance = this.currentArray.focusDistance;
        const phaseProfile = this.currentArray.phaseProfile;
        const phaseSlope = this.currentArray.phaseSlope;
        
        // Calculate element positions based on geometry
        this.calculateElementPositions();
        
        switch (phaseProfile) {
            case 'linear':
                // Linear phase progression for beam steering
                for (let i = 0; i < numElements; i++) {
                    const position = (i - (numElements - 1) / 2);
                    elements[i].phase = position * phaseSlope;
                }
                break;
                
            case 'quadratic':
                // Quadratic phase for focusing
                for (let i = 0; i < numElements; i++) {
                    const dx = elements[i].position.x;
                    const dy = elements[i].position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Simple focusing calculation
                    elements[i].phase = -360 * distance / focusDistance;
                }
                break;
                
            case 'random':
                // Random phases
                for (let i = 0; i < numElements; i++) {
                    elements[i].phase = Math.random() * 360 - 180;
                }
                break;
                
            case 'custom':
                // Keep current phases
                break;
        }
        
        // Apply steering
        if (steeringAngle !== 0) {
            for (let i = 0; i < numElements; i++) {
                const position = (i - (numElements - 1) / 2);
                elements[i].phase += position * steeringAngle * 2; // Simplified
            }
        }
        
        // Normalize phases to -180 to 180
        for (let i = 0; i < numElements; i++) {
            while (elements[i].phase > 180) elements[i].phase -= 360;
            while (elements[i].phase < -180) elements[i].phase += 360;
        }
    }
    
    calculateElementPositions() {
        const elements = this.currentArray.elements;
        const numElements = elements.length;
        const geometry = this.currentArray.geometry;
        const spacing = this.currentArray.spacing;
        const curvature = this.currentArray.curvature;
        
        for (let i = 0; i < numElements; i++) {
            const position = (i - (numElements - 1) / 2);
            
            switch (geometry) {
                case 'linear':
                    elements[i].position.x = position * spacing;
                    elements[i].position.y = 0;
                    break;
                    
                case 'curved':
                    const angle = position * spacing / curvature;
                    elements[i].position.x = curvature * Math.sin(angle);
                    elements[i].position.y = curvature * (1 - Math.cos(angle));
                    break;
                    
                case 'circular':
                    const radius = (numElements * spacing) / (2 * Math.PI);
                    const circleAngle = (position * spacing) / radius;
                    elements[i].position.x = radius * Math.sin(circleAngle);
                    elements[i].position.y = radius * Math.cos(circleAngle);
                    break;
            }
            
            // Apply array rotation
            const cos = Math.cos(this.currentArray.rotation * Math.PI / 180);
            const sin = Math.sin(this.currentArray.rotation * Math.PI / 180);
            const x = elements[i].position.x;
            const y = elements[i].position.y;
            elements[i].position.x = x * cos - y * sin;
            elements[i].position.y = x * sin + y * cos;
            
            // Apply array position
            elements[i].position.x += this.currentArray.posX;
            elements[i].position.y += this.currentArray.posY;
        }
    }
    
    calculateBeamPattern(angles) {
        const elements = this.currentArray.elements;
        const numElements = elements.length;
        const wavelength = 300 / this.currentArray.frequency; // Speed of light / frequency
        const k = 2 * Math.PI / wavelength;
        
        return angles.map(theta => {
            const thetaRad = theta * Math.PI / 180;
            let sumReal = 0;
            let sumImag = 0;
            
            for (let i = 0; i < numElements; i++) {
                const element = elements[i];
                const phaseShift = element.phase * Math.PI / 180;
                const amplitude = element.amplitude;
                
                // Calculate phase contribution
                const elementPhase = k * (element.position.x * Math.sin(thetaRad) + 
                                        element.position.y * Math.cos(thetaRad));
                
                sumReal += amplitude * Math.cos(elementPhase + phaseShift);
                sumImag += amplitude * Math.sin(elementPhase + phaseShift);
            }
            
            const magnitude = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
            return magnitude / numElements; // Normalize
        });
    }
    
    updateAllVisualizations() {
        this.updateHeatmap();
        this.updatePolarPattern();
        this.updateArrayView();
        this.updatePhaseView();
        this.updateMetrics();
        this.updateStatusDisplay();
    }
    
    updateHeatmap() {
        const canvas = document.getElementById('heatmapCanvas');
        if (!canvas || !this.heatmapCtx) return;
        
        const ctx = this.heatmapCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
        gradient.addColorStop(1, 'rgba(30, 41, 59, 0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Draw coordinate system
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        
        // Grid lines
        const gridSize = 50;
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Center cross
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();
        
        // Calculate and draw beam pattern
        const scale = Math.min(width, height) / 20; // Adaptive scaling
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Sample points in space
        const resolution = 3;
        const step = Math.max(1, Math.floor(width / 200));
        
        for (let x = 0; x < width; x += step) {
            for (let y = 0; y < height; y += step) {
                const worldX = (x - centerX) / scale;
                const worldY = (centerY - y) / scale;
                
                // Calculate field intensity at this point
                let field = 0;
                const elements = this.currentArray.elements;
                
                for (const element of elements) {
                    const dx = worldX - element.position.x;
                    const dy = worldY - element.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const wavelength = 300 / this.currentArray.frequency;
                    const k = 2 * Math.PI / wavelength;
                    
                    if (distance > 0) {
                        const phase = element.phase * Math.PI / 180;
                        const elementField = element.amplitude * Math.cos(k * distance + phase) / (distance + 0.1);
                        field += elementField;
                    }
                }
                
                // Convert to intensity and normalize
                const intensity = Math.abs(field) / elements.length;
                const normalizedIntensity = Math.min(intensity * 5, 1);
                
                // Draw pixel
                if (normalizedIntensity > 0.05) {
                    const color = this.getHeatmapColor(normalizedIntensity);
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, step, step);
                }
            }
        }
        
        // Draw array elements
        this.drawArrayOnHeatmap(ctx, scale, centerX, centerY);
        
        // Draw beam direction
        this.drawBeamDirection(ctx, centerX, centerY);
    }
    
    drawArrayOnHeatmap(ctx, scale, centerX, centerY) {
        const elements = this.currentArray.elements;
        
        for (const element of elements) {
            const x = centerX + element.position.x * scale;
            const y = centerY - element.position.y * scale;
            
            // Draw element with glow effect
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#3b82f6';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            
            // Draw phase indicator
            const phaseAngle = element.phase * Math.PI / 180;
            const indicatorX = x + Math.cos(phaseAngle) * 10;
            const indicatorY = y - Math.sin(phaseAngle) * 10;
            
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(indicatorX, indicatorY);
            ctx.stroke();
            
            // Draw element glow based on amplitude
            if (element.amplitude > 0) {
                ctx.beginPath();
                ctx.arc(x, y, 8 * element.amplitude, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 * element.amplitude})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
    
    drawBeamDirection(ctx, centerX, centerY) {
        const angle = this.currentArray.steeringAngle * Math.PI / 180;
        const length = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.4;
        
        // Draw beam line with gradient
        const gradient = ctx.createLinearGradient(centerX, centerY, 
            centerX + Math.sin(angle) * length, 
            centerY - Math.cos(angle) * length);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.2)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.sin(angle) * length,
            centerY - Math.cos(angle) * length
        );
        ctx.stroke();
        
        // Draw arrow head
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        const arrowX = centerX + Math.sin(angle) * length;
        const arrowY = centerY - Math.cos(angle) * length;
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - Math.sin(angle + 0.3) * 10, arrowY + Math.cos(angle + 0.3) * 10);
        ctx.lineTo(arrowX - Math.sin(angle - 0.3) * 10, arrowY + Math.cos(angle - 0.3) * 10);
        ctx.closePath();
        ctx.fill();
        
        // Draw angle text with background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        const textX = centerX + Math.sin(angle) * (length + 30);
        const textY = centerY - Math.cos(angle) * (length + 30);
        ctx.fillRect(textX - 40, textY - 15, 80, 30);
        
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.currentArray.steeringAngle}°`, textX, textY);
    }
    
    initPolarChart() {
        const ctx = this.polarCtx;
        const canvas = document.getElementById('polarCanvas');
        
        if (!canvas) return;
        
        this.polarChart = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: Array.from({length: 72}, (_, i) => i * 5 - 180),
                datasets: [{
                    data: Array(72).fill(0),
                    backgroundColor: 'rgba(59, 130, 246, 0.3)',
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    borderWidth: 2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1,
                        ticks: {
                            display: false,
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.2)'
                        }
                    },
                    angle: {
                        ticks: {
                            color: '#cbd5e1'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Angle: ${context.label}°, Value: ${context.raw.toFixed(3)}`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 300,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    updatePolarPattern() {
        if (!this.polarChart) return;
        
        const angles = Array.from({length: 361}, (_, i) => i - 180);
        const pattern = this.calculateBeamPattern(angles);
        
        // Downsample for display
        const displayData = [];
        for (let i = 0; i < 72; i++) {
            const idx = i * 5;
            displayData.push(pattern[idx]);
        }
        
        this.polarChart.data.datasets[0].data = displayData;
        this.polarChart.update('none');
        
        // Update metrics
        this.updateBeamMetrics(pattern);
    }
    
    updateBeamMetrics(pattern) {
        const maxIndex = pattern.indexOf(Math.max(...pattern));
        const mainLobeAngle = maxIndex - 180;
        
        // Find -3dB points for beamwidth
        const maxPower = Math.max(...pattern) ** 2;
        const halfPower = maxPower / 2;
        
        let leftAngle = -180;
        let rightAngle = 180;
        
        for (let i = maxIndex; i >= 0; i--) {
            if (pattern[i] ** 2 <= halfPower) {
                leftAngle = i - 180;
                break;
            }
        }
        
        for (let i = maxIndex; i < pattern.length; i++) {
            if (pattern[i] ** 2 <= halfPower) {
                rightAngle = i - 180;
                break;
            }
        }
        
        const beamWidth = Math.abs(rightAngle - leftAngle);
        
        // Calculate sidelobe level
        const sidelobePattern = [...pattern];
        sidelobePattern.splice(Math.max(0, maxIndex - 10), 21); // Remove main lobe
        const maxSidelobe = Math.max(...sidelobePattern);
        const sidelobeLevel = 20 * Math.log10(maxSidelobe / pattern[maxIndex]) || -60;
        
        // Calculate directivity (simplified)
        const totalPower = pattern.reduce((sum, val) => sum + val ** 2, 0);
        const directivity = 10 * Math.log10(maxPower / (totalPower / pattern.length)) || 0;
        
        // Update display
        document.getElementById('mainLobeAngle').textContent = `${mainLobeAngle}°`;
        document.getElementById('mainLobeAngleDisplay').textContent = `${mainLobeAngle}°`;
        document.getElementById('measuredBeamWidth').textContent = `${beamWidth.toFixed(1)}°`;
        document.getElementById('sidelobeLevel').textContent = `${sidelobeLevel.toFixed(1)} dB`;
        document.getElementById('directivityValue').textContent = `${directivity.toFixed(1)} dBi`;
    }
    
    updateArrayView() {
        const canvas = document.getElementById('arrayCanvas');
        if (!canvas || !this.arrayCtx) return;
        
        const ctx = this.arrayCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
        gradient.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Draw background grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        const gridSize = 40;
        for (let x = 0; x <= width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw coordinate axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();
        
        // Draw coordinate labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('X (λ)', width/2, 20);
        ctx.save();
        ctx.translate(20, height/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillText('Y (λ)', 0, 0);
        ctx.restore();
        
        // Scale to fit array
        const elements = this.currentArray.elements;
        if (elements.length === 0) return;
        
        // Calculate bounds
        const xPositions = elements.map(e => e.position.x);
        const yPositions = elements.map(e => e.position.y);
        const maxX = Math.max(...xPositions.map(Math.abs));
        const maxY = Math.max(...yPositions.map(Math.abs));
        const maxExtent = Math.max(maxX, maxY, 1);
        
        const scale = Math.min(width, height) / (maxExtent * 2.5);
        
        // Draw elements
        for (const element of elements) {
            const x = width/2 + element.position.x * scale;
            const y = height/2 - element.position.y * scale;
            
            // Draw element with amplitude-based size
            const size = 8 + 4 * element.amplitude;
            const alpha = 0.3 + 0.7 * element.amplitude;
            
            // Draw glow effect
            ctx.shadowColor = element.amplitude > 0 ? '#3b82f6' : '#6b7280';
            ctx.shadowBlur = 15 * element.amplitude;
            ctx.fillStyle = element.amplitude > 0 ? 
                `rgba(59, 130, 246, ${alpha})` : 
                `rgba(107, 114, 128, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            
            // Draw phase indicator
            const phaseAngle = element.phase * Math.PI / 180;
            const indicatorLength = 15 * element.amplitude;
            const indicatorX = x + Math.cos(phaseAngle) * indicatorLength;
            const indicatorY = y - Math.sin(phaseAngle) * indicatorLength;
            
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(indicatorX, indicatorY);
            ctx.stroke();
            
            // Draw element number
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element.index + 1, x, y);
        }
        
        // Draw array outline
        if (elements.length > 1) {
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(width/2 + elements[0].position.x * scale, 
                      height/2 - elements[0].position.y * scale);
            
            for (let i = 1; i < elements.length; i++) {
                ctx.lineTo(width/2 + elements[i].position.x * scale, 
                          height/2 - elements[i].position.y * scale);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Update metrics
        const activeElements = elements.filter(e => e.amplitude > 0).length;
        const arrayLength = Math.max(...elements.map(e => Math.abs(e.position.x))) * 2;
        
        document.getElementById('activeElements').textContent = 
            `${activeElements}/${elements.length}`;
        document.getElementById('activeElementsDisplay').textContent = 
            `${activeElements}/${elements.length}`;
        document.getElementById('arrayLength').textContent = 
            `${arrayLength.toFixed(1)}λ`;
    }
    
    initPhaseChart() {
        const ctx = this.phaseCtx;
        const canvas = document.getElementById('phaseCanvas');
        
        if (!canvas) return;
        
        this.phaseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Phase',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Amplitude',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Element Index',
                            color: '#cbd5e1',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cbd5e1',
                            font: {
                                family: 'Inter, sans-serif'
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Phase (°)',
                            color: '#8b5cf6',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        },
                        min: -180,
                        max: 180,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cbd5e1',
                            font: {
                                family: 'Inter, sans-serif'
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Amplitude',
                            color: '#10b981',
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        },
                        min: 0,
                        max: 1,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#cbd5e1',
                            font: {
                                family: 'Inter, sans-serif'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#cbd5e1',
                            font: {
                                family: 'Inter, sans-serif'
                            },
                            usePointStyle: true
                        },
                        position: 'top'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#475569',
                        borderWidth: 1,
                        cornerRadius: 6,
                        usePointStyle: true
                    }
                },
                animation: {
                    duration: 300,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    updatePhaseView() {
        if (!this.phaseChart) return;
        
        const elements = this.currentArray.elements;
        const labels = elements.map((_, i) => i + 1);
        const phases = elements.map(e => e.phase);
        const amplitudes = elements.map(e => e.amplitude);
        
        this.phaseChart.data.labels = labels;
        this.phaseChart.data.datasets[0].data = phases;
        this.phaseChart.data.datasets[1].data = amplitudes;
        this.phaseChart.update('none');
        
        // Update phase metrics
        const maxPhase = Math.max(...phases);
        const minPhase = Math.min(...phases);
        const phaseMean = phases.reduce((a, b) => a + b, 0) / phases.length;
        const phaseVariance = phases.reduce((a, b) => a + (b - phaseMean) ** 2, 0) / phases.length;
        const phaseRMS = Math.sqrt(phaseVariance);
        
        document.getElementById('maxPhase').textContent = `${maxPhase.toFixed(1)}°`;
        document.getElementById('minPhase').textContent = `${minPhase.toFixed(1)}°`;
        document.getElementById('phaseRMS').textContent = `${phaseRMS.toFixed(1)}°`;
    }
    
    createHeatmapGradient() {
        // Create a gradient for heatmap colors
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = 256;
        gradientCanvas.height = 1;
        const gradientCtx = gradientCanvas.getContext('2d');
        
        const gradient = gradientCtx.createLinearGradient(0, 0, 256, 0);
        gradient.addColorStop(0, '#00008b');   // Dark blue
        gradient.addColorStop(0.25, '#0000ff'); // Blue
        gradient.addColorStop(0.5, '#00ffff');  // Cyan
        gradient.addColorStop(0.75, '#00ff00'); // Green
        gradient.addColorStop(1, '#ff0000');    // Red
        
        gradientCtx.fillStyle = gradient;
        gradientCtx.fillRect(0, 0, 256, 1);
        
        this.heatmapGradient = gradientCtx.getImageData(0, 0, 256, 1).data;
    }
    
    getHeatmapColor(intensity) {
        // intensity from 0 to 1
        const idx = Math.floor(Math.min(intensity, 0.99) * 255) * 4;
        return `rgba(${this.heatmapGradient[idx]}, ${this.heatmapGradient[idx + 1]}, 
                ${this.heatmapGradient[idx + 2]}, ${0.5 + intensity * 0.5})`;
    }
    
    updateSliderValue(sliderId, value) {
        const valueElement = document.getElementById(sliderId + 'Value');
        if (valueElement) {
            valueElement.textContent = value;
        }
    }
    
    updateElementSelect() {
        const select = document.getElementById('selectedElement');
        if (!select) return;
        
        select.innerHTML = '';
        
        for (let i = 0; i < this.currentArray.elements.length; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Element ${i + 1}`;
            select.appendChild(option);
        }
        
        this.updateElementControls(0);
    }
    
    updateElementControls(elementIndex) {
        const element = this.currentArray.elements[elementIndex];
        if (!element) return;
        
        document.getElementById('elementPhase').value = element.phase;
        document.getElementById('elementPhaseValue').textContent = `${element.phase}°`;
        
        document.getElementById('elementAmplitude').value = element.amplitude;
        document.getElementById('elementAmplitudeValue').textContent = element.amplitude.toFixed(2);
    }
    
    updateArraySelect() {
        const select = document.getElementById('arraySelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        this.arrays.forEach((array, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = array.name;
            if (index === this.currentArrayIndex) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    
    updateUIFromArray() {
        const array = this.currentArray;
        
        // Update sliders and values
        document.getElementById('numElements').value = array.numElements;
        this.updateSliderValue('numElements', array.numElements);
        
        document.getElementById('geometryType').value = array.geometry;
        document.getElementById('curvatureControl').style.display = 
            array.geometry === 'curved' ? 'block' : 'none';
        
        document.getElementById('curvature').value = array.curvature;
        this.updateSliderValue('curvature', array.curvature.toFixed(1));
        
        document.getElementById('elementSpacing').value = array.spacing;
        this.updateSliderValue('spacing', array.spacing.toFixed(2));
        
        document.getElementById('frequency').value = array.frequency;
        this.updateSliderValue('frequency', array.frequency);
        
        document.getElementById('posX').value = array.posX;
        this.updateSliderValue('posX', array.posX.toFixed(1));
        
        document.getElementById('posY').value = array.posY;
        this.updateSliderValue('posY', array.posY.toFixed(1));
        
        document.getElementById('rotation').value = array.rotation;
        this.updateSliderValue('rotation', array.rotation + '°');
        
        document.getElementById('steeringAngle').value = array.steeringAngle;
        this.updateSliderValue('steeringAngle', array.steeringAngle + '°');
        
        document.getElementById('focusDistance').value = array.focusDistance;
        this.updateSliderValue('focusDistance', array.focusDistance.toFixed(1));
        
        document.getElementById('beamWidth').value = array.beamWidth;
        this.updateSliderValue('beamWidth', array.beamWidth + '°');
        
        document.getElementById('phaseProfile').value = array.phaseProfile;
        document.getElementById('phaseSlope').value = array.phaseSlope;
        this.updateSliderValue('phaseSlope', array.phaseSlope + '°');
        
        document.getElementById('arrayName').value = array.name;
        
        this.updateElementSelect();
    }
    
    updateMetrics() {
        // Update max intensity
        const elements = this.currentArray.elements;
        const totalAmplitude = elements.reduce((sum, e) => sum + e.amplitude, 0);
        const avgAmplitude = totalAmplitude / elements.length;
        document.getElementById('maxIntensity').textContent = avgAmplitude.toFixed(2);
        document.getElementById('maxIntensityDisplay').textContent = avgAmplitude.toFixed(2);
    }
    
    updateStatusDisplay() {
        // Update connection status
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.style.color = '#10b981';
        }
        
        // Update simulation status
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            if (this.isRunning) {
                statusIndicator.classList.remove('status-inactive');
                statusIndicator.classList.add('status-active');
            } else {
                statusIndicator.classList.remove('status-active');
                statusIndicator.classList.add('status-inactive');
            }
        }
    }
    
    updatePerformanceMetrics() {
        const now = Date.now();
        const delta = now - this.lastUpdate;
        const fps = delta > 0 ? 1000 / delta : 60;
        this.lastUpdate = now;
        
        const updateRateElement = document.getElementById('updateRate');
        if (updateRateElement) {
            updateRateElement.textContent = Math.min(Math.round(fps), 60);
        }
    }
    
    async addArray() {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'add_array'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const newArray = {
                    id: this.arrays.length,
                    name: `Array ${this.arrays.length + 1}`,
                    ...this.defaultConfig,
                    elements: [],
                    phaseSlope: 0,
                    posX: this.arrays.length * 2
                };
                
                this.arrays.push(newArray);
                this.currentArrayIndex = this.arrays.length - 1;
                this.currentArray = newArray;
                
                this.updateArrayElements();
                this.calculatePhases();
                this.updateArraySelect();
                this.updateUIFromArray();
                this.updateAllVisualizations();
                
                this.showNotification(`Array ${this.arrays.length} added`);
            }
        } catch (error) {
            console.error('Error adding array:', error);
            this.showNotification('Failed to add array', 'error');
        }
    }
    
    async removeArray() {
        if (this.arrays.length <= 1) {
            this.showNotification('Cannot remove the last array', 'warning');
            return;
        }
        
        if (!confirm('Are you sure you want to remove this array?')) {
            return;
        }
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'remove_array',
                    array_id: this.currentArray.id
                })
            });
            
            if (response.ok) {
                this.arrays.splice(this.currentArrayIndex, 1);
                this.currentArrayIndex = Math.max(0, this.currentArrayIndex - 1);
                this.currentArray = this.arrays[this.currentArrayIndex];
                
                this.updateArraySelect();
                this.updateUIFromArray();
                this.updateAllVisualizations();
                
                this.showNotification('Array removed');
            }
        } catch (error) {
            console.error('Error removing array:', error);
            this.showNotification('Failed to remove array', 'error');
        }
    }
    
    async resetPhases() {
        this.currentArray.elements.forEach(element => {
            element.phase = 0;
            element.amplitude = 1.0;
        });
        
        this.currentArray.steeringAngle = 0;
        this.currentArray.phaseSlope = 0;
        
        document.getElementById('steeringAngle').value = 0;
        document.getElementById('phaseSlope').value = 0;
        this.updateSliderValue('steeringAngle', '0°');
        this.updateSliderValue('phaseSlope', '0°');
        
        await this.updateBackend();
        this.updateElementControls(0);
        this.updateAllVisualizations();
        this.showNotification('Phases reset to zero');
    }
    
    async applyToAllElements() {
        const selectedElement = parseInt(document.getElementById('selectedElement').value);
        const element = this.currentArray.elements[selectedElement];
        
        if (!element) return;
        
        this.currentArray.elements.forEach(e => {
            e.phase = element.phase;
            e.amplitude = element.amplitude;
        });
        
        await this.updateBackend();
        this.updateAllVisualizations();
        this.showNotification('Applied to all elements');
    }
    
    async loadScenario(scenarioId) {
        const scenario = this.scenarios[scenarioId];
        if (!scenario) {
            this.showNotification('Scenario not found', 'error');
            return;
        }
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'load_scenario',
                    scenario_id: scenarioId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Apply scenario settings
                Object.assign(this.currentArray, scenario);
                
                this.updateUIFromArray();
                this.updateArrayElements();
                this.calculatePhases();
                this.updateAllVisualizations();
                
                this.showNotification(`Loaded scenario: ${scenario.name}`);
            }
        } catch (error) {
            console.error('Error loading scenario:', error);
            
            // Fallback to local loading
            Object.assign(this.currentArray, scenario);
            this.updateUIFromArray();
            this.updateArrayElements();
            this.calculatePhases();
            this.updateAllVisualizations();
            this.showNotification(`Loaded scenario: ${scenario.name}`);
        }
    }
    
    async saveScenario() {
        const name = document.getElementById('scenarioName').value.trim();
        const description = document.getElementById('scenarioDescription').value.trim();
        
        if (!name) {
            this.showNotification('Please enter a scenario name', 'warning');
            return;
        }
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'save_scenario',
                    name: name,
                    description: description
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Update scenarios list
                this.scenarios[name.toLowerCase().replace(/ /g, '_')] = {
                    name: name,
                    description: description,
                    ...this.currentArray
                };
                
                // Clear form
                document.getElementById('scenarioName').value = '';
                document.getElementById('scenarioDescription').value = '';
                
                this.showNotification(`Scenario "${name}" saved`);
            }
        } catch (error) {
            console.error('Error saving scenario:', error);
            
            // Fallback to local save
            this.scenarios[name.toLowerCase().replace(/ /g, '_')] = {
                name: name,
                description: description,
                ...this.currentArray
            };
            
            // Remove elements from save
            delete this.scenarios[name.toLowerCase().replace(/ /g, '_')].elements;
            
            document.getElementById('scenarioName').value = '';
            document.getElementById('scenarioDescription').value = '';
            
            this.showNotification(`Scenario "${name}" saved locally`);
        }
    }
    
    async resetScenario() {
        if (!confirm('Reset to default configuration?')) {
            return;
        }
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'reset_array'
                })
            });
            
            if (response.ok) {
                Object.assign(this.currentArray, this.defaultConfig);
                this.updateUIFromArray();
                this.updateArrayElements();
                this.calculatePhases();
                this.updateAllVisualizations();
                this.showNotification('Reset to default configuration');
            }
        } catch (error) {
            console.error('Error resetting scenario:', error);
            
            // Fallback to local reset
            Object.assign(this.currentArray, this.defaultConfig);
            this.updateUIFromArray();
            this.updateArrayElements();
            this.calculatePhases();
            this.updateAllVisualizations();
            this.showNotification('Reset to default configuration');
        }
    }
    
    togglePause() {
        this.isRunning = !this.isRunning;
        const button = document.getElementById('pauseSimBtn');
        const indicator = document.querySelector('.status-indicator');
        
        if (this.isRunning) {
            button.innerHTML = '<i class="fas fa-pause me-2"></i>Pause';
            button.classList.remove('btn-simulator-secondary');
            button.classList.add('btn-simulator');
            indicator.classList.remove('status-inactive');
            indicator.classList.add('status-active');
            this.startAnimation();
            this.showNotification('Simulation resumed');
        } else {
            button.innerHTML = '<i class="fas fa-play me-2"></i>Play';
            button.classList.remove('btn-simulator');
            button.classList.add('btn-simulator-secondary');
            indicator.classList.remove('status-active');
            indicator.classList.add('status-inactive');
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            this.showNotification('Simulation paused');
        }
    }
    
    startAnimation() {
        if (!this.isRunning) return;
        
        const animate = () => {
            this.updateAllVisualizations();
            
            if (this.isRunning) {
                this.animationId = requestAnimationFrame(animate);
            }
        };
        
        this.animationId = requestAnimationFrame(animate);
    }
    
    takeSnapshot() {
        const activeTab = document.querySelector('#vizTabs .nav-link.active');
        const tabId = activeTab?.getAttribute('data-bs-target')?.replace('#', '') || 'heatmap-viz';
        
        let canvas;
        switch (tabId) {
            case 'heatmap-viz':
                canvas = document.getElementById('heatmapCanvas');
                break;
            case 'polar-viz':
                canvas = document.getElementById('polarCanvas');
                break;
            case 'array-viz':
                canvas = document.getElementById('arrayCanvas');
                break;
            case 'phase-viz':
                canvas = document.getElementById('phaseCanvas');
                break;
            default:
                canvas = document.getElementById('heatmapCanvas');
        }
        
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `beamforming_snapshot_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Snapshot saved');
    }
    
    exportHeatmap() {
        const canvas = document.getElementById('heatmapCanvas');
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `beamforming_heatmap_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Heatmap exported');
    }
    
    async quickSave() {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    action: 'quick_save',
                    name: `Quick Save ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                })
            });
            
            if (response.ok) {
                this.showNotification('Configuration saved');
            }
        } catch (error) {
            console.error('Error quick saving:', error);
            this.showNotification('Failed to save', 'error');
        }
    }
    
    showQuickLoadMenu() {
        // Create modal for quick load
        const modal = document.createElement('div');
        modal.className = 'modal fade show d-block';
        modal.style.cssText = 'background-color: rgba(0,0,0,0.5);';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content" style="background-color: var(--control-panel-bg); border-color: var(--border-color);">
                    <div class="modal-header">
                        <h5 class="modal-title text-white">Quick Load</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="list-group">
                            ${this.quickSaves.map((save, index) => `
                                <a href="#" class="list-group-item list-group-item-action" 
                                   style="background-color: var(--card-bg); border-color: var(--border-color); color: var(--text-primary);"
                                   onclick="window.simulator.loadQuickSave(${index}); $(this).closest('.modal').remove();">
                                    <div class="d-flex justify-content-between">
                                        <strong>${save.name}</strong>
                                        <small class="text-secondary">${save.timestamp}</small>
                                    </div>
                                    <small class="text-secondary">${save.array.numElements} elements, ${save.array.geometry}</small>
                                </a>
                            `).join('')}
                            ${this.quickSaves.length === 0 ? 
                                '<p class="text-center text-secondary">No quick saves available</p>' : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-simulator-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add Bootstrap modal behavior
        $(modal).modal('show');
        $(modal).on('hidden.bs.modal', function () {
            modal.remove();
        });
        
        // Close on escape
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                $(modal).modal('hide');
            }
        });
    }
    
    loadQuickSave(index) {
        if (index >= 0 && index < this.quickSaves.length) {
            const save = this.quickSaves[index];
            this.currentArray = { ...save.array };
            this.updateUIFromArray();
            this.updateAllVisualizations();
            this.showNotification(`Loaded: ${save.name}`);
        }
    }
    
    loadCustomScenario() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const config = JSON.parse(e.target.result);
                        
                        const response = await fetch(this.apiEndpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': this.getCsrfToken()
                            },
                            body: JSON.stringify({
                                action: 'import_config',
                                config: config
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            // Reload from backend
                            await this.loadFromBackend();
                            this.updateAllVisualizations();
                            
                            this.showNotification('Custom scenario loaded');
                        }
                    } catch (err) {
                        this.showNotification('Error loading file: ' + err.message, 'error');
                    }
                };
                reader.readAsText(file);
            } catch (error) {
                this.showNotification('Error reading file', 'error');
            }
        };
        input.click();
    }
    
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.arrays.length > 0 && this.isRunning) {
                this.quickSave();
            }
        }, 30000);
    }
    
    hideAllMenus() {
        // Remove any open modals or dropdowns
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            $(modal).modal('hide');
        });
        
        // Close any open dropdowns
        const dropdowns = document.querySelectorAll('.dropdown.show');
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            if (toggle) {
                toggle.click();
            }
        });
    }
    
    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `custom-notification alert alert-${type === 'error' ? 'danger' : type} position-fixed`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 250px;
            max-width: 400px;
            backdrop-filter: blur(10px);
            border: 1px solid ${type === 'error' ? 'var(--error)' : type === 'warning' ? 'var(--caution)' : 'var(--success)'};
            animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 2.7s;
        `;
        
        const icon = type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'check-circle';
        
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${icon} me-3" style="font-size: 1.2rem;"></i>
                <div class="flex-grow-1">
                    <div class="fw-semibold">${message}</div>
                </div>
                <button type="button" class="btn-close btn-close-white ms-3" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
        
        // Add CSS for animations if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                .custom-notification.alert-success {
                    background-color: rgba(19, 213, 39, 0.1) !important;
                    color: #d1fadf !important;
                    border-color: var(--success) !important;
                }
                
                .custom-notification.alert-warning {
                    background-color: rgba(219, 187, 37, 0.1) !important;
                    color: #fef3c7 !important;
                    border-color: var(--caution) !important;
                }
                
                .custom-notification.alert-danger {
                    background-color: rgba(230, 24, 94, 0.1) !important;
                    color: #fce7f3 !important;
                    border-color: var(--error) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Initialize simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading indicator
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Initialize simulator
    window.simulator = new BeamformingSimulator();
    
    // Make loadScenario available globally
    window.loadScenario = (scenarioId) => {
        window.simulator.loadScenario(scenarioId);
    };
    
    // Update all slider values on page load
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueId = slider.id + 'Value';
        const valueElement = document.getElementById(valueId);
        if (valueElement) {
            const suffix = slider.id.includes('Angle') || 
                          slider.id.includes('rotation') || 
                          slider.id.includes('phase') ? '°' : '';
            valueElement.textContent = slider.value + suffix;
        }
    });
    
    // Show curvature control based on initial geometry
    const geometrySelect = document.getElementById('geometryType');
    const curvatureControl = document.getElementById('curvatureControl');
    if (geometrySelect && curvatureControl) {
        curvatureControl.style.display = geometrySelect.value === 'curved' ? 'block' : 'none';
        geometrySelect.addEventListener('change', function() {
            curvatureControl.style.display = this.value === 'curved' ? 'block' : 'none';
        });
    }
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Show welcome message
    setTimeout(() => {
        if (window.simulator && window.simulator.showNotification) {
            window.simulator.showNotification('Beamforming Simulator Ready!');
        }
    }, 1000);
});

// Handle window resize
window.addEventListener('resize', function() {
    if (window.simulator && window.simulator.resizeCanvases) {
        window.simulator.resizeCanvases();
        if (window.simulator.updateAllVisualizations) {
            window.simulator.updateAllVisualizations();
        }
    }
});

// Export functionality
window.exportConfiguration = function() {
    window.location.href = '/api/beamforming/export/';
};

// Import functionality
window.importConfiguration = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('config_file', file);
        
        try {
            const response = await fetch('/api/beamforming/import/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                if (window.simulator) {
                    window.simulator.showNotification('Configuration imported successfully');
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            } else {
                if (window.simulator) {
                    window.simulator.showNotification('Failed to import configuration', 'error');
                }
            }
        } catch (error) {
            console.error('Error importing:', error);
            if (window.simulator) {
                window.simulator.showNotification('Error importing configuration', 'error');
            }
        }
    };
    input.click();
};