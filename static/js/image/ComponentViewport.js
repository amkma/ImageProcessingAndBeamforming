/**
 * ComponentViewport - Displays FFT components with filter overlay
 */
class ComponentViewport extends Viewport {
    constructor(viewportId, index, image, filter) {
        super(viewportId);
        this.index = index;
        this.image = image;
        this.filter = filter;
        this.componentSelect = document.getElementById(`component-select-${index}`);
        this.overlay = document.getElementById(`filter-overlay-${index}`);
        this.rectangle = document.getElementById(`filter-rect-${index}`);
        
        this.setupComponentSelect();
        this.setupDragAdjustments();
        this.setupFilterRectangle();
        
        // Listen for image upload events
        document.addEventListener('image-uploaded', (e) => {
            if (e.detail.imageIndex === this.index) {
                this.updateComponentPreview();
            }
        });
    }

    setupComponentSelect() {
        if (!this.componentSelect) return;
        
        this.componentSelect.addEventListener('change', () => {
            this.updateComponentPreview();
        });
    }

    async updateComponentPreview() {
        if (!this.image.isLoaded()) {
            this.showPlaceholder('No image loaded');
            return;
        }
        
        const component = this.componentSelect ? this.componentSelect.value : 'magnitude';
        
        // Reset component adjustments when changing component
        this.image.componentAdjustments = { brightness: 1.0, contrast: 1.0 };
        
        // Remove overlay temporarily
        if (this.overlay && this.element.contains(this.overlay)) {
            this.element.removeChild(this.overlay);
        }
        
        this.showPlaceholder('Loading...');
        
        try {
            const componentImage = await this.image.getFFTComponent(component);
            if (componentImage) {
                this.displayImage(componentImage);
                
                // Re-attach filter overlay
                if (this.overlay) {
                    this.element.appendChild(this.overlay);
                }
                
                // Update rectangle visibility
                if (this.rectangle) {
                    this.rectangle.style.display = 'block';
                }
                if (this.overlay) {
                    this.overlay.style.pointerEvents = 'auto';
                }
                
                // Update rectangle positioning
                setTimeout(() => {
                    if (this.filter) {
                        this.filter.updateAllRectangles();
                    }
                }, 50);
            }
        } catch (error) {
            console.error('Component update failed:', error);
            this.showPlaceholder('Error loading component');
        }
    }

    setupDragAdjustments() {
        this.element.addEventListener('mousedown', (e) => {
            // Don't interfere with filter rectangle drag
            if (e.target.closest('.filter-rectangle') || e.target.closest('.resize-handle')) {
                return;
            }
            
            if (!this.image.isLoaded()) return;
            
            this.startDrag(
                e,
                (brightness, contrast) => {
                    // Live preview during drag
                    this.image.componentAdjustments = { brightness, contrast };
                },
                async () => {
                    // Apply adjustments to backend
                    const component = this.componentSelect ? this.componentSelect.value : 'magnitude';
                    const result = await this.image.applyComponentAdjustments(
                        component,
                        this.image.componentAdjustments
                    );
                    if (result) {
                        // Remove overlay temporarily
                        if (this.overlay && this.element.contains(this.overlay)) {
                            this.element.removeChild(this.overlay);
                        }
                        
                        this.displayImage(result);
                        
                        // Re-attach filter overlay
                        if (this.overlay) {
                            this.element.appendChild(this.overlay);
                        }
                        
                        // Update rectangle positioning
                        if (this.filter) {
                            this.filter.updateAllRectangles();
                        }
                    }
                }
            );
        });
    }

    setupFilterRectangle() {
        if (!this.rectangle || !this.filter) return;
        
        this.filter.initializeInteractiveRectangle(this.index, this.rectangle, this.element);
    }

    attachOverlay() {
        if (this.overlay && !this.element.contains(this.overlay)) {
            this.element.appendChild(this.overlay);
        }
    }
}