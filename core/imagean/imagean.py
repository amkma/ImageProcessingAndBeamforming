
import numpy as np
from PIL import Image
import io
import base64


class ImageViewer:

    
    def __init__(self):
        """Initialize empty image viewer with clean state."""
        self.images = {}  # Currently displayed images (post-adjustment)
        self.original_images = {}  # Immutable originals (pre-adjustment)
        self.last_adjustments = {}  # Cumulative brightness/contrast tracking
        self.fft_cache = {}  # Pre-computed FFT components for instant access
        
    def load_image(self, image_key, image_data):
 
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
        self.fft_cache[image_key] = {
            'fft': fft_result,
            'magnitude': np.abs(fft_result),  # Vectorized magnitude
            'phase': np.angle(fft_result),    # Vectorized phase
            'real': np.real(fft_result),      # Vectorized real
            'imaginary': np.imag(fft_result)  # Vectorized imaginary
        }
    
    def check_and_resize_to_smallest(self):
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
       
        if image_key not in self.images:
            raise ValueError(f"Image '{image_key}' not loaded")
            
        if image_key not in self.fft_cache:
            raise ValueError(f"FFT not computed for '{image_key}'")
            
        return self.fft_cache[image_key]
    
    def get_magnitude(self, image_key):
      
        fft_cache = self._get_fft(image_key)
        return fft_cache['magnitude']
    
    def get_phase(self, image_key):
      
        fft_cache = self._get_fft(image_key)
        return fft_cache['phase']
    
    def get_real(self, image_key):
     
        fft_cache = self._get_fft(image_key)
        return fft_cache['real']
    
    def get_imaginary(self, image_key):
      
        fft_cache = self._get_fft(image_key)
        return fft_cache['imaginary']
    
    def mix_images(self, modes, weights_a, weights_b, region_params):
       
        # Early return: validate weights provided
        if not weights_a:
            return None
            
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
            
        elif reference == 'current':
            # RELATIVE MODE: Apply delta from last-applied values
            last_b = self.last_adjustments[image_key]['brightness']
            last_c = self.last_adjustments[image_key]['contrast']
            
            # Start from current displayed state
            source_image = self.images[image_key].copy()
            
            # Apply brightness delta (ratio-based to avoid compounding)
            if last_b > 0:
                adjusted = source_image * (brightness / last_b)
            else:
                adjusted = source_image * brightness
            
            # Apply contrast delta (ratio-based)
            if last_c > 0:
                adjusted = (adjusted - 127.5) * (contrast / last_c) + 127.5
            else:
                adjusted = (adjusted - 127.5) * contrast + 127.5
            
            # Track new cumulative values
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
    
    def clear_images(self):
      
        self.images.clear()
        self.original_images.clear()
        self.last_adjustments.clear()
        self.fft_cache.clear()
    
    def get_loaded_images(self):
       
        return list(self.images.keys())
    
    def image_to_base64(self, image_array):
       
        img_pil = Image.fromarray(image_array.astype(np.uint8))
        buffer = io.BytesIO()
        img_pil.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"