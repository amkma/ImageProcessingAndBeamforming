"""Image Processing API Views - Controller Layer

RESTful API endpoints acting as thin controllers for Fourier Transform operations.

Architecture:
- Pure controller pattern: Parse HTTP → Call ImageViewer → Return JSON
- All business logic resides in core.imagean.imagean.ImageViewer
- Session persistence via global ImageViewer instance
- CSRF exemption for same-origin API endpoints

Endpoints:
    /api/upload/          - Upload and process images
    /api/resize/          - Enforce unified dimensions
    /api/fft/             - Retrieve FFT component visualizations
    /api/mix/             - Perform frequency domain mixing
    /api/apply-adjustments/ - Apply brightness/contrast
    /api/clear/           - Clear session state
    /api/status/          - Get loaded images inventory

Design Principle:
Views contain ZERO business logic. All processing, computation, and formatting
occurs in ImageViewer methods. Views strictly handle:
1. HTTP request parsing
2. Parameter validation
3. ImageViewer method invocation
4. JSON response construction
"""

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import json
from core.imagean.imagean import ImageViewer

# =============================================================================
# SESSION STATE MANAGEMENT
# =============================================================================

# Global ImageViewer instance persists images across API requests
# WARNING: Not suitable for production multi-user deployment
# TODO: Migrate to session-based or database-backed storage for production
viewer = ImageViewer()


# =============================================================================
# PAGE RENDERING VIEWS
# =============================================================================

def home(request):
    """
    Render landing page with application selection cards.
    
    Returns:
        HttpResponse: Rendered home.html template
    """
    return render(request, 'home.html')


def image(request):
    """
    Render Image Processing application interface.
    
    Features:
    - 4 input image slots with FFT component visualization
    - Per-image mixing mode selection (magnitude/phase or real/imaginary)
    - Frequency domain filtering with interactive rectangle
    - 2 output viewports for result comparison
    
    Returns:
        HttpResponse: Rendered image.html template
    """
    return render(request, 'image.html')


# =============================================================================
# IMAGE UPLOAD AND PROCESSING API
# =============================================================================

@csrf_exempt
def upload_image(request):
    """Upload image file and process for frequency domain operations.
    
    Controller: Parses HTTP request, delegates to ImageViewer, returns JSON response.
    
    POST Parameters:
        - image (file): Image file (any format supported by PIL)
        - image_key (str): Identifier ('img1', 'img2', 'img3', or 'img4')
    
    Returns:
        JsonResponse with success status and grayscale image data
    """
    try:
        image_file = request.FILES.get('image')
        image_key = request.POST.get('image_key')

        if not image_file or not image_key:
            return JsonResponse({'error': 'Missing image or image_key'}, status=400)

        # Save to temporary storage
        file_name = default_storage.save(f'temp_{image_key}.png', ContentFile(image_file.read()))
        file_path = default_storage.path(file_name)

        # Delegate to ImageViewer for processing
        shape = viewer.load_image(image_key, file_path)
        grayscale_image = viewer.image_to_base64(viewer.images[image_key])

        # Cleanup
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
    """Enforce unified image dimensions across all loaded images.
    
    Controller: Delegates dimension enforcement to ImageViewer, returns updated images.
    
    Returns:
        JsonResponse with success status, new dimensions, and updated base64 images
    """
    try:
        result = viewer.check_and_resize_to_smallest()

        if result is None:
            return JsonResponse({'error': 'No images loaded'}, status=400)

        # Return resized images directly to avoid redundant fetches
        images = viewer.get_all_images_as_base64()

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
    """Retrieve and visualize FFT components from pre-computed cache.
    
    Controller: Parses request, delegates to ImageViewer for visualization.
    
    POST Parameters:
        - image_key (str): Image identifier ('img1'-'img4')
        - component (str): 'magnitude', 'phase', 'real', or 'imaginary'
    
    Returns:
        JsonResponse with base64-encoded visualized component
    """
    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        component = data.get('component', 'magnitude')

        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Delegate to ImageViewer for component visualization
        img_base64 = viewer.get_fft_component_visualization(image_key, component)

        return JsonResponse({
            'success': True,
            'image_key': image_key,
            'component': component,
            'image': img_base64
        })

    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def mix_images(request):
    """Frequency domain mixing with Inverse FFT.
    
    Controller: Parses mixing parameters, delegates to ImageViewer.
    
    POST Parameters:
        - modes (dict): {image_key: 'magnitude_phase' or 'real_imaginary'}
        - weights_a (dict): {image_key: weight_float [0.0-1.0]}
        - weights_b (dict): {image_key: weight_float [0.0-1.0]}
        - region (dict): {x, y, width, height, type: 'inner'/'outer'}
    
    Returns:
        JsonResponse with base64-encoded mixed output image
    """
    try:
        data = json.loads(request.body)
        modes = data.get('modes', {})
        weights_a = data.get('weights_a', {})
        weights_b = data.get('weights_b', {})
        region_params = data.get('region', {'x': 0, 'y': 0, 'width': 1.0, 'height': 1.0, 'type': 'inner'})

        if not weights_a and not weights_b:
            return JsonResponse({'error': 'No weights provided'}, status=400)

        # Delegate to ImageViewer for frequency domain mixing
        output_image = viewer.mix_images(modes, weights_a, weights_b, region_params)
        
        # Determine output key from request or default to output1
        output_key = data.get('output_key', 'output1')
        
        # Store output image for adjustment reference
        viewer.store_output_image(output_key, output_image)
        
        img_base64 = viewer.image_to_base64(output_image)

        return JsonResponse({
            'success': True,
            'output_image': img_base64
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def apply_adjustments(request):
    """Apply display-only brightness/contrast adjustments.
    
    Controller: Parses adjustment parameters, delegates to ImageViewer.
    
    POST Parameters:
        - image_key (str): Image identifier
        - brightness (float): Multiplier [0.0-2.0], default 1.0
        - contrast (float): Multiplier [0.0-3.0], default 1.0
        - reference (str): 'original' or 'current'
    
    Returns:
        JsonResponse with adjusted image and applied values
    """

    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))
        reference = data.get('reference', 'original')

        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        if reference not in ['original', 'current']:
            return JsonResponse({'error': 'Invalid reference mode'}, status=400)

        # Delegate to ImageViewer for adjustment processing
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_brightness_contrast(
            image_key, brightness, contrast, reference
        )

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
def apply_output_adjustments(request):
    """Apply brightness/contrast adjustments to output viewports.
    
    Controller: Parses adjustment parameters, delegates to ImageViewer.
    
    POST Parameters:
        - output_key (str): Output identifier ('output1' or 'output2')
        - brightness (float): Multiplier [0.0-2.0], default 1.0
        - contrast (float): Multiplier [0.0-3.0], default 1.0
    
    Returns:
        JsonResponse with adjusted output image
    """
    try:
        data = json.loads(request.body)
        output_key = data.get('output_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))

        if not output_key:
            return JsonResponse({'error': 'Missing output_key'}, status=400)

        # Delegate to ImageViewer for output adjustment processing
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_output_adjustments(
            output_key, brightness, contrast
        )

        adjusted_base64 = viewer.image_to_base64(adjusted_image)

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


# =============================================================================
# SESSION MANAGEMENT AND STATUS API
# =============================================================================


def beamforming(request):
    return render(request, 'beamforman.html')
