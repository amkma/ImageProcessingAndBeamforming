/**
 * InputViewport - Handles input image upload and display
 */
class InputViewport extends Viewport {
    constructor(viewportId, index, image) {
        super(viewportId);
        this._index = index;
        this._image = image;
        this._fileInput = document.getElementById(`input-file-${index}`);
        
        if (!this._fileInput) {
            this._fileInput = this.createFileInput();
        }
        
        this.setupFileUpload();
        this.setupDragAdjustments();
    }

    // Getters
    get index() {
        return this._index;
    }

    get image() {
        return this._image;
    }

    get fileInput() {
        return this._fileInput;
    }

    createFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = `input-file-${this._index}`;
        input.className = 'file-input';
        input.accept = 'image/*';
        input.style.display = 'none';
        
        document.body.appendChild(input);
        return input;
    }

    setupFileUpload() {
        // Double-click to upload
        this._element.addEventListener('dblclick', () => {
            this._fileInput.click();
        });
        
        // File selection handler
        this._fileInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                const success = await this._image.upload(e.target.files[0]);
                if (success) {
                    this.displayImage(this._image.base64Data);
                    this._image.resetAdjustments();
                    
                    // Dispatch event for other components
                    const event = new CustomEvent('image-uploaded', {
                        detail: { 
                            imageIndex: this._index, 
                            imageKey: this._image.imageKey 
                        }
                    });
                    document.dispatchEvent(event);
                }
            }
        });
    }

    setupDragAdjustments() {
        this._element.addEventListener('mousedown', (e) => {
            if (!this._image.isLoaded()) return;
            
            this.startDrag(
                e,
                (brightness, contrast) => {
                    // Display-only adjustments - update CSS only, don't modify backend
                    this._adjustments = { brightness, contrast };
                    this.applyCSSAdjustments();
                },
                async () => {
                    // No backend call - adjustments are display-only for input viewport
                    // The original image data remains unchanged for FFT processing
                }
            );
        });
    }

    updateImage(imageSrc) {
        this.displayImage(imageSrc);
    }
}