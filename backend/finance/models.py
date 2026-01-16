from django.db import models
from django.conf import settings


class Category(models.Model):
    """Transaction categories (Food, Transport, Entertainment, etc.)"""
    CATEGORY_TYPES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
    ]

    name = models.CharField(max_length=50)
    type = models.CharField(max_length=10, choices=CATEGORY_TYPES)
    icon = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=7, default='#6366f1')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='categories',
        null=True,
        blank=True
    )
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'Categories'

    def __str__(self):
        return f"{self.name} ({self.type})"


class Account(models.Model):
    """Bank accounts, wallets, credit cards."""
    ACCOUNT_TYPES = [
        ('checking', 'Checking'),
        ('savings', 'Savings'),
        ('credit', 'Credit Card'),
        ('cash', 'Cash'),
        ('investment', 'Investment'),
    ]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='accounts'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.type})"


class Transaction(models.Model):
    """Income and expense transactions."""
    TRANSACTION_TYPES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
        ('transfer', 'Transfer'),
    ]

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    description = models.CharField(max_length=255)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name='transactions'
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', '-date']),
            models.Index(fields=['user', 'type']),
            models.Index(fields=['user', 'category']),
            models.Index(fields=['user', 'account']),
            models.Index(fields=['-date', '-created_at']),
        ]

    def __str__(self):
        return f"{self.type}: {self.amount} - {self.description}"


class Budget(models.Model):
    """Monthly budgets per category."""
    PERIOD_CHOICES = [
        ('monthly', 'Monthly'),
        ('weekly', 'Weekly'),
        ('yearly', 'Yearly'),
    ]

    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='budgets'
    )
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES, default='monthly')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='budgets'
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name}: {self.amount}/{self.period}"


class Investment(models.Model):
    """Investment portfolio tracking."""
    INVESTMENT_TYPES = [
        ('stock', 'Stock'),
        ('etf', 'ETF'),
        ('mutual_fund', 'Mutual Fund'),
        ('bond', 'Bond'),
        ('crypto', 'Cryptocurrency'),
        ('real_estate', 'Real Estate'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=20, blank=True)
    type = models.CharField(max_length=20, choices=INVESTMENT_TYPES)
    quantity = models.DecimalField(max_digits=18, decimal_places=8)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2)
    current_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    purchase_date = models.DateField()
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='investments'
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='investments'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def total_invested(self):
        return self.quantity * self.purchase_price

    @property
    def current_value(self):
        if self.current_price:
            return self.quantity * self.current_price
        return self.total_invested

    @property
    def gain_loss(self):
        return self.current_value - self.total_invested

    @property
    def gain_loss_percent(self):
        if self.total_invested > 0:
            return (self.gain_loss / self.total_invested) * 100
        return 0

    def __str__(self):
        return f"{self.name} ({self.symbol})"


class SavingsGoal(models.Model):
    """Track savings goals."""
    name = models.CharField(max_length=100)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_date = models.DateField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='savings_goals'
    )
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def progress_percent(self):
        if self.target_amount > 0:
            return min((self.current_amount / self.target_amount) * 100, 100)
        return 0

    def __str__(self):
        return f"{self.name}: {self.current_amount}/{self.target_amount}"


class Portfolio(models.Model):
    """Track investment portfolios and savings accounts."""
    PORTFOLIO_TYPES = [
        ('isa', 'ISA'),
        ('jisa', 'Junior ISA'),
        ('pension', 'Pension'),
        ('gia', 'General Investment'),
        ('savings', 'Savings Account'),
        ('emergency', 'Emergency Fund'),
        ('other', 'Other'),
    ]

    RISK_LEVELS = [
        ('1', 'Level 1/5 - Very Low'),
        ('2', 'Level 2/5 - Low'),
        ('3', 'Level 3/5 - Medium'),
        ('4', 'Level 4/5 - Medium-High'),
        ('5', 'Level 5/5 - High'),
        ('none', 'N/A'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='portfolios'
    )
    name = models.CharField(max_length=100)
    portfolio_type = models.CharField(max_length=20, choices=PORTFOLIO_TYPES)
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, default='none')
    provider = models.CharField(max_length=100, blank=True)  # e.g., "Nutmeg", "Vanguard"

    # Initial investment info
    initial_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    start_date = models.DateField()

    # Current value (updated monthly)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Year start value (for YTD calculations)
    year_start_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Owner info (for whose account it is)
    owner_name = models.CharField(max_length=100, blank=True)  # e.g., "Nishant", "Kiaan", "Krati"

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-current_value']

    @property
    def total_gain_loss(self):
        return self.current_value - self.initial_value

    @property
    def total_gain_loss_percent(self):
        if self.initial_value > 0:
            return (self.total_gain_loss / self.initial_value) * 100
        return 0

    @property
    def ytd_gain_loss(self):
        return self.current_value - self.year_start_value

    @property
    def ytd_gain_loss_percent(self):
        if self.year_start_value > 0:
            return (self.ytd_gain_loss / self.year_start_value) * 100
        return 0

    def __str__(self):
        return f"{self.name} - {self.get_portfolio_type_display()}"


