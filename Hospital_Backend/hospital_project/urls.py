"""Корневые маршруты проекта Hospital."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('clinic.urls')),
    path('api-auth/', include('rest_framework.urls')),
]

# Выдача загруженных фотографий при локальном запуске.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
