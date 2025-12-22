/**
 * Viewport - Base class for all viewport types
 */
class Viewport {
    constructor(viewportId) {
        this._viewportId = viewportId;
        this._element = document.getElementById(viewportId);
        this._adjustments = { brightness: 1.0, contrast: 1.0 };
        this._dragState = null;
        this._adjustmentTimeout = null;
        
        if (!this._element) {
            throw new Error(`Viewport element not found: ${viewportId}`);
        }
    }

    // Getters
    get viewportId() {
        return this._viewportId;
    }

    get element() {
        return this._element;
    }

    get adjustments() {
        return this._adjustments;
    }

    get dragState() {
        return this._dragState;
    }

    get adjustmentTimeout() {
        return this._adjustmentTimeout;
    }

    // Setters
    set adjustments(value) {
        this._adjustments = value;
    }

    set dragState(value) {
        this._dragState = value;
    }

    set adjustmentTimeout(value) {
        this._adjustmentTimeout = value;
    }

    displayImage(imageSrc) {
        this._element.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = imageSrc;
        
        img.onload = () => {
            if (this.onImageLoad) {
                this.onImageLoad(img);
            }
        };
        
        this._element.appendChild(img);
        this.applyCSSAdjustments();
    }

    showPlaceholder(message = 'Click to upload') {
        this._element.innerHTML = '';
        const placeholder = document.createElement('span');
        placeholder.className = 'placeholder';
        placeholder.textContent = message;
        this._element.appendChild(placeholder);
    }

    clear() {
        this._element.innerHTML = '';
    }

    setAdjustments(adjustments) {
        this.adjustments = adjustments;
        this.applyCSSAdjustments();
    }

    applyCSSAdjustments() {
        const img = this._element.querySelector('img');
        if (img) {
            img.style.filter = `brightness(${this._adjustments.brightness}) contrast(${this._adjustments.contrast})`;
        }
    }

    startDrag(e, onDrag, onDragEnd) {
        if (e.button !== 0) return;
        
        e.preventDefault();
        
        this._dragState = {
            startX: e.clientX,
            startY: e.clientY,
            initialBrightness: this._adjustments.brightness,
            initialContrast: this._adjustments.contrast
        };
        
        this._element.classList.add('dragging');
        this.showAdjustmentIndicator(this._adjustments.brightness, this._adjustments.contrast);
        
        const dragHandler = (moveEvent) => {
            if (!this._dragState) return;
            
            const deltaX = moveEvent.clientX - this._dragState.startX;
            const deltaY = moveEvent.clientY - this._dragState.startY;
            
            const brightness = this._dragState.initialBrightness - (deltaY / 300);
            const clampedBrightness = Math.max(0.0, Math.min(2.0, brightness));
            
            const contrast = this._dragState.initialContrast + (deltaX / 300);
            const clampedContrast = Math.max(0.0, Math.min(3.0, contrast));
            
            this._adjustments = {
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
            this._element.classList.remove('dragging');
            this.hideAdjustmentIndicator();
            
            if (onDragEnd) {
                onDragEnd();
            }
            
            this._dragState = null;
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
            clearTimeout(this._adjustmentTimeout);
            
            this._adjustmentTimeout = setTimeout(() => {
                indicator.classList.remove('visible');
            }, 1000);
        }
    }

    hideAdjustmentIndicator() {
        const indicator = document.getElementById('adjustment-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
            clearTimeout(this._adjustmentTimeout);
        }
    }

    resize(width, height) {
        this._element.style.width = `${width}px`;
        this._element.style.height = `${height}px`;
    }

    getDimensions() {
        return {
            width: this._element.offsetWidth,
            height: this._element.offsetHeight
        };
    }

    hasImage() {
        return this._element.querySelector('img') !== null;
    }

    getImage() {
        return this._element.querySelector('img');
    }
}