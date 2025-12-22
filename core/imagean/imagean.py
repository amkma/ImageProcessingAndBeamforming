"""
OOP-based Image Processing System
Complete encapsulation of image processing operations
"""

import numpy as np
from PIL import Image
import io
import base64
from abc import ABC, abstractmethod


class ImageComponent(ABC):
    """Abstract base class for all image components"""
    
    def __init__(self, data, component_type=None):
        self._original = data.copy()
        self._current = data.copy()
        self._component_type = component_type
        self._brightness = 1.0
        self._contrast = 1.0
    
    @property
    def shape(self):
        return self._current.shape
    
    @property
    def current(self):
        return self._current
    
    def apply_adjustments(self, brightness, contrast):
        """Apply brightness/contrast adjustments"""
        self._brightness = max(0.0, min(2.0, float(brightness)))
        self._contrast = max(0.0, min(3.0, float(contrast)))
        
        adjusted = self._original * self._brightness
        adjusted = (adjusted - 127.5) * self._contrast + 127.5
        self._current = np.clip(adjusted, 0, 255)
        
        return self._current
    
    def reset(self):
        """Reset to original state"""
        self._current = self._original.copy()
        self._brightness = 1.0
        self._contrast = 1.0
    
    def to_base64(self):
        """Convert to base64 for display"""
        # For display, ensure values are uint8
        display_data = self._current.astype(np.uint8)
        
        if self._component_type == 'magnitude':
            display_data = np.log(display_data + 1)
            display_data = display_data - display_data.min()
            if display_data.max() > 0:
                display_data = display_data / display_data.max() * 255
        
        img_pil = Image.fromarray(display_data.astype(np.uint8))
        buffer = io.BytesIO()
        img_pil.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
    
    @abstractmethod
    def get_type(self):
        """Get component type"""
        pass


class GrayscaleImage(ImageComponent):
    """Concrete class for grayscale images"""
    
    def __init__(self, image_data):
        super().__init__(image_data, 'grayscale')
        self._fft_components = {}
    
    def get_type(self):
        return 'grayscale'
    
    def compute_fft(self):
        """Compute FFT and create component objects"""
        fft_result = np.fft.fftshift(np.fft.fft2(self._current))
        
        # Create FFT component objects
        self._fft_components = {
            'magnitude': FFTComponent(np.abs(fft_result), 'magnitude'),
            'phase': FFTComponent(np.angle(fft_result), 'phase'),
            'real': FFTComponent(np.real(fft_result), 'real'),
            'imaginary': FFTComponent(np.imag(fft_result), 'imaginary')
        }
        return self._fft_components
    
    def get_fft_component(self, component_name):
        """Get specific FFT component"""
        if component_name not in self._fft_components:
            self.compute_fft()
        return self._fft_components.get(component_name)
    
    def resize(self, target_height, target_width):
        """Resize image to target dimensions"""
        img_pil = Image.fromarray(self._current.astype(np.uint8))
        img_resized = img_pil.resize((target_width, target_height), Image.LANCZOS)
        
        # Update both original and current
        resized_array = np.array(img_resized, dtype=np.float64)
        self._original = resized_array
        self._current = resized_array.copy()
        
        # Clear FFT cache since image changed
        self._fft_components.clear()
        
        return self.shape


class FFTComponent(ImageComponent):
    """Concrete class for FFT components"""
    
    def __init__(self, fft_data, component_type):
        super().__init__(fft_data, component_type)
    
    def get_type(self):
        return self._component_type
    
    def to_base64(self):
        """Special display for FFT components"""
        display_data = self._current.copy()
        
        # Special processing for magnitude
        if self._component_type == 'magnitude':
            display_data = np.log(display_data + 1)
        
        # Normalize for display
        display_min = display_data.min()
        display_max = display_data.max()
        
        if display_max > display_min:
            display_data = (display_data - display_min) / (display_max - display_min) * 255
        else:
            display_data = np.zeros_like(display_data)
        
        img_pil = Image.fromarray(display_data.astype(np.uint8))
        buffer = io.BytesIO()
        img_pil.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"


