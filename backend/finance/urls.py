from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    AccountViewSet,
    TransactionViewSet,
    BudgetViewSet,
    InvestmentViewSet,
    SavingsGoalViewSet,
    MonthlyNoteViewSet,
    RecurringTransactionViewSet,
    HouseBudgetViewSet,
    BudgetLineItemViewSet,
    dashboard,
    monthly_summary,
    expense_by_category,
    monthly_trends,
    save_monthly_note,
    budget_overview,
    create_default_house_budget,
)

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='category')
router.register('accounts', AccountViewSet, basename='account')
router.register('transactions', TransactionViewSet, basename='transaction')
router.register('budgets', BudgetViewSet, basename='budget')
router.register('investments', InvestmentViewSet, basename='investment')
router.register('savings-goals', SavingsGoalViewSet, basename='savings-goal')
router.register('monthly-notes', MonthlyNoteViewSet, basename='monthly-note')
router.register('recurring-transactions', RecurringTransactionViewSet, basename='recurring-transaction')
router.register('house-budgets', HouseBudgetViewSet, basename='house-budget')
router.register('budget-line-items', BudgetLineItemViewSet, basename='budget-line-item')

urlpatterns = [
    path('dashboard/', dashboard, name='dashboard'),
    path('monthly-summary/', monthly_summary, name='monthly-summary'),
    path('expense-by-category/', expense_by_category, name='expense-by-category'),
    path('monthly-trends/', monthly_trends, name='monthly-trends'),
    path('save-monthly-note/', save_monthly_note, name='save-monthly-note'),
    path('budget-overview/', budget_overview, name='budget-overview'),
    path('house-budget/create-default/', create_default_house_budget, name='create-default-house-budget'),
    path('', include(router.urls)),
]
