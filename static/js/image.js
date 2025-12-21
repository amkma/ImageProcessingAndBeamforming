/**
 * ImageMixer - Fourier Transform-based Image Processing Application
 * 
 * Architecture:
 * - OOP-based design with ImageMixerApp class
 * - Centralized state management as instance properties
 * - Event-driven UI interactions with drag-based adjustments
 * - Real-time FFT component visualization
 * - Frequency domain filtering with visual rectangle overlay
 * - Unified mixing mode selection (magnitude/phase or real/imaginary)
 */

class ImageMixerApp {
    /**
     * Initialize Image Mixer Application
     * 
     * State Properties:
     * - images: Base64-encoded grayscale images for 4 input slots
     * - adjustments: Display-only brightness/contrast for input viewports (does not affect FFT)
     * - outputAdjustments: Brightness/contrast for output viewports
     * - mixingMode: Unified mode for all images ('magnitude_phase' or 'real_imaginary')
     * - weightsA/B: Slider weights for component A (Mag/Real) and B (Phase/Imag)
     * - selectedOutput: Which output viewport (1 or 2) receives mixed results
     * - pendingRequest: AbortController for canceling in-flight API requests
     * - dragState: Active drag operation state for viewport adjustments
     * - filter: Frequency domain filter configuration (rectangle coordinates and mode)
     * - rectangleDragState: Active drag operation for filter rectangle manipulation
     */
    constructor() {
        this.state = {
            images: {
                img1: null,
                img2: null,
                img3: null,
                img4: null
            },
            adjustments: {
                img1: { brightness: 1.0, contrast: 1.0 },
                img2: { brightness: 1.0, contrast: 1.0 },
                img3: { brightness: 1.0, contrast: 1.0 },
                img4: { brightness: 1.0, contrast: 1.0 }
            },
            outputAdjustments: {
                output1: { brightness: 1.0, contrast: 1.0 },
                output2: { brightness: 1.0, contrast: 1.0 }
            },
            componentAdjustments: {
                img1: { brightness: 1.0, contrast: 1.0 },
                img2: { brightness: 1.0, contrast: 1.0 },
                img3: { brightness: 1.0, contrast: 1.0 },
                img4: { brightness: 1.0, contrast: 1.0 }
            },
            mixingMode: 'magnitude_phase',
            weightsA: { img1: 0, img2: 0, img3: 0, img4: 0 },
            weightsB: { img1: 0, img2: 0, img3: 0, img4: 0 },
            selectedOutput: 1,
            pendingRequest: null,
            dragState: null,
            filter: {
                mode: 'inner',
                rect: {
                    x: 0.25,
                    y: 0.25,
                    width: 0.5,
                    height: 0.5
                }
            },
            savedRectangle: null,
            rectangleDragState: null
        };

        this.statusTimeout = null;
        this.adjustmentTimeout = null;
    }

