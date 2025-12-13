import numpy as np
from PIL import Image
import io
import base64


class ImageViewer:
    def __init__(self):
        self.images = {}  # Store up to 4 currently displayed images
        self.original_images = {}  # Store original uploaded images (before adjustments)
        self.last_adjustments = {}  # Track last-applied brightness/contrast for each image
        self.fft_cache = {}  # Cache FFT results
        
    def load_image(self, image_key, image_data):
        """
        Load image and force convert to grayscale immediately.
        Pre-computes FFT and all components for instant access.
        
        Args:
            image_key: Identifier for the image (e.g., 'img1', 'img2', 'img3', 'img4')
            image_data: PIL Image object or file path
        """
        if isinstance(image_data, str):
            img = Image.open(image_data)
        else:
            img = image_data
            
        # FORCED GRAYSCALE CONVERSION - No color images allowed
        img_gray = img.convert('L')
        img_array = np.array(img_gray, dtype=np.float64)
        
        # Store ORIGINAL for reference=original mode
        self.original_images[image_key] = img_array.copy()
        
        # Store current display image
        self.images[image_key] = img_array
        
        # Initialize adjustment tracking (brightness=1.0, contrast=1.0)
        self.last_adjustments[image_key] = {'brightness': 1.0, 'contrast': 1.0}
        
        # PRE-COMPUTE FFT immediately upon upload
        fft_result = np.fft.fftshift(np.fft.fft2(self.images[image_key]))
        self.fft_cache[image_key] = {
            'fft': fft_result,
            'magnitude': np.abs(fft_result),
            'phase': np.angle(fft_result),
            'real': np.real(fft_result),
            'imaginary': np.imag(fft_result)
        }
            
        return self.images[image_key].shape
    
    def check_and_resize_to_smallest(self):
        """
        Check dimensions of all loaded images and resize them to match 
        the smallest image's dimensions. Recomputes FFT for resized images.
        
        Returns:
            tuple: (height, width) of the smallest dimensions
        """
        if len(self.images) == 0:
            return None
            
        # Find smallest dimensions
        min_height = min(img.shape[0] for img in self.images.values())
        min_width = min(img.shape[1] for img in self.images.values())
        
        # Resize all images to smallest dimensions
        for key in self.images:
            if self.images[key].shape != (min_height, min_width):
                # Resize current display image
                img_pil = Image.fromarray(self.images[key].astype(np.uint8))
                img_resized = img_pil.resize((min_width, min_height), Image.LANCZOS)
                self.images[key] = np.array(img_resized, dtype=np.float64)
                
                # Also resize original image
                if key in self.original_images:
                    orig_pil = Image.fromarray(self.original_images[key].astype(np.uint8))
                    orig_resized = orig_pil.resize((min_width, min_height), Image.LANCZOS)
                    self.original_images[key] = np.array(orig_resized, dtype=np.float64)
                
                # RECOMPUTE FFT after resizing
                fft_result = np.fft.fftshift(np.fft.fft2(self.images[key]))
                self.fft_cache[key] = {
                    'fft': fft_result,
                    'magnitude': np.abs(fft_result),
                    'phase': np.angle(fft_result),
                    'real': np.real(fft_result),
                    'imaginary': np.imag(fft_result)
                }
        
        return (min_height, min_width)
    
    def _get_fft(self, image_key):
        """
        Get FFT of an image (pre-computed and cached).
        
        Args:
            image_key: Identifier for the image
            
        Returns:
            dict: Cached FFT and all components
        """
        if image_key not in self.images:
            raise ValueError(f"Image '{image_key}' not loaded")
            
        if image_key not in self.fft_cache:
            raise ValueError(f"FFT not computed for '{image_key}'")
            
        return self.fft_cache[image_key]
    
    def get_magnitude(self, image_key):
        """
        Return the magnitude component of the Fourier Transform.
        
        Args:
            image_key: Identifier for the image
            
        Returns:
            numpy.ndarray: Magnitude spectrum
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['magnitude']
    
    def get_phase(self, image_key):
        """
        Return the phase component of the Fourier Transform.
        
        Args:
            image_key: Identifier for the image
            
        Returns:
            numpy.ndarray: Phase spectrum in radians
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['phase']
    
    def get_real(self, image_key):
        """
        Return the real component of the Fourier Transform.
        
        Args:
            image_key: Identifier for the image
            
        Returns:
            numpy.ndarray: Real component
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['real']
    
    def get_imaginary(self, image_key):
        """
        Return the imaginary component of the Fourier Transform.
        
        Args:
            image_key: Identifier for the image
            
        Returns:
            numpy.ndarray: Imaginary component
        """
        fft_cache = self._get_fft(image_key)
        return fft_cache['imaginary']
    
    def mix_images(self, modes, weights_a, weights_b, filter_params=None):
        """
        Core logic to mix images in frequency domain.
        'weights_a' controls Component 1 (Magnitude or Real).
        'weights_b' controls Component 2 (Phase or Imaginary).
        """
        
        # 1. Get the shape from the first image in the request to initialize accumulators
        if not weights_a:
            return None
            
        first_key = next(iter(weights_a.keys()))
        if first_key not in self.original_images:
            # Try to find any valid key
            valid_keys = [k for k in weights_a.keys() if k in self.original_images]
            if not valid_keys:
                return None
            first_key = valid_keys[0]
            
        # Use original images for all processing (ignore display adjustments)
        ref_img = self.original_images[first_key] 
        h, w = ref_img.shape
        
        # Accumulators for the two mixed components
        mixed_comp_1 = np.zeros((h, w), dtype=np.float64)
        mixed_comp_2 = np.zeros((h, w), dtype=np.float64)
        
        # We need to track the common mode to decide how to reconstruct (Rectangular vs Polar)
        # Default to the mode of the first image
        output_mode = modes.get(first_key, 'magnitude_phase')

        # 2. Iterate through all images involved in mixing
        # We union keys to ensure we catch images that might only have a weight in A or B
        all_keys = set(weights_a.keys()) | set(weights_b.keys())

        for key in all_keys:
            if key not in self.original_images:
                continue
                
            # Get raw ORIGINAL image and compute FFT (ignore display adjustments)
            img_data = self.original_images[key]
            fft_data = np.fft.fft2(img_data)
            
            # Apply FFT Shift (centers low frequencies)
            fft_shifted = np.fft.fftshift(fft_data)

            # Get the mode for this specific image
            mode = modes.get(key, 'magnitude_phase')
            
            # Get weights (default to 0.0 if not present)
            wa = weights_a.get(key, 0.0)
            wb = weights_b.get(key, 0.0)

            # 3. Extract Components based on Mode
            if mode == 'magnitude_phase':
                # Comp 1: Magnitude, Comp 2: Phase
                # CRITICAL: Use raw np.abs, DO NOT use log scale here!
                comp_1 = np.abs(fft_shifted)
                comp_2 = np.angle(fft_shifted)
                
                # If the main output mode is Real/Imag but this image is Mag/Phase, 
                # mixing them directly is mathematically invalid. 
                # This code assumes consistency across inputs (as per your prompt).
                
            elif mode == 'real_imaginary':
                # Comp 1: Real, Comp 2: Imaginary
                comp_1 = np.real(fft_shifted)
                comp_2 = np.imag(fft_shifted)
            
            # 4. Accumulate Weighted Components
            mixed_comp_1 += comp_1 * wa
            mixed_comp_2 += comp_2 * wb

        # 5. Reconstruct the Mixed FFT
        # This depends on the mode we are operating in.
        if output_mode == 'magnitude_phase':
            # Polar Reconstruction: Mag * e^(j*Phase)
            combined_fft = mixed_comp_1 * np.exp(1j * mixed_comp_2)
        else:
            # Rectangular Reconstruction: Real + j*Imag
            combined_fft = mixed_comp_1 + 1j * mixed_comp_2

        # 6. Inverse FFT
        # Inverse Shift first
        combined_fft_ishift = np.fft.ifftshift(combined_fft)
        
        # Inverse FFT to get image space
        img_back = np.fft.ifft2(combined_fft_ishift)
        
        # Magnitude of complex result (removes residual imaginary parts)
        img_back = np.abs(img_back)
        
        # 7. Normalize for Display (0-255)
        # This ensures the output is a valid image format
        img_back = np.clip(img_back, 0, 255).astype(np.uint8)
        
        return img_back
    
    def _create_frequency_mask(self, shape, mode, rect_coords):
        """
        Create a binary frequency mask for filtering based on rectangle coordinates.
        
        Args:
            shape: tuple (height, width) of the frequency domain
            mode: 'inner' (keep low frequencies) or 'outer' (keep high frequencies)
            rect_coords: dict with 'x', 'y', 'width', 'height' in normalized coordinates (0-1)
            
        Returns:
            numpy.ndarray: Binary mask (1.0 where frequencies are kept, 0.0 where rejected)
        """
        height, width = shape
        
        # Extract normalized coordinates (0-1 range)
        norm_x = rect_coords.get('x', 0.25)
        norm_y = rect_coords.get('y', 0.25)
        norm_width = rect_coords.get('width', 0.5)
        norm_height = rect_coords.get('height', 0.5)
        
        # Convert to pixel coordinates
        x_start = int(norm_x * width)
        y_start = int(norm_y * height)
        rect_width = int(norm_width * width)
        rect_height = int(norm_height * height)
        
        # Calculate end coordinates
        x_end = x_start + rect_width
        y_end = y_start + rect_height
        
        # Ensure bounds are within image
        x_start = max(0, min(x_start, width))
        y_start = max(0, min(y_start, height))
        x_end = max(0, min(x_end, width))
        y_end = max(0, min(y_end, height))
        
        # Ensure minimum size
        if x_end <= x_start:
            x_end = x_start + 1
        if y_end <= y_start:
            y_end = y_start + 1
        
        # Create binary mask
        mask = np.zeros(shape, dtype=np.float64)
        
        if mode == 'inner':
            # Keep inner rectangle (selected region), reject outer
            mask[y_start:y_end, x_start:x_end] = 1.0
        else:  # mode == 'outer'
            # Keep outer region, reject inner rectangle
            mask[:, :] = 1.0
            mask[y_start:y_end, x_start:x_end] = 0.0
        
        return mask
    
    def apply_brightness_contrast(self, image_key, brightness, contrast, reference='original'):
        """
        Apply brightness and contrast adjustments with support for absolute and relative modes.
        
        Brightness: multiplier clamped to 0.00-2.00 (default 1.00)
        Contrast: multiplier clamped to 0.00-3.00 (default 1.00)
        
        Args:
            image_key: Identifier for the image
            brightness: Brightness multiplier (0.00 to 2.00)
            contrast: Contrast multiplier (0.00 to 3.00)
            reference: 'original' (absolute) or 'current' (relative delta)
        
        Returns:
            tuple: (adjusted_image, shape, applied_brightness, applied_contrast)
        """
        if image_key not in self.images:
            loaded_keys = list(self.images.keys())
            raise ValueError(f"Image '{image_key}' not loaded. Available images: {loaded_keys}")
        
        # VALIDATE AND CLAMP incoming values
        brightness = max(0.0, min(2.0, float(brightness)))
        contrast = max(0.0, min(3.0, float(contrast)))
        
        if reference == 'original':
            # ABSOLUTE MODE: Apply to original image
            source_image = self.original_images[image_key].copy()
            
            # Apply brightness (multiplier)
            adjusted = source_image * brightness
            
            # Apply contrast (scale around midpoint 127.5)
            adjusted = (adjusted - 127.5) * contrast + 127.5
            
            # Update last-applied values
            self.last_adjustments[image_key] = {
                'brightness': brightness,
                'contrast': contrast
            }
            
        elif reference == 'current':
            # RELATIVE MODE: Apply delta from last-applied value
            last_b = self.last_adjustments[image_key]['brightness']
            last_c = self.last_adjustments[image_key]['contrast']
            
            # Calculate deltas
            delta_brightness = brightness - last_b
            delta_contrast = contrast - last_c
            
            # Start from currently displayed image
            source_image = self.images[image_key].copy()
            
            # Apply deltas
            # For brightness: multiply by (new/old) ratio
            if last_b > 0:
                adjusted = source_image * (brightness / last_b)
            else:
                adjusted = source_image * brightness
            
            # For contrast: apply additional contrast scaling
            if last_c > 0:
                adjusted = (adjusted - 127.5) * (contrast / last_c) + 127.5
            else:
                adjusted = (adjusted - 127.5) * contrast + 127.5
            
            # Update last-applied values
            self.last_adjustments[image_key] = {
                'brightness': brightness,
                'contrast': contrast
            }
        else:
            raise ValueError(f"Invalid reference mode: {reference}")
        
        # CLIP to valid range
        adjusted = np.clip(adjusted, 0, 255)
        
        # Display-only adjustment - do NOT update self.images or FFT cache
        # All processing uses original images
        
        return adjusted, adjusted.shape, brightness, contrast
    
    def clear_images(self):
        """Clear all loaded images, originals, adjustments, and cache."""
        self.images.clear()
        self.original_images.clear()
        self.last_adjustments.clear()
        self.fft_cache.clear()
    
    def get_loaded_images(self):
        """Return list of loaded image keys."""
        return list(self.images.keys())
    
    def image_to_base64(self, image_array):
        """Convert numpy array to base64 string for web display."""
        img_pil = Image.fromarray(image_array.astype(np.uint8))
        buffer = io.BytesIO()
        img_pil.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
