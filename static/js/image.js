/**
 * Image Mixer - Main entry point
 * Initializes the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Create and initialize the ImageMixer
        window.imageMixer = new ImageMixer();
        
        // Make it globally available
        console.log('Image Mixer initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Image Mixer:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff4444;
            color: white;
            padding: 20px;
            border-radius: 5px;
            z-index: 10000;
        `;
        errorDiv.textContent = `Application Error: ${error.message}`;
        document.body.appendChild(errorDiv);
    }
});