/**
 * ImageMixer - Main orchestrator class with filter rectangle feature
 */
class ImageMixer {
    constructor() {
        this._images = {};
        this._inputViewports = [];
        this._componentViewports = [];
        this._outputViewports = [];
        this._filter = null;
        this._mixingMode = 'magnitude_phase';
        this._selectedOutput = 1;
        this._pendingRequest = null;
        this._statusTimeout = null;
        this._mixingDebounceTimer = null;
        this._filterDebounceTimer = null;
        this._isMixing = false;
        
        this.initialize();
    }

    // Getters
    get images() {
        return this._images;
    }

    get inputViewports() {
        return this._inputViewports;
    }

    get componentViewports() {
        return this._componentViewports;
    }

    get outputViewports() {
        return this._outputViewports;
    }

    get filter() {
        return this._filter;
    }

    get mixingMode() {
        return this._mixingMode;
    }

    get selectedOutput() {
        return this._selectedOutput;
    }

    get pendingRequest() {
        return this._pendingRequest;
    }

    get statusTimeout() {
        return this._statusTimeout;
    }

    // Setters
    set mixingMode(value) {
        this._mixingMode = value;
    }

    set selectedOutput(value) {
        this._selectedOutput = value;
    }

    set pendingRequest(value) {
        this._pendingRequest = value;
    }

    set statusTimeout(value) {
        this._statusTimeout = value;
    }

    set filter(value) {
        this._filter = value;
    }

    // Methods for managing images
    getImage(imageKey) {
        return this._images[imageKey];
    }

    setImage(imageKey, image) {
        this._images[imageKey] = image;
    }

    // Methods for managing viewports
    getInputViewport(index) {
        return this._inputViewports[index];
    }

    addInputViewport(viewport) {
        this._inputViewports.push(viewport);
    }

    getComponentViewport(index) {
        return this._componentViewports[index];
    }

    addComponentViewport(viewport) {
        this._componentViewports.push(viewport);
    }

    getOutputViewport(index) {
        return this._outputViewports[index];
    }

    addOutputViewport(viewport) {
        this._outputViewports.push(viewport);
    }

