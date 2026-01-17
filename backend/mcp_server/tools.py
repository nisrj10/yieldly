"""
MCP Tools for Yiedly Financial Data

These tools allow Claude to read and interact with Yiedly financial data.
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
    BudgetLineItem, Transaction, Account, Investment
)


def get_household_users():
    """Get users in the Raj Family household."""
    household = Household.objects.filter(name='Raj Family').first()
    if household:
        return User.objects.filter(household=household)
    return User.objects.none()


def get_financial_summary() -> dict:
    """
    Get a comprehensive financial summary including net worth,
    emergency fund status, investments, and savings goals.
    """
    household_users = get_household_users()

    # Get all portfolios
    portfolios = Portfolio.objects.filter(user__in=household_users, is_active=True)

    # Calculate totals by type
    investments = portfolios.filter(portfolio_type__in=['isa', 'jisa', 'pension', 'gia'])
    savings = portfolios.filter(portfolio_type__in=['savings', 'emergency'])
    pots = portfolios.filter(portfolio_type='pot')

    total_investments = sum(p.current_value for p in investments)
    total_savings = sum(p.current_value for p in savings)
    total_pots = sum(p.current_value for p in pots)

    # Separate Kiaan's portfolios
    kiaan_portfolios = portfolios.filter(owner_name__icontains='kiaan')
    kiaan_net_worth = sum(p.current_value for p in kiaan_portfolios)

    my_net_worth = total_investments + total_savings + total_pots - kiaan_net_worth
    total_net_worth = total_investments + total_savings + total_pots

    # Emergency fund calculation
    emergency_portfolios = portfolios.filter(portfolio_type='emergency') | portfolios.filter(name__icontains='emergency')
    emergency_fund = sum(p.current_value for p in emergency_portfolios)

    # Get savings goals
    goals = SavingsGoal.objects.filter(user__in=household_users, is_completed=False)
    total_goal_target = sum(g.target_amount for g in goals)
    total_goal_saved = sum(g.current_amount for g in goals)

    return {
        'summary': {
            'my_net_worth': float(my_net_worth),
            'kiaan_net_worth': float(kiaan_net_worth),
            'family_total': float(total_net_worth),
            'total_investments': float(total_investments),
            'total_savings': float(total_savings),
            'total_pots': float(total_pots),
            'emergency_fund': float(emergency_fund),
            'emergency_months_covered': round(float(emergency_fund) / 3466, 1),  # Based on monthly expenses
        },
        'goals': {
            'active_count': goals.count(),
            'total_target': float(total_goal_target),
            'total_saved': float(total_goal_saved),
            'progress_percent': round(float(total_goal_saved) / float(total_goal_target) * 100, 1) if total_goal_target > 0 else 0,
        },
        'timestamp': datetime.now().isoformat(),
    }


def get_portfolios() -> dict:
    """Get all portfolios with their current values and performance."""
    household_users = get_household_users()
    portfolios = Portfolio.objects.filter(user__in=household_users, is_active=True)

    result = []
    for p in portfolios:
        # Calculate YTD return
        year_start = date(date.today().year, 1, 1)
        start_snapshot = PortfolioSnapshot.objects.filter(
            portfolio=p, year=year_start.year, month=1
        ).first()

        ytd_return = 0
        if start_snapshot and start_snapshot.value > 0:
            ytd_return = ((float(p.current_value) - float(start_snapshot.value)) / float(start_snapshot.value)) * 100

        # Calculate all-time return
        all_time_return = 0
        if p.initial_value and p.initial_value > 0:
            all_time_return = ((float(p.current_value) - float(p.initial_value)) / float(p.initial_value)) * 100

        result.append({
            'id': p.id,
            'name': p.name,
            'type': p.portfolio_type,
            'owner': p.owner_name or 'Family',
            'current_value': float(p.current_value),
            'initial_value': float(p.initial_value) if p.initial_value else None,
            'ytd_return_percent': round(ytd_return, 1),
            'all_time_return_percent': round(all_time_return, 1),
        })

    return {'portfolios': result, 'count': len(result)}


def get_savings_goals() -> dict:
    """Get all active savings goals with progress."""
    household_users = get_household_users()
    goals = SavingsGoal.objects.filter(user__in=household_users, is_completed=False)

    result = []
    for g in goals:
        progress = (float(g.current_amount) / float(g.target_amount) * 100) if g.target_amount > 0 else 0
        result.append({
            'id': g.id,
            'name': g.name,
            'target_amount': float(g.target_amount),
            'current_amount': float(g.current_amount),
            'remaining': float(g.target_amount - g.current_amount),
            'progress_percent': round(progress, 1),
            'target_date': g.target_date.isoformat() if g.target_date else None,
        })

    return {'goals': result, 'count': len(result)}


def get_house_budget() -> dict:
    """Get the house budget with all line items."""
    household_users = get_household_users()
    budget = HouseBudget.objects.filter(user__in=household_users, is_template=True).first()

    if not budget:
        return {'error': 'No house budget found'}

    line_items = BudgetLineItem.objects.filter(budget=budget).order_by('group', 'order')

    # Group items
    groups = {}
    for item in line_items:
        group = item.group or 'Other'
        if group not in groups:
            groups[group] = []
        groups[group].append({
            'name': item.name,
            'amount': float(item.amount),
            'category_type': item.category_type,
            'split_type': item.split_type,
            'notes': item.notes,
        })

    total_income = float(budget.primary_salary + budget.secondary_income + budget.other_income + budget.partner_contribution)
    total_expenses = sum(float(item.amount) for item in line_items if item.category_type == 'expense')
    total_savings = sum(float(item.amount) for item in line_items if item.category_type == 'saving')

    return {
        'budget': {
            'name': budget.name,
            'income': {
                'primary_salary': float(budget.primary_salary),
                'secondary_income': float(budget.secondary_income),
                'other_income': float(budget.other_income),
                'partner_contribution': float(budget.partner_contribution),
                'total': total_income,
            },
            'total_expenses': total_expenses,
            'total_savings': total_savings,
            'monthly_buffer': total_income - total_expenses - total_savings,
        },
        'line_items_by_group': groups,
    }


def get_monthly_spending(months: int = 3) -> dict:
    """Get monthly spending breakdown for the last N months."""
    household_users = get_household_users()
    now = timezone.now().date()

    results = []
    for i in range(months):
        total_months = now.year * 12 + now.month - i
        year = (total_months - 1) // 12
        month = (total_months - 1) % 12 + 1

        month_start = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1)
        else:
            month_end = date(year, month + 1, 1)

        # Get transactions
        income = Transaction.objects.filter(
            user__in=household_users, type='income',
            date__gte=month_start, date__lt=month_end
        ).exclude(
            category__name__in=['Internal Transfers', 'Shopping']
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        expenses = Transaction.objects.filter(
            user__in=household_users, type='expense',
            date__gte=month_start, date__lt=month_end
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        results.append({
            'year': year,
            'month': month,
            'month_name': date(year, month, 1).strftime('%B %Y'),
            'income': float(income),
            'expenses': float(expenses),
            'savings': float(income) - float(expenses),
            'savings_rate': round((float(income) - float(expenses)) / float(income) * 100, 1) if income > 0 else 0,
        })

    return {'monthly_data': results}


def update_portfolio_value(portfolio_id: int, new_value: float, notes: str = '') -> dict:
    """Update a portfolio's current value and create a snapshot."""
    household_users = get_household_users()

    try:
        portfolio = Portfolio.objects.get(id=portfolio_id, user__in=household_users)
    except Portfolio.DoesNotExist:
        return {'error': f'Portfolio {portfolio_id} not found'}

    old_value = float(portfolio.current_value)
    portfolio.current_value = Decimal(str(new_value))
    portfolio.save()

    # Create snapshot
    now = timezone.now()
    snapshot, created = PortfolioSnapshot.objects.update_or_create(
        portfolio=portfolio,
        year=now.year,
        month=now.month,
        defaults={'value': new_value, 'notes': notes}
    )

    return {
        'success': True,
        'portfolio': portfolio.name,
        'old_value': old_value,
        'new_value': new_value,
        'change': new_value - old_value,
        'change_percent': round((new_value - old_value) / old_value * 100, 2) if old_value > 0 else 0,
    }


