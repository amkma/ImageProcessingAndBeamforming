"""
Image Processing API Views
===========================

RESTful API endpoints for Fourier Transform-based image processing application.

Architecture:
- Session-based image persistence using global ImageViewer instance
- Pre-computed FFT caching for performance optimization
- Unified Region Model for frequency domain filtering
- Display-only brightness/contrast adjustments (does not affect FFT)

API Endpoints:
    - /api/upload/ - Upload and process grayscale images
    - /api/resize/ - Resize all images to smallest dimensions
    - /api/fft/ - Retrieve FFT component visualizations
    - /api/mix/ - Perform frequency domain mixing with IFFT
    - /api/apply-adjustments/ - Apply brightness/contrast (display-only)
    - /api/clear/ - Clear all loaded images from session
    - /api/status/ - Get current session state

Design Decisions:
- Global ImageViewer instance for session persistence (not production-ready for multi-user)
- CSRF exemption for API endpoints (fronted served from same origin)
- All FFT operations use original unmodified images
- Display adjustments applied separately from processing
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
    """
    Upload image file and process for frequency domain operations.
    
    Workflow:
    1. Receive uploaded image file via multipart/form-data
    2. Save to temporary storage
    3. Load into ImageViewer (converts to grayscale)
    4. Pre-compute FFT and cache all components (magnitude, phase, real, imaginary)
    5. Store original grayscale image for future FFT operations
    6. Return grayscale image as base64 for display
    7. Clean up temporary file
    
    POST Parameters:
        - image (file): Image file (any format supported by PIL)
        - image_key (str): Identifier ('img1', 'img2', 'img3', or 'img4')
    
    Returns:
        JsonResponse: {
            'success': True,
            'image_key': str,
            'shape': (height, width),
            'grayscale_image': str (base64),
            'loaded_images': list of str
        }
    
    Design Notes:
    - Automatic grayscale conversion ensures FFT compatibility
    - FFT pre-computation eliminates latency on component requests
    - Original image preserved for unmodified FFT operations
    - Base64 encoding enables direct display in frontend
    
    Status Codes:
        - 200: Success
        - 400: Missing required parameters
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        image_file = request.FILES.get('image')
        image_key = request.POST.get('image_key')

        # Validate required parameters
        if not image_file or not image_key:
            return JsonResponse({'error': 'Missing image or image_key'}, status=400)

        # Save uploaded file to temporary storage
        file_name = default_storage.save(f'temp_{image_key}.png', ContentFile(image_file.read()))
        file_path = default_storage.path(file_name)

        # Load and process image (grayscale conversion + FFT pre-computation)
        shape = viewer.load_image(image_key, file_path)

        # Convert processed grayscale image to base64 for frontend display
        grayscale_image = viewer.image_to_base64(viewer.images[image_key])

        # Clean up temporary file (no longer needed after loading)
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
    Enforce unified image dimensions across all loaded images.
    
    Workflow:
    1. Find minimum dimensions among all loaded images
    2. Crop all images to match minimum dimensions
    3. Recompute FFT for all resized images
    4. Update session state with new dimensions
    
    Why This Exists:
    - Frequency domain operations require identical image dimensions
    - Mixing/adding images in frequency domain requires matching FFT sizes
    - Prevents dimension mismatch errors during IFFT
    
    POST Parameters:
        None required - automatically detects minimum dimensions
    
    Returns:
        JsonResponse: {
            'success': True,
            'dimensions': (height, width),
            'message': str
        }
    
    Design Notes:
    - Uses crop (not scale) to preserve spatial frequencies
    - Automatic FFT recomputation after resize
    - Returns None if no images loaded (validation check)
    
    Status Codes:
        - 200: Success
        - 400: No images loaded
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        result = viewer.check_and_resize_to_smallest()

        # Validation: ensure images exist
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
    Retrieve and visualize FFT components from pre-computed cache.
    
    Workflow:
    1. Parse request to extract image_key and component type
    2. Retrieve pre-computed FFT component from viewer cache
    3. Apply visualization transformation (log scale for magnitude, normalization for others)
    4. Normalize to 0-255 for display
    5. Convert to base64 for frontend rendering
    
    POST Parameters:
        - image_key (str): Image identifier ('img1', 'img2', 'img3', 'img4')
        - component (str): Component type
            * 'magnitude': FFT magnitude spectrum (log-scaled for visualization)
            * 'phase': FFT phase spectrum (normalized)
            * 'real': Real component of FFT (normalized)
            * 'imaginary': Imaginary component of FFT (normalized)
    
    Returns:
        JsonResponse: {
            'success': True,
            'image_key': str,
            'component': str,
            'image': str (base64)
        }
    
    Design Notes:
    - Components retrieved from cache (computed during upload)
    - Logarithmic scaling for magnitude improves visibility of low-frequency components
    - Min-max normalization ensures consistent display across different scales
    - No FFT computation here - purely retrieval and visualization
    
    Visualization Algorithm:
    - Magnitude: display = log(magnitude + 1) → normalize to [0, 255]
    - Others: display = component → normalize to [0, 255]
    - Normalization: (value - min) / (max - min) * 255
    
    Status Codes:
        - 200: Success
        - 400: Missing image_key or invalid component type
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        component = data.get('component', 'magnitude')

        # Validate required parameters
        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Retrieve pre-computed FFT component from cache
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

        # Apply visualization transformation
        import numpy as np
        
        # Log scale for magnitude (enhances low-frequency visibility)
        if component == 'magnitude':
            display = np.log(result + 1)
        else:
            display = result

        # Normalize to [0, 255] for display
        display = display - display.min()
        if display.max() > 0:
            display = display / display.max() * 255

        # Convert to base64 for frontend rendering
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
    Frequency domain mixing with Inverse FFT using Unified Region Model.
    
    Architecture:
    This endpoint implements the core frequency domain mixing algorithm that:
    1. Computes fresh FFT from original images (no cached/stale data)
    2. Applies per-image mode selection (magnitude/phase or real/imaginary)
    3. Applies per-image weight blending (component A and B weights)
    4. Applies frequency region filter (inner/outer rectangle mask)
    5. Performs Inverse FFT to generate spatial domain output
    
    Unified Region Model:
    - ALWAYS applies frequency mask (no conditional bypass)
    - Full spectrum: {'x': 0, 'y': 0, 'width': 1.0, 'height': 1.0, 'type': 'inner'}
    - Custom filter: user-defined rectangle with inner/outer type
    - Region applied to weighted sum in frequency domain before IFFT
    
    POST Parameters:
        - modes (dict): {image_key: mode_string}
            * 'magnitude_phase': Weighted blend of magnitude and phase components
            * 'real_imaginary': Weighted blend of real and imaginary components
        
        - weights_a (dict): {image_key: weight_float}
            * Weight for component A (magnitude or real)
            * Range: [0.0, 1.0]
            * Missing keys treated as 0.0
        
        - weights_b (dict): {image_key: weight_float}
            * Weight for component B (phase or imaginary)
            * Range: [0.0, 1.0]
            * Missing keys treated as 0.0
        
        - region (dict): Frequency domain filter specification
            * x, y: Normalized top-left corner [0.0, 1.0]
            * width, height: Normalized dimensions [0.0, 1.0]
            * type: 'inner' (keep inside) or 'outer' (keep outside)
            * Default: Full spectrum (entire frequency domain)
    
    Returns:
        JsonResponse: {
            'success': True,
            'output_image': str (base64 PNG of IFFT result)
        }
    
    Design Notes:
    - Strictly uses ONLY request parameters (no cached state)
    - Images with both weights = 0.0 are skipped (optimization)
    - Fresh FFT computation ensures clean state
    - Region Model always applied (consistent architecture)
    - Backend enforces parameter integrity (frontend state cannot leak)
    
    Processing Pipeline:
    1. Parse request parameters (modes, weights, region)
    2. Validate at least one weight provided
    3. Compute fresh FFT for all original images
    4. For each image:
       - Convert FFT to selected mode components
       - Apply component weights
       - Add to frequency domain accumulator
    5. Apply region mask to accumulated FFT
    6. Perform Inverse FFT
    7. Convert to spatial domain image
    8. Return as base64 PNG
    
    Status Codes:
        - 200: Success
        - 400: No weights provided
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        modes = data.get('modes', {})
        weights_a = data.get('weights_a', {})
        weights_b = data.get('weights_b', {})
        region_params = data.get('region', {'x': 0, 'y': 0, 'width': 1.0, 'height': 1.0, 'type': 'inner'})

        # Validate: require at least one non-zero weight
        if not weights_a and not weights_b:
            return JsonResponse({'error': 'No weights provided'}, status=400)

        # Perform frequency domain mixing with Unified Region Model
        # Backend strictly enforces request parameters only
        output_image = viewer.mix_images(modes, weights_a, weights_b, region_params)
        
        # Convert output to base64 for frontend display
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
    Apply display-only brightness/contrast adjustments with FFT recomputation.
    
    Architecture - Display-Only Adjustments:
    This endpoint implements adjustments that modify the spatial domain image
    and recompute FFT, separate from frequency domain operations. Changes here
    persist to FFT but do NOT affect output viewport adjustments (canvas-based).
    
    Workflow:
    1. Parse brightness and contrast values from request
    2. Determine reference mode (absolute from original or relative delta)
    3. Apply adjustments to spatial domain image
    4. Recompute FFT components from adjusted image
    5. Update cached FFT components (magnitude, phase, real, imaginary)
    6. Return adjusted image for input viewport display
    
    POST Parameters:
        - image_key (str): Image identifier ('img1', 'img2', 'img3', 'img4')
        - brightness (float): Brightness multiplier [0.00, 2.00], default 1.00
            * < 1.0: Darken image
            * = 1.0: No change
            * > 1.0: Brighten image
        - contrast (float): Contrast multiplier [0.00, 3.00], default 1.00
            * < 1.0: Reduce contrast
            * = 1.0: No change
            * > 1.0: Increase contrast
        - reference (str): Adjustment reference mode
            * 'original': Absolute adjustments from original uploaded image
            * 'current': Relative delta from current adjusted state
    
    Returns:
        JsonResponse: {
            'success': True,
            'image_key': str,
            'adjusted_image': str (base64),
            'shape': (height, width),
            'applied_brightness': float (actual value applied),
            'applied_contrast': float (actual value applied),
            'reference': str
        }
    
    Design Notes:
    - Adjustments modify the image that FFT is computed from
    - FFT components automatically recomputed after adjustment
    - Original image preserved for 'original' reference mode
    - Current state preserved for 'current' reference mode
    - Independent from output viewport canvas-based adjustments
    
    Adjustment Algorithm:
    1. Brightness: pixel_value = pixel_value * brightness_multiplier
    2. Contrast: pixel_value = (pixel_value - mean) * contrast_multiplier + mean
    3. Clipping: Ensure [0, 255] range after adjustment
    
    Reference Modes Explained:
    - 'original': brightness=1.5 always means 1.5× original brightness
    - 'current': brightness=1.2 means 1.2× current brightness (stacks)
    
    Status Codes:
        - 200: Success
        - 400: Missing image_key or invalid reference mode
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        data = json.loads(request.body)
        image_key = data.get('image_key')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))
        reference = data.get('reference', 'original')

        # Validate required parameters
        if not image_key:
            return JsonResponse({'error': 'Missing image_key'}, status=400)

        # Validate reference mode
        if reference not in ['original', 'current']:
            return JsonResponse({'error': 'Invalid reference mode'}, status=400)

        # Apply adjustments to spatial domain and recompute FFT
        adjusted_image, shape, applied_brightness, applied_contrast = viewer.apply_brightness_contrast(
            image_key, brightness, contrast, reference
        )

        # Convert adjusted image to base64 for input viewport display
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