    /**
     * Show status indicator with message and type
     * @param {string} message - Status message to display
     * @param {string} type - Status type: 'loading' (spinner) or 'done' (checkmark)
     * 
     * Design: Auto-hides 'done' status after 2s, 'loading' stays until manually hidden
     */
    showStatus(message, type = 'loading') {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        clearTimeout(this.statusTimeout);
        
        text.textContent = message;
        indicator.className = `status-indicator visible ${type}`;
        
        // Auto-hide success messages
        if (type === 'done') {
            this.statusTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
            }, 2000);
        }
    }

    /**
     * Hide status indicator immediately
     */
    hideStatus() {
        const indicator = document.getElementById('status-indicator');
        indicator.classList.remove('visible');
    }

    /**
     * =============================================================================
     * APPLICATION INITIALIZATION
     * =============================================================================
     */

    /**
     * Main initialization - sets up all event listeners and UI components
     * Called after DOM is fully loaded to ensure all elements exist
     */
    initialize() {
        this.initializeFileInputs();
        this.initializeViewportDrag();
        this.initializeComponentSelects();
        this.initializeMixingMode();
        this.initializeSliders();
        this.initializeOutputSelection();
        this.initializeFilterControls();
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.updateAllRectangles();
        });
    }

    /**
     * =============================================================================
     * UTILITY FUNCTIONS
     * =============================================================================
     */

    /**
     * Check if any images are currently loaded
     * @returns {boolean} True if at least one image is loaded
     */
    hasLoadedImages() {
        return Object.values(this.state.images).some(img => img !== null);
    }

    /**
     * =============================================================================
     * FILE UPLOAD & IMAGE DISPLAY
     * =============================================================================
     */

    /**
     * Initialize file upload event listeners for all 4 input viewports
     * Design: Double-click viewport to trigger hidden file input
     */
    initializeFileInputs() {
        for (let i = 1; i <= 4; i++) {
            const viewport = document.getElementById(`input-viewport-${i}`);
            const fileInput = document.getElementById(`input-file-${i}`);
            
            viewport.addEventListener('dblclick', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files[0], `img${i}`, i);
            });
        }
    }

    /**
     * Upload image file to backend and process
     * Backend converts to grayscale, stores in session, pre-computes FFT
     * 
     * @param {File} file - Selected image file
     * @param {string} imageKey - State key (img1-img4)
     * @param {number} index - Viewport index (1-4)
     * 
     * Workflow:
     * 1. Upload to /api/upload/ endpoint
     * 2. Backend converts to grayscale and caches FFT components
     * 3. Auto-resize all images to smallest dimensions (unified sizing)
     * 4. Trigger FFT component preview update
     * 5. Resize viewports to fit smallest image
     * 6. Update filter rectangle visibility
     */
    async handleFileUpload(file, imageKey, index) {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('image_key', imageKey);
        
        try {
            const response = await fetch('/api/upload/', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.state.images[imageKey] = data.grayscale_image;
                this.displayImage(`input-viewport-${index}`, data.grayscale_image);
                
                await this.autoResize();
                
                this.updateComponentPreview(index);
                
                setTimeout(() => this.resizeAllInputViewportsToSmallest(), 100);
                
                this.updateAllRectangles();
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    }

    /**
     * Display base64 image in specified viewport
     * @param {string} viewportId - DOM element ID
     * @param {string} imageSrc - Base64 image data URI
     * 
     * Design: Creates new img element to replace placeholder
     * Triggers viewport resize on load for input viewports
     */
    displayImage(viewportId, imageSrc) {
        const viewport = document.getElementById(viewportId);
        viewport.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = imageSrc;
        
        img.onload = () => {
            if (viewportId.includes('input-viewport')) {
                this.resizeAllInputViewportsToSmallest();
            }
        };
        
        viewport.appendChild(img);
    }

    /**
     * Resize all input viewports to match smallest loaded image dimensions
     * Maintains aspect ratio and enforces 200px maximum size
     * 
     * Purpose: Ensures visual consistency across all input viewports
     * All images are displayed at the same viewport size regardless of original dimensions
     * 
     * Algorithm:
     * 1. Find smallest naturalWidth/Height across all loaded images
     * 2. Calculate aspect ratio from smallest image
     * 3. Scale to fit within 200x200px box while preserving aspect ratio
     * 4. Apply dimensions to all 4 input viewport containers
     */
    resizeAllInputViewportsToSmallest() {
        const inputViewports = [
            { id: 'input-viewport-1' },
            { id: 'input-viewport-2' },
            { id: 'input-viewport-3' },
            { id: 'input-viewport-4' }
        ];
        
        let minWidth = Infinity;
        let minHeight = Infinity;
        let hasAnyImage = false;
        
        inputViewports.forEach(viewport => {
            const element = document.getElementById(viewport.id);
            const img = element?.querySelector('img');
            
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                hasAnyImage = true;
                minWidth = Math.min(minWidth, img.naturalWidth);
                minHeight = Math.min(minHeight, img.naturalHeight);
            }
        });
        
        if (!hasAnyImage) return;
        
        const aspectRatio = minWidth / minHeight;
        const maxSize = 200;
        
        let finalWidth, finalHeight;
        
        if (aspectRatio > 1) {
            finalWidth = maxSize;
            finalHeight = Math.round(maxSize / aspectRatio);
        } else {
            finalHeight = maxSize;
            finalWidth = Math.round(maxSize * aspectRatio);
        }
        
        inputViewports.forEach(viewport => {
            const element = document.getElementById(viewport.id);
            if (element) {
                element.style.width = `${finalWidth}px`;
                element.style.height = `${finalHeight}px`;
            }
        });
    }

    /**
     * =============================================================================
     * INPUT VIEWPORT BRIGHTNESS/CONTRAST ADJUSTMENTS
     * =============================================================================
     */

    /**
     * Initialize drag-based brightness/contrast adjustments for input and output viewports
     * 
     * Interaction Model:
     * - Mouse drag up/down: Adjust brightness (0.0 to 2.0)
     * - Mouse drag left/right: Adjust contrast (0.0 to 3.0)
     * 
     * Design: 
     * - Input viewports: Display-only adjustments (does NOT affect FFT calculations)
     * - Output viewports: Backend adjustments
     * Backend always uses original unmodified images for frequency domain operations
     */
    initializeViewportDrag() {
        for (let i = 1; i <= 4; i++) {
            const viewport = document.getElementById(`input-viewport-${i}`);
            const imageKey = `img${i}`;
            
            viewport.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (!this.state.images[imageKey]) return;
                
                e.preventDefault();
                
                this.state.dragState = {
                    viewport: viewport,
                    imageKey: imageKey,
                    index: i,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialBrightness: this.state.adjustments[imageKey].brightness,
                    initialContrast: this.state.adjustments[imageKey].contrast,
                    isOutput: false
                };
                
                viewport.classList.add('dragging');
                this.showAdjustmentIndicator(this.state.dragState.initialBrightness, this.state.dragState.initialContrast);
                
                document.addEventListener('mousemove', (e) => this.handleDrag(e));
                document.addEventListener('mouseup', () => this.handleDragEnd());
            });
        }
        
        for (let i = 1; i <= 2; i++) {
            const viewport = document.getElementById(`output-viewport-${i}`);
            const outputKey = `output${i}`;
            
            viewport.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                
                const img = viewport.querySelector('img');
                if (!img) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                this.state.dragState = {
                    viewport: viewport,
                    outputKey: outputKey,
                    outputIndex: i,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialBrightness: this.state.outputAdjustments[outputKey].brightness,
                    initialContrast: this.state.outputAdjustments[outputKey].contrast,
                    isOutput: true
                };
                
                viewport.classList.add('dragging');
                this.showAdjustmentIndicator(this.state.dragState.initialBrightness, this.state.dragState.initialContrast);
                
                document.addEventListener('mousemove', (e) => this.handleDrag(e));
                document.addEventListener('mouseup', () => this.handleDragEnd());
            });
        }
        
        // Component viewport drag (brightness/contrast for FFT components)
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            const viewport = document.getElementById(`component-viewport-${i}`);
            
            viewport.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                
                const img = viewport.querySelector('img');
                if (!img) return;
                
                // Don't interfere with filter rectangle drag
                if (e.target.closest('.filter-rectangle') || e.target.closest('.resize-handle')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                this.state.dragState = {
                    viewport: viewport,
                    imageKey: imageKey,
                    componentIndex: i,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialBrightness: this.state.componentAdjustments[imageKey].brightness,
                    initialContrast: this.state.componentAdjustments[imageKey].contrast,
                    isComponent: true
                };
                
                viewport.classList.add('dragging');
                this.showAdjustmentIndicator(this.state.dragState.initialBrightness, this.state.dragState.initialContrast);
                
                document.addEventListener('mousemove', (e) => this.handleDrag(e));
                document.addEventListener('mouseup', () => this.handleDragEnd());
            });
        }
    }

    /**
     * Handle mouse move during brightness/contrast drag operation
     * @param {MouseEvent} e - Mouse move event
     * 
     * Controls:
     * - Vertical (Y-axis): Brightness adjustment
     *   - Drag up: increase brightness (inversed for intuitive feel)
     *   - Drag down: decrease brightness
     *   - Range: 0.0 (black) to 2.0 (very bright)
     *   - Sensitivity: 300px for full range
     * 
     * - Horizontal (X-axis): Contrast adjustment
     *   - Drag right: increase contrast
     *   - Drag left: decrease contrast
     *   - Range: 0.0 (flat gray) to 3.0 (maximum contrast)
     *   - Sensitivity: 300px for full range
     */
    handleDrag(e) {
        if (!this.state.dragState) return;
        
        const deltaX = e.clientX - this.state.dragState.startX;
        const deltaY = e.clientY - this.state.dragState.startY;
        
        const brightness = this.state.dragState.initialBrightness - (deltaY / 300);
        const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
        
        const contrast = this.state.dragState.initialContrast + (deltaX / 300);
        const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
        
        if (this.state.dragState.isOutput) {
            this.state.outputAdjustments[this.state.dragState.outputKey] = {
                brightness: clampedBrightness,
                contrast: clampedContrast
            };
        } else if (this.state.dragState.isComponent) {
            this.state.componentAdjustments[this.state.dragState.imageKey] = {
                brightness: clampedBrightness,
                contrast: clampedContrast
            };
        } else {
            this.state.adjustments[this.state.dragState.imageKey] = {
                brightness: clampedBrightness,
                contrast: clampedContrast
            };
        }
        
        this.showAdjustmentIndicator(clampedBrightness, clampedContrast);
    }

    /**
     * Finalize brightness/contrast adjustment on mouse release
     * 
     * Design Decision:
     * - Input viewports: Display-only adjustments via backend
     * - Output viewports: Backend adjustments
     * - Does NOT trigger FFT recalculation
     * - Backend FFT operations always use original unmodified images
     * 
     * Rationale: Separates visual presentation from frequency domain calculations
     * Users can adjust display for better visibility without affecting mix results
     */
    async handleDragEnd() {
        if (!this.state.dragState) return;
        
        this.state.dragState.viewport.classList.remove('dragging');
        
        this.hideAdjustmentIndicator();
        
        try {
            if (this.state.dragState.isOutput) {
                const outputKey = this.state.dragState.outputKey;
                const outputIndex = this.state.dragState.outputIndex;
                const adjustments = this.state.outputAdjustments[outputKey];
                
                const response = await fetch('/api/apply-output-adjustments/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        output_key: outputKey,
                        brightness: adjustments.brightness,
                        contrast: adjustments.contrast
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.displayImage(`output-viewport-${outputIndex}`, data.adjusted_image);
                } else {
                    console.warn(`Output adjustment failed: ${data.error}`);
                    // Reset adjustments to neutral if output doesn't exist
                    this.state.outputAdjustments[outputKey] = {
                        brightness: 1.0,
                        contrast: 1.0
                    };
                }
            } else if (this.state.dragState.isComponent) {
                const imageKey = this.state.dragState.imageKey;
                const componentIndex = this.state.dragState.componentIndex;
                const adjustments = this.state.componentAdjustments[imageKey];
                const component = document.getElementById(`component-select-${componentIndex}`).value;
                
                const response = await fetch('/api/apply-component-adjustments/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_key: imageKey,
                        component: component,
                        brightness: adjustments.brightness,
                        contrast: adjustments.contrast
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const viewport = document.getElementById(`component-viewport-${componentIndex}`);
                    const overlay = document.getElementById(`filter-overlay-${componentIndex}`);
                    const overlayParent = overlay.parentNode;
                    overlayParent.removeChild(overlay);
                    
                    this.displayImage(`component-viewport-${componentIndex}`, data.adjusted_image);
                    
                    viewport.appendChild(overlay);
                    this.updateAllRectangles();
                } else {
                    console.warn(`Component adjustment failed: ${data.error}`);
                }
            } else {
                const imageKey = this.state.dragState.imageKey;
                const index = this.state.dragState.index;
                const adjustments = this.state.adjustments[imageKey];
                
                const response = await fetch('/api/apply-adjustments/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_key: imageKey,
                        brightness: adjustments.brightness,
                        contrast: adjustments.contrast,
                        reference: 'original'
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.state.images[imageKey] = data.adjusted_image;
                    this.displayImage(`input-viewport-${index}`, data.adjusted_image);
                    
                    setTimeout(() => {
                        this.updateAllRectangles();
                    }, 100);
                }
            }
        } catch (error) {
            console.error('Failed to apply adjustments:', error);
        }
        
        this.state.dragState = null;
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.handleDragEnd);
    }

    showAdjustmentIndicator(brightness, contrast) {
        const indicator = document.getElementById('adjustment-indicator');
        const brightnessSpan = document.getElementById('adj-brightness');
        const contrastSpan = document.getElementById('adj-contrast');
        
        brightnessSpan.textContent = brightness.toFixed(2);
        contrastSpan.textContent = contrast.toFixed(2);
        
        indicator.classList.add('visible');
        
        clearTimeout(this.adjustmentTimeout);
        
        this.adjustmentTimeout = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 1000);
    }

    hideAdjustmentIndicator() {
        const indicator = document.getElementById('adjustment-indicator');
        indicator.classList.remove('visible');
        clearTimeout(this.adjustmentTimeout);
    }


    /**
     * =============================================================================
     * FFT COMPONENT VISUALIZATION
     * =============================================================================
     */

    /**
     * Initialize FFT component selection dropdowns (Magnitude/Phase/Real/Imaginary)
     * Each image has independent component display options
     * 
     * Purpose: Visualizes different FFT components for analysis
     * - Magnitude: Shows frequency spectrum intensity (log-scaled)
     * - Phase: Shows phase angle at each frequency
     * - Real: Real part of complex FFT
     * - Imaginary: Imaginary part of complex FFT
     */
    initializeComponentSelects() {
        for (let i = 1; i <= 4; i++) {
            const select = document.getElementById(`component-select-${i}`);
            select.addEventListener('change', () => {
                this.updateComponentPreview(i);
            });
        }
    }

    /**
     * =============================================================================
     * MIXING MODE CONFIGURATION
     * =============================================================================
     */

    /**
     * Initialize unified mixing mode selector
     * 
     * Modes:
     * - magnitude_phase: Mix using magnitude and phase components
     *   Component A (Slider A) = Magnitude
     *   Component B (Slider B) = Phase
     * 
     * - real_imaginary: Mix using real and imaginary components
     *   Component A (Slider A) = Real part
     *   Component B (Slider B) = Imaginary part
     * 
     * Design: Unified mode applies to all images simultaneously with auto-mixing
     */
    initializeMixingMode() {
        const modeSelect = document.getElementById('unified-mode-select');
        
        modeSelect.addEventListener('change', () => {
            this.state.mixingMode = modeSelect.value;
            
            for (let i = 1; i <= 4; i++) {
                this.updateModeLabelsForImage(i, this.state.mixingMode);
            }
            
            this.performMixing();
        });
        
        for (let i = 1; i <= 4; i++) {
            this.updateModeLabelsForImage(i, this.state.mixingMode);
        }
    }

    /**
     * Update slider labels based on active mixing mode
     * @param {number} index - Image index (1-4)
     * @param {string} mode - Mixing mode ('magnitude_phase' or 'real_imaginary')
     * 
     * Updates UI labels to reflect current component meaning:
     * - magnitude_phase: Slider A = "Mag", Slider B = "Phase"
     * - real_imaginary: Slider A = "Real", Slider B = "Imag"
     */
    updateModeLabelsForImage(index, mode) {
        const labelA = document.getElementById(`label-a-${index}`);
        const labelB = document.getElementById(`label-b-${index}`);
        
        if (mode === 'magnitude_phase') {
            labelA.textContent = 'Mag';
            labelB.textContent = 'Phase';
        } else {
            labelA.textContent = 'Real';
            labelB.textContent = 'Imag';
        }
    }

    /**
     * Update FFT component preview for specified image
     * @param {number} index - Image index (1-4)
     * 
     * Workflow:
     * 1. Fetch selected component (magnitude/phase/real/imaginary) from backend
     * 2. Backend retrieves pre-computed FFT from cache
     * 3. Display component visualization in component viewport
     * 4. Reattach filter overlay rectangle
     * 5. Update rectangle positioning
     * 
     * Design: Uses cached FFT data from backend for instant component switching
     * No recalculation needed - FFT was pre-computed during image upload
     */
    async updateComponentPreview(index) {
        const imageKey = `img${index}`;
        
        if (!this.state.images[imageKey]) {
            console.warn(`Cannot update component preview - no image loaded for ${imageKey}`);
            return;
        }
        
        const component = document.getElementById(`component-select-${index}`).value;
        const viewport = document.getElementById(`component-viewport-${index}`);
        const overlay = document.getElementById(`filter-overlay-${index}`);
        
        const overlayParent = overlay.parentNode;
        overlayParent.removeChild(overlay);
        
        viewport.innerHTML = '<span class="placeholder">Loading...</span>';
        
        // Reset adjustments to neutral when component changes
        this.state.componentAdjustments[imageKey] = {
            brightness: 1.0,
            contrast: 1.0
        };
        
        try {
            const response = await fetch('/api/fft/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: imageKey,
                    component: component
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayImage(`component-viewport-${index}`, data.image);
                viewport.appendChild(overlay);
                
                setTimeout(() => {
                    this.updateAllRectangles();
                }, 50);
            } else {
                viewport.innerHTML = `<span class="placeholder">Error: ${data.error}</span>`;
                viewport.appendChild(overlay);
            }
        } catch (error) {
            viewport.innerHTML = `<span class="placeholder">Error loading component</span>`;
            viewport.appendChild(overlay);
        }
    }

    /**
     * =============================================================================
     * WEIGHT SLIDERS
     * =============================================================================
     */

    /**
     * Initialize weight sliders for mixing control
     * 
     * Purpose: Controls how much each FFT component contributes to final mix
     * - Each image has 2 sliders (Component A and Component B)
     * - Slider meaning depends on current mixing mode:
     *   - magnitude_phase mode: A = Magnitude weight, B = Phase weight
     *   - real_imaginary mode: A = Real weight, B = Imaginary weight
     * 
     * Range: 0-100% (stored as 0.0-1.0 in state)
     * 
     * Design: Real-time state updates with auto-mixing to selected output
     */
    initializeSliders() {
        for (let i = 1; i <= 4; i++) {
            const imageKey = `img${i}`;
            
            const sliderA = document.getElementById(`weight-a-${i}`);
            const valueA = document.getElementById(`weight-a-value-${i}`);
            
            sliderA.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                valueA.textContent = val;
                this.state.weightsA[imageKey] = val / 100;
                this.performMixing();
            });
            
            const sliderB = document.getElementById(`weight-b-${i}`);
            const valueB = document.getElementById(`weight-b-value-${i}`);
            
            sliderB.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                valueB.textContent = val;
                this.state.weightsB[imageKey] = val / 100;
                this.performMixing();
            });
        }
    }

    /**
     * =============================================================================
     * IMAGE MIXING (INVERSE FFT)
     * =============================================================================
     */

    /**
     * Perform frequency domain image mixing with Inverse FFT
     * 
     * Mixing Algorithm:
     * 1. For each loaded image, extract FFT components based on its mode
     * 2. Apply frequency domain mask (filter rectangle)
     * 3. Weight components by slider values (weightsA and weightsB)
     * 4. Accumulate weighted components across all images
     * 5. Reconstruct complex FFT from accumulated components
     * 6. Apply Inverse FFT to obtain spatial domain output
     * 7. Display result in selected output viewport
     * 
     * Unified Region Model:
     * - Always applies frequency mask based on filter rectangle
     * - 'inner' mode: Keep frequencies inside rectangle
     * - 'outer' mode: Keep frequencies outside rectangle
     * - Full spectrum: rectangle covers entire frequency domain (default)
     * 
     * Design Decisions:
     * - Auto-triggered on slider/mode/filter changes
     * - Cancellable via AbortController for rapid successive operations
     * - Uses original unmodified images for FFT (ignores display adjustments)
     * 
     * Performance: Backend performs all FFT calculations using cached pre-computed data
     */
    async performMixing() {
        if (this.state.pendingRequest) {
            this.state.pendingRequest.abort();
        }
        
        if (!this.hasLoadedImages()) {
            console.warn('Cannot perform mixing - no images loaded');
            this.showStatus('No images loaded', 'done');
            setTimeout(() => this.hideStatus(), 1500);
            return;
        }
        
        this.showStatus('Computing IFFT...', 'loading');
        
        const controller = new AbortController();
        this.state.pendingRequest = controller;
        
        try {
            const regionParams = {
                x: this.state.filter.rect.x,
                y: this.state.filter.rect.y,
                width: this.state.filter.rect.width,
                height: this.state.filter.rect.height,
                type: this.state.filter.mode
            };
            
            const response = await fetch('/api/mix/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modes: Object.fromEntries(Object.keys(this.state.images).map(key => [key, this.state.mixingMode])),
                    weights_a: this.state.weightsA,
                    weights_b: this.state.weightsB,
                    region: regionParams,
                    output_key: `output${this.state.selectedOutput}`
                }),
                signal: controller.signal
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.state.outputAdjustments[`output${this.state.selectedOutput}`] = {
                    brightness: 1.0,
                    contrast: 1.0
                };
                
                this.displayImage(`output-viewport-${this.state.selectedOutput}`, data.output_image);
                
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
            this.state.pendingRequest = null;
        }
    }

    initializeOutputSelection() {
        for (let i = 1; i <= 2; i++) {
            const viewport = document.getElementById(`output-viewport-${i}`);
            const container = viewport.parentElement;
            
            viewport.addEventListener('dblclick', () => {
                document.querySelectorAll('.output-container').forEach(c => {
                    c.classList.remove('selected');
                });
                
                container.classList.add('selected');
                this.state.selectedOutput = i;
            });
        }
        
        document.querySelector('.output-container').classList.add('selected');
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
                        this.state.images[imageKey] = data.images[imageKey];
                        this.displayImage(`input-viewport-${i}`, data.images[imageKey]);
                        
                        this.updateComponentPreview(i);
                    }
                }
            }
        } catch (error) {
            console.error('Auto-resize failed:', error);
        }
    }


    /**
     * =============================================================================
     * FREQUENCY FILTER CONTROLS
     * =============================================================================
     */

    initializeFilterControls() {
        const filterInner = document.getElementById('filter-inner');
        const filterOuter = document.getElementById('filter-outer');
        const filterAll = document.getElementById('filter-all');
        
        filterInner.addEventListener('change', () => {
            if (filterInner.checked) {
                this.state.filter.mode = 'inner';
                if (this.state.savedRectangle) {
                    this.state.filter.rect = { ...this.state.savedRectangle };
                    this.state.savedRectangle = null;
                    this.updateAllRectangles();
                }
                this.updateFilterMode();
                this.performMixing();
            }
        });
        
        filterOuter.addEventListener('change', () => {
            if (filterOuter.checked) {
                this.state.filter.mode = 'outer';
                if (this.state.savedRectangle) {
                    this.state.filter.rect = { ...this.state.savedRectangle };
                    this.state.savedRectangle = null;
                    this.updateAllRectangles();
                }
                this.updateFilterMode();
                this.performMixing();
            }
        });
        
        filterAll.addEventListener('change', () => {
            if (filterAll.checked) {
                this.state.savedRectangle = { ...this.state.filter.rect };
                this.state.filter.mode = 'inner';
                this.state.filter.rect = {
                    x: 0,
                    y: 0,
                    width: 1.0,
                    height: 1.0
                };
                this.updateAllRectangles();
                this.updateFilterMode();
                this.performMixing();
            }
        });
        
        const resetButton = document.getElementById('filter-reset');
        resetButton.addEventListener('click', () => {
            this.state.filter.mode = 'inner';
            this.state.filter.rect = {
                x: 0.25,
                y: 0.25,
                width: 0.5,
                height: 0.5
            };
            
            filterInner.checked = true;
            this.updateAllRectangles();
            this.updateFilterMode();
            this.performMixing();
        });
        
        for (let i = 1; i <= 4; i++) {
            this.initializeInteractiveRectangle(i);
        }
    }

    initializeInteractiveRectangle(index) {
        const overlay = document.getElementById(`filter-overlay-${index}`);
        const rectangle = document.getElementById(`filter-rect-${index}`);
        const viewport = document.getElementById(`component-viewport-${index}`);
        
        rectangle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle')) {
                return;
            }
            
            const imageKey = `img${index}`;
            if (!this.state.images[imageKey]) {
                console.warn(`Cannot drag filter rectangle - no image loaded in viewport ${index}`);
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const rect = viewport.getBoundingClientRect();
            const rectBounds = rectangle.getBoundingClientRect();
            
            this.state.rectangleDragState = {
                type: 'move',
                sourceIndex: index,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: rectBounds.left - rect.left,
                initialTop: rectBounds.top - rect.top,
                viewportWidth: rect.width,
                viewportHeight: rect.height
            };
            
            rectangle.classList.add('dragging');
            document.addEventListener('mousemove', (e) => this.handleRectangleMove(e));
            document.addEventListener('mouseup', () => this.handleRectangleEnd());
        });
        
        const handles = rectangle.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                const imageKey = `img${index}`;
                if (!this.state.images[imageKey]) {
                    console.warn(`Cannot resize filter rectangle - no image loaded in viewport ${index}`);
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                const rect = viewport.getBoundingClientRect();
                const rectBounds = rectangle.getBoundingClientRect();
                const handleType = handle.classList[1];
                
                this.state.rectangleDragState = {
                    type: 'resize',
                    sourceIndex: index,
                    handleType: handleType,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialLeft: rectBounds.left - rect.left,
                    initialTop: rectBounds.top - rect.top,
                    initialWidth: rectBounds.width,
                    initialHeight: rectBounds.height,
                    viewportWidth: rect.width,
                    viewportHeight: rect.height
                };
                
                rectangle.classList.add('dragging');
                document.addEventListener('mousemove', (e) => this.handleRectangleResize(e));
                document.addEventListener('mouseup', () => this.handleRectangleEnd());
            });
        });
    }

    handleRectangleMove(e) {
        if (!this.state.rectangleDragState || this.state.rectangleDragState.type !== 'move') return;
        
        const ds = this.state.rectangleDragState;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        
        let newLeft = ds.initialLeft + deltaX;
        let newTop = ds.initialTop + deltaY;
        
        const rect = document.getElementById(`filter-rect-${ds.sourceIndex}`);
        const rectWidth = parseFloat(rect.style.width) || (ds.viewportWidth * this.state.filter.rect.width);
        const rectHeight = parseFloat(rect.style.height) || (ds.viewportHeight * this.state.filter.rect.height);
        
        newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - rectWidth));
        newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - rectHeight));
        
        this.state.filter.rect.x = newLeft / ds.viewportWidth;
        this.state.filter.rect.y = newTop / ds.viewportHeight;
        
        this.updateAllRectangles();
        this.performMixing();
    }

    handleRectangleResize(e) {
        if (!this.state.rectangleDragState || this.state.rectangleDragState.type !== 'resize') return;
        
        const ds = this.state.rectangleDragState;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        
        let newLeft = ds.initialLeft;
        let newTop = ds.initialTop;
        let newWidth = ds.initialWidth;
        let newHeight = ds.initialHeight;
        
        switch (ds.handleType) {
            case 'nw':
                newLeft = ds.initialLeft + deltaX;
                newTop = ds.initialTop + deltaY;
                newWidth = ds.initialWidth - deltaX;
                newHeight = ds.initialHeight - deltaY;
                break;
            case 'ne':
                newTop = ds.initialTop + deltaY;
                newWidth = ds.initialWidth + deltaX;
                newHeight = ds.initialHeight - deltaY;
                break;
            case 'sw':
                newLeft = ds.initialLeft + deltaX;
                newWidth = ds.initialWidth - deltaX;
                newHeight = ds.initialHeight + deltaY;
                break;
            case 'se':
                newWidth = ds.initialWidth + deltaX;
                newHeight = ds.initialHeight + deltaY;
                break;
        }
        
        const minSize = 20;
        if (newWidth < minSize) {
            if (ds.handleType.includes('w')) {
                newLeft = ds.initialLeft + ds.initialWidth - minSize;
            }
            newWidth = minSize;
        }
        if (newHeight < minSize) {
            if (ds.handleType.includes('n')) {
                newTop = ds.initialTop + ds.initialHeight - minSize;
            }
            newHeight = minSize;
        }
        
        newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - newWidth));
        newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - newHeight));
        newWidth = Math.min(newWidth, ds.viewportWidth - newLeft);
        newHeight = Math.min(newHeight, ds.viewportHeight - newTop);
        
        this.state.filter.rect.x = newLeft / ds.viewportWidth;
        this.state.filter.rect.y = newTop / ds.viewportHeight;
        this.state.filter.rect.width = newWidth / ds.viewportWidth;
        this.state.filter.rect.height = newHeight / ds.viewportHeight;
        
        this.updateAllRectangles();
        this.performMixing();
    }

    handleRectangleEnd() {
        if (this.state.rectangleDragState) {
            const rect = document.getElementById(`filter-rect-${this.state.rectangleDragState.sourceIndex}`);
            if (rect) {
                rect.classList.remove('dragging');
            }
            
            const filterAll = document.querySelector('#filter-all');
            const filterInner = document.querySelector('#filter-inner');
            if (filterAll && filterAll.checked && filterInner) {
                filterInner.checked = true;
                this.state.filter.mode = 'inner';
                if (this.state.savedRectangle) {
                    this.state.filter.rect = { ...this.state.savedRectangle };
                    this.state.savedRectangle = null;
                    this.updateAllRectangles();
                }
                const changeEvent = new Event('change', { bubbles: true });
                filterInner.dispatchEvent(changeEvent);
            }
            
            this.state.rectangleDragState = null;
        }
        
        document.removeEventListener('mousemove', this.handleRectangleMove);
        document.removeEventListener('mousemove', this.handleRectangleResize);
        document.removeEventListener('mouseup', this.handleRectangleEnd);
        this.performMixing();
    }

    updateAllRectangles() {
        for (let i = 1; i <= 4; i++) {
            const viewport = document.getElementById(`component-viewport-${i}`);
            const rectangle = document.getElementById(`filter-rect-${i}`);
            const overlay = document.getElementById(`filter-overlay-${i}`);
            
            if (!viewport || !rectangle || !overlay) {
                continue;
            }
            
            const imageKey = `img${i}`;
            
            if (!this.state.images[imageKey]) {
                rectangle.style.display = 'none';
                overlay.style.pointerEvents = 'none';
                continue;
            }
            
            rectangle.style.display = 'block';
            overlay.style.pointerEvents = 'auto';
            
            const rect = viewport.getBoundingClientRect();
            
            const left = this.state.filter.rect.x * rect.width;
            const top = this.state.filter.rect.y * rect.height;
            const width = this.state.filter.rect.width * rect.width;
            const height = this.state.filter.rect.height * rect.height;
            
            rectangle.style.left = `${left}px`;
            rectangle.style.top = `${top}px`;
            rectangle.style.width = `${width}px`;
            rectangle.style.height = `${height}px`;
        }
    }

    updateFilterMode() {
        for (let i = 1; i <= 4; i++) {
            const overlay = document.getElementById(`filter-overlay-${i}`);
            
            if (!overlay) {
                console.warn(`Filter overlay not found for viewport ${i}`);
                continue;
            }
            
            overlay.className = `filter-overlay ${this.state.filter.mode}-mode`;
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.imageMixer = new ImageMixerApp();
    window.imageMixer.initialize();
});