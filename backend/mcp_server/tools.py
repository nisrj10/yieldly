"""
Yiedly MCP Tools - Financial Data Access

EFFICIENCY RULES:
1. All responses are kept compact - no unnecessary fields
2. Monetary values are rounded to 2 decimal places
3. Lists are limited by default (use limit parameter to get more)
4. Use get_financial_summary() first - it's the most efficient overview
5. Only fetch detailed data when specifically needed
6. Dates are ISO format strings, not full datetime objects
"""
import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from datetime import date, datetime
from django.db.models import Sum
from django.utils import timezone
from accounts.models import User, Household
from finance.models import (
    Portfolio, PortfolioSnapshot, SavingsGoal, HouseBudget,
    BudgetLineItem, Transaction
)

# Constants
MAX_LIST_ITEMS = 10
MAX_MONTHS = 6
MONTHLY_EXPENSES = 3466  # Used for emergency fund calculation


def _round(value, decimals=2):
    """Round to specified decimal places."""
    return round(float(value), decimals) if value else 0


def _get_household_users():
    """Get users in the Raj Family household. Cached for efficiency."""
    household = Household.objects.filter(name='Raj Family').first()
    if household:
        return User.objects.filter(household=household)
    return User.objects.none()


def get_financial_summary() -> dict:
    """
    Get a compact financial overview. START HERE - most efficient for general questions.
    Returns: net worth, emergency fund status, investment totals, goal progress.
    ~300 tokens response.
    """
    users = _get_household_users()
    portfolios = Portfolio.objects.filter(user__in=users, is_active=True).only(
        'current_value', 'portfolio_type', 'owner_name', 'name'
    )

    # Aggregate by type using Python to avoid multiple queries
    totals = {'isa': 0, 'jisa': 0, 'pension': 0, 'gia': 0, 'savings': 0, 'emergency': 0, 'pot': 0}
    kiaan_total = 0
    emergency_total = 0

    for p in portfolios:
        val = float(p.current_value)
        if p.portfolio_type in totals:
            totals[p.portfolio_type] += val
        if p.owner_name and 'kiaan' in p.owner_name.lower():
            kiaan_total += val
        if p.portfolio_type == 'emergency' or 'emergency' in p.name.lower():
            emergency_total += val

    investments = totals['isa'] + totals['jisa'] + totals['pension'] + totals['gia']
    savings = totals['savings'] + totals['emergency']
    pots = totals['pot']
    family_total = investments + savings + pots
    my_total = family_total - kiaan_total

    # Goals summary - single query
    goals_agg = SavingsGoal.objects.filter(
        user__in=users, is_completed=False
    ).aggregate(
        total_target=Sum('target_amount'),
        total_saved=Sum('current_amount')
    )
    target = float(goals_agg['total_target'] or 0)
    saved = float(goals_agg['total_saved'] or 0)

    return {
        'net_worth': {
            'mine': _round(my_total),
            'kiaan': _round(kiaan_total),
            'family': _round(family_total),
        },
        'breakdown': {
            'investments': _round(investments),
            'savings': _round(savings),
            'pots': _round(pots),
        },
        'emergency_fund': {
            'amount': _round(emergency_total),
            'months_covered': _round(emergency_total / MONTHLY_EXPENSES, 1),
        },
        'goals': {
            'target': _round(target),
            'saved': _round(saved),
            'progress_pct': _round(saved / target * 100, 1) if target > 0 else 0,
        },
    }


