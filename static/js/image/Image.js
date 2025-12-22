/**
 * Image - Encapsulates image data and operations
 */
class Image {
    constructor(imageKey, index) {
        this._imageKey = imageKey;
        this._index = index;
        this._base64Data = null;
        this._adjustments = { brightness: 1.0, contrast: 1.0 };
        this._componentAdjustments = { brightness: 1.0, contrast: 1.0 };
        this._weights = { a: 0, b: 0 };
        this._currentComponent = 'magnitude';
    }

    // Getters
    get imageKey() {
        return this._imageKey;
    }

    get index() {
        return this._index;
    }

    get base64Data() {
        return this._base64Data;
    }

    get adjustments() {
        return this._adjustments;
    }

    get componentAdjustments() {
        return this._componentAdjustments;
    }

    get weights() {
        return this._weights;
    }

    get currentComponent() {
        return this._currentComponent;
    }

    // Setters
    set base64Data(value) {
        this._base64Data = value;
    }

    set adjustments(value) {
        this._adjustments = value;
    }

    set componentAdjustments(value) {
        this._componentAdjustments = value;
    }

    set currentComponent(value) {
        this._currentComponent = value;
    }

    async upload(file) {
        if (!file) return false;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('image_key', this._imageKey);
        
        try {
            const response = await fetch('/api/upload/', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this._base64Data = data.grayscale_image;
                return true;
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
        
        return false;
    }

    async applyDisplayAdjustments(adjustments) {
        if (!this._base64Data) return null;
        
        try {
            const response = await fetch('/api/apply-adjustments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: this._imageKey,
                    brightness: adjustments.brightness,
                    contrast: adjustments.contrast,
                    reference: 'original'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this._base64Data = data.adjusted_image;
                return data.adjusted_image;
            }
        } catch (error) {
            console.error('Adjustment failed:', error);
        }
        
        return null;
    }

    async getFFTComponent(component) {
        if (!this._base64Data) return null;
        
        this._currentComponent = component;
        
        try {
            const response = await fetch('/api/fft/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: this._imageKey,
                    component: component
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.image;
            }
        } catch (error) {
            console.error('FFT component fetch failed:', error);
        }
        
        return null;
    }

    async applyComponentAdjustments(component, adjustments) {
        try {
            const response = await fetch('/api/apply-component-adjustments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: this._imageKey,
                    component: component,
                    brightness: adjustments.brightness,
                    contrast: adjustments.contrast
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.adjusted_image;
            }
        } catch (error) {
            console.error('Component adjustment failed:', error);
        }
        
        return null;
    }

    isLoaded() {
        return this._base64Data !== null;
    }

    setWeight(type, value) {
        this._weights[type] = value / 100;
    }

    resetAdjustments() {
        this._adjustments = { brightness: 1.0, contrast: 1.0 };
        this._componentAdjustments = { brightness: 1.0, contrast: 1.0 };
    }
}