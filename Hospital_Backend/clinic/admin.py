"""Управление клиникой через /admin/."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Appointment, Doctor, DoctorReview, MedicalRecord,
    Schedule, Specialization, UserProfile,
)


@admin.register(UserProfile)
class UserProfileAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'phone_number', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'phone_number')
    fieldsets = UserAdmin.fieldsets + ((
        'Информация пациента',
        {'fields': ('birth_date', 'phone_number', 'address', 'blood_group', 'date_register')}
    ),)
    readonly_fields = ('date_register',)


@admin.register(Specialization)
class SpecializationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


class ScheduleInline(admin.TabularInline):
    model = Schedule
    extra = 0


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('id', 'last_name', 'first_name', 'specialization', 'experience_years', 'price', 'average_rating')
    list_filter = ('specialization',)
    search_fields = ('last_name', 'first_name', 'patronymic')
    inlines = [ScheduleInline]

    @admin.display(description='Средний рейтинг')
    def average_rating(self, obj):
        return obj.get_avg_rating()


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ('id', 'doctor', 'day_of_week', 'start_time', 'end_time')
    list_filter = ('day_of_week', 'doctor__specialization')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'date_time', 'status')
    list_filter = ('status', 'doctor__specialization')
    search_fields = ('patient__username', 'doctor__last_name')
    readonly_fields = ('created_date',)


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'appointment', 'created_date')
    search_fields = ('appointment__patient__username', 'diagnosis')
    readonly_fields = ('created_date',)


@admin.register(DoctorReview)
class DoctorReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'doctor', 'patient', 'stars', 'created_date')
    list_filter = ('stars',)
    readonly_fields = ('created_date',)
