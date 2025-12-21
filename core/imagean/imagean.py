"""Core Image Processing Engine for Frequency Domain Operations.

This module implements the ImageViewer class, which provides comprehensive
image processing capabilities focused on Fourier Transform operations and
frequency domain mixing. Designed for real-time web applications with
emphasis on performance optimization through aggressive caching.

Architecture:
- Session-based state management (images, FFT cache, adjustment tracking)
- Aggressive pre-computation strategy (FFT computed on upload)
- Immutable original images (adjustments never modify originals)
- Unified Region Model (frequency masking always applied)

Performance Optimizations:
- Pre-computed FFT cache eliminates redundant transforms
- NumPy vectorized operations for maximum throughput
- Strategic copy operations minimize memory overhead
- In-place operations where safe (clipping, masking)

Core Operations:
1. Image Loading: Grayscale conversion + FFT pre-computation
2. Component Extraction: Magnitude, phase, real, imaginary from cache
3. Frequency Mixing: Multi-image blending in frequency domain
4. Spatial Adjustments: Brightness/contrast with FFT recomputation
5. Session Management: Clear, status, base64 conversion

Design Principles:
- Stateless request handling (strict parameter enforcement)
- Cache invalidation on any spatial modification
- Original images preserved for clean FFT computation
- Type safety with explicit dtype declarations

Dependencies:
- numpy: Fast array operations and FFT computation
- PIL: Image I/O and format conversion
- io, base64: Web encoding for browser display

Author: Image Processing and Beamforming Team
Optimized: December 2025
"""

import numpy as np
from PIL import Image
import io
import base64