class ImageViewer:
    """Main controller class - manages all image operations"""
    
    def __init__(self):
        self._images = {}  # Stores GrayscaleImage objects
        self._outputs = {}  # Stores output images
        self._frequency_masks = {}
    
    def load_image(self, image_key, image_source):
        """Load and create GrayscaleImage object"""
        if isinstance(image_source, str):
            img = Image.open(image_source)
        else:
            img = image_source
        
        img_gray = img.convert('L')
        img_array = np.array(img_gray, dtype=np.float64)
        
        # Create GrayscaleImage object
        image_obj = GrayscaleImage(img_array)
        self._images[image_key] = image_obj
        
        return image_obj.shape
    
    def get_image(self, image_key):
        """Get image object by key"""
        return self._images.get(image_key)
    
    def get_all_images(self):
        """Get all loaded image keys"""
        return list(self._images.keys())
    
    def get_image_base64(self, image_key):
        """Get image as base64"""
        image_obj = self.get_image(image_key)
        if image_obj:
            return image_obj.to_base64()
        return None
    
    def resize_all_to_smallest(self):
        """Resize all images to smallest dimensions"""
        if not self._images:
            return None
        
        # Find smallest dimensions
        shapes = [img.shape for img in self._images.values()]
        min_height = min(h for h, w in shapes)
        min_width = min(w for h, w in shapes)
        
        # Resize all images
        for image_obj in self._images.values():
            image_obj.resize(min_height, min_width)
        
        return (min_height, min_width)
    
    def get_fft_component_visualization(self, image_key, component='magnitude'):
        """Get FFT component visualization"""
        image_obj = self.get_image(image_key)
        if not image_obj:
            raise ValueError(f"Image '{image_key}' not found")
        
        fft_component = image_obj.get_fft_component(component)
        if not fft_component:
            raise ValueError(f"Component '{component}' not found")
        
        return fft_component.to_base64()
    
    def mix_images(self, modes, weights_a, weights_b, region_params):
        """Frequency domain mixing"""
        if not self._images:
            raise ValueError("No images loaded")
        
        # Get reference image for dimensions
        first_key = next(iter(self._images.keys()))
        ref_image = self._images[first_key]
        h, w = ref_image.shape
        
        # Create frequency mask
        frequency_mask = self._create_frequency_mask((h, w), region_params)
        
        mixed_comp_1 = np.zeros((h, w), dtype=np.float64)
        mixed_comp_2 = np.zeros((h, w), dtype=np.float64)
        
        all_keys = set(weights_a.keys()) | set(weights_b.keys())
        
        for key in all_keys:
            if key not in self._images:
                continue
            
            image_obj = self._images[key]
            mode = modes.get(key, 'magnitude_phase')
            wa = weights_a.get(key, 0.0)
            wb = weights_b.get(key, 0.0)
            
            if wa == 0.0 and wb == 0.0:
                continue
            
            # Compute FFT
            fft_result = np.fft.fftshift(np.fft.fft2(image_obj.current))
            
            if mode == 'magnitude_phase':
                comp_1 = np.abs(fft_result)
                comp_2 = np.angle(fft_result)
            else:
                comp_1 = np.real(fft_result)
                comp_2 = np.imag(fft_result)
            
            comp_1 *= frequency_mask
            comp_2 *= frequency_mask
            
            mixed_comp_1 += comp_1 * wa
            mixed_comp_2 += comp_2 * wb
        
        # Reconstruct
        output_mode = modes.get(first_key, 'magnitude_phase')
        if output_mode == 'magnitude_phase':
            combined_fft = mixed_comp_1 * np.exp(1j * mixed_comp_2)
        else:
            combined_fft = mixed_comp_1 + 1j * mixed_comp_2
        
        # Inverse FFT
        combined_fft_ishift = np.fft.ifftshift(combined_fft)
        img_back = np.fft.ifft2(combined_fft_ishift)
        img_back = np.abs(img_back)
        np.clip(img_back, 0, 255, out=img_back)
        
        return img_back.astype(np.uint8)
    
    def _create_frequency_mask(self, shape, region_params):
        """Create frequency domain mask"""
        height, width = shape
        
        norm_x = region_params.get('x', 0.25)
        norm_y = region_params.get('y', 0.25)
        norm_width = region_params.get('width', 0.5)
        norm_height = region_params.get('height', 0.5)
        
        x_start = int(norm_x * width)
        y_start = int(norm_y * height)
        x_end = min(x_start + int(norm_width * width), width)
        y_end = min(y_start + int(norm_height * height), height)
        
        mask_type = region_params.get('type', 'inner')
        
        if mask_type == 'inner':
            mask = np.zeros(shape, dtype=np.float64)
            mask[y_start:y_end, x_start:x_end] = 1.0
        else:
            mask = np.ones(shape, dtype=np.float64)
            mask[y_start:y_end, x_start:x_end] = 0.0
        
        return mask
    
    def apply_brightness_contrast(self, image_key, brightness, contrast):
        """Apply adjustments to input image"""
        image_obj = self.get_image(image_key)
        if not image_obj:
            raise ValueError(f"Image '{image_key}' not found")
        
        adjusted = image_obj.apply_adjustments(brightness, contrast)
        return adjusted, adjusted.shape, image_obj._brightness, image_obj._contrast
    
    def store_output_image(self, output_key, image_array):
        """Store output image as GrayscaleImage object"""
        output_image = GrayscaleImage(image_array)
        self._outputs[output_key] = output_image
    
    def get_output_image(self, output_key):
        """Get output image object"""
        return self._outputs.get(output_key)
    
    def apply_output_adjustments(self, output_key, brightness, contrast):
        """Apply adjustments to output image"""
        output_obj = self.get_output_image(output_key)
        if not output_obj:
            raise ValueError(f"Output '{output_key}' not found")
        
        adjusted = output_obj.apply_adjustments(brightness, contrast)
        return adjusted, adjusted.shape, output_obj._brightness, output_obj._contrast
    
    def apply_component_adjustments(self, image_key, component, brightness, contrast):
        """Apply adjustments to FFT component"""
        image_obj = self.get_image(image_key)
        if not image_obj:
            raise ValueError(f"Image '{image_key}' not found")
        
        fft_component = image_obj.get_fft_component(component)
        if not fft_component:
            raise ValueError(f"Component '{component}' not found")
        
        adjusted = fft_component.apply_adjustments(brightness, contrast)
        return adjusted, adjusted.shape, fft_component._brightness, fft_component._contrast
    
    def clear_all(self):
        """Clear all images"""
        self._images.clear()
        self._outputs.clear()
        self._frequency_masks.clear()