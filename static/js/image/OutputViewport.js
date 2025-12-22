/**
 * OutputViewport - Displays mixed output images
 */
class OutputViewport extends Viewport {
    constructor(viewportId, index) {
        super(viewportId);
        this._index = index;
        this._outputKey = `output${index}`;
        this._isSelected = false;
        this._container = document.getElementById(`output-container-${index}`);
        
        this.setupSelection();
        this.setupDragAdjustments();
    }

    // Getters
    get index() {
        return this._index;
    }

    get outputKey() {
        return this._outputKey;
    }

    get isSelected() {
        return this._isSelected;
    }

    get container() {
        return this._container;
    }

    // Setters
    set isSelected(value) {
        this._isSelected = value;
    }

    setupSelection() {
        // Select on double-click
        this._element.addEventListener('dblclick', () => {
            this.select();
        });
    }

    setupDragAdjustments() {
        this._element.addEventListener('mousedown', (e) => {
            if (!this.hasImage()) return;
            
            this.startDrag(
                e,
                (brightness, contrast) => {
                    // Live preview during drag
                },
                async () => {
                    // Apply output adjustments to backend
                    await this.applyOutputAdjustments();
                }
            );
        });
    }

    select() {
        // Remove selection from all outputs
        document.querySelectorAll('.output-container').forEach(container => {
            container.classList.remove('selected');
        });
        
        // Select this one
        if (this._container) {
            this._container.classList.add('selected');
        }
        this._isSelected = true;
        
        // Dispatch selection event
        const event = new CustomEvent('output-selected', {
            detail: { outputIndex: this._index }
        });
        document.dispatchEvent(event);
    }

    async applyOutputAdjustments() {
        const img = this._element.querySelector('img');
        if (!img) return;
        
        try {
            const response = await fetch('/api/apply-output-adjustments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    output_key: this._outputKey,
                    brightness: this._adjustments.brightness,
                    contrast: this._adjustments.contrast
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayImage(data.adjusted_image);
            } else {
                // Reset adjustments if output doesn't exist
                this._adjustments = { brightness: 1.0, contrast: 1.0 };
                this.applyCSSAdjustments();
            }
        } catch (error) {
            console.error('Output adjustment failed:', error);
        }
    }

    displayOutput(imageSrc) {
        this.displayImage(imageSrc);
        // Don't reset adjustments - preserve user's brightness/contrast changes
    }
}