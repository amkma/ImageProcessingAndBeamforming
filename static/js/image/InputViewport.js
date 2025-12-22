/**
 * InputViewport - Handles input image upload and display
 */
class InputViewport extends Viewport {
    constructor(viewportId, index, image) {
        super(viewportId);
        this.index = index;
        this.image = image;
        this.fileInput = document.getElementById(`input-file-${index}`);
        
        if (!this.fileInput) {
            this.fileInput = this.createFileInput();
        }
        
        this.setupFileUpload();
        this.setupDragAdjustments();
    }

    createFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = `input-file-${this.index}`;
        input.className = 'file-input';
        input.accept = 'image/*';
        input.style.display = 'none';
        
        document.body.appendChild(input);
        return input;
    }

    setupFileUpload() {
        // Double-click to upload
        this.element.addEventListener('dblclick', () => {
            this.fileInput.click();
        });
        
        // File selection handler
        this.fileInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const success = await this.image.upload(e.target.files[0]);
                if (success) {
                    this.displayImage(this.image.base64Data);
                    this.image.resetAdjustments();
                    
                    // Dispatch event for other components
                    const event = new CustomEvent('image-uploaded', {
                        detail: { 
                            imageIndex: this.index, 
                            imageKey: this.image.imageKey 
                        }
                    });
                    document.dispatchEvent(event);
                }
            }
        });
    }

    setupDragAdjustments() {
        this.element.addEventListener('mousedown', (e) => {
            if (!this.image.isLoaded()) return;
            
            this.startDrag(
                e,
                (brightness, contrast) => {
                    // Live preview during drag
                    this.image.adjustments = { brightness, contrast };
                },
                async () => {
                    // Apply adjustments to backend
                    const result = await this.image.applyDisplayAdjustments(this.image.adjustments);
                    if (result) {
                        this.displayImage(result);
                    }
                }
            );
        });
    }

    updateImage(imageSrc) {
        this.displayImage(imageSrc);
    }
}