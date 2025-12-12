from django.contrib import admin
from django.urls import path
from . import views
from . import views2
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    
    # Image Processing API URLs
    path('api/upload/', views.upload_image, name='upload_image'),
    path('api/resize/', views.resize_images, name='resize_images'),
    path('api/fft/', views.get_fft_component, name='get_fft_component'),
    path('api/mix/', views.mix_images, name='mix_images'),
    path('api/apply-adjustments/', views.apply_adjustments, name='apply_adjustments'),
    path('api/clear/', views.clear_images, name='clear_images'),
    path('api/status/', views.get_status, name='get_status'),
    
    # Beamforming Simulator URLs
    path('beamforming/', views2.BeamformingView.as_view(), name='beamforming'),
    
    # Beamforming API endpoints
    path('api/beamforming/update/', views2.BeamformingView.as_view(), name='beamforming_update'),
    path('api/beamforming/add-array/', views2.BeamformingView.as_view(), name='beamforming_add_array'),
    path('api/beamforming/remove-array/', views2.BeamformingView.as_view(), name='beamforming_remove_array'),
    path('api/beamforming/load-scenario/', views2.BeamformingView.as_view(), name='beamforming_load_scenario'),
    path('api/beamforming/save-scenario/', views2.BeamformingView.as_view(), name='beamforming_save_scenario'),
    path('api/beamforming/visualization/', views2.BeamformingView.as_view(), name='beamforming_visualization'),
    
    # Quick operations
    path('api/beamforming/quick/', views2.QuickOperationsView.as_view(), name='beamforming_quick'),
    
    # Export/Import endpoints
    path('api/beamforming/export/', views2.ExportConfigurationView.as_view(), name='beamforming_export'),
    path('api/beamforming/import/', views2.ExportConfigurationView.as_view(), name='beamforming_import'),
    
    # API Documentation
    path('api/beamforming/documentation/', views2.APIDocumentationView.as_view(), name='beamforming_api_docs'),
    
    # Alternative direct page access
    path('simulator/', views2.BeamformingView.as_view(), name='simulator'),
    path('beamforming-simulator/', views2.BeamformingView.as_view(), name='beamforming_simulator'),
]

# Add static and media files serving in development mode
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)