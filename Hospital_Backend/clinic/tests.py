"""Проверки регистрации, прав пациентов и правил записи к врачу."""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Appointment, Doctor, DoctorReview, Schedule, Specialization, UserProfile


class HospitalAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.patient = UserProfile.objects.create_user(username='patient1', password='StrongPass123!')
        cls.other_patient = UserProfile.objects.create_user(username='patient2', password='StrongPass123!')
        cls.staff = UserProfile.objects.create_superuser(
            username='adminhospital', email='admin@example.org', password='StrongPass123!'
        )
        cls.specialization = Specialization.objects.create(name='Терапевт')
        cls.doctor = Doctor.objects.create(
            first_name='Айбек', last_name='Токтосунов',
            experience_years=5, price=Decimal('700.00'), specialization=cls.specialization,
        )
        future_day = timezone.localdate() + timedelta(days=1)
        cls.visit_at = timezone.make_aware(datetime.combine(future_day, time(10, 0)))
        Schedule.objects.create(
            doctor=cls.doctor, day_of_week=future_day.weekday(),
            start_time=time(9, 0), end_time=time(17, 0),
        )

    def _appointment_data(self, **overrides):
        data = {
            'doctor': self.doctor.pk,
            'date_time': self.visit_at.isoformat(),
            'complaint': 'Консультация',
        }
        data.update(overrides)
        return data

    def test_register_and_login(self):
        response = self.client.post('/api/register/', {
            'username': 'newpatient', 'password': 'AnotherStrongPass123!',
            'password_confirm': 'AnotherStrongPass123!', 'phone_number': '+996700000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(UserProfile.objects.get(username='newpatient').check_password('AnotherStrongPass123!'))
        response = self.client.post('/api/login/', {
            'username': 'newpatient', 'password': 'AnotherStrongPass123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    def test_public_doctors_but_only_staff_can_add(self):
        response = self.client.get('/api/doctors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.client.force_authenticate(user=self.patient)
        response = self.client.post('/api/doctors/', {
            'first_name': 'Test', 'last_name': 'User', 'price': '300.00',
            'specialization': self.specialization.pk,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_can_book_but_cannot_book_busy_time(self):
        self.client.force_authenticate(user=self.patient)
        response = self.client.post('/api/appointments/', self._appointment_data(), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], Appointment.Status.PENDING)
        response = self.client.post('/api/appointments/', self._appointment_data(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_book_outside_schedule_or_self_confirm(self):
        self.client.force_authenticate(user=self.patient)
        bad_time = self.visit_at.replace(hour=20)
        response = self.client.post(
            '/api/appointments/', self._appointment_data(date_time=bad_time.isoformat()), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post(
            '/api/appointments/', self._appointment_data(status='confirmed'), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patient_sees_only_own_appointments(self):
        appointment = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor,
            date_time=self.visit_at, complaint='Консультация',
        )
        self.client.force_authenticate(user=self.other_patient)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        response = self.client.get(f'/api/appointments/{appointment.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patient_cannot_change_doctor_or_mark_completed(self):
        appointment = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor,
            date_time=self.visit_at, complaint='Консультация',
        )
        self.client.force_authenticate(user=self.patient)
        response = self.client.patch(f'/api/appointments/{appointment.pk}/', {
            'status': 'completed',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.patch(f'/api/appointments/{appointment.pk}/', {
            'doctor': self.doctor.pk,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.patch(f'/api/appointments/{appointment.pk}/', {
            'status': 'cancelled',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_medical_record_only_after_completed_and_only_own(self):
        appointment = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor,
            date_time=self.visit_at, complaint='Консультация',
        )
        payload = {'appointment': appointment.pk, 'diagnosis': 'Учебный диагноз', 'prescription': 'Рекомендации'}
        self.client.force_authenticate(user=self.patient)
        self.assertEqual(
            self.client.post('/api/medical-records/', payload, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(
            self.client.post('/api/medical-records/', payload, format='json').status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        appointment.status = Appointment.Status.COMPLETED
        appointment.save(update_fields=['status'])
        response = self.client.post('/api/medical-records/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.client.force_authenticate(user=self.other_patient)
        self.assertEqual(self.client.get('/api/medical-records/').data['count'], 0)
        self.client.force_authenticate(user=self.patient)
        self.assertEqual(self.client.get('/api/medical-records/').data['count'], 1)
        appointment_detail = self.client.get(f'/api/appointments/{appointment.pk}/')
        self.assertEqual(appointment_detail.data['medical_record']['diagnosis'], 'Учебный диагноз')

    def test_reviews_rating_and_duplicate(self):
        self.client.force_authenticate(user=self.patient)
        data = {'doctor': self.doctor.pk, 'stars': 5, 'comment': 'Спасибо!'}
        response = self.client.post('/api/reviews/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self.doctor.get_avg_rating(), 5.0)
        self.assertEqual(self.client.post('/api/reviews/', data, format='json').status_code, 400)
        self.assertEqual(DoctorReview.objects.count(), 1)
