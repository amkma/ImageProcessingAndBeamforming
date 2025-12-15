// Global state
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
    mixingModes: {
        img1: 'magnitude_phase',
        img2: 'magnitude_phase',
        img3: 'magnitude_phase',
        img4: 'magnitude_phase'
    },
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
    rectangleDragState: null,
    componentDragState: null
};

// Status indicator management
let statusTimeout = null;

function showStatus(message, type = 'loading') {
    const indicator = document.getElementById('status-indicator');
    const text = document.getElementById('status-text');
    
    clearTimeout(statusTimeout);
    
    text.textContent = message;
    indicator.className = `status-indicator visible ${type}`;
    
    if (type === 'done') {
        statusTimeout = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2000);
    }
}

function hideStatus() {
    const indicator = document.getElementById('status-indicator');
    indicator.classList.remove('visible');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeFileInputs();
    initializeViewportDrag();
    initializeOutputViewportDrag();
    initializeComponentViewportDrag();
    initializeComponentSelects();
    initializeMixingMode();
    initializeSliders();
    initializeButtons();
    initializeOutputSelection();
    initializeFilterControls();
});

// Handle window resize to keep rectangles synchronized
window.addEventListener('resize', () => {
    updateAllRectangles();
});

// Helper function to check if any images are loaded
function hasLoadedImages() {
    return Object.values(state.images).some(img => img !== null);
}

// Helper function to get count of loaded images
function getLoadedImageCount() {
    return Object.values(state.images).filter(img => img !== null).length;
}

// File Upload Handling
function initializeFileInputs() {
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`input-viewport-${i}`);
        const fileInput = document.getElementById(`input-file-${i}`);
        
        // Double-click to upload/change
        viewport.addEventListener('dblclick', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0], `img${i}`, i);
        });
    }
}

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
            // Use the processed grayscale image from backend
            state.images[imageKey] = data.grayscale_image;
            displayImage(`input-viewport-${index}`, data.grayscale_image);
            
            // Auto-resize to smallest dimensions (enforces unified sizing)
            await autoResize();
            
            // Update component preview after resize (triggers FFT recalculation)
            updateComponentPreview(index);
            
            // Resize all input viewports to smallest after upload completes
            setTimeout(() => resizeAllInputViewportsToSmallest(), 100);
            
            // Update filter rectangle visibility now that image is loaded
            updateAllRectangles();
        }
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

function displayImage(viewportId, imageSrc) {
    const viewport = document.getElementById(viewportId);
    viewport.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    
    // When image loads, trigger resize for input viewports
    img.onload = function() {
        if (viewportId.includes('input-viewport')) {
            resizeAllInputViewportsToSmallest();
        }
    };
    
    viewport.appendChild(img);
}

// Resize all input viewports to fit smallest image with aspect ratio preserved
function resizeAllInputViewportsToSmallest() {
    const inputViewports = [
        { id: 'input-viewport-1', img: null },
        { id: 'input-viewport-2', img: null },
        { id: 'input-viewport-3', img: null },
        { id: 'input-viewport-4', img: null }
    ];
    
    // Collect all loaded images from input viewports
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
    
    // Calculate aspect ratio from smallest image
    const aspectRatio = minWidth / minHeight;
    const maxSize = 200;
    
    let finalWidth, finalHeight;
    
    // Fit within 200x200 while preserving aspect ratio
    if (aspectRatio > 1) {
        // Wider than tall
        finalWidth = maxSize;
        finalHeight = Math.round(maxSize / aspectRatio);
    } else {
        // Taller than wide
        finalHeight = maxSize;
        finalWidth = Math.round(maxSize * aspectRatio);
    }
    
    // Apply calculated dimensions to all input viewports
    inputViewports.forEach(viewport => {
        const element = document.getElementById(viewport.id);
        if (element) {
            element.style.width = finalWidth + 'px';
            element.style.height = finalHeight + 'px';
        }
    });
}

