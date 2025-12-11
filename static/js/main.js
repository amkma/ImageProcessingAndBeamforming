// Global state
const state = {
    images: {
        img1: null,
        img2: null,
        img3: null,
        img4: null
    },
    adjustments: {
        img1: { brightness: 0, contrast: 1 },
        img2: { brightness: 0, contrast: 1 },
        img3: { brightness: 0, contrast: 1 },
        img4: { brightness: 0, contrast: 1 }
    },
    selectedOutput: 1,
    pendingRequest: null,
    dragState: null,
    filter: {
        mode: 'inner',  // 'inner' or 'outer'
        rect: {
            x: 0.25,      // Normalized coordinates (0-1)
            y: 0.25,
            width: 0.5,
            height: 0.5
        }
    },
    rectangleDragState: null
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
    initializeComponentSelects();
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
            updateComponentPreview(index);
            
            // Auto-resize after upload
            await autoResize();
            
            // Update filter rectangle visibility now that image is loaded
            updateAllRectangles();
        }
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

function displayImage(viewportId, imageSrc, adjustments = null) {
    const viewport = document.getElementById(viewportId);
    viewport.innerHTML = '';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    
    // Apply adjustments if provided
    if (adjustments) {
        img.style.filter = `brightness(${1 + adjustments.brightness}) contrast(${adjustments.contrast})`;
    }
    
    viewport.appendChild(img);
}

// Mouse Drag for Brightness/Contrast
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
                startX: e.clientX,
                startY: e.clientY,
                initialBrightness: state.adjustments[imageKey].brightness,
                initialContrast: state.adjustments[imageKey].contrast
            };
            
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        });
    }
}

function handleDrag(e) {
    if (!state.dragState) return;
    
    const deltaX = e.clientX - state.dragState.startX;
    const deltaY = e.clientY - state.dragState.startY;
    
    // Up/Down = Brightness (-1 to 1)
    const brightness = state.dragState.initialBrightness - (deltaY / 200);
    const clampedBrightness = Math.max(-1, Math.min(1, brightness));
    
    // Left/Right = Contrast (0.5 to 2)
    const contrast = state.dragState.initialContrast + (deltaX / 200);
    const clampedContrast = Math.max(0.5, Math.min(2, contrast));
    
    // Update state
    state.adjustments[state.dragState.imageKey] = {
        brightness: clampedBrightness,
        contrast: clampedContrast
    };
    
    // Apply visual feedback
    const img = state.dragState.viewport.querySelector('img');
    if (img) {
        img.style.filter = `brightness(${1 + clampedBrightness}) contrast(${clampedContrast})`;
    }
}

async function handleDragEnd() {
    if (!state.dragState) return;
    
    const imageKey = state.dragState.imageKey;
    const adjustments = state.adjustments[imageKey];
    
    // Apply adjustments to backend - treats as new input image
    try {
        const response = await fetch('/api/apply-adjustments/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_key: imageKey,
                brightness: adjustments.brightness,
                contrast: adjustments.contrast
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update displayed image with backend-processed version
            state.images[imageKey] = data.adjusted_image;
            
            // Get viewport index from imageKey (img1 -> 1)
            const index = parseInt(imageKey.replace('img', ''));
            displayImage(`input-viewport-${index}`, data.adjusted_image);
            
            // Update component preview to reflect new FFT
            updateComponentPreview(index);
            
            // Ensure filter rectangles remain visible and positioned correctly
            setTimeout(() => {
                updateAllRectangles();
            }, 100);
        }
    } catch (error) {
        console.error('Failed to apply adjustments:', error);
    }
    
    // Clean up drag state
    state.dragState = null;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
}

// Component Selection
function initializeComponentSelects() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`component-select-${i}`);
        select.addEventListener('change', () => {
            updateComponentPreview(i);
            // NO AUTO-TRIGGER - mixing only on output viewport click
        });
    }
}

async function updateComponentPreview(index) {
    const imageKey = `img${index}`;
    
    // CRITICAL: Verify image exists before updating preview
    if (!state.images[imageKey]) {
        console.warn(`Cannot update component preview - no image loaded for ${imageKey}`);
        return;
    }
    
    const component = document.getElementById(`component-select-${index}`).value;
    const viewport = document.getElementById(`component-viewport-${index}`);
    
    // Save overlay and rectangle before clearing
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
            
            // Re-add overlay after image loads
            viewport.appendChild(overlay);
            
            // Update rectangle positions and visibility
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
        const slider = document.getElementById(`weight-slider-${i}`);
        const valueDisplay = document.getElementById(`weight-value-${i}`);
        
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
            // NO AUTO-TRIGGER - only on output viewport click
        });
    }
}

// Mixing only on explicit output viewport click - no auto-triggering

async function performMixing() {
    // Cancel pending request
    if (state.pendingRequest) {
        state.pendingRequest.abort();
    }
    
    // CRITICAL: Check if any images are loaded
    if (!hasLoadedImages()) {
        console.warn('Cannot perform mixing - no images loaded');
        showStatus('No images loaded', 'done');
        setTimeout(hideStatus, 1500);
        return;
    }
    
    // Get weights
    const weights = {};
    const components = {};
    let hasValidWeight = false;
    
    for (let i = 1; i <= 4; i++) {
        const imageKey = `img${i}`;
        if (state.images[imageKey]) {
            const weight = parseFloat(document.getElementById(`weight-slider-${i}`).value) / 100;
            weights[imageKey] = weight;
            
            const component = document.getElementById(`component-select-${i}`).value;
            components[imageKey] = component;
            
            if (weight > 0) hasValidWeight = true;
        }
    }
    
    if (!hasValidWeight) {
        console.warn('Cannot perform mixing - all weights are zero');
        return;
    }
    
    // Show loading status
    showStatus('Computing IFFT with filter...', 'loading');
    
    // Create abortable request
    const controller = new AbortController();
    state.pendingRequest = controller;
    
    try {
        const response = await fetch('/api/mix/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weights: weights,
                components: components,
                filter: state.filter  // Include filter parameters
            }),
            signal: controller.signal
        });
        
        const data = await response.json();
        
        if (data.success) {
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
        
        viewport.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.output-container').forEach(c => {
                c.classList.remove('selected');
            });
            
            // Mark as selected
            container.classList.add('selected');
            state.selectedOutput = i;
            
            // Auto-trigger mixing on click
            performMixing();
        });
    }
    
    // Select Output 1 by default
    document.querySelector('.output-container').classList.add('selected');
}

// Auto-resize function
async function autoResize() {
    try {
        const response = await fetch('/api/resize/', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload all images to reflect resize
            for (let i = 1; i <= 4; i++) {
                const imageKey = `img${i}`;
                if (state.images[imageKey]) {
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