def get_portfolios(limit: int = MAX_LIST_ITEMS) -> dict:
    """
    Get portfolio list with values. Use limit to control response size.
    Default: 10 items. ~400 tokens for 10 portfolios.
    """
    users = _get_household_users()
    portfolios = Portfolio.objects.filter(
        user__in=users, is_active=True
    ).only(
        'id', 'name', 'portfolio_type', 'owner_name', 'current_value', 'initial_value'
    ).order_by('-current_value')[:limit]

    result = []
    for p in portfolios:
        gain = 0
        if p.initial_value and p.initial_value > 0:
            gain = _round((float(p.current_value) - float(p.initial_value)) / float(p.initial_value) * 100, 1)

        result.append({
            'id': p.id,
            'name': p.name,
            'type': p.portfolio_type,
            'owner': p.owner_name or 'Family',
            'value': _round(p.current_value),
            'gain_pct': gain,
        })

    return {'portfolios': result, 'count': len(result), 'limited': len(result) == limit}


def get_savings_goals(limit: int = MAX_LIST_ITEMS) -> dict:
    """
    Get active savings goals. ~200 tokens for typical response.
    """
    users = _get_household_users()
    goals = SavingsGoal.objects.filter(
        user__in=users, is_completed=False
    ).only(
        'id', 'name', 'target_amount', 'current_amount', 'target_date'
    ).order_by('-current_amount')[:limit]

    result = []
    for g in goals:
        progress = _round(float(g.current_amount) / float(g.target_amount) * 100, 1) if g.target_amount > 0 else 0
        result.append({
            'id': g.id,
            'name': g.name,
            'target': _round(g.target_amount),
            'saved': _round(g.current_amount),
            'remaining': _round(g.target_amount - g.current_amount),
            'progress_pct': progress,
            'target_date': g.target_date.isoformat() if g.target_date else None,
        })

    return {'goals': result, 'count': len(result)}


def get_house_budget(summary_only: bool = False) -> dict:
    """
    Get household budget. Use summary_only=True for compact response (~150 tokens).
    Full response with line items: ~500 tokens.
    """
    users = _get_household_users()
    budget = HouseBudget.objects.filter(user__in=users, is_template=True).first()

    if not budget:
        return {'error': 'No budget found'}

    total_income = float(
        budget.primary_salary + budget.secondary_income +
        budget.other_income + budget.partner_contribution
    )

    if summary_only:
        # Quick aggregation
        items = BudgetLineItem.objects.filter(budget=budget)
        expenses = sum(float(i.amount) for i in items if i.category_type == 'expense')
        savings = sum(float(i.amount) for i in items if i.category_type == 'saving')

        return {
            'income': _round(total_income),
            'expenses': _round(expenses),
            'savings': _round(savings),
            'buffer': _round(total_income - expenses - savings),
        }

    # Full budget with grouped items
    items = BudgetLineItem.objects.filter(budget=budget).order_by('group', 'order')
    groups = {}
    total_expenses = 0
    total_savings = 0

    for item in items:
        group = item.group or 'Other'
        if group not in groups:
            groups[group] = []
        groups[group].append({
            'name': item.name,
            'amount': _round(item.amount),
            'type': item.category_type,
        })
        if item.category_type == 'expense':
            total_expenses += float(item.amount)
        else:
            total_savings += float(item.amount)

    return {
        'income': {
            'primary': _round(budget.primary_salary),
            'partner': _round(budget.partner_contribution),
            'other': _round(budget.secondary_income + budget.other_income),
            'total': _round(total_income),
        },
        'totals': {
            'expenses': _round(total_expenses),
            'savings': _round(total_savings),
            'buffer': _round(total_income - total_expenses - total_savings),
        },
        'by_group': groups,
    }


