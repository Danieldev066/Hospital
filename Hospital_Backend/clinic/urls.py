"""Все маршруты API. Базовый адрес — http://127.0.0.1:8000/api/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppointmentViewSet, DoctorReviewViewSet, DoctorViewSet, LoginView,
    LogoutView, MedicalRecordViewSet, MeView, RegisterView, ScheduleViewSet,
    SpecializationViewSet,
)

router = DefaultRouter()
router.register('specializations', SpecializationViewSet, basename='specialization')
router.register('doctors', DoctorViewSet, basename='doctor')
router.register('schedules', ScheduleViewSet, basename='schedule')
router.register('appointments', AppointmentViewSet, basename='appointment')
router.register('medical-records', MedicalRecordViewSet, basename='medical-record')
router.register('reviews', DoctorReviewViewSet, basename='review')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('', include(router.urls)),
]
