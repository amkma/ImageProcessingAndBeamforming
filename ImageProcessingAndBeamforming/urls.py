from django.contrib import admin
from django.urls import path
from . import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # HOME PAGE (ROOT)
    path('', views.home, name='home'),

    # Image Processing URLs
    path('image-processing/', views.image, name='image_processing'),

    # Image Processing API URLs
    path('api/upload/', views.upload_image, name='upload_image'),
    path('api/resize/', views.resize_images, name='resize_images'),
    path('api/fft/', views.get_fft_component, name='get_fft_component'),
    path('api/mix/', views.mix_images, name='mix_images'),
    path('api/apply-adjustments/', views.apply_adjustments, name='apply_adjustments'),
    path('api/apply-output-adjustments/', views.apply_output_adjustments, name='apply_output_adjustments'),
    path('api/apply-component-adjustments/', views.apply_component_adjustments, name='apply_component_adjustments'),
    # path('api/clear/', views.clear_images', name='clear_images'),
    # path('api/status/', views.get_status, name='get_status'),

    # Beamforming Simulator URLs (Pure Frontend - No Backend)
    path('beamforming/', views.beamforming, name='beamforming'),
]

# Add static and media files serving in development mode
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)