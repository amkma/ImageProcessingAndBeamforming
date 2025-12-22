/**
 * OutputViewport - Displays mixed output images
 */
class OutputViewport extends Viewport {
    constructor(viewportId, index) {
        super(viewportId);
        this.index = index;
        this.outputKey = `output${index}`;
        this.isSelected = false;
        this.container = document.getElementById(`output-container-${index}`);
        
        this.setupSelection();
        this.setupDragAdjustments();
    }

    setupSelection() {
        // Select on double-click
        this.element.addEventListener('dblclick', () => {
            this.select();
        });
    }

    setupDragAdjustments() {
        this.element.addEventListener('mousedown', (e) => {
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
        if (this.container) {
            this.container.classList.add('selected');
        }
        this.isSelected = true;
        
        // Dispatch selection event
        const event = new CustomEvent('output-selected', {
            detail: { outputIndex: this.index }
        });
        document.dispatchEvent(event);
    }

    async applyOutputAdjustments() {
        const img = this.element.querySelector('img');
        if (!img) return;
        
        try {
            const response = await fetch('/api/apply-output-adjustments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    output_key: this.outputKey,
                    brightness: this.adjustments.brightness,
                    contrast: this.adjustments.contrast
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayImage(data.adjusted_image);
            } else {
                // Reset adjustments if output doesn't exist
                this.adjustments = { brightness: 1.0, contrast: 1.0 };
                this.applyCSSAdjustments();
            }
        } catch (error) {
            console.error('Output adjustment failed:', error);
        }
    }

    displayOutput(imageSrc) {
        this.displayImage(imageSrc);
        this.adjustments = { brightness: 1.0, contrast: 1.0 };
        this.applyCSSAdjustments();
    }
}