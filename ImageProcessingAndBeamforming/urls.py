from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('api/upload/', views.upload_image, name='upload_image'),
    path('api/resize/', views.resize_images, name='resize_images'),
    path('api/fft/', views.get_fft_component, name='get_fft_component'),
    path('api/mix/', views.mix_images, name='mix_images'),
    path('api/apply-adjustments/', views.apply_adjustments, name='apply_adjustments'),
    path('api/clear/', views.clear_images, name='clear_images'),
    path('api/status/', views.get_status, name='get_status'),
]
