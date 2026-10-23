"""HTTP API для пациентов, врачей, расписания и медицинских записей."""
from django.contrib.auth import authenticate
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Appointment, Doctor, DoctorReview, MedicalRecord, Schedule, Specialization, UserProfile
from .permissions import IsReviewOwnerOrStaff
from .serializers import (
    AppointmentSerializer, DoctorReviewSerializer, DoctorSerializer,
    MedicalRecordSerializer, RegistrationSerializer, ScheduleSerializer,
    SpecializationSerializer, UserProfileSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = UserProfile.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            return Response({'detail': 'Неверный логин или пароль.'}, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user_id': user.pk, 'username': user.username})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'detail': 'Вы вышли из аккаунта.'})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PublicReadStaffWriteMixin:
    """Читать можно всем; создавать/редактировать — только администратору."""
    def get_permissions(self):
        permission_type = (
            permissions.AllowAny if self.action in ('list', 'retrieve')
            else permissions.IsAdminUser
        )
        return [permission_type()]


class SpecializationViewSet(PublicReadStaffWriteMixin, viewsets.ModelViewSet):
    queryset = Specialization.objects.all()
    serializer_class = SpecializationSerializer


class DoctorViewSet(PublicReadStaffWriteMixin, viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related('specialization').all()
    serializer_class = DoctorSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['first_name', 'last_name', 'patronymic', 'specialization__name']
    ordering_fields = ['last_name', 'experience_years', 'price']

    def get_queryset(self):
        queryset = super().get_queryset()
        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(specialization_id=specialization) if specialization.isdigit() else queryset.none()
        return queryset


class ScheduleViewSet(PublicReadStaffWriteMixin, viewsets.ModelViewSet):
    queryset = Schedule.objects.select_related('doctor').all()
    serializer_class = ScheduleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        doctor = self.request.query_params.get('doctor')
        weekday = self.request.query_params.get('day_of_week')
        if doctor:
            queryset = queryset.filter(doctor_id=doctor) if doctor.isdigit() else queryset.none()
        if weekday is not None:
            queryset = queryset.filter(day_of_week=weekday) if weekday.isdigit() else queryset.none()
        return queryset


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Appointment.objects.select_related(
            'patient', 'doctor', 'medical_record'
        ).all()
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(patient=self.request.user)

    def perform_create(self, serializer):
        # Пациент не может создать запись на имя другого пользователя.
        serializer.save(patient=self.request.user)

    def perform_destroy(self, instance):
        if not self.request.user.is_staff and instance.status not in (
            Appointment.Status.PENDING, Appointment.Status.CANCELLED,
        ):
            raise PermissionDenied('Подтверждённую запись сначала отмените. История завершённых приёмов сохраняется.')
        instance.delete()


class MedicalRecordViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalRecordSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = MedicalRecord.objects.select_related(
            'appointment', 'appointment__patient', 'appointment__doctor'
        )
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(appointment__patient=self.request.user)


class DoctorReviewViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorReviewSerializer
    queryset = DoctorReview.objects.select_related('doctor', 'patient').all()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated(), IsReviewOwnerOrStaff()]

    def get_queryset(self):
        queryset = super().get_queryset()
        doctor = self.request.query_params.get('doctor')
        if doctor:
            queryset = queryset.filter(doctor_id=doctor) if doctor.isdigit() else queryset.none()
        return queryset

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)
