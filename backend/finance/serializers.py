from rest_framework import serializers
from .models import Category, Account, Transaction, Budget, Investment, SavingsGoal, MonthlyNote, RecurringTransaction, HouseBudget, BudgetLineItem, BudgetChangeLog, CategoryExclusion, Portfolio, PortfolioSnapshot


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'type', 'icon', 'color', 'is_default']
        read_only_fields = ['id']


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'type', 'balance', 'currency', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'amount', 'type', 'description', 'category', 'category_name',
            'account', 'account_name', 'date', 'created_at', 'notes'
        ]
        read_only_fields = ['id', 'created_at']


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            'id', 'name', 'amount', 'category', 'category_name', 'period',
            'start_date', 'end_date', 'is_active', 'spent', 'remaining'
        ]
        read_only_fields = ['id']

    def get_spent(self, obj):
        from django.db.models import Sum
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now().date()
        if obj.period == 'monthly':
            start = now.replace(day=1)
        elif obj.period == 'weekly':
            start = now - timedelta(days=now.weekday())
        else:
            start = now.replace(month=1, day=1)

        total = Transaction.objects.filter(
            user=obj.user,
            category=obj.category,
            type='expense',
            date__gte=start
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        return float(total)

    def get_remaining(self, obj):
        return float(obj.amount) - self.get_spent(obj)


class InvestmentSerializer(serializers.ModelSerializer):
    total_invested = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    current_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    gain_loss = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    gain_loss_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = Investment
        fields = [
            'id', 'name', 'symbol', 'type', 'quantity', 'purchase_price',
            'current_price', 'purchase_date', 'account', 'notes',
            'total_invested', 'current_value', 'gain_loss', 'gain_loss_percent',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SavingsGoalSerializer(serializers.ModelSerializer):
    progress_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = SavingsGoal
        fields = [
            'id', 'name', 'target_amount', 'current_amount', 'target_date',
            'is_completed', 'progress_percent', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DashboardSerializer(serializers.Serializer):
    total_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_savings = serializers.DecimalField(max_digits=12, decimal_places=2)
    investment_value = serializers.DecimalField(max_digits=12, decimal_places=2)
    recent_transactions = TransactionSerializer(many=True)
    budget_status = BudgetSerializer(many=True)
    savings_goals = SavingsGoalSerializer(many=True)


class MonthlyNoteSerializer(serializers.ModelSerializer):
    month_name = serializers.SerializerMethodField()
    actual_income = serializers.SerializerMethodField()
    actual_expenses = serializers.SerializerMethodField()
    actual_savings = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyNote
        fields = [
            'id', 'year', 'month', 'month_name', 'note',
            'income_target', 'expense_target', 'savings_target',
            'actual_income', 'actual_expenses', 'actual_savings',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_month_name(self, obj):
        import calendar
        return calendar.month_name[obj.month]

    def get_actual_income(self, obj):
        from django.db.models import Sum
        from datetime import date
        import calendar
        last_day = calendar.monthrange(obj.year, obj.month)[1]
        start = date(obj.year, obj.month, 1)
        end = date(obj.year, obj.month, last_day)
        total = Transaction.objects.filter(
            user=obj.user,
            type='income',
            date__gte=start,
            date__lte=end
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        return float(total)

    def get_actual_expenses(self, obj):
        from django.db.models import Sum
        from datetime import date
        import calendar
        last_day = calendar.monthrange(obj.year, obj.month)[1]
        start = date(obj.year, obj.month, 1)
        end = date(obj.year, obj.month, last_day)
        total = Transaction.objects.filter(
            user=obj.user,
            type='expense',
            date__gte=start,
            date__lte=end
        ).aggregate(Sum('amount'))['amount__sum'] or 0
        return float(total)

    def get_actual_savings(self, obj):
        return self.get_actual_income(obj) - self.get_actual_expenses(obj)


class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = RecurringTransaction
        fields = [
            'id', 'name', 'amount', 'type', 'category', 'category_name',
            'account', 'account_name', 'frequency', 'start_date', 'end_date',
            'next_date', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class MonthlyTrendSerializer(serializers.Serializer):
    """Monthly trends data for charts."""
    year = serializers.IntegerField()
    month = serializers.IntegerField()
    month_name = serializers.CharField()
    income = serializers.DecimalField(max_digits=12, decimal_places=2)
    expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    savings = serializers.DecimalField(max_digits=12, decimal_places=2)
    savings_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    note = serializers.CharField(allow_blank=True)


class BudgetLineItemSerializer(serializers.ModelSerializer):
    primary_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    partner_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = BudgetLineItem
        fields = [
            'id', 'name', 'amount', 'category_type', 'split_type',
            'primary_share_percent', 'group', 'notes', 'order',
            'primary_amount', 'partner_amount'
        ]


class HouseBudgetSerializer(serializers.ModelSerializer):
    line_items = BudgetLineItemSerializer(many=True, read_only=True)
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    # Computed totals
    total_expenses = serializers.SerializerMethodField()
    total_savings = serializers.SerializerMethodField()
    total_investments = serializers.SerializerMethodField()
    primary_total = serializers.SerializerMethodField()
    partner_total = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = HouseBudget
        fields = [
            'id', 'name', 'month', 'year', 'is_template',
            'primary_salary', 'secondary_income', 'other_income',
            'partner_name', 'partner_contribution',
            'notes', 'created_at', 'updated_at',
            'total_income', 'line_items',
            'total_expenses', 'total_savings', 'total_investments',
            'primary_total', 'partner_total', 'remaining'
        ]

    def get_total_expenses(self, obj):
        return sum(item.amount for item in obj.line_items.filter(category_type='expense'))

    def get_total_savings(self, obj):
        return sum(item.amount for item in obj.line_items.filter(category_type='saving'))

    def get_total_investments(self, obj):
        return sum(item.amount for item in obj.line_items.filter(category_type='investment'))

    def get_primary_total(self, obj):
        total = 0
        for item in obj.line_items.all():
            total += item.primary_amount
        return total

    def get_partner_total(self, obj):
        total = 0
        for item in obj.line_items.all():
            total += item.partner_amount
        return total

    def get_remaining(self, obj):
        total_outgoing = sum(item.amount for item in obj.line_items.all())
        return float(obj.total_income) - float(total_outgoing)


class BudgetChangeLogSerializer(serializers.ModelSerializer):
    """Serializer for budget change history."""
    change_type_display = serializers.CharField(source='get_change_type_display', read_only=True)
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = BudgetChangeLog
        fields = [
            'id', 'budget', 'line_item_id', 'line_item_name',
            'change_type', 'change_type_display', 'field_name',
            'old_value', 'new_value', 'note', 'created_at', 'formatted_date'
        ]
        read_only_fields = ['id', 'created_at']

    def get_formatted_date(self, obj):
        return obj.created_at.strftime('%d %b %Y, %H:%M')


class CategoryExclusionSerializer(serializers.ModelSerializer):
    transaction_description = serializers.CharField(source='transaction.description', read_only=True)
    transaction_amount = serializers.DecimalField(source='transaction.amount', max_digits=12, decimal_places=2, read_only=True)
    transaction_date = serializers.DateField(source='transaction.date', read_only=True)

    class Meta:
        model = CategoryExclusion
        fields = ['id', 'transaction', 'transaction_description', 'transaction_amount', 'transaction_date', 'category', 'created_at']
        read_only_fields = ['id', 'created_at']


class PortfolioSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioSnapshot
        fields = ['id', 'portfolio', 'year', 'month', 'value', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']


class PortfolioSerializer(serializers.ModelSerializer):
    portfolio_type_display = serializers.CharField(source='get_portfolio_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    total_gain_loss = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_gain_loss_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    ytd_gain_loss = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    ytd_gain_loss_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    recent_snapshots = serializers.SerializerMethodField()

    class Meta:
        model = Portfolio
        fields = [
            'id', 'name', 'portfolio_type', 'portfolio_type_display',
            'risk_level', 'risk_level_display', 'provider', 'currency', 'owner_name',
            'initial_value', 'start_date', 'current_value', 'year_start_value',
            'total_gain_loss', 'total_gain_loss_percent',
            'ytd_gain_loss', 'ytd_gain_loss_percent',
            'notes', 'is_active', 'created_at', 'updated_at', 'recent_snapshots'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_recent_snapshots(self, obj):
        snapshots = obj.snapshots.all()[:12]  # Last 12 months
        return PortfolioSnapshotSerializer(snapshots, many=True).data
