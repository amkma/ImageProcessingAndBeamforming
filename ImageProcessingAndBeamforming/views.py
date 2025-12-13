from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import json
from core.imagean.imagean import ImageViewer

# Global instance to persist images across requests
viewer = ImageViewer()


def image(request):
    """Serve main index page."""
    return render(request, 'image.html')


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
    Mix images using dual-component weighting.
    POST params:
        - modes: dict {image_key: mode} where mode is 'magnitude_phase' or 'real_imaginary'
        - weights_a: dict {image_key: weight} for component A
        - weights_b: dict {image_key: weight} for component B
        - filter: dict with 'mode' and 'rect' [optional]
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        modes = data.get('modes', {})
        weights_a = data.get('weights_a', {})
        weights_b = data.get('weights_b', {})
        filter_params = data.get('filter', None)

        if not weights_a and not weights_b:
            return JsonResponse({'error': 'No weights provided'}, status=400)

        # Perform mixing
        output_image = viewer.mix_images(modes, weights_a, weights_b, filter_params)
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
    Supports both absolute (original) and relative (current) reference modes.
    POST params:
        - image_key: identifier
        - brightness: multiplier value (0.00 to 2.00, default 1.00)
        - contrast: multiplier value (0.00 to 3.00, default 1.00)
        - reference: 'original' (absolute), 'current' (relative delta), or 'output' for output images
        - image_data: (optional) base64 image data for output adjustments
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))
        reference = data.get('reference', 'original')
        image_data = data.get('image_data')

        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Validate reference mode
        if reference not in ['original', 'current', 'output']:
            return JsonResponse({'error': 'Invalid reference mode'}, status=400)

        # Handle output image adjustments
        if reference == 'output':
            if not image_data:
                return JsonResponse({'error': 'Missing image_data for output adjustment'}, status=400)

            # Decode base64 image
            import base64
            import io
            from PIL import Image, ImageEnhance
            import numpy as np

            # Remove data URL prefix if present
            if 'base64,' in image_data:
                image_data = image_data.split('base64,')[1]

            img_bytes = base64.b64decode(image_data)
            img = Image.open(io.BytesIO(img_bytes))

            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Apply brightness
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(brightness)

            # Apply contrast
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(contrast)

            # Convert back to base64
            adjusted_base64 = viewer.image_to_base64(np.array(img))

            return JsonResponse({
                'success': True,
                'image_key': image_key,
                'adjusted_image': adjusted_base64,
                'applied_brightness': brightness,
                'applied_contrast': contrast,
                'reference': reference
            })

        # Apply adjustments to input images and recalculate FFT
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_brightness_contrast(
            image_key, brightness, contrast, reference
        )

        # Convert to base64 for display
        adjusted_base64 = viewer.image_to_base64(adjusted_image)

        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'adjusted_image': adjusted_base64,
            'shape': shape,
            'applied_brightness': applied_brightness,
            'applied_contrast': applied_contrast,
            'reference': reference
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