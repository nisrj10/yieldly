from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Household


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'username', 'first_name', 'last_name', 'household', 'is_staff']
    list_filter = ['is_staff', 'is_active', 'household']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering = ['email']
    fieldsets = UserAdmin.fieldsets + (
        ('Household', {'fields': ('household',)}),
    )


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at']
    search_fields = ['name']
