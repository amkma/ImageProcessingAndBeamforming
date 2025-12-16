/**
 * ImageMixer - Fourier Transform-based Image Processing Application
 * 
 * Architecture:
 * - Centralized state management for all application data
 * - Event-driven UI interactions with drag-based adjustments
 * - Real-time FFT component visualization
 * - Frequency domain filtering with visual rectangle overlay
 * - Per-image mixing mode selection (magnitude/phase or real/imaginary)
 */

/**
 * Application State
 * Centralized state object containing all runtime data:
 * - images: Base64-encoded grayscale images for 4 input slots
 * - adjustments: Display-only brightness/contrast for input viewports (does not affect FFT)
 * - outputAdjustments: Client-side brightness/contrast for output viewports
 * - mixingMode: Unified mode for all images ('magnitude_phase' or 'real_imaginary')
 * - weightsA/B: Slider weights for component A (Mag/Real) and B (Phase/Imag)
 * - selectedOutput: Which output viewport (1 or 2) receives mixed results
 * - pendingRequest: AbortController for canceling in-flight API requests
 * - dragState: Active drag operation state for input viewport adjustments
 * - filter: Frequency domain filter configuration (rectangle coordinates and mode)
 * - rectangleDragState: Active drag operation for filter rectangle manipulation
 */
const state = {
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
    mixingMode: 'magnitude_phase', // Unified mode for all images
    weightsA: { img1: 0, img2: 0, img3: 0, img4: 0 },
    weightsB: { img1: 0, img2: 0, img3: 0, img4: 0 },
    selectedOutput: 1,
    pendingRequest: null,
    dragState: null,
    filter: {
        mode: 'inner', // 'inner' or 'outer' - determines whether rectangle includes or excludes frequencies
        rect: {
            x: 0.25,      // Normalized X position (0-1)
            y: 0.25,      // Normalized Y position (0-1)
            width: 0.5,   // Normalized width (0-1)
            height: 0.5   // Normalized height (0-1)
        }
    },
    savedRectangle: null, // Preserves rectangle coordinates when switching to "all regions"
    rectangleDragState: null
};

/**
 * Status Indicator Management
 * Handles the floating status indicator UI element
 */
let statusTimeout = null;

/**
 * Show status indicator with message and type
 * @param {string} message - Status message to display
 * @param {string} type - Status type: 'loading' (spinner) or 'done' (checkmark)
 * 
 * Design: Auto-hides 'done' status after 2s, 'loading' stays until manually hidden
 */
function showStatus(message, type = 'loading') {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    clearTimeout(statusTimeout);
    
    text.textContent = message;
    indicator.className = `status-indicator visible ${type}`;
    
    // Auto-hide success messages
    if (type === 'done') {
        statusTimeout = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    }
}

/**
 * Hide status indicator immediately
 */
function hideStatus() {
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
 * Executes after DOM is fully loaded to ensure all elements exist
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeFileInputs();              // File upload handlers
    initializeViewportDrag();            // Input viewport brightness/contrast drag
    initializeOutputViewportDrag();      // Output viewport adjustment drag
    initializeComponentSelects();        // FFT component dropdown menus
    initializeMixingMode();              // Mixing mode dropdown handlers
    initializeSliders();                 // Weight slider event handlers
    initializeOutputSelection();         // Output viewport selection
    initializeFilterControls();          // Frequency filter controls
});

/**
 * Window resize handler - keeps filter rectangles synchronized across viewports
 * Required because rectangles use pixel positioning that must recalculate on viewport size changes
 */
window.addEventListener('resize', () => {
    updateAllRectangles();
});

/**
 * =============================================================================
 * UTILITY FUNCTIONS
 * =============================================================================
 */

/**
 * Check if any images are currently loaded
 * @returns {boolean} True if at least one image is loaded
 */
function hasLoadedImages() {
    return Object.values(state.images).some(img => img !== null);
}

/**
 * Get count of loaded images
 * @returns {number} Number of non-null images in state
 * @deprecated Not currently used - candidate for removal if not needed
 */
