import numpy as np
from PIL import Image
import io
import base64


class ImageViewer:
    def __init__(self):
        self.images = {}  # Store up to 4 images
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
        self.images[image_key] = np.array(img_gray, dtype=np.float64)
        
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
                img_pil = Image.fromarray(self.images[key].astype(np.uint8))
                img_resized = img_pil.resize((min_width, min_height), Image.LANCZOS)
                self.images[key] = np.array(img_resized, dtype=np.float64)
                
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
    
    def mix_images(self, weights, component_selections, filter_params=None):
        """
        Mix FFTs using STRICT COMPONENT-AWARE ALGORITHM with FREQUENCY DOMAIN FILTERING:
        1. Normalize weights to sum to 1.0
        2. Determine mixing mode based on selected components
        3. For Magnitude/Phase mode: compute weighted averages separately, reconstruct via Magnitude * exp(j*Phase)
        4. For Real/Imaginary mode: compute weighted averages separately, reconstruct via Real + j*Imaginary
        5. APPLY FREQUENCY FILTER MASK to weighted components (before summation)
        6. Apply IFFT to reconstructed complex FFT
        7. Clip to 0-255 range
        
        Args:
            weights: dict of {image_key: weight_value} - raw weight values (0-1)
            component_selections: dict of {image_key: component_type}
                component_type can be 'magnitude', 'phase', 'real', 'imaginary'
            filter_params: dict with 'mode' ('inner' or 'outer'), 'size' (0-100)
                
        Returns:
            numpy.ndarray: Mixed output image (uint8)
        """
        if len(self.images) == 0:
            raise ValueError("No images loaded")
        
        # STEP 1: NORMALIZE WEIGHTS to sum to 1.0
        valid_weights = {k: v for k, v in weights.items() if k in self.images and v > 0}
        if not valid_weights:
            shape = next(iter(self.images.values())).shape
            return np.zeros(shape, dtype=np.uint8)
        
        total_weight = sum(valid_weights.values())
        if total_weight > 0:
            normalized_weights = {k: v / total_weight for k, v in valid_weights.items()}
        else:
            normalized_weights = valid_weights
        
        # STEP 2: DETERMINE MIXING MODE - categorize components
        has_magnitude = False
        has_phase = False
        has_real = False
        has_imaginary = False
        
        for image_key in normalized_weights.keys():
            component_type = component_selections.get(image_key, 'magnitude')
            if component_type == 'magnitude':
                has_magnitude = True
            elif component_type == 'phase':
                has_phase = True
            elif component_type == 'real':
                has_real = True
            elif component_type == 'imaginary':
                has_imaginary = True
        
        # Get reference shape
        ref_shape = next(iter(self.images.values())).shape
        
        # CREATE FREQUENCY FILTER MASK if filter parameters provided
        frequency_mask = None
        if filter_params and filter_params.get('rect'):
            frequency_mask = self._create_frequency_mask(
                ref_shape, 
                filter_params.get('mode', 'inner'),
                filter_params.get('rect')
            )
        
        # STEP 3: COMPUTE WEIGHTED AVERAGES FOR SELECTED COMPONENTS
        # Mode 1: Magnitude/Phase (polar form)
        if has_magnitude or has_phase:
            # Calculate weighted average for magnitude
            magnitude_sum = np.zeros(ref_shape, dtype=np.float64)
            magnitude_total_weight = 0.0
            
            for image_key, weight in normalized_weights.items():
                component_type = component_selections.get(image_key, 'magnitude')
                if component_type == 'magnitude':
                    fft_cache = self._get_fft(image_key)
                    component_data = fft_cache['magnitude'] * weight
                    # APPLY FREQUENCY FILTER MASK
                    if frequency_mask is not None:
                        component_data = component_data * frequency_mask
                    magnitude_sum += component_data
                    magnitude_total_weight += weight
            
            # Calculate weighted average for phase
            phase_sum = np.zeros(ref_shape, dtype=np.float64)
            phase_total_weight = 0.0
            
            for image_key, weight in normalized_weights.items():
                component_type = component_selections.get(image_key, 'magnitude')
                if component_type == 'phase':
                    fft_cache = self._get_fft(image_key)
                    component_data = fft_cache['phase'] * weight
                    # APPLY FREQUENCY FILTER MASK
                    if frequency_mask is not None:
                        component_data = component_data * frequency_mask
                    phase_sum += component_data
                    phase_total_weight += weight
            
            # If only magnitude or only phase selected, use first image for missing component
            if magnitude_total_weight == 0:
                first_key = next(iter(normalized_weights.keys()))
                magnitude_sum = self._get_fft(first_key)['magnitude']
            
            if phase_total_weight == 0:
                first_key = next(iter(normalized_weights.keys()))
                phase_sum = self._get_fft(first_key)['phase']
            
            # RECONSTRUCT: Magnitude * exp(j * Phase)
            aggregate_matrix = magnitude_sum * np.exp(1j * phase_sum)
        
        # Mode 2: Real/Imaginary (rectangular form)
        elif has_real or has_imaginary:
            # Calculate weighted average for real
            real_sum = np.zeros(ref_shape, dtype=np.float64)
            real_total_weight = 0.0
            
            for image_key, weight in normalized_weights.items():
                component_type = component_selections.get(image_key, 'magnitude')
                if component_type == 'real':
                    fft_cache = self._get_fft(image_key)
                    component_data = fft_cache['real'] * weight
                    # APPLY FREQUENCY FILTER MASK
                    if frequency_mask is not None:
                        component_data = component_data * frequency_mask
                    real_sum += component_data
                    real_total_weight += weight
            
            # Calculate weighted average for imaginary
            imaginary_sum = np.zeros(ref_shape, dtype=np.float64)
            imaginary_total_weight = 0.0
            
            for image_key, weight in normalized_weights.items():
                component_type = component_selections.get(image_key, 'magnitude')
                if component_type == 'imaginary':
                    fft_cache = self._get_fft(image_key)
                    component_data = fft_cache['imaginary'] * weight
                    # APPLY FREQUENCY FILTER MASK
                    if frequency_mask is not None:
                        component_data = component_data * frequency_mask
                    imaginary_sum += component_data
                    imaginary_total_weight += weight
            
            # RECONSTRUCT: Real + j*Imaginary
            aggregate_matrix = real_sum + 1j * imaginary_sum
        
        else:
            # No valid components - return black
            return np.zeros(ref_shape, dtype=np.uint8)
        
        # STEP 4: Apply IFFT to the reconstructed complex FFT
        # aggregate_matrix is in shifted frequency domain
        # Need to: ifftshift -> ifft2 -> take real part
        
        # Unshift to prepare for IFFT
        aggregate_unshifted = np.fft.ifftshift(aggregate_matrix)
        
        # Perform IFFT
        spatial_complex = np.fft.ifft2(aggregate_unshifted)
        
        # Take real part and handle any numerical errors
        output_image = np.real(spatial_complex)
        output_image = np.abs(output_image)
        
        # STEP 5: Clip to valid range without normalization
        output_image = np.clip(output_image, 0, 255)
        
        return output_image.astype(np.uint8)
    
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
    
    def apply_brightness_contrast(self, image_key, brightness, contrast):
        """
        Apply brightness and contrast adjustments to an image and recalculate FFT.
        This treats the adjusted image as a new input image.
        
        Args:
            image_key: Identifier for the image
            brightness: Brightness adjustment (-1 to 1)
            contrast: Contrast adjustment (0.5 to 2)
        
        Returns:
            tuple: (adjusted_image, shape)
        """
        if image_key not in self.images:
            raise ValueError(f"Image '{image_key}' not loaded")
        
        # Get original image
        original = self.images[image_key].copy()
        
        # Apply adjustments
        # Brightness: add offset
        adjusted = original + (brightness * 255)
        
        # Contrast: scale around midpoint (127.5)
        adjusted = (adjusted - 127.5) * contrast + 127.5
        
        # Clip to valid range
        adjusted = np.clip(adjusted, 0, 255)
        
        # UPDATE the image in place (treat as new input)
        self.images[image_key] = adjusted
        
        # RECALCULATE FFT immediately
        fft_result = np.fft.fftshift(np.fft.fft2(self.images[image_key]))
        self.fft_cache[image_key] = {
            'fft': fft_result,
            'magnitude': np.abs(fft_result),
            'phase': np.angle(fft_result),
            'real': np.real(fft_result),
            'imaginary': np.imag(fft_result)
        }
        
        return adjusted, adjusted.shape
    
    def clear_images(self):
        """Clear all loaded images and cache."""
        self.images.clear()
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
