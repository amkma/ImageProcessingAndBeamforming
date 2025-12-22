/**
 * Viewport - Base class for all viewport types
 */
class Viewport {
    constructor(viewportId) {
        this.viewportId = viewportId;
        this.element = document.getElementById(viewportId);
        this.adjustments = { brightness: 1.0, contrast: 1.0 };
        this.dragState = null;
        this.adjustmentTimeout = null;
        
        if (!this.element) {
            throw new Error(`Viewport element not found: ${viewportId}`);
        }
    }

    displayImage(imageSrc) {
        this.element.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = imageSrc;
        
        img.onload = () => {
            if (this.onImageLoad) {
                this.onImageLoad(img);
            }
        };
        
        this.element.appendChild(img);
        this.applyCSSAdjustments();
    }

    showPlaceholder(message = 'Click to upload') {
        this.element.innerHTML = '';
        const placeholder = document.createElement('span');
        placeholder.className = 'placeholder';
        placeholder.textContent = message;
        this.element.appendChild(placeholder);
    }

    clear() {
        this.element.innerHTML = '';
    }

    setAdjustments(adjustments) {
        this.adjustments = adjustments;
        this.applyCSSAdjustments();
    }

    applyCSSAdjustments() {
        const img = this.element.querySelector('img');
        if (img) {
            img.style.filter = `brightness(${this.adjustments.brightness}) contrast(${this.adjustments.contrast})`;
        }
    }

    startDrag(e, onDrag, onDragEnd) {
        if (e.button !== 0) return;
        
        e.preventDefault();
        
        this.dragState = {
            startX: e.clientX,
            startY: e.clientY,
            initialBrightness: this.adjustments.brightness,
            initialContrast: this.adjustments.contrast
        };
        
        this.element.classList.add('dragging');
        this.showAdjustmentIndicator(this.adjustments.brightness, this.adjustments.contrast);
        
        const dragHandler = (moveEvent) => {
            if (!this.dragState) return;
            
            const deltaX = moveEvent.clientX - this.dragState.startX;
            const deltaY = moveEvent.clientY - this.dragState.startY;
            
            const brightness = this.dragState.initialBrightness - (deltaY / 300);
            const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
            
            const contrast = this.dragState.initialContrast + (deltaX / 300);
            const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
            
            this.adjustments = {
                brightness: clampedBrightness,
                contrast: clampedContrast
            };
            
            this.applyCSSAdjustments();
            this.showAdjustmentIndicator(clampedBrightness, clampedContrast);
            
            if (onDrag) {
                onDrag(clampedBrightness, clampedContrast);
            }
        };
        
        const dragEndHandler = () => {
            this.element.classList.remove('dragging');
            this.hideAdjustmentIndicator();
            
            if (onDragEnd) {
                onDragEnd();
            }
            
            this.dragState = null;
            document.removeEventListener('mousemove', dragHandler);
            document.removeEventListener('mouseup', dragEndHandler);
        };
        
        document.addEventListener('mousemove', dragHandler);
        document.addEventListener('mouseup', dragEndHandler);
    }

    showAdjustmentIndicator(brightness, contrast) {
        const indicator = document.getElementById('adjustment-indicator');
        const brightnessSpan = document.getElementById('adj-brightness');
        const contrastSpan = document.getElementById('adj-contrast');
        
        if (brightnessSpan) brightnessSpan.textContent = brightness.toFixed(2);
        if (contrastSpan) contrastSpan.textContent = contrast.toFixed(2);
        
        if (indicator) {
            indicator.classList.add('visible');
            clearTimeout(this.adjustmentTimeout);
            
            this.adjustmentTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
            }, 1000);
        }
    }

    hideAdjustmentIndicator() {
        const indicator = document.getElementById('adjustment-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
            clearTimeout(this.adjustmentTimeout);
        }
    }

    resize(width, height) {
        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
    }

    getDimensions() {
        return {
            width: this.element.offsetWidth,
            height: this.element.offsetHeight
        };
    }

    hasImage() {
        return this.element.querySelector('img') !== null;
    }

    getImage() {
        return this.element.querySelector('img');
    }
}