// Mouse Drag for Brightness/Contrast Adjustments
function initializeViewportDrag() {
    for (let i = 1; i <= 4; i++) {
        const viewport = document.getElementById(`input-viewport-${i}`);
        const imageKey = `img${i}`;
        
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left button only
            if (!state.images[imageKey]) return;
            
            e.preventDefault();
            
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
            
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        });
    }
}

function handleDrag(e) {
    if (!state.dragState) return;
    
    const deltaX = e.clientX - state.dragState.startX;
    const deltaY = e.clientY - state.dragState.startY;
    
    // Up/Down = Brightness (0.0 to 2.0)
    // Drag up increases brightness, drag down decreases
    const brightness = state.dragState.initialBrightness - (deltaY / 300);
    const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
    
    // Left/Right = Contrast (0.0 to 3.0)
    // Drag right increases contrast, drag left decreases
    const contrast = state.dragState.initialContrast + (deltaX / 300);
    const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
    
    // Update state
    state.adjustments[state.dragState.imageKey] = {
        brightness: clampedBrightness,
        contrast: clampedContrast
    };
    
    // Update indicator
    showAdjustmentIndicator(clampedBrightness, clampedContrast);
}

async function handleDragEnd() {
    if (!state.dragState) return;
    
    const imageKey = state.dragState.imageKey;
    const index = state.dragState.index;
    const adjustments = state.adjustments[imageKey];
    
    state.dragState.viewport.classList.remove('dragging');
    
    // Hide indicator after half a second
    setTimeout(() => {
        hideAdjustmentIndicator();
    }, 500);
    
    // Apply adjustments to backend
    try {
        showStatus('Applying adjustments...', 'loading');
        
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
            // Update state with backend-validated values
            state.adjustments[imageKey] = {
                brightness: data.applied_brightness,
                contrast: data.applied_contrast
            };
            
            // Update displayed image with backend-processed version
            state.images[imageKey] = data.adjusted_image;
            displayImage(`input-viewport-${index}`, data.adjusted_image);
            
            // Recalculate and cache FFT after brightness/contrast adjustment
            updateComponentPreview(index);
            
            // Ensure filter rectangles remain visible
            setTimeout(() => {
                updateAllRectangles();
            }, 100);
            
            showStatus('Adjustments applied', 'done');
        } else {
            showStatus('Failed: ' + data.error, 'done');
        }
    } catch (error) {
        console.error('Failed to apply adjustments:', error);
        showStatus('Error applying adjustments', 'done');
    }
    
    // Clean up drag state
    state.dragState = null;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
}

// Initialize Output Viewport Drag for Brightness/Contrast
function initializeOutputViewportDrag() {
    for (let i = 1; i <= 2; i++) {
        const viewport = document.getElementById(`output-viewport-${i}`);
        const outputKey = `output${i}`;
        
        viewport.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left button only
            
            // Check if there's an image in the output viewport
            const img = viewport.querySelector('img');
            if (!img) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            state.dragState = {
                viewport: viewport,
                outputKey: outputKey,
                outputIndex: i,
                startX: e.clientX,
                startY: e.clientY,
                initialBrightness: state.outputAdjustments[outputKey].brightness,
                initialContrast: state.outputAdjustments[outputKey].contrast,
                isOutput: true
            };
            
            viewport.classList.add('dragging');
            showAdjustmentIndicator(state.dragState.initialBrightness, state.dragState.initialContrast);
            
            document.addEventListener('mousemove', handleOutputDrag);
            document.addEventListener('mouseup', handleOutputDragEnd);
        });
    }
}

function handleOutputDrag(e) {
    if (!state.dragState || !state.dragState.isOutput) return;
    
    const deltaX = e.clientX - state.dragState.startX;
    const deltaY = e.clientY - state.dragState.startY;
    
    const brightness = state.dragState.initialBrightness - (deltaY / 300);
    const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
    
    const contrast = state.dragState.initialContrast + (deltaX / 300);
    const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
    
    state.outputAdjustments[state.dragState.outputKey] = {
        brightness: clampedBrightness,
        contrast: clampedContrast
    };
    
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

// Component Selection Dropdowns
function initializeComponentSelects() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`component-select-${i}`);
        select.addEventListener('change', () => {
            updateComponentPreview(i);
        });
    }
}