def get_monthly_spending(months: int = 3) -> dict:
    """
    Get monthly income/expenses. Max 6 months to limit response size.
    ~150 tokens per month.
    """
    months = min(months, MAX_MONTHS)
    users = _get_household_users()
    now = timezone.now().date()

    results = []
    for i in range(months):
        total_months = now.year * 12 + now.month - i
        year = (total_months - 1) // 12
        month = (total_months - 1) % 12 + 1

        month_start = date(year, month, 1)
        month_end = date(year, month + 1, 1) if month < 12 else date(year + 1, 1, 1)

        # Single query with aggregation
        income = Transaction.objects.filter(
            user__in=users, type='income',
            date__gte=month_start, date__lt=month_end
        ).exclude(
            category__name__in=['Internal Transfers', 'Shopping']
        ).aggregate(total=Sum('amount'))['total'] or 0

        expenses = Transaction.objects.filter(
            user__in=users, type='expense',
            date__gte=month_start, date__lt=month_end
        ).aggregate(total=Sum('amount'))['total'] or 0

        income_f = float(income)
        expenses_f = float(expenses)
        savings = income_f - expenses_f

        results.append({
            'month': f"{year}-{month:02d}",
            'income': _round(income_f),
            'expenses': _round(expenses_f),
            'savings': _round(savings),
            'rate_pct': _round(savings / income_f * 100, 1) if income_f > 0 else 0,
        })

    return {'months': results}


def update_portfolio_value(portfolio_id: int, new_value: float, notes: str = '') -> dict:
    """
    Update portfolio value. Creates monthly snapshot. ~100 tokens response.
    """
    users = _get_household_users()

    try:
        portfolio = Portfolio.objects.get(id=portfolio_id, user__in=users)
    except Portfolio.DoesNotExist:
        return {'error': f'Portfolio {portfolio_id} not found'}

    old_value = float(portfolio.current_value)
    portfolio.current_value = Decimal(str(new_value))
    portfolio.save()

    # Create/update snapshot
    now = timezone.now()
    PortfolioSnapshot.objects.update_or_create(
        portfolio=portfolio, year=now.year, month=now.month,
        defaults={'value': new_value, 'notes': notes}
    )

    change = new_value - old_value
    return {
        'success': True,
        'portfolio': portfolio.name,
        'old': _round(old_value),
        'new': _round(new_value),
        'change': _round(change),
        'change_pct': _round(change / old_value * 100, 1) if old_value > 0 else 0,
    }


def add_funds_to_goal(goal_id: int, amount: float) -> dict:
    """
    Add funds to savings goal. ~100 tokens response.
    """
    users = _get_household_users()

    try:
        goal = SavingsGoal.objects.get(id=goal_id, user__in=users)
    except SavingsGoal.DoesNotExist:
        return {'error': f'Goal {goal_id} not found'}

    old_amount = float(goal.current_amount)
    goal.current_amount += Decimal(str(amount))

    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True

    goal.save()

    return {
        'success': True,
        'goal': goal.name,
        'added': _round(amount),
        'new_total': _round(goal.current_amount),
        'target': _round(goal.target_amount),
        'progress_pct': _round(float(goal.current_amount) / float(goal.target_amount) * 100, 1),
        'completed': goal.is_completed,
    }


def create_savings_goal(name: str, target_amount: float, target_date: str = None) -> dict:
    """
    Create new savings goal. ~80 tokens response.
    """
    users = _get_household_users()
    primary_user = users.first()

    if not primary_user:
        return {'error': 'No user found'}

    goal = SavingsGoal.objects.create(
        user=primary_user,
        name=name,
        target_amount=Decimal(str(target_amount)),
        current_amount=Decimal('0'),
        target_date=datetime.strptime(target_date, '%Y-%m-%d').date() if target_date else None,
    )

    return {
        'success': True,
        'id': goal.id,
        'name': goal.name,
        'target': _round(goal.target_amount),
    }