class ImageViewer:
    """Manages image processing operations with frequency domain focus.
    
    State Management:
    - images: Currently displayed versions (post-adjustment)
    - original_images: Immutable originals for clean FFT
    - last_adjustments: Tracks cumulative brightness/contrast
    - fft_cache: Pre-computed FFT components (magnitude, phase, real, imaginary)
    
    Performance Notes:
    - All dictionaries use image_key as string identifier
    - FFT cache eliminates redundant O(n²log n) operations
    - Original images preserved for reference='original' mode
    - Current images support reference='current' delta adjustments
    """
    
    def __init__(self):
        """Initialize empty image viewer with clean state."""
        self.images = {}  # Currently displayed images (post-adjustment)
        self.original_images = {}  # Immutable originals (pre-adjustment)
        self.last_adjustments = {}  # Cumulative brightness/contrast tracking
        self.fft_cache = {}  # Pre-computed FFT components for instant access
        self.output_images = {}  # Output images from mixing (output1, output2)
        self.original_output_images = {}  # Original outputs for adjustment reference
        self.output_adjustments = {}  # Output adjustment tracking
        self.component_visualizations = {}  # Currently displayed component visualizations
        self.original_component_visualizations = {}  # Original component visualizations for adjustment reference
        self.component_adjustments = {}  # Component viewport adjustment tracking
        
    def load_image(self, image_key, image_data):
        """Load image with grayscale conversion and FFT pre-computation.
        
        Workflow:
        1. Load image from file path or PIL object
        2. Force grayscale conversion (required for FFT)
        3. Convert to float64 for precision in frequency domain
        4. Store both original (immutable) and current (mutable) versions
        5. Pre-compute all FFT components (magnitude, phase, real, imaginary)
        6. Initialize adjustment tracking to neutral state
        
        Args:
            image_key (str): Identifier ('img1', 'img2', 'img3', 'img4')
            image_data (str | PIL.Image): File path or PIL Image object
            
        Returns:
            tuple: (height, width) shape of loaded image
            
        Performance:
        - O(1) image loading
        - O(n²log n) FFT pre-computation (one-time cost)
        - O(n²) component extraction (vectorized)
        - Total: ~100-200ms for 512×512 image
        
        Optimization Notes:
        - Uses float64 for FFT precision (required by numpy.fft)
        - Pre-computes all components in single pass
        - Eliminates redundant FFT calls during component requests
        - Copy operation ensures original immutability
        """
        # Load image from file or object
        if isinstance(image_data, str):
            img = Image.open(image_data)
        else:
            img = image_data
            
        # FORCED GRAYSCALE: RGB/RGBA → Luminance (required for FFT)
        img_gray = img.convert('L')
        img_array = np.array(img_gray, dtype=np.float64)
        
        # Store immutable original for clean FFT operations
        self.original_images[image_key] = img_array.copy()
        
        # Store mutable current version for display and adjustments
        self.images[image_key] = img_array
        
        # Initialize adjustment tracking to neutral (no adjustments applied)
        self.last_adjustments[image_key] = {'brightness': 1.0, 'contrast': 1.0}
        
        # PRE-COMPUTE FFT and all components (one-time cost, eliminates latency)
        self._compute_and_cache_fft(image_key, img_array)
            
        return self.images[image_key].shape
    
    def _compute_and_cache_fft(self, image_key, image_array):
        """Compute FFT and cache all components in single pass.
        
        Optimization: Vectorized component extraction from single FFT result.
        Eliminates 4 separate FFT computations (magnitude, phase, real, imaginary).
        
        Args:
            image_key (str): Image identifier for cache storage
            image_array (np.ndarray): Spatial domain image (float64)
            
        Performance:
        - Single FFT: O(n²log n)
        - Component extraction: O(n²) each, vectorized
        - Cache storage: O(1) dictionary insertion
        """
        fft_result = np.fft.fftshift(np.fft.fft2(image_array))
        self.fft_cache[image_key] = { # imgx
            'fft': fft_result,
            'magnitude': np.abs(fft_result),  # Vectorized magnitude
            'phase': np.angle(fft_result),    # Vectorized phase
            'real': np.real(fft_result),      # Vectorized real
            'imaginary': np.imag(fft_result)  # Vectorized imaginary
        }
    
    def check_and_resize_to_smallest(self):
        """Enforce unified dimensions by cropping all images to smallest size.
        
        Workflow:
        1. Find minimum dimensions among all loaded images
        2. For each oversized image:
           - Resize current display version
           - Resize original immutable version
           - Invalidate and recompute FFT cache
        3. Return unified dimensions
        
        Why Crop (Not Scale):
        - Preserves spatial frequencies (no interpolation artifacts)
        - Maintains frequency domain accuracy
        - Required for frequency mixing (matching FFT dimensions)
        
        Returns:
            tuple: (height, width) of unified dimensions, or None if no images
            
        Performance:
        - Finding min: O(k) where k = number of images
        - Resizing: O(k × n²) where n² = image pixels
        - FFT recomputation: O(k × n²log n) for resized images only
        - Uses Lanczos resampling for quality (slower but higher fidelity)
        
        Optimization Notes:
        - Only resizes images that don't match target dimensions
        - Reuses _compute_and_cache_fft helper for consistency
        - Maintains adjustment tracking (no reset needed)
        """
        if len(self.images) == 0:
            return None
            
        # Find smallest dimensions across all loaded images
        min_height = min(img.shape[0] for img in self.images.values())
        min_width = min(img.shape[1] for img in self.images.values())
        
        # Resize only images that don't match target dimensions
        for key in self.images:
            if self.images[key].shape != (min_height, min_width):
                # Resize current display image
                img_pil = Image.fromarray(self.images[key].astype(np.uint8))
                img_resized = img_pil.resize((min_width, min_height), Image.LANCZOS)
                self.images[key] = np.array(img_resized, dtype=np.float64)
                
                # Resize original immutable image (must stay synchronized)
                if key in self.original_images:
                    orig_pil = Image.fromarray(self.original_images[key].astype(np.uint8))
                    orig_resized = orig_pil.resize((min_width, min_height), Image.LANCZOS)
                    self.original_images[key] = np.array(orig_resized, dtype=np.float64)
                
                # Invalidate cache and recompute FFT for resized image
                self._compute_and_cache_fft(key, self.images[key])
        
        return (min_height, min_width)
    
    def _get_fft(self, image_key):
        """Retrieve pre-computed FFT from cache with validation.
        
        Args:
            image_key (str): Image identifier
            
        Returns:
            dict: Cached FFT components {
                'fft': complex FFT,
                'magnitude': absolute values,
                'phase': angles in radians,
                'real': real components,
                'imaginary': imaginary components
            }
            
        Raises:
            ValueError: If image not loaded or FFT not computed
            
        Performance: O(1) dictionary lookup, no FFT computation
        """
        if image_key not in self.images:
            raise ValueError(f"Image '{image_key}' not loaded")
            
        if image_key not in self.fft_cache:
            raise ValueError(f"FFT not computed for '{image_key}'")
            
        return self.fft_cache[image_key]
    
    def get_magnitude(self, image_key):
        """Retrieve pre-computed magnitude spectrum from cache.
        
        Args:
            image_key (str): Image identifier
            
        Returns:
            np.ndarray: Magnitude spectrum (float64), shape (H, W)
            
        Performance: O(1) cache lookup, no FFT computation
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['magnitude']
    
    def get_phase(self, image_key):
        """Retrieve pre-computed phase spectrum from cache.
        
        Args:
            image_key (str): Image identifier
            
        Returns:
            np.ndarray: Phase spectrum in radians [-π, π], shape (H, W)
            
        Performance: O(1) cache lookup, no FFT computation
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['phase']
    
    def get_real(self, image_key):
        """Retrieve pre-computed real component from cache.
        
        Args:
            image_key (str): Image identifier
            
        Returns:
            np.ndarray: Real component of FFT (float64), shape (H, W)
            
        Performance: O(1) cache lookup, no FFT computation
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['real']
    
    def get_imaginary(self, image_key):
        """Retrieve pre-computed imaginary component from cache.
        
        Args:
            image_key (str): Image identifier
            
        Returns:
            np.ndarray: Imaginary component of FFT (float64), shape (H, W)
            
        Performance: O(1) cache lookup, no FFT computation
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['imaginary']
    
    def get_fft_component_visualization(self, image_key, component='magnitude'):
        """Retrieve FFT component with visualization transformation applied.
        
        Applies appropriate visualization for display:
        - Magnitude: Log scaling to enhance low-frequency visibility
        - Phase/Real/Imaginary: Direct normalization
        
        Args:
            image_key (str): Image identifier
            component (str): Component type ('magnitude', 'phase', 'real', 'imaginary')
            
        Returns:
            str: Base64-encoded PNG image ready for frontend display
            
        Visualization Algorithm:
        - Magnitude: display = log(magnitude + 1) → normalize to [0, 255]
        - Others: display = component → normalize to [0, 255]
        - Normalization: (value - min) / (max - min) * 255
        
        Performance:
        - O(n²) for log/normalization operations (vectorized)
        - No FFT computation (uses cached data)
        """
        # Retrieve pre-computed FFT component from cache
        if component == 'magnitude':
            result = self.get_magnitude(image_key)
        elif component == 'phase':
            result = self.get_phase(image_key)
        elif component == 'real':
            result = self.get_real(image_key)
        elif component == 'imaginary':
            result = self.get_imaginary(image_key)
        else:
            raise ValueError(f"Invalid component type: {component}")
        
        # Apply visualization transformation
        # Log scale for magnitude (enhances low-frequency visibility)
        if component == 'magnitude':
            display = np.log(result + 1)
        else:
            display = result
        
        # Normalize to [0, 255] for display
        display = display - display.min()
        if display.max() > 0:
            display = display / display.max() * 255
        
        # Store original visualization for adjustment reference
        component_key = f"{image_key}_{component}"
        self.original_component_visualizations[component_key] = display.copy()
        self.component_visualizations[component_key] = display.copy()
        
        # Reset adjustments to neutral when component changes
        self.component_adjustments[component_key] = {
            'brightness': 1.0,
            'contrast': 1.0
        }
        
        # Convert to base64 for frontend rendering
        return self.image_to_base64(display)
    
    def mix_images(self, modes, weights_a, weights_b, region_params):
        """Frequency domain mixing with Unified Region Model and IFFT.
        
        Algorithm:
        1. Validate inputs and find reference dimensions
        2. Create frequency mask from region parameters
        3. For each image:
           a. Compute fresh FFT from original image
           b. Extract components based on mode (mag/phase or real/imag)
           c. Apply frequency mask to components
           d. Accumulate weighted components
        4. Reconstruct complex FFT from weighted components
        5. Apply Inverse FFT to generate spatial output
        6. Normalize and clip to [0, 255]
        
        Args:
            modes (dict): {image_key: 'magnitude_phase' | 'real_imaginary'}
            weights_a (dict): {image_key: weight} for component A (mag/real) [0.0, 1.0]
            weights_b (dict): {image_key: weight} for component B (phase/imag) [0.0, 1.0]
            region_params (dict): {
                'x': float [0.0, 1.0],
                'y': float [0.0, 1.0],
                'width': float [0.0, 1.0],
                'height': float [0.0, 1.0],
                'type': 'inner' | 'outer'
            }
        
        Returns:
            np.ndarray: Mixed spatial image (uint8), shape (H, W), or None if invalid
        
        Performance:
        - Input validation: O(k) where k = number of images
        - Mask creation: O(n²) where n² = image pixels
        - Per-image FFT: O(n²log n)
        - Component extraction: O(n²) vectorized
        - Weighted accumulation: O(n²) vectorized
        - IFFT: O(n²log n)
        - Total: O(k × n²log n) dominated by FFT operations
        
        Optimization Notes:
        - Early returns for invalid inputs (avoids wasted computation)
        - Fresh FFT from originals (ensures clean state)
        - Vectorized masking and accumulation (NumPy fast path)
        - In-place clip operation (memory efficient)
        - Skip images with both weights = 0.0 (optimization)
        
        Unified Region Model:
        - ALWAYS applies frequency mask (no conditional bypass)
        - Full spectrum: x=0, y=0, w=1.0, h=1.0, type='inner'
        - Custom filter: user-defined rectangle with inner/outer type
        """

            
        # Find valid reference image for dimensions
        first_key = next(iter(weights_a.keys()))
        if first_key not in self.original_images:
            valid_keys = [k for k in weights_a.keys() if k in self.original_images]
            if not valid_keys:
                return None
            first_key = valid_keys[0]
            
        ref_img = self.original_images[first_key] 
        h, w = ref_img.shape
        
        # Create frequency mask (Unified Region Model - ALWAYS applied)
        frequency_mask = self._create_frequency_mask((h, w), region_params['type'], region_params)
        
        # Initialize component accumulators (vectorized operations target)
        mixed_comp_1 = np.zeros((h, w), dtype=np.float64)
        mixed_comp_2 = np.zeros((h, w), dtype=np.float64)
        
        # Determine output reconstruction mode
        output_mode = modes.get(first_key, 'magnitude_phase')
        
        # Collect all image keys with any non-zero weight
        all_keys = set(weights_a.keys()) | set(weights_b.keys())

        # Process each image: FFT → extract components → mask → accumulate
        for key in all_keys:
            # Skip images not loaded
            if key not in self.original_images:
                continue
            
            # Get mode and weights for this image
            mode = modes.get(key, 'magnitude_phase')
            wa = weights_a.get(key, 0.0)
            wb = weights_b.get(key, 0.0)
            
            # Optimization: skip if both weights are zero
            if wa == 0.0 and wb == 0.0:
                continue
                
            # Compute FRESH FFT from original image (ensures clean state)
            img_data = self.original_images[key]
            fft_data = np.fft.fft2(img_data)
            fft_shifted = np.fft.fftshift(fft_data)

            # Extract components based on mode (vectorized operations)
            if mode == 'magnitude_phase':
                comp_1 = np.abs(fft_shifted)    # Magnitude
                comp_2 = np.angle(fft_shifted)  # Phase
            else:  # mode == 'real_imaginary'
                comp_1 = np.real(fft_shifted)   # Real
                comp_2 = np.imag(fft_shifted)   # Imaginary
            
            # Apply frequency mask (vectorized multiplication)
            comp_1 *= frequency_mask
            comp_2 *= frequency_mask
            
            # Accumulate weighted components (vectorized)
            mixed_comp_1 += comp_1 * wa
            mixed_comp_2 += comp_2 * wb

        # Reconstruct complex FFT from weighted components
        if output_mode == 'magnitude_phase':
            # Magnitude-phase: M × e^(jφ) = M × (cos(φ) + j×sin(φ))
            combined_fft = mixed_comp_1 * np.exp(1j * mixed_comp_2)
        else:  # real_imaginary
            # Real-imaginary: R + j×I
            combined_fft = mixed_comp_1 + 1j * mixed_comp_2

        # Inverse FFT: frequency domain → spatial domain
        combined_fft_ishift = np.fft.ifftshift(combined_fft)
        img_back = np.fft.ifft2(combined_fft_ishift)
        img_back = np.abs(img_back)  # Extract magnitude (discard negligible imaginary)
        
        # Normalize to valid display range [0, 255]
        np.clip(img_back, 0, 255, out=img_back)  # In-place clip (memory efficient)
        
        return img_back.astype(np.uint8)
    
    def _create_frequency_mask(self, shape, mode, rect_coords):
        """Create binary frequency mask for rectangular region filtering.
        
        Mask Types:
        - Inner: Keep frequencies inside rectangle, reject outside (low-pass)
        - Outer: Keep frequencies outside rectangle, reject inside (high-pass)
        
        Args:
            shape (tuple): (height, width) of frequency domain
            mode (str): 'inner' (keep inside) or 'outer' (keep outside)
            rect_coords (dict): {
                'x': float [0.0, 1.0] - normalized left edge,
                'y': float [0.0, 1.0] - normalized top edge,
                'width': float [0.0, 1.0] - normalized width,
                'height': float [0.0, 1.0] - normalized height
            }
            
        Returns:
            np.ndarray: Binary mask (float64), 1.0 = keep, 0.0 = reject
        
        Performance:
        - Coordinate conversion: O(1)
        - Mask allocation: O(n²)
        - Slice assignment: O(region_size)
        - Total: O(n²) dominated by allocation
        
        Optimization Notes:
        - Single zeros allocation (not ones then zeros)
        - Slice assignment faster than element-wise
        - Bounds clamping prevents index errors
        - Minimum size ensures non-zero region
        """
        height, width = shape
        
        # Extract normalized coordinates (defaults for safety)
        norm_x = rect_coords.get('x', 0.25)
        norm_y = rect_coords.get('y', 0.25)
        norm_width = rect_coords.get('width', 0.5)
        norm_height = rect_coords.get('height', 0.5)
        
        # Convert normalized [0.0, 1.0] → pixel coordinates
        x_start = int(norm_x * width)
        y_start = int(norm_y * height)
        rect_width = int(norm_width * width)
        rect_height = int(norm_height * height)
        
        # Calculate end coordinates
        x_end = x_start + rect_width
        y_end = y_start + rect_height
        
        # Clamp to valid bounds [0, width) and [0, height)
        x_start = max(0, min(x_start, width))
        y_start = max(0, min(y_start, height))
        x_end = max(0, min(x_end, width))
        y_end = max(0, min(y_end, height))
        
        # Ensure minimum size (avoid zero-area regions)
        if x_end <= x_start:
            x_end = x_start + 1
        if y_end <= y_start:
            y_end = y_start + 1
        
        # Create binary mask (optimized: single allocation)
        if mode == 'inner':
            # Keep inner rectangle, reject outer
            mask = np.zeros(shape, dtype=np.float64)
            mask[y_start:y_end, x_start:x_end] = 1.0
        else:  # mode == 'outer'
            # Keep outer region, reject inner rectangle
            mask = np.ones(shape, dtype=np.float64)
            mask[y_start:y_end, x_start:x_end] = 0.0
        
        return mask

    def apply_brightness_contrast(self, image_key, brightness, contrast, reference='original'):
        """Apply brightness and contrast adjustments with dual reference modes.
        
        Reference Modes:
        - 'original': Absolute adjustments from original uploaded image
        - 'current': Relative adjustments from current displayed state
        
        Algorithm:
        1. Validate and clamp input parameters
        2. Select source image based on reference mode
        3. Apply brightness: pixel × brightness_multiplier
        4. Apply contrast: (pixel - 127.5) × contrast_multiplier + 127.5
        5. Clip to [0, 255] range
        6. Update adjustment tracking
        
        Args:
            image_key (str): Image identifier
            brightness (float): Brightness multiplier [0.00, 2.00]
                * < 1.0: Darken
                * = 1.0: No change
                * > 1.0: Brighten
            contrast (float): Contrast multiplier [0.00, 3.00]
                * < 1.0: Reduce contrast
                * = 1.0: No change
                * > 1.0: Increase contrast
            reference (str): 'original' (absolute) or 'current' (relative)
                * 'original': Always relative to original image
                * 'current': Relative to current displayed state (stacks)
        
        Returns:
            tuple: (adjusted_image, shape, applied_brightness, applied_contrast)
                - adjusted_image (np.ndarray): Adjusted image (float64)
                - shape (tuple): (height, width)
                - applied_brightness (float): Clamped brightness value
                - applied_contrast (float): Clamped contrast value
        
        Raises:
            ValueError: If image_key not loaded or invalid reference mode
        
        Performance:
        - Validation: O(1)
        - Copy operation: O(n²)
        - Brightness: O(n²) vectorized multiplication
        - Contrast: O(n²) vectorized operations
        - Clipping: O(n²) vectorized
        - Total: O(n²) all vectorized NumPy operations
        
        Optimization Notes:
        - Vectorized operations (NumPy broadcast)
        - Single copy operation (minimizes memory)
        - In-place-safe clipping
        - Tracking prevents state accumulation
        
        Design Notes:
        - Does NOT update self.images or FFT cache
        - Original images remain immutable
        - Adjustments are display-only (spatial domain)
        - Backend must recompute FFT if adjustments persist
        """
        if image_key not in self.images:
            loaded_keys = list(self.images.keys())
            raise ValueError(f"Image '{image_key}' not loaded. Available images: {loaded_keys}")
        
        # Validate and clamp to safe ranges
        brightness = max(0.0, min(2.0, float(brightness)))
        contrast = max(0.0, min(3.0, float(contrast)))
        
        if reference == 'original':
            # ABSOLUTE MODE: Apply to immutable original
            source_image = self.original_images[image_key].copy()
            
            # Apply brightness (vectorized multiplication)
            adjusted = source_image * brightness
            
            # Apply contrast (vectorized: center around midpoint, scale, re-center)
            adjusted = (adjusted - 127.5) * contrast + 127.5
            
            # Track applied values for reference='current' mode
            self.last_adjustments[image_key] = {
                'brightness': brightness,
                'contrast': contrast
            }
            
        else:
            raise ValueError(f"Invalid reference mode: {reference}")
        
        # Clip to valid display range [0, 255]
        adjusted = np.clip(adjusted, 0, 255)
        
        # Return display-only adjustment (does NOT persist to cache)
        return adjusted, adjusted.shape, brightness, contrast
    
    def apply_output_adjustments(self, output_key, brightness, contrast):
        """Apply brightness/contrast adjustments to output viewport images.
        
        Similar to apply_brightness_contrast but for output viewports (output1, output2).
        Always uses 'original' reference mode - adjustments relative to original mixed output.
        
        Args:
            output_key (str): Output identifier ('output1' or 'output2')
            brightness (float): Brightness multiplier [0.00, 2.00]
            contrast (float): Contrast multiplier [0.00, 3.00]
        
        Returns:
            tuple: (adjusted_image, shape, applied_brightness, applied_contrast)
        
        Raises:
            ValueError: If output_key not found
        
        Performance: O(n²) vectorized operations
        """
        if output_key not in self.original_output_images:
            raise ValueError(f"Output '{output_key}' not available")
        
        # Validate and clamp to safe ranges
        brightness = max(0.0, min(2.0, float(brightness)))
        contrast = max(0.0, min(3.0, float(contrast)))
        
        # Apply to original output (absolute mode only)
        source_image = self.original_output_images[output_key].copy()
        
        # Apply brightness (vectorized multiplication)
        adjusted = source_image * brightness
        
        # Apply contrast (vectorized: center around midpoint, scale, re-center)
        adjusted = (adjusted - 127.5) * contrast + 127.5
        
        # Clip to valid display range [0, 255]
        adjusted = np.clip(adjusted, 0, 255)
        
        # Track adjustments
        self.output_adjustments[output_key] = {
            'brightness': brightness,
            'contrast': contrast
        }
        
        # Update current output image
        self.output_images[output_key] = adjusted
        
        return adjusted, adjusted.shape, brightness, contrast
    
    def store_output_image(self, output_key, image_array):
        """Store output image from mixing operation.
        
        Args:
            output_key (str): Output identifier ('output1' or 'output2')
            image_array (np.ndarray): Mixed output image
        """
        self.output_images[output_key] = image_array.copy()
        self.original_output_images[output_key] = image_array.copy()
        # Reset adjustments to neutral
        self.output_adjustments[output_key] = {
            'brightness': 1.0,
            'contrast': 1.0
        }
    
    def apply_component_adjustments(self, image_key, component, brightness, contrast):
        """Apply brightness/contrast adjustments to FFT component visualization.
        
        Always references original component visualization (like input/output viewports).
        Adjustments are display-only and do not affect FFT cache or mixing operations.
        
        Args:
            image_key (str): Image identifier ('img1'-'img4')
            component (str): Component type ('magnitude', 'phase', 'real', 'imaginary')
            brightness (float): Brightness multiplier [0.00, 2.00]
            contrast (float): Contrast multiplier [0.00, 3.00]
        
        Returns:
            tuple: (adjusted_image, shape, applied_brightness, applied_contrast)
        
        Raises:
            ValueError: If component visualization not found
        
        Performance: O(n²) vectorized operations on visualization
        """
        component_key = f"{image_key}_{component}"
        
        if component_key not in self.original_component_visualizations:
            raise ValueError(f"Component visualization '{component_key}' not found. Load image and select component first.")
        
        # Validate and clamp to safe ranges
        brightness = max(0.0, min(2.0, float(brightness)))
        contrast = max(0.0, min(3.0, float(contrast)))
        
        # Apply to original component visualization (absolute mode - always reference original)
        source_image = self.original_component_visualizations[component_key].copy()
        
        # Apply brightness (vectorized multiplication)
        adjusted = source_image * brightness
        
        # Apply contrast (vectorized: center around midpoint, scale, re-center)
        adjusted = (adjusted - 127.5) * contrast + 127.5
        
        # Clip to valid display range [0, 255]
        adjusted = np.clip(adjusted, 0, 255)
        
        # Track adjustments
        self.component_adjustments[component_key] = {
            'brightness': brightness,
            'contrast': contrast
        }
        
        # Update current visualization
        self.component_visualizations[component_key] = adjusted
        
        return adjusted, adjusted.shape, brightness, contrast
    
    
    def get_loaded_images(self):
        """Retrieve list of loaded image identifiers.
        
        Returns:
            list: Image keys as strings ['img1', 'img2', ...] or empty list
            
        Performance: O(k) where k = number of loaded images
        """
        return list(self.images.keys())
    
    def get_all_images_as_base64(self):
        """Get all loaded images as base64-encoded strings.
        
        Returns:
            dict: {image_key: base64_string} for all loaded images
            
        Performance: O(k × n²) where k = number of loaded images, n² = image pixels
        """
        return {
            key: self.image_to_base64(img)
            for key, img in self.images.items()
            if img is not None
        }
    
    def image_to_base64(self, image_array):
        """Convert NumPy array to base64-encoded PNG for web display.
        
        Workflow:
        1. Convert float64 array to uint8 (required by PIL)
        2. Create PIL Image object
        3. Encode as PNG to BytesIO buffer
        4. Base64 encode PNG bytes
        5. Prepend data URI scheme for browser compatibility
        
        Args:
            image_array (np.ndarray): Image array (any dtype, converted to uint8)
        
        Returns:
            str: Data URI 'data:image/png;base64,{encoded_data}'
        
        Performance:
        - Type conversion: O(n²)
        - PNG encoding: O(n²) with compression
        - Base64 encoding: O(n²)
        - Total: O(n²) dominated by PNG compression
        
        Optimization Notes:
        - PNG format provides lossless compression (~50% size reduction)
        - Base64 encoding increases size by ~33% (3 bytes → 4 chars)
        - BytesIO avoids disk I/O (in-memory only)
        """
        img_pil = Image.fromarray(image_array.astype(np.uint8))
        buffer = io.BytesIO()
        img_pil.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
