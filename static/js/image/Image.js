/**
 * Image - Encapsulates image data and operations
 */
class Image {
    constructor(imageKey, index) {
        this.imageKey = imageKey;
        this.index = index;
        this.base64Data = null;
        this.adjustments = { brightness: 1.0, contrast: 1.0 };
        this.componentAdjustments = { brightness: 1.0, contrast: 1.0 };
        this.weights = { a: 0, b: 0 };
        this.currentComponent = 'magnitude';
    }

    async upload(file) {
        if (!file) return false;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('image_key', this.imageKey);
        
        try {
            const response = await fetch('/api/upload/', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.base64Data = data.grayscale_image;
                return true;
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
        
        return false;
    }

    async applyDisplayAdjustments(adjustments) {
        if (!this.base64Data) return null;
        
        try {
            const response = await fetch('/api/apply-adjustments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: this.imageKey,
                    brightness: adjustments.brightness,
                    contrast: adjustments.contrast,
                    reference: 'original'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.base64Data = data.adjusted_image;
                return data.adjusted_image;
            }
        } catch (error) {
            console.error('Adjustment failed:', error);
        }
        
        return null;
    }

    async getFFTComponent(component) {
        if (!this.base64Data) return null;
        
        this.currentComponent = component;
        
        try {
            const response = await fetch('/api/fft/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_key: this.imageKey,
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
                    image_key: this.imageKey,
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
        return this.base64Data !== null;
    }

    setWeight(type, value) {
        this.weights[type] = value / 100;
    }

    resetAdjustments() {
        this.adjustments = { brightness: 1.0, contrast: 1.0 };
        this.componentAdjustments = { brightness: 1.0, contrast: 1.0 };
    }
}