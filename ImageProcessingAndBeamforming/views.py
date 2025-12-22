"""
Refactored Views - Pure Controllers using OOP ImageViewer
"""

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import json
from core.imagean.imagean import ImageViewer

# =============================================================================
# SINGLETON IMAGE VIEWER
# =============================================================================

# Create a single instance of ImageViewer
viewer = ImageViewer()


# =============================================================================
# PAGE RENDERING VIEWS
# =============================================================================

def home(request):
    """Render home page"""
    return render(request, 'home.html')


def image(request):
    """Render image processing interface"""
    return render(request, 'image.html')


def beamforming(request):
    """Render beamforming interface"""
    return render(request, 'beamforman.html')


# =============================================================================
# IMAGE PROCESSING API CONTROLLERS
# =============================================================================

@csrf_exempt
def upload_image(request):
    """Upload and process image"""
    try:
        image_file = request.FILES.get('image')
        image_key = request.POST.get('image_key')

        if not image_file or not image_key:
            return JsonResponse({'error': 'Missing image or image_key'}, status=400)

        # Save temporarily
        file_name = default_storage.save(f'temp_{image_key}.png', ContentFile(image_file.read()))
        file_path = default_storage.path(file_name)

        # Delegate to ImageViewer
        shape = viewer.load_image(image_key, file_path)
        grayscale_image = viewer.get_image_base64(image_key)

        # Cleanup
        default_storage.delete(file_name)

        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'shape': shape,
            'grayscale_image': grayscale_image,
            'loaded_images': viewer.get_all_images()
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def resize_images(request):
    """Resize all images to smallest dimensions"""
    try:
        result = viewer.resize_all_to_smallest()

        if result is None:
            return JsonResponse({'error': 'No images loaded'}, status=400)

        # Get all images as base64
        images = {}
        for key in viewer.get_all_images():
            images[key] = viewer.get_image_base64(key)

        return JsonResponse({
            'success': True,
            'dimensions': result,
            'images': images,
            'message': f'All images resized to {result[1]}x{result[0]}'
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_fft_component(request):
    """Get FFT component visualization"""
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        component = data.get('component', 'magnitude')

        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Delegate to ImageViewer
        img_base64 = viewer.get_fft_component_visualization(image_key, component)

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
    """Mix images in frequency domain"""
    try:
        data = json.loads(request.body)
        modes = data.get('modes', {})
        weights_a = data.get('weights_a', {})
        weights_b = data.get('weights_b', {})
        region_params = data.get('region', {
            'x': 0, 'y': 0, 'width': 1.0, 'height': 1.0, 'type': 'inner'
        })

        if not weights_a and not weights_b:
            return JsonResponse({'error': 'No weights provided'}, status=400)

        # Delegate mixing to ImageViewer
        output_image = viewer.mix_images(modes, weights_a, weights_b, region_params)
        
        # Store output
        output_key = data.get('output_key', 'output1')
        viewer.store_output_image(output_key, output_image)
        
        # Convert to base64
        output_obj = viewer.get_output_image(output_key)
        img_base64 = output_obj.to_base64() if output_obj else None

        return JsonResponse({
            'success': True,
            'output_image': img_base64
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def apply_adjustments(request):
    """Apply brightness/contrast to input image"""
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))

        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Delegate to ImageViewer
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_brightness_contrast(
            image_key, brightness, contrast
        )

        adjusted_base64 = viewer.get_image_base64(image_key)

        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'adjusted_image': adjusted_base64,
            'shape': shape,
            'applied_brightness': applied_brightness,
            'applied_contrast': applied_contrast
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def apply_output_adjustments(request):
    """Apply brightness/contrast to output image"""
    try:
        data = json.loads(request.body)
        output_key = data.get('output_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))

        if not output_key:
            return JsonResponse({'error': 'Missing output_key'}, status=400)

        # Delegate to ImageViewer
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_output_adjustments(
            output_key, brightness, contrast
        )

        # Get base64 from output object
        output_obj = viewer.get_output_image(output_key)
        adjusted_base64 = output_obj.to_base64() if output_obj else None

        return JsonResponse({
            'success': True,
            'output_key': output_key,
            'adjusted_image': adjusted_base64,
            'shape': shape,
            'applied_brightness': applied_brightness,
            'applied_contrast': applied_contrast
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def apply_component_adjustments(request):
    """Apply brightness/contrast to FFT component"""
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        component = data.get('component')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))

        if not image_key or not component:
            return JsonResponse({'error': 'Missing image_key or component'}, status=400)

        # Delegate to ImageViewer
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_component_adjustments(
            image_key, component, brightness, contrast
        )

        # Get component visualization
        component_base64 = viewer.get_fft_component_visualization(image_key, component)

        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'component': component,
            'adjusted_image': component_base64,
            'shape': shape,
            'applied_brightness': applied_brightness,
            'applied_contrast': applied_contrast
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def clear_images(request):
    """Clear all images"""
    try:
        viewer.clear_all()
        return JsonResponse({'success': True, 'message': 'All images cleared'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def get_status(request):
    """Get current status"""
    try:
        return JsonResponse({
            'success': True,
            'images': viewer.get_all_images(),
            'count': len(viewer.get_all_images())
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)