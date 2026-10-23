"""Фиктивные врачи и часы приёма для тренировки в PyCharm."""
from datetime import time
from decimal import Decimal

from django.core.management.base import BaseCommand

from clinic.models import Doctor, Schedule, Specialization


class Command(BaseCommand):
    help = 'Добавить демонстрационные специализации, врачей и графики'

    def handle(self, *args, **options):
        demo = [
            ('Терапевт', 'Первичный приём и общие заболевания', 'Айбек', 'Токтосунов', Decimal('700.00'), 8),
            ('Кардиолог', 'Диагностика сердечно-сосудистых заболеваний', 'Айгуль', 'Сыдыкова', Decimal('1000.00'), 12),
            ('Хирург', 'Хирургические консультации', 'Бакыт', 'Осмонов', Decimal('1200.00'), 10),
        ]
        for spec_name, desc, name, surname, price, years in demo:
            specialization, _ = Specialization.objects.get_or_create(
                name=spec_name, defaults={'description': desc},
            )
            doctor, _ = Doctor.objects.get_or_create(
                first_name=name, last_name=surname, specialization=specialization,
                defaults={'price': price, 'experience_years': years},
            )
            for day in range(5):  # Понедельник–пятница
                Schedule.objects.get_or_create(
                    doctor=doctor, day_of_week=day,
                    start_time=time(9, 0), end_time=time(17, 0),
                )
        self.stdout.write(self.style.SUCCESS('Тестовые врачи и расписания добавлены.'))