class PortfolioSnapshot(models.Model):
    """Monthly snapshots of portfolio values for historical tracking."""
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='snapshots'
    )
    year = models.IntegerField()
    month = models.IntegerField()  # 1-12
    value = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['portfolio', 'year', 'month']
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.portfolio.name} - {self.month}/{self.year}: £{self.value}"


class MonthlyNote(models.Model):
    """Monthly financial notes and comments for tracking."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='monthly_notes'
    )
    year = models.IntegerField()
    month = models.IntegerField()  # 1-12
    note = models.TextField()
    income_target = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expense_target = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    savings_target = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'year', 'month']
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.user.email} - {self.year}/{self.month}"


class HouseBudget(models.Model):
    """Monthly household budget planning."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='house_budgets'
    )
    name = models.CharField(max_length=100, default='Monthly Budget')
    month = models.IntegerField(null=True, blank=True)  # 1-12, null for template
    year = models.IntegerField(null=True, blank=True)
    is_template = models.BooleanField(default=False)

    # Income
    primary_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    secondary_income = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_income = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Partner info for split
    partner_name = models.CharField(max_length=100, blank=True, default='Partner')
    partner_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'year', 'month']
        ordering = ['-year', '-month']

    @property
    def total_income(self):
        return self.primary_salary + self.secondary_income + self.other_income + self.partner_contribution

    def __str__(self):
        if self.is_template:
            return f"{self.name} (Template)"
        return f"{self.name} - {self.month}/{self.year}"


class BudgetLineItem(models.Model):
    """Individual line items in a house budget."""
    CATEGORY_TYPES = [
        ('expense', 'Expense'),
        ('saving', 'Saving'),
        ('investment', 'Investment'),
    ]

    SPLIT_TYPES = [
        ('shared', 'Shared'),
        ('personal_primary', 'Personal (Primary)'),
        ('personal_partner', 'Personal (Partner)'),
    ]

    budget = models.ForeignKey(
        HouseBudget,
        on_delete=models.CASCADE,
        related_name='line_items'
    )
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category_type = models.CharField(max_length=20, choices=CATEGORY_TYPES, default='expense')
    split_type = models.CharField(max_length=20, choices=SPLIT_TYPES, default='shared')

    # For shared expenses, what percentage does primary pay (0-100)
    primary_share_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50)

    # Grouping
    group = models.CharField(max_length=50, blank=True)  # e.g., "Housing", "Transport", "Utilities"

    # Optional notes
    notes = models.CharField(max_length=255, blank=True)

    # Order for display
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['group', 'order', 'name']

    @property
    def primary_amount(self):
        if self.split_type == 'personal_partner':
            return 0
        elif self.split_type == 'personal_primary':
            return self.amount
        else:  # shared
            return self.amount * (self.primary_share_percent / 100)

    @property
    def partner_amount(self):
        if self.split_type == 'personal_primary':
            return 0
        elif self.split_type == 'personal_partner':
            return self.amount
        else:  # shared
            return self.amount * ((100 - self.primary_share_percent) / 100)

    def __str__(self):
        return f"{self.name}: £{self.amount}"


class BudgetChangeLog(models.Model):
    """Track changes to house budget and line items over time."""
    CHANGE_TYPES = [
        ('create', 'Created'),
        ('update', 'Updated'),
        ('delete', 'Deleted'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='budget_change_logs'
    )
    budget = models.ForeignKey(
        HouseBudget,
        on_delete=models.CASCADE,
        related_name='change_logs'
    )
    line_item_id = models.IntegerField(null=True, blank=True)  # Store ID for reference even if deleted
    line_item_name = models.CharField(max_length=100, blank=True)  # Store name for display
    change_type = models.CharField(max_length=10, choices=CHANGE_TYPES)
    field_name = models.CharField(max_length=50, blank=True)  # e.g., 'amount', 'name', 'primary_salary'
    old_value = models.CharField(max_length=255, blank=True)
    new_value = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)  # Optional explanation
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['budget', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        if self.line_item_name:
            return f"{self.change_type}: {self.line_item_name} - {self.field_name}"
        return f"{self.change_type}: Budget - {self.field_name}"


class CategoryExclusion(models.Model):
    """Track transactions excluded from smart category spending calculations."""
    SMART_CATEGORIES = [
        ('Groceries', 'Groceries'),
        ('Eating Out', 'Eating Out'),
        ('Transport', 'Transport'),
        ('Health & Fitness', 'Health & Fitness'),
        ('Shopping', 'Shopping'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='category_exclusions'
    )
    transaction = models.ForeignKey(
        'Transaction',
        on_delete=models.CASCADE,
        related_name='category_exclusions'
    )
    category = models.CharField(max_length=50, choices=SMART_CATEGORIES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'transaction', 'category']
        indexes = [
            models.Index(fields=['user', 'category']),
        ]

    def __str__(self):
        return f"Exclude {self.transaction.description} from {self.category}"


class RecurringTransaction(models.Model):
    """Recurring transactions (bills, subscriptions, salary)."""
    FREQUENCY_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('yearly', 'Yearly'),
    ]

    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=10, choices=[('income', 'Income'), ('expense', 'Expense')])
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recurring_transactions'
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name='recurring_transactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recurring_transactions'
    )
    frequency = models.CharField(max_length=15, choices=FREQUENCY_CHOICES, default='monthly')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name}: {self.amount}/{self.frequency}"