def get_financial_health_check() -> dict:
    """
    Quick financial health analysis. ~250 tokens response.
    Includes score, key insights, and any warnings.
    """
    summary = get_financial_summary()
    spending = get_monthly_spending(3)

    insights = []
    warnings = []

    # Emergency fund
    months = summary['emergency_fund']['months_covered']
    if months >= 6:
        insights.append(f"Emergency fund healthy: {months} months")
    elif months >= 3:
        warnings.append(f"Emergency fund at {months} months - target 6")
    else:
        warnings.append(f"Emergency fund low: {months} months")

    # Savings rate
    if spending['months']:
        rates = [m['rate_pct'] for m in spending['months'] if m['rate_pct'] > 0]
        if rates:
            avg_rate = sum(rates) / len(rates)
            if avg_rate >= 30:
                insights.append(f"Excellent savings: {avg_rate:.0f}%")
            elif avg_rate >= 20:
                insights.append(f"Good savings: {avg_rate:.0f}%")
            elif avg_rate > 0:
                warnings.append(f"Low savings rate: {avg_rate:.0f}%")

    # Goals
    if summary['goals']['progress_pct'] > 0:
        insights.append(f"Goals: {summary['goals']['progress_pct']:.0f}% progress")

    # Calculate score (0-100)
    score = min(100, max(0, int(
        months * 10 +  # Up to 60 for 6 months
        (avg_rate if 'avg_rate' in dir() else 0) +  # Up to 30+
        summary['goals']['progress_pct'] / 10  # Up to 10
    )))

    return {
        'score': score,
        'status': 'excellent' if score >= 80 else 'good' if score >= 60 else 'needs_attention',
        'insights': insights,
        'warnings': warnings,
        'net_worth': summary['net_worth']['family'],
    }


# ============================================================
# TOOL REGISTRY
# ============================================================
TOOLS = {
    'get_financial_summary': {
        'function': get_financial_summary,
        'description': 'Get compact financial overview (net worth, emergency fund, goals). START HERE for general questions. ~300 tokens.',
        'parameters': {},
    },
    'get_portfolios': {
        'function': get_portfolios,
        'description': 'List portfolios with values. Use limit param to control size.',
        'parameters': {
            'limit': {'type': 'integer', 'description': 'Max items (default 10)', 'default': 10},
        },
    },
    'get_savings_goals': {
        'function': get_savings_goals,
        'description': 'List active savings goals with progress.',
        'parameters': {
            'limit': {'type': 'integer', 'description': 'Max items (default 10)', 'default': 10},
        },
    },
    'get_house_budget': {
        'function': get_house_budget,
        'description': 'Get household budget. Use summary_only=True for compact response.',
        'parameters': {
            'summary_only': {'type': 'boolean', 'description': 'Return summary only (default False)', 'default': False},
        },
    },
    'get_monthly_spending': {
        'function': get_monthly_spending,
        'description': 'Get monthly income/expenses/savings. Max 6 months.',
        'parameters': {
            'months': {'type': 'integer', 'description': 'Months to fetch (default 3, max 6)', 'default': 3},
        },
    },
    'update_portfolio_value': {
        'function': update_portfolio_value,
        'description': 'Update a portfolio value.',
        'parameters': {
            'portfolio_id': {'type': 'integer', 'description': 'Portfolio ID', 'required': True},
            'new_value': {'type': 'number', 'description': 'New value in GBP', 'required': True},
            'notes': {'type': 'string', 'description': 'Optional notes', 'default': ''},
        },
    },
    'add_funds_to_goal': {
        'function': add_funds_to_goal,
        'description': 'Add funds to a savings goal.',
        'parameters': {
            'goal_id': {'type': 'integer', 'description': 'Goal ID', 'required': True},
            'amount': {'type': 'number', 'description': 'Amount in GBP', 'required': True},
        },
    },
    'create_savings_goal': {
        'function': create_savings_goal,
        'description': 'Create a new savings goal.',
        'parameters': {
            'name': {'type': 'string', 'description': 'Goal name', 'required': True},
            'target_amount': {'type': 'number', 'description': 'Target in GBP', 'required': True},
            'target_date': {'type': 'string', 'description': 'Date YYYY-MM-DD', 'default': None},
        },
    },
    'get_financial_health_check': {
        'function': get_financial_health_check,
        'description': 'Quick health analysis with score and insights. ~250 tokens.',
        'parameters': {},
    },
}
