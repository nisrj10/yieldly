from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta, date
import calendar
from .models import Category, Account, Transaction, Budget, Investment, SavingsGoal, MonthlyNote, RecurringTransaction, HouseBudget, BudgetLineItem
from .serializers import (
    CategorySerializer,
    AccountSerializer,
    TransactionSerializer,
    BudgetSerializer,
    InvestmentSerializer,
    SavingsGoalSerializer,
    MonthlyNoteSerializer,
    RecurringTransactionSerializer,
    HouseBudgetSerializer,
    BudgetLineItemSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user) | Category.objects.filter(is_default=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Transaction.objects.filter(user=self.request.user).select_related('category', 'account')

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        # Filter by type
        tx_type = self.request.query_params.get('type')
        if tx_type:
            queryset = queryset.filter(type=tx_type)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)

        # Filter by account
        account = self.request.query_params.get('account')
        if account:
            queryset = queryset.filter(account_id=account)

        return queryset

    def perform_create(self, serializer):
        transaction = serializer.save(user=self.request.user)
        # Update account balance
        account = transaction.account
        if transaction.type == 'income':
            account.balance += transaction.amount
        elif transaction.type == 'expense':
            account.balance -= transaction.amount
        account.save()

    def perform_destroy(self, instance):
        # Reverse the balance change
        account = instance.account
        if instance.type == 'income':
            account.balance -= instance.amount
        elif instance.type == 'expense':
            account.balance += instance.amount
        account.save()
        instance.delete()


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Investment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavingsGoal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MonthlyNoteViewSet(viewsets.ModelViewSet):
    serializer_class = MonthlyNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return MonthlyNote.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RecurringTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringTransaction.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    user = request.user
    now = timezone.now().date()
    month_start = now.replace(day=1)

    # Categories to exclude from income (transfers and refunds aren't real income)
    excluded_income_categories = ['Internal Transfers', 'Shopping']

    # Calculate totals
    accounts = Account.objects.filter(user=user, is_active=True)
    total_balance = accounts.aggregate(Sum('balance'))['balance__sum'] or 0

    monthly_income = Transaction.objects.filter(
        user=user, type='income', date__gte=month_start
    ).exclude(
        category__name__in=excluded_income_categories
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    monthly_expenses = Transaction.objects.filter(
        user=user, type='expense', date__gte=month_start
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    investments = Investment.objects.filter(user=user)
    investment_value = sum(inv.current_value for inv in investments)

    recent_transactions = Transaction.objects.filter(user=user)[:10]
    active_budgets = Budget.objects.filter(user=user, is_active=True)
    savings_goals = SavingsGoal.objects.filter(user=user, is_completed=False)

    return Response({
        'total_balance': total_balance,
        'total_income': monthly_income,
        'total_expenses': monthly_expenses,
        'net_savings': monthly_income - monthly_expenses,
        'investment_value': investment_value,
        'recent_transactions': TransactionSerializer(recent_transactions, many=True).data,
        'budget_status': BudgetSerializer(active_budgets, many=True).data,
        'savings_goals': SavingsGoalSerializer(savings_goals, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_summary(request):
    user = request.user
    now = timezone.now().date()

    # Categories to exclude from income (transfers and refunds aren't real income)
    excluded_income_categories = ['Internal Transfers', 'Shopping']

    # Get last 6 months data
    summaries = []
    for i in range(6):
        month_date = now.replace(day=1) - timedelta(days=i * 30)
        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            next_month = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month = month_start.replace(month=month_start.month + 1)

        income = Transaction.objects.filter(
            user=user, type='income',
            date__gte=month_start, date__lt=next_month
        ).exclude(
            category__name__in=excluded_income_categories
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        expenses = Transaction.objects.filter(
            user=user, type='expense',
            date__gte=month_start, date__lt=next_month
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        summaries.append({
            'month': month_start.strftime('%B %Y'),
            'income': income,
            'expenses': expenses,
            'savings': income - expenses
        })

    return Response(summaries)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expense_by_category(request):
    user = request.user
    now = timezone.now().date()
    month_start = now.replace(day=1)

    expenses = Transaction.objects.filter(
        user=user, type='expense', date__gte=month_start
    ).values('category__name', 'category__color').annotate(
        total=Sum('amount')
    ).order_by('-total')

    return Response(list(expenses))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def monthly_trends(request):
    """Get detailed monthly trends with targets and notes for the last 12 months."""
    user = request.user
    now = timezone.now().date()
    months_count = int(request.query_params.get('months', 12))

    # Categories to exclude from income (transfers and refunds aren't real income)
    excluded_income_categories = ['Internal Transfers', 'Shopping']

    trends = []
    for i in range(months_count):
        # Calculate month boundaries
        if now.month - i <= 0:
            year = now.year - 1
            month = 12 + (now.month - i)
        else:
            year = now.year
            month = now.month - i

        month_start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        month_end = date(year, month, last_day)

        # Get actual income and expenses (excluding transfers/refunds from income)
        income = Transaction.objects.filter(
            user=user, type='income',
            date__gte=month_start, date__lte=month_end
        ).exclude(
            category__name__in=excluded_income_categories
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        expenses = Transaction.objects.filter(
            user=user, type='expense',
            date__gte=month_start, date__lte=month_end
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        savings = float(income) - float(expenses)
        savings_rate = (savings / float(income) * 100) if income > 0 else 0

        # Get monthly note if exists
        try:
            note_obj = MonthlyNote.objects.get(user=user, year=year, month=month)
            note = note_obj.note
            income_target = float(note_obj.income_target) if note_obj.income_target else None
            expense_target = float(note_obj.expense_target) if note_obj.expense_target else None
            savings_target = float(note_obj.savings_target) if note_obj.savings_target else None
        except MonthlyNote.DoesNotExist:
            note = ''
            income_target = None
            expense_target = None
            savings_target = None

        trends.append({
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'income': income,
            'expenses': expenses,
            'savings': savings,
            'savings_rate': round(savings_rate, 1),
            'income_target': income_target,
            'expense_target': expense_target,
            'savings_target': savings_target,
            'note': note,
        })

    return Response(trends)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_monthly_note(request):
    """Save or update a monthly note with targets."""
    user = request.user
    year = request.data.get('year')
    month = request.data.get('month')

    if not year or not month:
        return Response({'error': 'Year and month required'}, status=status.HTTP_400_BAD_REQUEST)

    note_obj, created = MonthlyNote.objects.update_or_create(
        user=user,
        year=year,
        month=month,
        defaults={
            'note': request.data.get('note', ''),
            'income_target': request.data.get('income_target'),
            'expense_target': request.data.get('expense_target'),
            'savings_target': request.data.get('savings_target'),
        }
    )

    return Response(MonthlyNoteSerializer(note_obj).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_overview(request):
    """Get comprehensive budget overview with category breakdown."""
    user = request.user
    now = timezone.now().date()
    month_start = now.replace(day=1)

    # Get all active budgets
    budgets = Budget.objects.filter(user=user, is_active=True)

    # Calculate total budgeted and spent
    total_budgeted = budgets.aggregate(Sum('amount'))['amount__sum'] or 0
    total_spent = Transaction.objects.filter(
        user=user, type='expense', date__gte=month_start
    ).aggregate(Sum('amount'))['amount__sum'] or 0

    # Get spending by category
    category_spending = Transaction.objects.filter(
        user=user, type='expense', date__gte=month_start
    ).values('category__id', 'category__name', 'category__color').annotate(
        spent=Sum('amount')
    ).order_by('-spent')

    # Match with budgets
    budget_data = []
    for budget in budgets:
        spent = Transaction.objects.filter(
            user=user, type='expense',
            category=budget.category,
            date__gte=month_start
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        budget_data.append({
            'id': budget.id,
            'name': budget.name,
            'category': budget.category.name,
            'category_color': budget.category.color,
            'budgeted': float(budget.amount),
            'spent': float(spent),
            'remaining': float(budget.amount) - float(spent),
            'percent_used': round((float(spent) / float(budget.amount) * 100), 1) if budget.amount > 0 else 0,
        })

    # Unbudgeted categories
    budgeted_categories = set(b.category_id for b in budgets)
    unbudgeted = []
    for cat in category_spending:
        if cat['category__id'] not in budgeted_categories:
            unbudgeted.append({
                'category': cat['category__name'],
                'category_color': cat['category__color'],
                'spent': float(cat['spent']),
            })

    return Response({
        'total_budgeted': float(total_budgeted),
        'total_spent': float(total_spent),
        'remaining': float(total_budgeted) - float(total_spent),
        'percent_used': round((float(total_spent) / float(total_budgeted) * 100), 1) if total_budgeted > 0 else 0,
        'budgets': budget_data,
        'unbudgeted_spending': unbudgeted,
    })


class HouseBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = HouseBudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return HouseBudget.objects.filter(user=self.request.user).prefetch_related('line_items')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        """Add a line item to a budget."""
        budget = self.get_object()
        serializer = BudgetLineItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(budget=budget)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate a budget (for creating new month from template)."""
        source = self.get_object()
        new_month = request.data.get('month')
        new_year = request.data.get('year')

        # Create new budget
        new_budget = HouseBudget.objects.create(
            user=request.user,
            name=request.data.get('name', source.name),
            month=new_month,
            year=new_year,
            is_template=False,
            primary_salary=source.primary_salary,
            secondary_income=source.secondary_income,
            other_income=source.other_income,
            partner_name=source.partner_name,
            partner_contribution=source.partner_contribution,
        )

        # Copy line items
        for item in source.line_items.all():
            BudgetLineItem.objects.create(
                budget=new_budget,
                name=item.name,
                amount=item.amount,
                category_type=item.category_type,
                split_type=item.split_type,
                primary_share_percent=item.primary_share_percent,
                group=item.group,
                notes=item.notes,
                order=item.order,
            )

        return Response(HouseBudgetSerializer(new_budget).data, status=status.HTTP_201_CREATED)


class BudgetLineItemViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetLineItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BudgetLineItem.objects.filter(budget__user=self.request.user)

    def perform_create(self, serializer):
        budget_id = self.request.data.get('budget')
        budget = HouseBudget.objects.get(id=budget_id, user=self.request.user)
        serializer.save(budget=budget)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_spending_breakdown(request):
    """Get spending breakdown by smart categories (Groceries, Eating Out, etc.) for multiple months."""
    user = request.user
    months_count = int(request.query_params.get('months', 4))

    # Category keywords
    CATEGORIES = {
        'Groceries': {
            'keywords': ['tesco', 'sainsbury', 'asda', 'marks & spencer', 'm&s', 'aldi', 'lidl', 'co-op', 'costco', 'morrisons', 'waitrose'],
            'exclude': ['petrol', 'fuel'],
            'budget': 350,
        },
        'Eating Out': {
            'keywords': ['starbucks', 'costa', 'mcdonald', 'burger', 'kfc', 'nando', 'pizza', 'domino', 'deliveroo', 'uber eats', 'just eat', 'restaurant', 'cafe', 'coffee', 'pub', 'grill', 'greggs', 'pret', 'subway', 'wagamama', 'gail', 'leon', 'itsu', 'bakery', 'kebab', 'frankie', 'benny', 'mowgli', 'zizzi', 'prezzo', 'ask italian'],
            'exclude': ['village hotel', 'village gym'],
            'budget': 150,
        },
        'Transport': {
            'keywords': ['petrol', 'fuel', 'parking', 'train', 'bus', 'taxi', 'toll', 'car wash', 'national rail', 'trainline', 'tfl'],
            'exclude': [],
            'budget': 120,
        },
        'Health & Fitness': {
            'keywords': ['pharmacy', 'boots', 'superdrug', 'dentist', 'doctor', 'hospital', 'gym', 'puregym', 'village gym', 'village hotel'],
            'exclude': [],
            'budget': 61,
        },
        'Shopping': {
            'keywords': ['amazon', 'ebay', 'argos', 'john lewis', 'currys', 'next', 'primark', 'zara', 'h&m', 'asos', 'tk maxx'],
            'exclude': ['amazon prime', 'prime video'],
            'budget': 100,
        },
    }

    now = timezone.now().date()
    results = []

    for i in range(months_count):
        # Calculate month boundaries
        if now.month - i <= 0:
            year = now.year - 1
            month = 12 + (now.month - i)
        else:
            year = now.year
            month = now.month - i

        month_start = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        month_end = date(year, month, last_day)

        # Get all transactions for this month
        transactions = Transaction.objects.filter(
            user=user,
            date__gte=month_start,
            date__lte=month_end
        )

        month_data = {
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'categories': {}
        }

        for cat_name, cat_config in CATEGORIES.items():
            total = 0
            count = 0

            for t in transactions:
                desc = t.description.lower() if t.description else ''
                amt = abs(float(t.amount))

                # Skip large amounts (likely salary/transfers)
                if amt > 2000:
                    continue

                # Check if matches category keywords
                matches = any(kw in desc for kw in cat_config['keywords'])
                excluded = any(ex in desc for ex in cat_config['exclude'])

                if matches and not excluded:
                    total += amt
                    count += 1

            month_data['categories'][cat_name] = {
                'total': round(total, 2),
                'count': count,
                'budget': cat_config['budget'],
                'variance': round(cat_config['budget'] - total, 2),
            }

        results.append(month_data)

    return Response(results)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_default_house_budget(request):
    """Create a default house budget with Nishant's template data."""
    user = request.user

    # Check if template already exists
    existing = HouseBudget.objects.filter(user=user, is_template=True).first()
    if existing:
        return Response(HouseBudgetSerializer(existing).data)

    # Create the budget template based on spreadsheet
    # Nishant Salary: £4,200, Krati Salary: £3,000
    # Total Household Income: £7,200
    budget = HouseBudget.objects.create(
        user=user,
        name='House Budget Template',
        is_template=True,
        primary_salary=4200,  # Nishant's salary
        secondary_income=0,   # No secondary income (Monzo is just a transfer)
        other_income=0,
        partner_name='Krati',
        partner_contribution=3000,  # Krati's salary
    )

    # Expenses from spreadsheet with groups
    expenses = [
        # Housing
        {'name': 'Mortgage', 'amount': 1205, 'group': 'Housing'},
        {'name': 'Insurance (Home)', 'amount': 150, 'group': 'Housing'},
        {'name': 'Gas, Electricity, Water', 'amount': 180, 'group': 'Housing'},
        {'name': 'Council Tax', 'amount': 275, 'group': 'Housing'},
        {'name': 'House Work', 'amount': 200, 'group': 'Housing'},
        {'name': 'Sky', 'amount': 45, 'group': 'Housing'},
        # Transport
        {'name': 'Car Insurance', 'amount': 60, 'group': 'Transport'},
        {'name': 'Lease Car', 'amount': 0, 'group': 'Transport'},
        {'name': 'Car Fuel', 'amount': 60, 'group': 'Transport'},
        {'name': 'Car Tax', 'amount': 0, 'group': 'Transport'},
        # Living
        {'name': 'Grocery', 'amount': 350, 'group': 'Living'},
        {'name': 'Dining out and Entertainment', 'amount': 0, 'group': 'Living'},
        # Subscriptions
        {'name': 'Spotify, Netflix, Amazon', 'amount': 20, 'group': 'Subscriptions', 'split_type': 'personal_primary', 'notes': 'Paid from Personal'},
        # Family
        {'name': 'Childcare', 'amount': 500, 'group': 'Family'},
        {'name': 'Kiaan monthly', 'amount': 200, 'group': 'Family'},
        # Property
        {'name': 'India Property - LKO', 'amount': 450, 'group': 'Property'},
        {'name': 'India House - JSR', 'amount': 0, 'group': 'Property'},
    ]

    # Savings
    savings = [
        {'name': 'Money Farm - JISA (Kiaan)', 'amount': 100, 'group': 'Savings'},
        {'name': 'Money Farm - Us', 'amount': 500, 'group': 'Savings'},
        {'name': 'Cash Saving', 'amount': 300, 'group': 'Savings'},
        {'name': 'Holiday Saving', 'amount': 500, 'group': 'Savings'},
        {'name': 'India Investment (SCB)', 'amount': 300, 'group': 'Savings', 'notes': 'Up-to 2031'},
    ]

    # Personal savings
    personal_savings = [
        {'name': 'Mandatory Personal Savings', 'amount': 250, 'group': 'Personal', 'split_type': 'personal_primary'},
        {'name': 'Personal Expenses Buffer', 'amount': 150, 'group': 'Personal', 'split_type': 'personal_primary'},
        {'name': 'India Property Investment', 'amount': 145, 'group': 'Personal', 'split_type': 'personal_primary'},
    ]

    # Create line items
    order = 0
    # Calculate share percentages based on spreadsheet
    # Shared Expenses: £3555, Nishant: £2255, Krati: £1300
    # Nishant pays 63.4% of shared expenses
    nishant_share = round((2255 / 3555) * 100, 2)  # ~63.4%

    for item in expenses:
        BudgetLineItem.objects.create(
            budget=budget,
            name=item['name'],
            amount=item['amount'],
            category_type='expense',
            split_type=item.get('split_type', 'shared'),
            primary_share_percent=nishant_share if item.get('split_type', 'shared') == 'shared' else 100,
            group=item['group'],
            notes=item.get('notes', ''),
            order=order,
        )
        order += 1

    # Shared savings: £1700, Nishant: £1400
    savings_share = round((1400 / 1700) * 100, 2)  # ~82.4%

    for item in savings:
        BudgetLineItem.objects.create(
            budget=budget,
            name=item['name'],
            amount=item['amount'],
            category_type='saving',
            split_type='shared',
            primary_share_percent=savings_share,
            group=item['group'],
            notes=item.get('notes', ''),
            order=order,
        )
        order += 1

    for item in personal_savings:
        BudgetLineItem.objects.create(
            budget=budget,
            name=item['name'],
            amount=item['amount'],
            category_type='saving',
            split_type=item['split_type'],
            primary_share_percent=100,
            group=item['group'],
            notes=item.get('notes', ''),
            order=order,
        )
        order += 1

    return Response(HouseBudgetSerializer(budget).data, status=status.HTTP_201_CREATED)
