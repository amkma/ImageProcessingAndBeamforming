/**
 * Filter - Manages frequency domain filtering with draggable rectangle overlay
 */
class Filter {
    constructor() {
        this._mode = 'inner';
        this._rect = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
        this._savedRectangle = null;
        this._rectangleDragState = null;
        this._updateDebounceTimer = null;
        
        this.initializeFilterControls();
    }

    // Getters
    get mode() {
        return this._mode;
    }

    get rect() {
        return this._rect;
    }

    get savedRectangle() {
        return this._savedRectangle;
    }

    get rectangleDragState() {
        return this._rectangleDragState;
    }

    // Setters
    set mode(value) {
        this._mode = value;
    }

    set rect(value) {
        this._rect = value;
    }

    set savedRectangle(value) {
        this._savedRectangle = value;
    }

    set rectangleDragState(value) {
        this._rectangleDragState = value;
    }

    initializeFilterControls() {
        // Mode radio buttons
        const filterInner = document.getElementById('filter-inner');
        const filterOuter = document.getElementById('filter-outer');
        const filterAll = document.getElementById('filter-all');
        
        if (filterInner) {
            filterInner.addEventListener('change', () => {
                if (filterInner.checked) {
                    this.setMode('inner');
                }
            });
        }
        
        if (filterOuter) {
            filterOuter.addEventListener('change', () => {
                if (filterOuter.checked) {
                    this.setMode('outer');
                }
            });
        }
        
        if (filterAll) {
            filterAll.addEventListener('change', () => {
                if (filterAll.checked) {
                    this.setMode('all');
                }
            });
        }
        
        // Reset button
        const resetButton = document.getElementById('filter-reset');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.reset();
            });
        }
    }

    setMode(mode) {
        if (mode === 'all') {
            this._savedRectangle = { ...this._rect };
            this._rect = { x: 0, y: 0, width: 1.0, height: 1.0 };
            this._mode = 'inner';
        } else {
            if (this._savedRectangle && mode === 'inner') {
                this._rect = { ...this._savedRectangle };
                this._savedRectangle = null;
            }
            this._mode = mode;
        }
        
        this.updateAllRectangles();
        this.updateFilterMode();
        this.dispatchChangeEvent();
    }

    reset() {
        this._mode = 'inner';
        this._rect = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
        this._savedRectangle = null;
        
        // Update UI
        const filterInner = document.getElementById('filter-inner');
        if (filterInner) filterInner.checked = true;
        
        this.updateAllRectangles();
        this.updateFilterMode();
        this.dispatchChangeEvent();
    }

    initializeInteractiveRectangle(index, rectangle, viewport) {
        // Rectangle drag
        rectangle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle')) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const rectBounds = rectangle.getBoundingClientRect();
            const viewportBounds = viewport.getBoundingClientRect();
            
            this._rectangleDragState = {
                type: 'move',
                sourceIndex: index,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: rectBounds.left - viewportBounds.left,
                initialTop: rectBounds.top - viewportBounds.top,
                viewportWidth: viewportBounds.width,
                viewportHeight: viewportBounds.height
            };
            
            rectangle.classList.add('dragging');
            document.addEventListener('mousemove', (e) => this.handleRectangleMove(e));
            document.addEventListener('mouseup', () => this.handleRectangleEnd());
        });
        
        // Resize handles
        const handles = rectangle.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const rectBounds = rectangle.getBoundingClientRect();
                const viewportBounds = viewport.getBoundingClientRect();
                const handleType = handle.classList[1];
                
                this._rectangleDragState = {
                    type: 'resize',
                    sourceIndex: index,
                    handleType: handleType,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialLeft: rectBounds.left - viewportBounds.left,
                    initialTop: rectBounds.top - viewportBounds.top,
                    initialWidth: rectBounds.width,
                    initialHeight: rectBounds.height,
                    viewportWidth: viewportBounds.width,
                    viewportHeight: viewportBounds.height
                };
                
                rectangle.classList.add('dragging');
                document.addEventListener('mousemove', (e) => this.handleRectangleResize(e));
                document.addEventListener('mouseup', () => this.handleRectangleEnd());
            });
        });
    }

    handleRectangleMove(e) {
        if (!this._rectangleDragState || this._rectangleDragState.type !== 'move') return;
        
        const ds = this._rectangleDragState;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        
        let newLeft = ds.initialLeft + deltaX;
        let newTop = ds.initialTop + deltaY;
        
        const rect = document.getElementById(`filter-rect-${ds.sourceIndex}`);
        const rectWidth = parseFloat(rect.style.width) || (ds.viewportWidth * this._rect.width);
        const rectHeight = parseFloat(rect.style.height) || (ds.viewportHeight * this._rect.height);
        
        newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - rectWidth));
        newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - rectHeight));
        
        this._rect.x = newLeft / ds.viewportWidth;
        this._rect.y = newTop / ds.viewportHeight;
        
        this.updateAllRectangles();
        
        // Debounce change event during drag
        clearTimeout(this._updateDebounceTimer);
        this._updateDebounceTimer = setTimeout(() => {
            this.dispatchChangeEvent();
        }, 50);
    }

    handleRectangleResize(e) {
        if (!this._rectangleDragState || this._rectangleDragState.type !== 'resize') return;
        
        const ds = this._rectangleDragState;
        const deltaX = e.clientX - ds.startX;
        const deltaY = e.clientY - ds.startY;
        
        let newLeft = ds.initialLeft;
        let newTop = ds.initialTop;
        let newWidth = ds.initialWidth;
        let newHeight = ds.initialHeight;
        
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
        
        newLeft = Math.max(0, Math.min(newLeft, ds.viewportWidth - newWidth));
        newTop = Math.max(0, Math.min(newTop, ds.viewportHeight - newHeight));
        newWidth = Math.min(newWidth, ds.viewportWidth - newLeft);
        newHeight = Math.min(newHeight, ds.viewportHeight - newTop);
        
        this._rect.x = newLeft / ds.viewportWidth;
        this._rect.y = newTop / ds.viewportHeight;
        this._rect.width = newWidth / ds.viewportWidth;
        this._rect.height = newHeight / ds.viewportHeight;
        
        this.updateAllRectangles();
        
        // Debounce change event during resize
        clearTimeout(this._updateDebounceTimer);
        this._updateDebounceTimer = setTimeout(() => {
            this.dispatchChangeEvent();
        }, 50);
    }

    handleRectangleEnd() {
        if (this._rectangleDragState) {
            const rect = document.getElementById(`filter-rect-${this._rectangleDragState.sourceIndex}`);
            if (rect) {
                rect.classList.remove('dragging');
            }
            
            // Update UI if in 'all' mode
            const filterAll = document.querySelector('#filter-all');
            const filterInner = document.querySelector('#filter-inner');
            if (filterAll && filterAll.checked && filterInner) {
                filterInner.checked = true;
                this._mode = 'inner';
                if (this._savedRectangle) {
                    this._rect = { ...this._savedRectangle };
                    this._savedRectangle = null;
                    this.updateAllRectangles();
                }
            }
            
            this._rectangleDragState = null;
        }
        
        document.removeEventListener('mousemove', this.handleRectangleMove);
        document.removeEventListener('mousemove', this.handleRectangleResize);
        document.removeEventListener('mouseup', this.handleRectangleEnd);
        
        this.dispatchChangeEvent();
    }

    updateAllRectangles() {
        for (let i = 1; i <= 4; i++) {
            const viewport = document.getElementById(`component-viewport-${i}`);
            const rectangle = document.getElementById(`filter-rect-${i}`);
            const overlay = document.getElementById(`filter-overlay-${i}`);
            
            if (!viewport || !rectangle || !overlay) continue;
            
            const viewportRect = viewport.getBoundingClientRect();
            
            const left = this._rect.x * viewportRect.width;
            const top = this._rect.y * viewportRect.height;
            const width = this._rect.width * viewportRect.width;
            const height = this._rect.height * viewportRect.height;
            
            rectangle.style.left = `${left}px`;
            rectangle.style.top = `${top}px`;
            rectangle.style.width = `${width}px`;
            rectangle.style.height = `${height}px`;
            
            overlay.className = `filter-overlay ${this._mode}-mode`;
        }
    }

    updateFilterMode() {
        for (let i = 1; i <= 4; i++) {
            const overlay = document.getElementById(`filter-overlay-${i}`);
            
            if (!overlay) continue;
            
            overlay.className = `filter-overlay ${this._mode}-mode`;
        }
    }

    dispatchChangeEvent() {
        const event = new CustomEvent('filter-changed', {
            detail: {
                mode: this._mode,
                rect: { ...this._rect }
            }
        });
        document.dispatchEvent(event);
    }

    getParams() {
        return {
            x: this._rect.x,
            y: this._rect.y,
            width: this._rect.width,
            height: this._rect.height,
            type: this._mode
        };
    }
}