def add_funds_to_goal(goal_id: int, amount: float) -> dict:
    """Add funds to an existing savings goal."""
    household_users = get_household_users()

    try:
        goal = SavingsGoal.objects.get(id=goal_id, user__in=household_users)
    except SavingsGoal.DoesNotExist:
        return {'error': f'Goal {goal_id} not found'}

    old_amount = float(goal.current_amount)
    goal.current_amount += Decimal(str(amount))

    # Check if goal is completed
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True

    goal.save()

    progress = (float(goal.current_amount) / float(goal.target_amount) * 100) if goal.target_amount > 0 else 0

    return {
        'success': True,
        'goal': goal.name,
        'added': amount,
        'old_amount': old_amount,
        'new_amount': float(goal.current_amount),
        'target': float(goal.target_amount),
        'remaining': float(goal.target_amount - goal.current_amount),
        'progress_percent': round(progress, 1),
        'is_completed': goal.is_completed,
    }


def create_savings_goal(name: str, target_amount: float, target_date: str = None) -> dict:
    """Create a new savings goal."""
    household_users = get_household_users()
    primary_user = household_users.first()

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
        'goal': {
            'id': goal.id,
            'name': goal.name,
            'target_amount': float(goal.target_amount),
            'target_date': goal.target_date.isoformat() if goal.target_date else None,
        }
    }


