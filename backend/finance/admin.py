from django.contrib import admin
from .models import Category, Account, Transaction, Budget, Investment, SavingsGoal


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'color', 'is_default', 'user']
    list_filter = ['type', 'is_default']
    search_fields = ['name']


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'balance', 'currency', 'user', 'is_active']
    list_filter = ['type', 'is_active']
    search_fields = ['name', 'user__email']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['description', 'amount', 'type', 'category', 'account', 'date', 'user']
    list_filter = ['type', 'category', 'date']
    search_fields = ['description', 'user__email']
    date_hierarchy = 'date'


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['name', 'amount', 'category', 'period', 'user', 'is_active']
    list_filter = ['period', 'is_active']
    search_fields = ['name', 'user__email']


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'symbol', 'type', 'quantity', 'purchase_price', 'current_price', 'user']
    list_filter = ['type']
    search_fields = ['name', 'symbol', 'user__email']


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ['name', 'target_amount', 'current_amount', 'target_date', 'is_completed', 'user']
    list_filter = ['is_completed']
    search_fields = ['name', 'user__email']