function getLoadedImageCount() {
    return Object.values(state.images).filter(img => img !== null).length;
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
function initializeFileInputs() {
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`input-viewport-${i}`);
        const fileInput = document.getElementById(`input-file-${i}`);
        
        // Double-click viewport triggers file picker
        viewport.addEventListener('dblclick', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0], `img${i}`, i);
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
async function handleFileUpload(file, imageKey, index) {
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
            // Store base64 grayscale image from backend
            state.images[imageKey] = data.grayscale_image;
            displayImage(`input-viewport-${index}`, data.grayscale_image);
            
            // Enforce unified sizing across all images (backend operation)
            await autoResize();
            
            // Update FFT component preview (triggers backend FFT calculation)
            updateComponentPreview(index);
            
            // Resize viewport containers to fit smallest image (UI operation)
            setTimeout(() => resizeAllInputViewportsToSmallest(), 100);
            
            // Show/hide filter rectangles based on loaded images
            updateAllRectangles();
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
function displayImage(viewportId, imageSrc) {
    const viewport = document.getElementById(viewportId);
    viewport.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    
    // After image loads, resize input viewports to maintain uniform size
    img.onload = function() {
        if (viewportId.includes('input-viewport')) {
            resizeAllInputViewportsToSmallest();
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
function resizeAllInputViewportsToSmallest() {
    const inputViewports = [
        { id: 'input-viewport-1' },
        { id: 'input-viewport-2' },
        { id: 'input-viewport-3' },
        { id: 'input-viewport-4' }
    ];
    
    // Find smallest dimensions across all loaded images
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
    
    if (!hasAnyImage) return; // No images loaded yet
    
    // Calculate aspect ratio from smallest image
    const aspectRatio = minWidth / minHeight;
    const maxSize = 200; // Maximum viewport dimension
    
    let finalWidth, finalHeight;
    
    // Scale to fit within 200x200 while preserving aspect ratio
    if (aspectRatio > 1) {
        // Landscape orientation
        finalWidth = maxSize;
        finalHeight = Math.round(maxSize / aspectRatio);
    } else {
        // Portrait orientation
        finalHeight = maxSize;
        finalWidth = Math.round(maxSize * aspectRatio);
    }
    
    // Apply calculated dimensions to all input viewport containers
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
 * Initialize drag-based brightness/contrast adjustments for input viewports
 * 
 * Interaction Model:
 * - Mouse drag up/down: Adjust brightness (0.0 to 2.0)
 * - Mouse drag left/right: Adjust contrast (0.0 to 3.0)
 * 
 * Design: Display-only adjustments (does NOT affect FFT calculations)
 * Backend always uses original unmodified images for frequency domain operations
 */
function initializeViewportDrag() {
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`input-viewport-${i}`);
        const imageKey = `img${i}`;
        
        viewport.addEventListener('mousedown', (e) => {
            // Only respond to left mouse button
            if (e.button !== 0) return;
            
            // Only allow drag if image is loaded
            if (!state.images[imageKey]) return;
            
            e.preventDefault();
            
            // Initialize drag state with current adjustment values
            state.dragState = {
                viewport: viewport,
                imageKey: imageKey,
                index: i,
                startX: e.clientX,
                startY: e.clientY,
                initialBrightness: state.adjustments[imageKey].brightness,
                initialContrast: state.adjustments[imageKey].contrast
            };
            
            viewport.classList.add('dragging');
            showAdjustmentIndicator(state.dragState.initialBrightness, state.dragState.initialContrast);
            
            // Attach global mouse move/up handlers for smooth dragging
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
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
function handleDrag(e) {
    if (!state.dragState) return;
    
    const deltaX = e.clientX - state.dragState.startX;
    const deltaY = e.clientY - state.dragState.startY;
    
    // Calculate new brightness (inverted Y-axis for intuitive control)
    const brightness = state.dragState.initialBrightness - (deltaY / 300);
    const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
    
    // Calculate new contrast
    const contrast = state.dragState.initialContrast + (deltaX / 300);
    const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
    
    // Update state with clamped values
    state.adjustments[state.dragState.imageKey] = {
        brightness: clampedBrightness,
        contrast: clampedContrast
    };
    
    // Update real-time visual indicator
    showAdjustmentIndicator(clampedBrightness, clampedContrast);
}

/**
 * Finalize brightness/contrast adjustment on mouse release
 * 
 * Design Decision: Display-only adjustments
 * - Sends adjustments to backend for image processing
 * - Updates displayed image with adjusted version
 * - Does NOT trigger FFT recalculation
 * - Backend FFT operations always use original unmodified images
 * 
 * Rationale: Separates visual presentation from frequency domain calculations
 * Users can adjust display for better visibility without affecting mix results
 */
async function handleDragEnd() {
    if (!state.dragState) return;
    
    const imageKey = state.dragState.imageKey;
    const index = state.dragState.index;
    const adjustments = state.adjustments[imageKey];
    
    state.dragState.viewport.classList.remove('dragging');
    
    // Auto-hide adjustment indicator
    setTimeout(() => {
        hideAdjustmentIndicator();
    }, 500);
    
    // Apply display-only adjustments via backend
    try {
        const response = await fetch('/api/apply-adjustments/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_key: imageKey,
                brightness: adjustments.brightness,
                contrast: adjustments.contrast,
                reference: 'original' // Always reference original image
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update displayed image (visual only)
            state.images[imageKey] = data.adjusted_image;
            displayImage(`input-viewport-${index}`, data.adjusted_image);
            
            // Refresh filter rectangle positioning
            setTimeout(() => {
                updateAllRectangles();
            }, 100);
        }
    } catch (error) {
        console.error('Failed to apply adjustments:', error);
    }
    
    // Clean up drag state and remove global listeners
    state.dragState = null;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
}

/**
 * =============================================================================
 * OUTPUT VIEWPORT BRIGHTNESS/CONTRAST ADJUSTMENTS
 * =============================================================================
 */

/**
 * Initialize drag-based brightness/contrast for output viewports
 * 
 * Design: Client-side canvas-based adjustments
 * - Preserves original mixed output in state[`originalOutput${i}`]
 * - Applies adjustments via canvas manipulation
 * - Does not send image data back to backend
 * - Allows visual tuning of final output without remixing
 */
function initializeOutputViewportDrag() {
    for (let i = 1; i <= 2; i++) {
        const viewport = document.getElementById(`output-viewport-${i}`);
        const outputKey = `output${i}`;
        
        viewport.addEventListener('mousedown', (e) => {
            // Only left mouse button
            if (e.button !== 0) return;
            
            // Only allow adjustment if output image exists
            const img = viewport.querySelector('img');
            if (!img) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // Initialize output drag state
            state.dragState = {
                viewport: viewport,
                outputKey: outputKey,
                outputIndex: i,
                startX: e.clientX,
                startY: e.clientY,
                initialBrightness: state.outputAdjustments[outputKey].brightness,
                initialContrast: state.outputAdjustments[outputKey].contrast,
                isOutput: true // Flag to distinguish from input viewport drag
            };
            
            viewport.classList.add('dragging');
            showAdjustmentIndicator(state.dragState.initialBrightness, state.dragState.initialContrast);
            
            // Attach global handlers
            document.addEventListener('mousemove', handleOutputDrag);
            document.addEventListener('mouseup', handleOutputDragEnd);
        });
    }
}

/**
 * Handle mouse move during output viewport brightness/contrast drag
 * @param {MouseEvent} e - Mouse move event
 * 
 * Identical controls to input viewport drag:
 * - Vertical: Brightness (0.0 - 2.0)
 * - Horizontal: Contrast (0.0 - 3.0)
 */
function handleOutputDrag(e) {
    if (!state.dragState || !state.dragState.isOutput) return;
    
    const deltaX = e.clientX - state.dragState.startX;
    const deltaY = e.clientY - state.dragState.startY;
    
    // Calculate and clamp brightness
    const brightness = state.dragState.initialBrightness - (deltaY / 300);
    const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
    
    // Calculate and clamp contrast
    const contrast = state.dragState.initialContrast + (deltaX / 300);
    const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
    
    // Update output adjustment state
    state.outputAdjustments[state.dragState.outputKey] = {
        brightness: clampedBrightness,
        contrast: clampedContrast
    };
    
    // Update real-time indicator
    showAdjustmentIndicator(clampedBrightness, clampedContrast);
}

async function handleOutputDragEnd() {
    if (!state.dragState || !state.dragState.isOutput) return;
    
    const outputKey = state.dragState.outputKey;
    const outputIndex = state.dragState.outputIndex;
    const adjustments = state.outputAdjustments[outputKey];
    
    state.dragState.viewport.classList.remove('dragging');
    
    hideAdjustmentIndicator();
    
    // Apply adjustments to output image using canvas
    try {
        const viewport = document.getElementById(`output-viewport-${outputIndex}`);
        const img = viewport.querySelector('img');
        if (!img || !img.complete) {
            state.dragState = null;
            document.removeEventListener('mousemove', handleOutputDrag);
            document.removeEventListener('mouseup', handleOutputDragEnd);
            return;
        }
        
        // Store original image if not already stored
        if (!state[`originalOutput${outputIndex}`]) {
            state[`originalOutput${outputIndex}`] = img.src;
        }
        
        // Apply adjustments using canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Load original output image
        const originalImg = new Image();
        originalImg.onload = () => {
            canvas.width = originalImg.width;
            canvas.height = originalImg.height;
            
            // Draw original image
            ctx.drawImage(originalImg, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Apply brightness and contrast (same as input viewports)
            for (let i = 0; i < data.length; i += 4) {
                // Apply brightness (multiplier)
                let r = data[i] * adjustments.brightness;
                let g = data[i + 1] * adjustments.brightness;
                let b = data[i + 2] * adjustments.brightness;
                
                // Apply contrast (scale around midpoint 127.5)
                r = (r - 127.5) * adjustments.contrast + 127.5;
                g = (g - 127.5) * adjustments.contrast + 127.5;
                b = (b - 127.5) * adjustments.contrast + 127.5;
                
                // Clamp values
                data[i] = Math.max(0, Math.min(255, r));
                data[i + 1] = Math.max(0, Math.min(255, g));
                data[i + 2] = Math.max(0, Math.min(255, b));
            }
            
            // Put modified image data back
            ctx.putImageData(imageData, 0, 0);
            
            // Update viewport with adjusted image
            img.src = canvas.toDataURL('image/png');
        };
        
        originalImg.src = state[`originalOutput${outputIndex}`];
        
    } catch (error) {
        console.error('Failed to apply output adjustments:', error);
    }
    
    state.dragState = null;
    document.removeEventListener('mousemove', handleOutputDrag);
    document.removeEventListener('mouseup', handleOutputDragEnd);
}

// Adjustment Indicator Functions
let adjustmentTimeout = null;

function showAdjustmentIndicator(brightness, contrast) {
    const indicator = document.getElementById('adjustment-indicator');
    const brightnessSpan = document.getElementById('adj-brightness');
    const contrastSpan = document.getElementById('adj-contrast');
    
    brightnessSpan.textContent = brightness.toFixed(2);
    contrastSpan.textContent = contrast.toFixed(2);
    
    indicator.classList.add('visible');
    
    // Clear existing timeout
    clearTimeout(adjustmentTimeout);
    
    // Auto-fade after 1 second
    adjustmentTimeout = setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1000);
}

function hideAdjustmentIndicator() {
    const indicator = document.getElementById('adjustment-indicator');
    indicator.classList.remove('visible');
    clearTimeout(adjustmentTimeout);
}

// Component Viewport Brightness/Contrast - DISABLED for FT viewports
function initializeComponentViewportDrag() {
    // FT viewports do NOT accept brightness/contrast adjustments
    // This function is intentionally disabled per requirements
}

function handleComponentDrag(e) {
    // DISABLED - FT viewports should not have brightness/contrast adjustments
}

function handleComponentDragEnd() {
    // DISABLED - FT viewports should not have brightness/contrast adjustments
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
function initializeComponentSelects() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`component-select-${i}`);
        select.addEventListener('change', () => {
            updateComponentPreview(i);
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
function initializeMixingMode() {
    const modeSelect = document.getElementById('unified-mode-select');
    
    modeSelect.addEventListener('change', () => {
        state.mixingMode = modeSelect.value;
        
        // Update all slider labels
        for (let i = 1; i <= 4; i++) {
            updateModeLabelsForImage(i, state.mixingMode);
        }
        
        // Auto-apply mixing
    });
    
    // Initialize all labels on page load
    for (let i = 1; i <= 4; i++) {
        updateModeLabelsForImage(i, state.mixingMode);
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
function updateModeLabelsForImage(index, mode) {
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
async function updateComponentPreview(index) {
    const imageKey = `img${index}`;
    
    // Validate image is loaded
    if (!state.images[imageKey]) {
        console.warn(`Cannot update component preview - no image loaded for ${imageKey}`);
        return;
    }
    
    const component = document.getElementById(`component-select-${index}`).value;
    const viewport = document.getElementById(`component-viewport-${index}`);
    const overlay = document.getElementById(`filter-overlay-${index}`);
    
    // Temporarily remove overlay to replace viewport content
    const overlayParent = overlay.parentNode;
    overlayParent.removeChild(overlay);
    
    viewport.innerHTML = '<span class="placeholder">Loading...</span>';
    
    try {
        const response = await fetch('/api/fft/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_key: imageKey,
                component: component // magnitude, phase, real, or imaginary
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Display FFT component visualization
            displayImage(`component-viewport-${index}`, data.image);
            
            // Reattach filter overlay
            viewport.appendChild(overlay);
            
            // Update filter rectangle positioning
            setTimeout(() => {
                updateAllRectangles();
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
 * Design: Real-time state updates, mixing triggered manually via output viewport click
 */
function initializeSliders() {
    for (let i = 1; i <= 4; i++) {
        const imageKey = `img${i}`;
        
        // Component A slider (Magnitude or Real)
        const sliderA = document.getElementById(`weight-a-${i}`);
        const valueA = document.getElementById(`weight-a-value-${i}`);
        
        sliderA.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valueA.textContent = val;
            state.weightsA[imageKey] = val / 100; // Convert to 0.0-1.0 range
        });
        
        // Component B slider (Phase or Imaginary)
        const sliderB = document.getElementById(`weight-b-${i}`);
        const valueB = document.getElementById(`weight-b-value-${i}`);
        
        sliderB.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valueB.textContent = val;
            state.weightsB[imageKey] = val / 100; // Convert to 0.0-1.0 range
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
 * - Manual trigger via output viewport double-click (no auto-update)
 * - Cancellable via AbortController for rapid successive operations
 * - Uses original unmodified images for FFT (ignores display adjustments)
 * - Stores original output for brightness/contrast reset capability
 * 
 * Performance: Backend performs all FFT calculations using cached pre-computed data
 */
async function performMixing() {
    // Cancel any pending mixing operation
    if (state.pendingRequest) {
        state.pendingRequest.abort();
    }
    
    // Validate at least one image is loaded
    if (!hasLoadedImages()) {
        console.warn('Cannot perform mixing - no images loaded');
        showStatus('No images loaded', 'done');
        setTimeout(hideStatus, 1500);
        return;
    }
    
    showStatus('Computing IFFT...', 'loading');
    
    // Create cancellable request
    const controller = new AbortController();
    state.pendingRequest = controller;
    
    try {
        // Build frequency filter parameters (Unified Region Model)
        // Always includes region params - full spectrum or custom rectangle
        const regionParams = {
            x: state.filter.rect.x,           // Normalized X (0-1)
            y: state.filter.rect.y,           // Normalized Y (0-1)
            width: state.filter.rect.width,   // Normalized width (0-1)
            height: state.filter.rect.height, // Normalized height (0-1)
            type: state.filter.mode           // 'inner' or 'outer'
        };
        
        // Send mixing request to backend
        const response = await fetch('/api/mix/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modes: Object.fromEntries(Object.keys(state.images).map(key => [key, state.mixingMode])), // Unified mode for all images
                weights_a: state.weightsA,   // Component A weights
                weights_b: state.weightsB,   // Component B weights
                region: regionParams         // Frequency filter configuration
            }),
            signal: controller.signal
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Preserve original output for adjustment operations
            state[`originalOutput${state.selectedOutput}`] = data.output_image;
            
            // Reset output adjustments to default
            state.outputAdjustments[`output${state.selectedOutput}`] = {
                brightness: 1.0,
                contrast: 1.0
            };
            
            // Display mixed result in selected output viewport
            displayImage(`output-viewport-${state.selectedOutput}`, data.output_image);
            
            showStatus('Done', 'done');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            // Request was cancelled - silent fail
            hideStatus();
        } else {
            console.error('Mixing failed:', error);
            hideStatus();
        }
    } finally {
        // Clear pending request reference
        state.pendingRequest = null;
    }
}

// Output Selection
function initializeOutputSelection() {
    for (let i = 1; i <= 2; i++) {
        const viewport = document.getElementById(`output-viewport-${i}`);
        const container = viewport.parentElement;
        
        // Double-click to select and trigger mixing
        viewport.addEventListener('dblclick', () => {
            // Remove previous selection
            document.querySelectorAll('.output-container').forEach(c => {
                c.classList.remove('selected');
            });
            
            // Mark as selected
            container.classList.add('selected');
            state.selectedOutput = i;
            
            // Auto-trigger mixing on double-click
            performMixing();
        });
    }
    
    // Select Output 1 by default
    document.querySelector('.output-container').classList.add('selected');
}

// Auto-resize function - enforces smallest dimensions across all inputs
async function autoResize() {
    try {
        const response = await fetch('/api/resize/', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload all input and component images to reflect resize
            for (let i = 1; i <= 4; i++) {
                const imageKey = `img${i}`;
                if (state.images[imageKey]) {
                    // Fetch updated input image after resize
                    try {
                        const imgResponse = await fetch(`/api/get-image/${imageKey}/`);
                        const imgData = await imgResponse.json();
                        if (imgData.success) {
                            state.images[imageKey] = imgData.image;
                            displayImage(`input-viewport-${i}`, imgData.image);
                        }
                    } catch (err) {
                        console.error(`Failed to reload ${imageKey}:`, err);
                    }
                    
                    // Update component preview (triggers FFT recalculation with resized image)
                    updateComponentPreview(i);
                }
            }
        }
    } catch (error) {
        console.error('Auto-resize failed:', error);
    }
}

// Button Actions - removed, now automated
function initializeButtons() {
    // No manual buttons
}

// Frequency Filter Controls
function initializeFilterControls() {
    // Filter mode toggle (inner/outer/all)
    const filterInner = document.getElementById('filter-inner');
    const filterOuter = document.getElementById('filter-outer');
    const filterAll = document.getElementById('filter-all');
    
    filterInner.addEventListener('change', () => {
        if (filterInner.checked) {
            state.filter.mode = 'inner';
            // Restore saved rectangle if switching from "all regions"
            if (state.savedRectangle) {
                state.filter.rect = { ...state.savedRectangle };
                state.savedRectangle = null;
                updateAllRectangles();
            }
            updateFilterMode();
        }
    });
    
    filterOuter.addEventListener('change', () => {
        if (filterOuter.checked) {
            state.filter.mode = 'outer';
            // Restore saved rectangle if switching from "all regions"
            if (state.savedRectangle) {
                state.filter.rect = { ...state.savedRectangle };
                state.savedRectangle = null;
                updateAllRectangles();
            }
            updateFilterMode();
        }
    });
    
    filterAll.addEventListener('change', () => {
        if (filterAll.checked) {
            // Save current rectangle before switching to full spectrum
            state.savedRectangle = { ...state.filter.rect };
            // Set to full spectrum: entire frequency domain
            state.filter.mode = 'inner';
            state.filter.rect = {
                x: 0,
                y: 0,
                width: 1.0,
                height: 1.0
            };
            updateAllRectangles();
            updateFilterMode();
        }
    });
    
    // Reset filter button
    const resetButton = document.getElementById('filter-reset');
    resetButton.addEventListener('click', () => {
        // Reset to defaults
        state.filter.mode = 'inner';
        state.filter.rect = {
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5
        };
        
        // Update UI
        filterInner.checked = true;
        updateAllRectangles();
        updateFilterMode();
    });
    
    // Initialize interactive rectangles for all 4 viewports
    for (let i = 1; i <= 4; i++) {
        initializeInteractiveRectangle(i);
    }
    
    // Initialize rectangle positions
    updateAllRectangles();
    updateFilterMode();
}

function initializeInteractiveRectangle(index) {
    const overlay = document.getElementById(`filter-overlay-${index}`);
    const rectangle = document.getElementById(`filter-rect-${index}`);
    const viewport = document.getElementById(`component-viewport-${index}`);
    
    // Verify elements exist before proceeding
    if (!overlay || !rectangle || !viewport) {
        console.warn(`Filter overlay elements not found for viewport ${index}`);
        return;
    }
    
    // Make rectangle draggable
    rectangle.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            return; // Let resize handle take precedence
        }
        
        // CRITICAL: Check if image is loaded for this viewport
        const imageKey = `img${index}`;
        if (!state.images[imageKey]) {
            console.warn(`Cannot drag filter rectangle - no image loaded in viewport ${index}`);
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const rect = viewport.getBoundingClientRect();
        const rectBounds = rectangle.getBoundingClientRect();
        
        state.rectangleDragState = {
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
        document.addEventListener('mousemove', handleRectangleMove);
        document.addEventListener('mouseup', handleRectangleEnd);
    });
    
    // Make resize handles work
    const handles = rectangle.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            // CRITICAL: Check if image is loaded for this viewport
            const imageKey = `img${index}`;
            if (!state.images[imageKey]) {
                console.warn(`Cannot resize filter rectangle - no image loaded in viewport ${index}`);
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const rect = viewport.getBoundingClientRect();
            const rectBounds = rectangle.getBoundingClientRect();
            const handleType = handle.classList[1]; // nw, ne, sw, se
            
            state.rectangleDragState = {
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
            document.addEventListener('mousemove', handleRectangleResize);
            document.addEventListener('mouseup', handleRectangleEnd);
        });
    });
}

function handleRectangleMove(e) {
    if (!state.rectangleDragState || state.rectangleDragState.type !== 'move') return;
    
    const ds = state.rectangleDragState;
    const deltaX = e.clientX - ds.startX;
    const deltaY = e.clientY - ds.startY;
    
    // Calculate new position in pixels
    let newLeft = ds.initialLeft + deltaX;
    let newTop = ds.initialTop + deltaY;
    
    // Get current rectangle size
    const rect = document.getElementById(`filter-rect-${ds.sourceIndex}`);
    const rectWidth = parseFloat(rect.style.width) || (ds.viewportWidth * state.filter.rect.width);
    const rectHeight = parseFloat(rect.style.height) || (ds.viewportHeight * state.filter.rect.height);
    
    // Constrain to viewport bounds
    newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - rectWidth));
    newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - rectHeight));
    
    // Update state with normalized coordinates
    state.filter.rect.x = newLeft / ds.viewportWidth;
    state.filter.rect.y = newTop / ds.viewportHeight;
    
    // Update all rectangles synchronously
    updateAllRectangles();
}

function handleRectangleResize(e) {
    if (!state.rectangleDragState || state.rectangleDragState.type !== 'resize') return;
    
    const ds = state.rectangleDragState;
    const deltaX = e.clientX - ds.startX;
    const deltaY = e.clientY - ds.startY;
    
    let newLeft = ds.initialLeft;
    let newTop = ds.initialTop;
    let newWidth = ds.initialWidth;
    let newHeight = ds.initialHeight;
    
    // Adjust based on handle type
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
    
    // Enforce minimum size (20px)
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
    
    // Constrain to viewport bounds
    newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - newWidth));
    newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - newHeight));
    newWidth = Math.min(newWidth, ds.viewportWidth - newLeft);
    newHeight = Math.min(newHeight, ds.viewportHeight - newTop);
    
    // Update state with normalized coordinates
    state.filter.rect.x = newLeft / ds.viewportWidth;
    state.filter.rect.y = newTop / ds.viewportHeight;
    state.filter.rect.width = newWidth / ds.viewportWidth;
    state.filter.rect.height = newHeight / ds.viewportHeight;
    
    // Update all rectangles synchronously
    updateAllRectangles();
}

function handleRectangleEnd() {
    if (state.rectangleDragState) {
        const rect = document.getElementById(`filter-rect-${state.rectangleDragState.sourceIndex}`);
        if (rect) {
            rect.classList.remove('dragging');
        }
        
        // Auto-switch from "all regions" to "inner" if user manually adjusts rectangle
        const filterAll = document.querySelector('#filter-all');
        const filterInner = document.querySelector('#filter-inner');
        if (filterAll && filterAll.checked && filterInner) {
            filterInner.checked = true;
            state.filter.mode = 'inner';
            // Restore saved rectangle if it exists
            if (state.savedRectangle) {
                state.filter.rect = { ...state.savedRectangle };
                state.savedRectangle = null;
                updateAllRectangles();
            }
            // Trigger change event for consistency
            const changeEvent = new Event('change', { bubbles: true });
            filterInner.dispatchEvent(changeEvent);
        }
        
        state.rectangleDragState = null;
    }
    
    document.removeEventListener('mousemove', handleRectangleMove);
    document.removeEventListener('mousemove', handleRectangleResize);
    document.removeEventListener('mouseup', handleRectangleEnd);
}

function updateAllRectangles() {
    // Synchronize all 4 rectangles to the same normalized coordinates
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`component-viewport-${i}`);
        const rectangle = document.getElementById(`filter-rect-${i}`);
        const overlay = document.getElementById(`filter-overlay-${i}`);
        
        if (!viewport || !rectangle || !overlay) {
            continue;
        }
        
        const imageKey = `img${i}`;
        
        // CRITICAL: Only show rectangle if image is loaded
        if (!state.images[imageKey]) {
            rectangle.style.display = 'none';
            overlay.style.pointerEvents = 'none';
            continue;
        }
        
        // Show rectangle for loaded images
        rectangle.style.display = 'block';
        overlay.style.pointerEvents = 'auto';
        
        const rect = viewport.getBoundingClientRect();
        
        // Convert normalized coordinates to pixels for this viewport
        const left = state.filter.rect.x * rect.width;
        const top = state.filter.rect.y * rect.height;
        const width = state.filter.rect.width * rect.width;
        const height = state.filter.rect.height * rect.height;
        
        // Apply styles
        rectangle.style.left = `${left}px`;
        rectangle.style.top = `${top}px`;
        rectangle.style.width = `${width}px`;
        rectangle.style.height = `${height}px`;
    }
}

function updateFilterMode() {
    // Update overlay classes for all viewports
    for (let i = 1; i <= 4; i++) {
        const overlay = document.getElementById(`filter-overlay-${i}`);
        
        if (!overlay) {
            console.warn(`Filter overlay not found for viewport ${i}`);
            continue;
        }
        
        overlay.className = `filter-overlay ${state.filter.mode}-mode`;
    }
}