# =============================================================================
# SESSION MANAGEMENT AND STATUS API
# =============================================================================

@csrf_exempt
def clear_images(request):
    """
    Clear all loaded images and reset session state.
    
    Workflow:
    1. Clear all cached images from viewer
    2. Clear all cached FFT components
    3. Reset session state to initial condition
    4. Return success confirmation
    
    Why This Exists:
    - Allows users to start fresh without page reload
    - Prevents memory leaks from accumulated image data
    - Clears stale FFT computations
    
    Returns:
        JsonResponse: {
            'success': True,
            'message': 'All images cleared'
        }
    
    Design Notes:
    - No parameters required
    - Complete session reset
    - Does not affect frontend state (weights, modes, sliders)
    - Production: Should implement proper session cleanup
    
    Status Codes:
        - 200: Success
        - 405: Method not allowed (not POST)
        - 500: Server error during processing
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST method required'}, status=405)

    try:
        # Clear all images and FFT cache
        viewer.clear_images()
        
        return JsonResponse({
            'success': True,
            'message': 'All images cleared'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def get_status(request):
    """
    Retrieve current session status and loaded images inventory.
    
    Workflow:
    1. Query viewer for list of loaded image keys
    2. Return count and keys of currently loaded images
    3. Used by frontend for state synchronization
    
    Why This Exists:
    - Frontend needs to know which images are loaded
    - Enables UI state synchronization after operations
    - Useful for debugging and monitoring session state
    
    Returns:
        JsonResponse: {
            'success': True,
            'loaded_images': list of str (image keys),
            'count': int (number of loaded images)
        }
    
    Design Notes:
    - GET endpoint (read-only)
    - No CSRF exemption required (safe method)
    - Returns empty list if no images loaded
    - Frontend polls this after uploads/clears
    
    Status Codes:
        - 200: Success
        - 500: Server error during processing
    """
    try:
        # Get list of currently loaded image keys
        loaded = viewer.get_loaded_images()
        
        return JsonResponse({
            'success': True,
            'loaded_images': loaded,
            'count': len(loaded)
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)