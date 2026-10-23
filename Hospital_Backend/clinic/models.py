"""Модели согласно техническому заданию Hospital."""
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Q


class UserProfile(AbstractUser):
    BLOOD_GROUPS = [
        ('O+', 'I (O) Rh+'), ('O-', 'I (O) Rh-'),
        ('A+', 'II (A) Rh+'), ('A-', 'II (A) Rh-'),
        ('B+', 'III (B) Rh+'), ('B-', 'III (B) Rh-'),
        ('AB+', 'IV (AB) Rh+'), ('AB-', 'IV (AB) Rh-'),
    ]
    birth_date = models.DateField('Дата рождения', blank=True, null=True)
    phone_number = models.CharField('Телефон', max_length=25, blank=True)
    address = models.CharField('Адрес', max_length=255, blank=True)
    blood_group = models.CharField('Группа крови', max_length=3, choices=BLOOD_GROUPS, blank=True)
    date_register = models.DateTimeField('Дата регистрации', auto_now_add=True)

    class Meta:
        verbose_name = 'Пациент / пользователь'
        verbose_name_plural = 'Пациенты / пользователи'

    def __str__(self):
        return self.get_full_name() or self.username


class Specialization(models.Model):
    name = models.CharField('Название', max_length=100, unique=True)
    description = models.TextField('Описание', blank=True)
    image = models.ImageField('Изображение', upload_to='specializations/', blank=True, null=True)

    class Meta:
        verbose_name = 'Специализация'
        verbose_name_plural = 'Специализации'
        ordering = ['name']

    def __str__(self):
        return self.name


class Doctor(models.Model):
    first_name = models.CharField('Имя', max_length=80)
    last_name = models.CharField('Фамилия', max_length=80)
    patronymic = models.CharField('Отчество', max_length=80, blank=True)
    photo = models.ImageField('Фото', upload_to='doctors/', blank=True, null=True)
    experience_years = models.PositiveIntegerField('Опыт (лет)', default=0)
    price = models.DecimalField(
        'Цена приёма', max_digits=9, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )
    specialization = models.ForeignKey(
        Specialization, on_delete=models.PROTECT, related_name='doctors',
        verbose_name='Специализация',
    )

    class Meta:
        verbose_name = 'Врач'
        verbose_name_plural = 'Врачи'
        ordering = ['last_name', 'first_name']

    def get_avg_rating(self):
        """Средняя оценка врача (0.0, если отзывов нет)."""
        avg = self.reviews.aggregate(result=Avg('stars'))['result']
        return round(float(avg), 2) if avg is not None else 0.0

    def get_appointment_count(self):
        """Общее число записей, включая отменённые."""
        return self.appointments.count()

    def __str__(self):
        return f'{self.last_name} {self.first_name} {self.patronymic}'.strip()


class Schedule(models.Model):
    WEEKDAYS = [
        (0, 'Понедельник'), (1, 'Вторник'), (2, 'Среда'),
        (3, 'Четверг'), (4, 'Пятница'), (5, 'Суббота'), (6, 'Воскресенье'),
    ]
    doctor = models.ForeignKey(
        Doctor, on_delete=models.CASCADE, related_name='schedules', verbose_name='Врач'
    )
    day_of_week = models.PositiveSmallIntegerField('День недели', choices=WEEKDAYS)
    start_time = models.TimeField('Начало')
    end_time = models.TimeField('Окончание')

    class Meta:
        verbose_name = 'Расписание'
        verbose_name_plural = 'Расписания'
        ordering = ['doctor', 'day_of_week', 'start_time']

    def clean(self):
        super().clean()
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError({'end_time': 'Окончание должно быть позже начала.'})
        if self.doctor_id is not None and self.day_of_week is not None and self.start_time and self.end_time:
            overlaps = Schedule.objects.filter(
                doctor_id=self.doctor_id,
                day_of_week=self.day_of_week,
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exclude(pk=self.pk)
            if overlaps.exists():
                raise ValidationError('Это время пересекается с другим расписанием врача.')

    def __str__(self):
        return f'{self.doctor} — {self.get_day_of_week_display()} {self.start_time:%H:%M}–{self.end_time:%H:%M}'


class Appointment(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидает подтверждения'
        CONFIRMED = 'confirmed', 'Подтверждена'
        CANCELLED = 'cancelled', 'Отменена'
        COMPLETED = 'completed', 'Завершена'

    patient = models.ForeignKey(
        UserProfile, on_delete=models.PROTECT, related_name='appointments', verbose_name='Пациент'
    )
    doctor = models.ForeignKey(
        Doctor, on_delete=models.PROTECT, related_name='appointments', verbose_name='Врач'
    )
    date_time = models.DateTimeField('Дата и время')
    complaint = models.TextField('Жалоба')
    status = models.CharField(
        'Статус', max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_date = models.DateTimeField('Создана', auto_now_add=True)

    class Meta:
        verbose_name = 'Запись на приём'
        verbose_name_plural = 'Записи на приём'
        ordering = ['-date_time']
        constraints = [
            models.UniqueConstraint(
                fields=['doctor', 'date_time'],
                condition=Q(status__in=['pending', 'confirmed']),
                name='unique_active_doctor_slot',
            ),
        ]

    def __str__(self):
        return f'{self.patient} → {self.doctor} ({self.date_time:%d.%m.%Y %H:%M})'


class MedicalRecord(models.Model):
    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name='medical_record',
        verbose_name='Запись на приём',
    )
    diagnosis = models.TextField('Диагноз')
    prescription = models.TextField('Назначения')
    created_date = models.DateTimeField('Создана', auto_now_add=True)

    class Meta:
        verbose_name = 'Медицинская запись'
        verbose_name_plural = 'Медицинские записи'
        ordering = ['-created_date']

    def clean(self):
        super().clean()
        if self.appointment_id and self.appointment.status != Appointment.Status.COMPLETED:
            raise ValidationError({'appointment': 'Медицинская запись доступна после завершения приёма.'})

    def __str__(self):
        return f'Медкарта по приёму №{self.appointment_id}'


class DoctorReview(models.Model):
    doctor = models.ForeignKey(
        Doctor, on_delete=models.CASCADE, related_name='reviews', verbose_name='Врач'
    )
    patient = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name='doctor_reviews',
        verbose_name='Пациент',
    )
    stars = models.PositiveSmallIntegerField(
        'Оценка', validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField('Комментарий', blank=True)
    created_date = models.DateTimeField('Создан', auto_now_add=True)

    class Meta:
        verbose_name = 'Отзыв врача'
        verbose_name_plural = 'Отзывы врачей'
        ordering = ['-created_date']
        constraints = [models.UniqueConstraint(
            fields=['doctor', 'patient'], name='one_review_per_patient_per_doctor'
        )]

    def __str__(self):
        return f'{self.doctor}: {self.stars}/5'
