"""Проверка входящих данных и преобразование моделей в JSON."""
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Appointment, Doctor, DoctorReview, MedicalRecord, Schedule,
    Specialization, UserProfile,
)


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = UserProfile
        fields = (
            'id', 'username', 'password', 'password_confirm', 'email',
            'first_name', 'last_name', 'birth_date', 'phone_number',
            'address', 'blood_group',
        )
        read_only_fields = ('id',)

    def validate(self, attrs):
        password = attrs.get('password')
        if password != attrs.pop('password_confirm', None):
            raise serializers.ValidationError({'password_confirm': 'Пароли не совпадают.'})
        validate_password(password)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return UserProfile.objects.create_user(password=password, **validated_data)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            'id', 'username', 'first_name', 'last_name', 'email',
            'birth_date', 'phone_number', 'address', 'blood_group', 'date_register',
        )
        read_only_fields = ('id', 'username', 'date_register')


class SpecializationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialization
        fields = ('id', 'name', 'description', 'image')


class DoctorSerializer(serializers.ModelSerializer):
    specialization_name = serializers.CharField(source='specialization.name', read_only=True)
    avg_rating = serializers.FloatField(source='get_avg_rating', read_only=True)
    appointment_count = serializers.IntegerField(source='get_appointment_count', read_only=True)

    class Meta:
        model = Doctor
        fields = (
            'id', 'first_name', 'last_name', 'patronymic', 'photo',
            'experience_years', 'price', 'specialization',
            'specialization_name', 'avg_rating', 'appointment_count',
        )


class ScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = Schedule
        fields = ('id', 'doctor', 'day_of_week', 'day_name', 'start_time', 'end_time')

    def validate(self, attrs):
        doctor = attrs.get('doctor', getattr(self.instance, 'doctor', None))
        day = attrs.get('day_of_week', getattr(self.instance, 'day_of_week', None))
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError({'end_time': 'Конец должен быть позже начала.'})
        if doctor and day is not None and start and end:
            existing = Schedule.objects.filter(
                doctor=doctor, day_of_week=day,
                start_time__lt=end, end_time__gt=start,
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError('Расписание пересекается с другой сменой врача.')
        return attrs


class MedicalRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = ('id', 'appointment', 'diagnosis', 'prescription', 'created_date')
        read_only_fields = ('id', 'created_date')

    def validate(self, attrs):
        appointment = attrs.get('appointment', getattr(self.instance, 'appointment', None))
        if appointment and appointment.status != Appointment.Status.COMPLETED:
            raise serializers.ValidationError({
                'appointment': 'Медицинская запись создаётся только после завершения приёма.'
            })
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.StringRelatedField(read_only=True)
    medical_record = MedicalRecordSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = (
            'id', 'patient', 'doctor', 'doctor_name', 'date_time',
            'complaint', 'status', 'created_date', 'medical_record',
        )
        read_only_fields = ('id', 'patient', 'created_date', 'medical_record')

    def validate(self, attrs):
        request = self.context['request']
        is_staff = request.user.is_staff
        status = attrs.get('status', getattr(self.instance, 'status', Appointment.Status.PENDING))
        doctor = attrs.get('doctor', getattr(self.instance, 'doctor', None))
        date_time = attrs.get('date_time', getattr(self.instance, 'date_time', None))

        if not is_staff:
            if self.instance is None:
                if 'status' in attrs and attrs['status'] != Appointment.Status.PENDING:
                    raise serializers.ValidationError({'status': 'Новая запись должна ожидать подтверждения.'})
            else:
                if self.instance.status in (Appointment.Status.CANCELLED, Appointment.Status.COMPLETED):
                    raise serializers.ValidationError('Нельзя изменять отменённый или завершённый приём.')
                if set(attrs) - {'complaint', 'status'}:
                    raise serializers.ValidationError('Пациент может менять только жалобу или отменять запись.')
                if 'status' in attrs and attrs['status'] != Appointment.Status.CANCELLED:
                    raise serializers.ValidationError({'status': 'Пациент может только отменить приём.'})
                if 'complaint' in attrs and self.instance.status != Appointment.Status.PENDING:
                    raise serializers.ValidationError({'complaint': 'Жалобу можно изменить только в ожидающей записи.'})

        should_check = (
            self.instance is None
            or 'doctor' in attrs
            or 'date_time' in attrs
            or ('status' in attrs and status in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED))
        )
        if should_check and status in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            if date_time and date_time <= timezone.now():
                raise serializers.ValidationError({'date_time': 'Выберите дату и время в будущем.'})
            if doctor and date_time:
                local_dt = timezone.localtime(date_time)
                work_time = local_dt.time().replace(tzinfo=None)
                is_working = Schedule.objects.filter(
                    doctor=doctor,
                    day_of_week=local_dt.weekday(),
                    start_time__lte=work_time,
                    end_time__gt=work_time,
                ).exists()
                if not is_working:
                    raise serializers.ValidationError({'date_time': 'Врач не работает в выбранное время.'})
                busy = Appointment.objects.filter(
                    doctor=doctor, date_time=date_time,
                    status__in=(Appointment.Status.PENDING, Appointment.Status.CONFIRMED),
                )
                if self.instance:
                    busy = busy.exclude(pk=self.instance.pk)
                if busy.exists():
                    raise serializers.ValidationError({'date_time': 'Это время уже занято.'})
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            raise serializers.ValidationError({'date_time': 'Это время уже занято.'})

    def update(self, instance, validated_data):
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except IntegrityError:
            raise serializers.ValidationError({'date_time': 'Это время уже занято.'})


class DoctorReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorReview
        fields = ('id', 'doctor', 'stars', 'comment', 'created_date')
        read_only_fields = ('id', 'created_date')
        # patient назначается в perform_create; проверка уникальности идёт ниже и на уровне БД.
        validators = []

    def validate(self, attrs):
        user = self.context['request'].user
        if self.instance and not user.is_staff:
            if 'doctor' in attrs and attrs['doctor'].pk != self.instance.doctor_id:
                raise serializers.ValidationError({'doctor': 'Нельзя переносить отзыв к другому врачу.'})
        doctor = attrs.get('doctor', getattr(self.instance, 'doctor', None))
        if doctor and user.is_authenticated:
            duplicates = DoctorReview.objects.filter(doctor=doctor, patient=(self.instance.patient if self.instance else user))
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError('Вы уже оставили отзыв этому врачу.')
        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError:
            raise serializers.ValidationError('Вы уже оставили отзыв этому врачу.')

    def update(self, instance, validated_data):
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except IntegrityError:
            raise serializers.ValidationError('Отзыв этому врачу уже существует.')