// Mixing Mode Selection
function initializeMixingMode() {
    for (let i = 1; i <= 4; i++) {
        const modeSelect = document.getElementById(`mode-select-${i}`);
        const imageKey = `img${i}`;
        
        modeSelect.addEventListener('change', () => {
            state.mixingModes[imageKey] = modeSelect.value;
            updateModeLabelsForImage(i, modeSelect.value);
        });
        
        // Initialize labels
        updateModeLabelsForImage(i, state.mixingModes[imageKey]);
    }
}

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

async function updateComponentPreview(index) {
    const imageKey = `img${index}`;
    
    if (!state.images[imageKey]) {
        console.warn(`Cannot update component preview - no image loaded for ${imageKey}`);
        return;
    }
    
    const component = document.getElementById(`component-select-${index}`).value;
    const viewport = document.getElementById(`component-viewport-${index}`);
    const overlay = document.getElementById(`filter-overlay-${index}`);
    const overlayParent = overlay.parentNode;
    overlayParent.removeChild(overlay);
    
    viewport.innerHTML = '<span class="placeholder">Loading...</span>';
    
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
            displayImage(`component-viewport-${index}`, data.image);
            viewport.appendChild(overlay);
            
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

// Slider Handling
function initializeSliders() {
    for (let i = 1; i <= 4; i++) {
        const imageKey = `img${i}`;
        
        // Component A sliders
        const sliderA = document.getElementById(`weight-a-${i}`);
        const valueA = document.getElementById(`weight-a-value-${i}`);
        
        sliderA.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valueA.textContent = val;
            state.weightsA[imageKey] = val / 100;
        });
        
        // Component B sliders
        const sliderB = document.getElementById(`weight-b-${i}`);
        const valueB = document.getElementById(`weight-b-value-${i}`);
        
        sliderB.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            valueB.textContent = val;
            state.weightsB[imageKey] = val / 100;
        });
    }
}

// Mixing only on explicit output viewport click - no auto-triggering

async function performMixing() {
    if (state.pendingRequest) {
        state.pendingRequest.abort();
    }
    
    if (!hasLoadedImages()) {
        console.warn('Cannot perform mixing - no images loaded');
        showStatus('No images loaded', 'done');
        setTimeout(hideStatus, 1500);
        return;
    }
    
    showStatus('Computing IFFT...', 'loading');
    
    const controller = new AbortController();
    state.pendingRequest = controller;
    
    try {
        // Unified Region Model: always send region params
        // Full spectrum mode: x=0, y=0, width=1.0, height=1.0, type='inner'
        // Custom filter mode: use state.filter.rect values
        const regionParams = {
            x: state.filter.rect.x,
            y: state.filter.rect.y,
            width: state.filter.rect.width,
            height: state.filter.rect.height,
            type: state.filter.mode
        };
        
        const response = await fetch('/api/mix/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modes: state.mixingModes,
                weights_a: state.weightsA,
                weights_b: state.weightsB,
                region: regionParams
            }),
            signal: controller.signal
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store original output and reset adjustments for selected output
            state[`originalOutput${state.selectedOutput}`] = data.output_image;
            state.outputAdjustments[`output${state.selectedOutput}`] = {
                brightness: 1.0,
                contrast: 1.0
            };
            
            // Display in selected output
            displayImage(`output-viewport-${state.selectedOutput}`, data.output_image);
            
            // Show done status
            showStatus('Done', 'done');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            hideStatus();
        } else {
            console.error('Mixing failed:', error);
            hideStatus();
        }
    } finally {
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
    // Filter mode toggle (inner/outer)
    const filterInner = document.getElementById('filter-inner');
    const filterOuter = document.getElementById('filter-outer');
    
    filterInner.addEventListener('change', () => {
        if (filterInner.checked) {
            state.filter.mode = 'inner';
            updateFilterMode();
        }
    });
    
    filterOuter.addEventListener('change', () => {
        if (filterOuter.checked) {
            state.filter.mode = 'outer';
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
        rect.classList.remove('dragging');
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