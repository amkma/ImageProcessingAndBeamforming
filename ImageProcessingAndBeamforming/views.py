from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import json
from core.imagean.imagean import ImageViewer

# Global instance to persist images across requests
viewer = ImageViewer()


def index(request):
    """Serve main index page."""
    return render(request, 'index.html')


@csrf_exempt
def upload_image(request):
    """
    Upload and process an image.
    POST params:
        - image: image file
        - image_key: identifier ('img1', 'img2', 'img3', 'img4')
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        image_file = request.FILES.get('image')
        image_key = request.POST.get('image_key')
        
        if not image_file or not image_key:
            return JsonResponse({'error': 'Missing image or image_key'}, status=400)
        
        # Save temporarily
        file_name = default_storage.save(f'temp_{image_key}.png', ContentFile(image_file.read()))
        file_path = default_storage.path(file_name)
        
        # Load into viewer (converts to grayscale and computes FFT)
        shape = viewer.load_image(image_key, file_path)
        
        # Get the processed grayscale image as base64
        grayscale_image = viewer.image_to_base64(viewer.images[image_key])
        
        # Clean up temp file
        default_storage.delete(file_name)
        
        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'shape': shape,
            'grayscale_image': grayscale_image,
            'loaded_images': viewer.get_loaded_images()
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def resize_images(request):
    """
    Resize all loaded images to smallest dimensions.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        result = viewer.check_and_resize_to_smallest()
        
        if result is None:
            return JsonResponse({'error': 'No images loaded'}, status=400)
        
        return JsonResponse({
            'success': True,
            'dimensions': result,
            'message': f'All images resized to {result[1]}x{result[0]}'
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_fft_component(request):
    """
    Get FFT component of an image.
    POST params:
        - image_key: identifier
        - component: 'magnitude', 'phase', 'real', 'imaginary'
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        component = data.get('component', 'magnitude')
        
        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)
        
        # Get component
        if component == 'magnitude':
            result = viewer.get_magnitude(image_key)
        elif component == 'phase':
            result = viewer.get_phase(image_key)
        elif component == 'real':
            result = viewer.get_real(image_key)
        elif component == 'imaginary':
            result = viewer.get_imaginary(image_key)
        else:
            return JsonResponse({'error': 'Invalid component type'}, status=400)
        
        # Convert to image for display
        import numpy as np
        # Log scale for magnitude, normalize others
        if component == 'magnitude':
            display = np.log(result + 1)
        else:
            display = result
        
        display = display - display.min()
        if display.max() > 0:
            display = display / display.max() * 255
        
        img_base64 = viewer.image_to_base64(display)
        
        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'component': component,
            'image': img_base64
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def mix_images(request):
    """
    Mix images based on weights and component selections with optional frequency filtering.
    POST params:
        - weights: dict {image_key: weight_value}
        - components: dict {image_key: component_type}
        - filter: dict with 'mode' ('inner'/'outer') and 'size' (0-100) [optional]
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        data = json.loads(request.body)
        weights = data.get('weights', {})
        components = data.get('components', {})
        filter_params = data.get('filter', None)
        
        if not weights:
            return JsonResponse({'error': 'No weights provided'}, status=400)
        
        # Perform mixing with optional filtering
        output_image = viewer.mix_images(weights, components, filter_params)
        img_base64 = viewer.image_to_base64(output_image)
        
        return JsonResponse({
            'success': True,
            'output_image': img_base64
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def apply_adjustments(request):
    """
    Apply brightness and contrast adjustments to an image.
    This treats the result as a new input image with recalculated FFT.
    POST params:
        - image_key: identifier
        - brightness: adjustment value (-1 to 1)
        - contrast: adjustment value (0.5 to 2)
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        brightness = float(data.get('brightness', 0))
        contrast = float(data.get('contrast', 1))
        
        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)
        
        # Apply adjustments and recalculate FFT
        adjusted_image, shape = viewer.apply_brightness_contrast(image_key, brightness, contrast)
        
        # Convert to base64 for display
        adjusted_base64 = viewer.image_to_base64(adjusted_image)
        
        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'adjusted_image': adjusted_base64,
            'shape': shape
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def clear_images(request):
    """Clear all loaded images."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)
    
    try:
        viewer.clear_images()
        return JsonResponse({
            'success': True,
            'message': 'All images cleared'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def get_status(request):
    """Get current status of loaded images."""
    try:
        loaded = viewer.get_loaded_images()
        return JsonResponse({
            'success': True,
            'loaded_images': loaded,
            'count': len(loaded)
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