def get_financial_health_check() -> dict:
    """
    Perform a comprehensive financial health check and provide insights.
    """
    summary = get_financial_summary()
    goals = get_savings_goals()
    budget = get_house_budget()
    spending = get_monthly_spending(3)

    insights = []
    warnings = []
    recommendations = []

    # Emergency fund check
    emergency_months = summary['summary']['emergency_months_covered']
    if emergency_months >= 6:
        insights.append(f"Emergency fund is healthy at {emergency_months} months coverage")
    elif emergency_months >= 3:
        warnings.append(f"Emergency fund at {emergency_months} months - aim for 6 months")
    else:
        warnings.append(f"Emergency fund critically low at {emergency_months} months")
        recommendations.append("Priority: Build emergency fund to at least 3 months of expenses")

    # Savings rate check
    if spending['monthly_data']:
        avg_savings_rate = sum(m['savings_rate'] for m in spending['monthly_data']) / len(spending['monthly_data'])
        if avg_savings_rate >= 30:
            insights.append(f"Excellent savings rate of {avg_savings_rate:.1f}%")
        elif avg_savings_rate >= 20:
            insights.append(f"Good savings rate of {avg_savings_rate:.1f}%")
        else:
            warnings.append(f"Savings rate at {avg_savings_rate:.1f}% - target 20%+")

    # Goal progress
    goal_progress = summary['goals']['progress_percent']
    if goal_progress > 0:
        insights.append(f"Overall goal progress: {goal_progress}%")

    # Investment diversification
    portfolios = get_portfolios()
    if portfolios['count'] >= 3:
        insights.append(f"Portfolio diversified across {portfolios['count']} accounts")

    return {
        'health_score': min(100, int(emergency_months * 10 + (avg_savings_rate if spending['monthly_data'] else 0) + goal_progress / 2)),
        'insights': insights,
        'warnings': warnings,
        'recommendations': recommendations,
        'summary': summary['summary'],
        'timestamp': datetime.now().isoformat(),
    }


# Tool registry for MCP
TOOLS = {
    'get_financial_summary': {
        'function': get_financial_summary,
        'description': 'Get a comprehensive financial summary including net worth, emergency fund, investments, and goals progress.',
        'parameters': {},
    },
    'get_portfolios': {
        'function': get_portfolios,
        'description': 'Get all investment portfolios with current values and performance metrics.',
        'parameters': {},
    },
    'get_savings_goals': {
        'function': get_savings_goals,
        'description': 'Get all active savings goals with progress tracking.',
        'parameters': {},
    },
    'get_house_budget': {
        'function': get_house_budget,
        'description': 'Get the household budget with income, expenses, and savings allocations.',
        'parameters': {},
    },
    'get_monthly_spending': {
        'function': get_monthly_spending,
        'description': 'Get monthly income, expenses, and savings for recent months.',
        'parameters': {
            'months': {'type': 'integer', 'description': 'Number of months to retrieve (default: 3)', 'default': 3},
        },
    },
    'update_portfolio_value': {
        'function': update_portfolio_value,
        'description': 'Update a portfolio current value. Use this when portfolio values need to be updated.',
        'parameters': {
            'portfolio_id': {'type': 'integer', 'description': 'The portfolio ID to update', 'required': True},
            'new_value': {'type': 'number', 'description': 'The new current value in GBP', 'required': True},
            'notes': {'type': 'string', 'description': 'Optional notes about the update', 'default': ''},
        },
    },
    'add_funds_to_goal': {
        'function': add_funds_to_goal,
        'description': 'Add funds to an existing savings goal.',
        'parameters': {
            'goal_id': {'type': 'integer', 'description': 'The goal ID to add funds to', 'required': True},
            'amount': {'type': 'number', 'description': 'Amount to add in GBP', 'required': True},
        },
    },
    'create_savings_goal': {
        'function': create_savings_goal,
        'description': 'Create a new savings goal.',
        'parameters': {
            'name': {'type': 'string', 'description': 'Name of the goal', 'required': True},
            'target_amount': {'type': 'number', 'description': 'Target amount in GBP', 'required': True},
            'target_date': {'type': 'string', 'description': 'Target date in YYYY-MM-DD format', 'default': None},
        },
    },
    'get_financial_health_check': {
        'function': get_financial_health_check,
        'description': 'Perform a comprehensive financial health check with insights, warnings, and recommendations.',
        'parameters': {},
    },
}
