"""Запрещаем пациентам изменять отзывы друг друга."""
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsReviewOwnerOrStaff(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.is_staff or obj.patient_id == request.user.pk
        )