    /**
     * Main initialization - sets up all OOP components
     */
    initialize() {
        this.createImages();
        this.createFilter();
        this.createViewports();
        this.initializeMixingMode();
        this.initializeSliders();
        this.initializeOutputSelection();
        this.setupGlobalListeners();
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.updateAllRectangles();
        });
        
        this.showStatus('Ready', 'done');
    }

    createImages() {
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            this.setImage(imageKey, new Image(imageKey, i));
        }
    }

    createFilter() {
        this.filter = new Filter();
    }

    createViewports() {
        // Create input viewports
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            const viewport = new InputViewport(`input-viewport-${i}`, i, this.getImage(imageKey));
            this.addInputViewport(viewport);
        }
        
        // Create component viewports
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            const viewport = new ComponentViewport(`component-viewport-${i}`, i, this.getImage(imageKey), this.filter);
            this.addComponentViewport(viewport);
        }
        
        // Create output viewports
        for (let i = 1; i <= 2; i++) {
            const viewport = new OutputViewport(`output-viewport-${i}`, i);
            this.addOutputViewport(viewport);
        }
    }

    initializeMixingMode() {
        const modeSelect = document.getElementById('unified-mode-select');
        if (!modeSelect) return;
        
        modeSelect.addEventListener('change', () => {
            this.mixingMode = modeSelect.value;
            this.updateModeLabels();
            this.updateComponentViewportsForMode();
            this.performMixing();
        });
        
        this.updateModeLabels();
    }

    updateComponentViewportsForMode() {
        // Update component selects and previews based on mixing mode
        const defaultComponent = this.mixingMode === 'magnitude_phase' ? 'magnitude' : 'real';
        
        for (let i = 1; i <= 4; i++) {
            const select = document.getElementById(`component-select-${i}`);
            if (select) {
                select.value = defaultComponent;
            }
            
            // Trigger component viewport update
            const componentViewport = this.getComponentViewport(i - 1);
            if (componentViewport) {
                componentViewport.updateComponentPreview();
            }
        }
    }

    updateModeLabels() {
        for (let i = 1; i <= 4; i++) {
            const labelA = document.getElementById(`label-a-${i}`);
            const labelB = document.getElementById(`label-b-${i}`);
            
            if (labelA && labelB) {
                if (this.mixingMode === 'magnitude_phase') {
                    labelA.textContent = 'Mag';
                    labelB.textContent = 'Phase';
                } else {
                    labelA.textContent = 'Real';
                    labelB.textContent = 'Imag';
                }
            }
        }
    }

    initializeSliders() {
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            
            const sliderA = document.getElementById(`weight-a-${i}`);
            const valueA = document.getElementById(`weight-a-value-${i}`);
            
            if (sliderA && valueA) {
                sliderA.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    valueA.textContent = val;
                    this.getImage(imageKey).setWeight('a', val);
                    this.debouncedPerformMixing(150);
                });
            }
            
            const sliderB = document.getElementById(`weight-b-${i}`);
            const valueB = document.getElementById(`weight-b-value-${i}`);
            
            if (sliderB && valueB) {
                sliderB.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    valueB.textContent = val;
                    this.getImage(imageKey).setWeight('b', val);
                    this.debouncedPerformMixing(150);
                });
            }
        }
    }

    initializeOutputSelection() {
        for (let i = 1; i <= 2; i++) {
            const viewport = this.getOutputViewport(i - 1);
            if (viewport) {
                // Override select method
                // const originalSelect = viewport.select;
                viewport.select = () => {
                    // Remove selection from all outputs
                    document.querySelectorAll('.output-container').forEach(c => {
                        c.classList.remove('selected');
                    });
                    
                    // Select this one
                    if (viewport.container) {
                        viewport.container.classList.add('selected');
                    }
                    viewport.isSelected = true;
                    this.selectedOutput = i;
                    
                    // Dispatch event
                    const event = new CustomEvent('output-selected', {
                        detail: { outputIndex: i }
                    });
                    document.dispatchEvent(event);
                };
                
                // Add double-click listener
                viewport.element.addEventListener('dblclick', () => {
                    viewport.select();
                });
            }
        }
        
        // Select first output by default
        const firstOutput = this.getOutputViewport(0);
        if (firstOutput) {
            firstOutput.select();
        }
    }

    setupGlobalListeners() {
        // Filter changes - debounced for drag/resize performance
        document.addEventListener('filter-changed', () => {
            clearTimeout(this._filterDebounceTimer);
            this._filterDebounceTimer = setTimeout(() => {
                this.performMixing();
            }, 100);
        });
        
        // Output selection
        document.addEventListener('output-selected', (e) => {
            this.selectedOutput = e.detail.outputIndex;
            this.performMixing();
        });
        
        // Image uploaded
        document.addEventListener('image-uploaded', async (e) => {
            // const { imageIndex } = e.detail;
            
            // Trigger auto-resize
            await this.autoResize();
            
            // Perform mixing if any images are loaded
            if (this.hasLoadedImages()) {
                this.performMixing();
            }
        });
    }

    async performMixing() {
        // Prevent duplicate mixing operations
        if (this._isMixing) {
            return;
        }
        
        if (this.pendingRequest) {
            this.pendingRequest.abort();
        }
        
        if (!this.hasLoadedImages()) {
            console.warn('Cannot perform mixing - no images loaded');
            this.showStatus('No images loaded', 'done');
            setTimeout(() => this.hideStatus(), 1500);
            return;
        }
        
        this._isMixing = true;
        this.showStatus('Computing IFFT...', 'loading');
        
        const controller = new AbortController();
        this.pendingRequest = controller;
        
        try {
            const weightsA = {};
            const weightsB = {};
            
            for (let i = 1; i <= 4; i++) {
                const imageKey = `img${i}`;
                const image = this.getImage(imageKey);
                if (image.isLoaded()) {
                    weightsA[imageKey] = image.weights.a;
                    weightsB[imageKey] = image.weights.b;
                }
            }
            
            const response = await fetch('/api/mix/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modes: Object.fromEntries(
                        Object.keys(this.images)
                            .filter(key => this.getImage(key).isLoaded())
                            .map(key => [key, this.mixingMode])
                    ),
                    weights_a: weightsA,
                    weights_b: weightsB,
                    region: this.filter.getParams(),
                    output_key: `output${this.selectedOutput}`
                }),
                signal: controller.signal
            });
            
            const data = await response.json();
            
            if (data.success) {
                const outputViewport = this.getOutputViewport(this.selectedOutput - 1);
                if (outputViewport) {
                    outputViewport.displayOutput(data.output_image);
                }
                this.showStatus('Done', 'done');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.hideStatus();
            } else {
                console.error('Mixing failed:', error);
                this.hideStatus();
            }
        } finally {
            this.pendingRequest = null;
            this._isMixing = false;
        }
    }

    async autoResize() {
        try {
            const response = await fetch('/api/resize/', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                for (let i = 1; i <= 4; i++) {
                    const imageKey = `img${i}`;
                    if (data.images[imageKey]) {
                        const image = this.getImage(imageKey);
                        image.base64Data = data.images[imageKey];
                        
                        // Update input viewport
                        const inputViewport = this.getInputViewport(i - 1);
                        if (inputViewport) {
                            inputViewport.updateImage(data.images[imageKey]);
                        }
                        
                        // Update component viewport
                        const componentViewport = this.getComponentViewport(i - 1);
                        if (componentViewport) {
                            componentViewport.updateComponentPreview();
                        }
                    }
                }
                
                // Update filter rectangles
                this.updateAllRectangles();
            }
        } catch (error) {
            console.error('Auto-resize failed:', error);
        }
    }

    updateAllRectangles() {
        if (this.filter) {
            this.filter.updateAllRectangles();
        }
    }

    debouncedPerformMixing(delay = 150) {
        clearTimeout(this._mixingDebounceTimer);
        this._mixingDebounceTimer = setTimeout(() => {
            this.performMixing();
        }, delay);
    }

    hasLoadedImages() {
        return Object.values(this.images).some(image => image.isLoaded());
    }

    showStatus(message, type = 'loading') {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        clearTimeout(this.statusTimeout);
        
        if (indicator && text) {
            text.textContent = message;
            indicator.className = `status-indicator visible ${type}`;
            
            if (type === 'done') {
                this.statusTimeout = setTimeout(() => {
                    indicator.classList.remove('visible');
                }, 2000);
            }
        }
    }

    hideStatus() {
        const indicator = document.getElementById('status-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
        }
    }
}