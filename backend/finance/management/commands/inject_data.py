from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from finance.models import Category, Account, Transaction, Budget, Investment, SavingsGoal
from accounts.models import Household
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Inject Nishant and Krati financial data'

    def handle(self, *args, **options):
        # Create Nishant user first
        nishant, created = User.objects.get_or_create(
            email='nishant@yiedly.com',
            defaults={
                'username': 'nishant',
                'first_name': 'Nishant',
                'last_name': 'Raj',
            }
        )
        if created:
            nishant.set_password('yiedly123')
            nishant.save()

        # Create household
        household, _ = Household.objects.get_or_create(
            name="Raj Family",
            defaults={'created_by': nishant}
        )

        nishant.household = household
        nishant.save()

        # Create Krati user
        krati, created = User.objects.get_or_create(
            email='krati@yiedly.com',
            defaults={
                'username': 'krati',
                'first_name': 'Krati',
                'last_name': 'Raj',
            }
        )
        if created:
            krati.set_password('yiedly123')
            krati.save()
        krati.household = household
        krati.save()

        self.stdout.write(self.style.SUCCESS(f'Users created: nishant@yiedly.com, krati@yiedly.com (password: yiedly123)'))

        # Create custom categories for UK expenses
        categories_data = [
            # Income
            {'name': 'Salary', 'type': 'income', 'color': '#22c55e'},
            # Expenses
            {'name': 'Mortgage', 'type': 'expense', 'color': '#ef4444'},
            {'name': 'Insurance', 'type': 'expense', 'color': '#f97316'},
            {'name': 'Car Insurance', 'type': 'expense', 'color': '#fb923c'},
            {'name': 'Car Fuel', 'type': 'expense', 'color': '#fbbf24'},
            {'name': 'Car Lease', 'type': 'expense', 'color': '#facc15'},
            {'name': 'Car Tax', 'type': 'expense', 'color': '#fde047'},
            {'name': 'Grocery', 'type': 'expense', 'color': '#84cc16'},
            {'name': 'House Work', 'type': 'expense', 'color': '#22c55e'},
            {'name': 'Utilities', 'type': 'expense', 'color': '#10b981'},
            {'name': 'Council Tax', 'type': 'expense', 'color': '#14b8a6'},
            {'name': 'Dining & Entertainment', 'type': 'expense', 'color': '#06b6d4'},
            {'name': 'Sky TV', 'type': 'expense', 'color': '#0ea5e9'},
            {'name': 'Subscriptions', 'type': 'expense', 'color': '#3b82f6'},
            {'name': 'India Property', 'type': 'expense', 'color': '#6366f1'},
            {'name': 'Childcare', 'type': 'expense', 'color': '#8b5cf6'},
            {'name': 'Kiaan Monthly', 'type': 'expense', 'color': '#a855f7'},
            {'name': 'Personal Expenses', 'type': 'expense', 'color': '#d946ef'},
            # Savings as expense (transfer out)
            {'name': 'Investment Contribution', 'type': 'expense', 'color': '#14b8a6'},
            {'name': 'Savings Contribution', 'type': 'expense', 'color': '#22c55e'},
        ]

        cat_map = {}
        for cat_data in categories_data:
            cat, _ = Category.objects.get_or_create(
                name=cat_data['name'],
                type=cat_data['type'],
                user=nishant,
                defaults={'color': cat_data['color']}
            )
            cat_map[cat_data['name']] = cat

        # Also map default categories
        for cat in Category.objects.filter(is_default=True):
            cat_map[cat.name] = cat

        self.stdout.write(self.style.SUCCESS('Categories created'))

        # Create accounts (GBP)
        Account.objects.filter(user=nishant).delete()

        monzo = Account.objects.create(
            name='Monzo (Joint)',
            type='checking',
            balance=Decimal('1950.00'),
            currency='GBP',
            user=nishant
        )

        joint_savings = Account.objects.create(
            name='Joint Savings',
            type='savings',
            balance=Decimal('300.00'),
            currency='GBP',
            user=nishant
        )

        nishant_personal = Account.objects.create(
            name='Nishant Personal',
            type='checking',
            balance=Decimal('145.00'),
            currency='GBP',
            user=nishant
        )

        investment_account = Account.objects.create(
            name='Investment Account',
            type='investment',
            balance=Decimal('0'),
            currency='GBP',
            user=nishant
        )

        self.stdout.write(self.style.SUCCESS('Accounts created'))

        # Clear existing transactions
        Transaction.objects.filter(user=nishant).delete()

        today = date.today()
        first_of_month = today.replace(day=1)

        # Create this month's transactions
        transactions = [
            # Income
            {'amount': 7200, 'type': 'income', 'desc': 'Monthly Salary', 'cat': 'Salary', 'account': monzo},

            # Fixed Expenses
            {'amount': 1205, 'type': 'expense', 'desc': 'Mortgage Payment', 'cat': 'Mortgage', 'account': monzo},
            {'amount': 150, 'type': 'expense', 'desc': 'Life Insurance', 'cat': 'Insurance', 'account': monzo},
            {'amount': 60, 'type': 'expense', 'desc': 'Car Insurance', 'cat': 'Car Insurance', 'account': monzo},
            {'amount': 275, 'type': 'expense', 'desc': 'Council Tax', 'cat': 'Council Tax', 'account': monzo},
            {'amount': 180, 'type': 'expense', 'desc': 'Gas, Electric, Water', 'cat': 'Utilities', 'account': monzo},
            {'amount': 45, 'type': 'expense', 'desc': 'Sky TV', 'cat': 'Sky TV', 'account': monzo},
            {'amount': 20, 'type': 'expense', 'desc': 'Spotify, Netflix, Amazon', 'cat': 'Subscriptions', 'account': nishant_personal},

            # Variable Expenses
            {'amount': 350, 'type': 'expense', 'desc': 'Grocery Shopping', 'cat': 'Grocery', 'account': monzo},
            {'amount': 200, 'type': 'expense', 'desc': 'House Work / Maintenance', 'cat': 'House Work', 'account': monzo},
            {'amount': 60, 'type': 'expense', 'desc': 'Car Fuel', 'cat': 'Car Fuel', 'account': monzo},

            # India Related
            {'amount': 450, 'type': 'expense', 'desc': 'India Property - LKO', 'cat': 'India Property', 'account': monzo},

            # Family
            {'amount': 500, 'type': 'expense', 'desc': 'Childcare', 'cat': 'Childcare', 'account': monzo},
            {'amount': 200, 'type': 'expense', 'desc': "Kiaan's Monthly", 'cat': 'Kiaan Monthly', 'account': monzo},

            # Savings Contributions (as expense transfers)
            {'amount': 100, 'type': 'expense', 'desc': 'Money Farm JISA - Kiaan', 'cat': 'Savings Contribution', 'account': monzo},
            {'amount': 500, 'type': 'expense', 'desc': 'Money Farm - Us', 'cat': 'Investment Contribution', 'account': monzo},
            {'amount': 300, 'type': 'expense', 'desc': 'Cash Savings', 'cat': 'Savings Contribution', 'account': monzo},
            {'amount': 500, 'type': 'expense', 'desc': 'Holiday Savings', 'cat': 'Savings Contribution', 'account': monzo},
            {'amount': 300, 'type': 'expense', 'desc': 'India SCB Investment', 'cat': 'Investment Contribution', 'account': monzo},

            # Personal
            {'amount': 250, 'type': 'expense', 'desc': 'Mandatory Personal Savings', 'cat': 'Savings Contribution', 'account': nishant_personal},
            {'amount': 150, 'type': 'expense', 'desc': 'Personal Expenses', 'cat': 'Personal Expenses', 'account': nishant_personal},
        ]

        for tx in transactions:
            Transaction.objects.create(
                amount=Decimal(str(tx['amount'])),
                type=tx['type'],
                description=tx['desc'],
                category=cat_map.get(tx['cat']),
                account=tx['account'],
                user=nishant,
                date=first_of_month + timedelta(days=tx.get('day', 1))
            )

        self.stdout.write(self.style.SUCCESS('Transactions created'))

        # Create Budgets
        Budget.objects.filter(user=nishant).delete()
        budgets = [
            {'name': 'Grocery Budget', 'amount': 400, 'category': 'Grocery'},
            {'name': 'Entertainment Budget', 'amount': 100, 'category': 'Dining & Entertainment'},
            {'name': 'Car Fuel Budget', 'amount': 80, 'category': 'Car Fuel'},
            {'name': 'House Maintenance', 'amount': 250, 'category': 'House Work'},
            {'name': 'Personal Spending', 'amount': 200, 'category': 'Personal Expenses'},
        ]

        for b in budgets:
            if b['category'] in cat_map:
                Budget.objects.create(
                    name=b['name'],
                    amount=Decimal(str(b['amount'])),
                    category=cat_map[b['category']],
                    period='monthly',
                    user=nishant,
                    start_date=first_of_month
                )

        self.stdout.write(self.style.SUCCESS('Budgets created'))

        # Create Investments
        Investment.objects.filter(user=nishant).delete()
        investments = [
            {'name': 'Money Farm - Us', 'type': 'etf', 'qty': 1, 'price': 15000, 'current': 15800},
            {'name': 'Money Farm JISA - Kiaan', 'type': 'etf', 'qty': 1, 'price': 3500, 'current': 3700},
            {'name': 'Stocks & Shares ISA', 'type': 'stock', 'qty': 1, 'price': 8000, 'current': 8500},
            {'name': 'SC Fund India', 'type': 'mutual_fund', 'qty': 1, 'price': 5000, 'current': 5200},
            {'name': 'India SCB Investment', 'type': 'bond', 'qty': 1, 'price': 2400, 'current': 2400, 'notes': 'Up to 2031'},
            {'name': 'India Property - LKO', 'type': 'real_estate', 'qty': 1, 'price': 25000, 'current': 28000},
        ]

        for inv in investments:
            Investment.objects.create(
                name=inv['name'],
                type=inv['type'],
                quantity=Decimal(str(inv['qty'])),
                purchase_price=Decimal(str(inv['price'])),
                current_price=Decimal(str(inv['current'])),
                purchase_date=date(2023, 1, 1),
                user=nishant,
                account=investment_account,
                notes=inv.get('notes', '')
            )

        self.stdout.write(self.style.SUCCESS('Investments created'))

        # Create Savings Goals
        SavingsGoal.objects.filter(user=nishant).delete()
        goals = [
            {'name': 'Emergency Fund', 'target': 15000, 'current': 8000},
            {'name': 'Holiday Fund 2026', 'target': 5000, 'current': 2500},
            {'name': "Kiaan's Education", 'target': 50000, 'current': 3700},
            {'name': 'House Renovation', 'target': 20000, 'current': 4000},
            {'name': 'New Car Fund', 'target': 25000, 'current': 0},
        ]

        for g in goals:
            SavingsGoal.objects.create(
                name=g['name'],
                target_amount=Decimal(str(g['target'])),
                current_amount=Decimal(str(g['current'])),
                user=nishant,
                target_date=date(2026, 12, 31) if 'Holiday' in g['name'] else None
            )

        self.stdout.write(self.style.SUCCESS('Savings Goals created'))

        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('DATA INJECTION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write('')
        self.stdout.write(f'Login: nishant@yiedly.com / yiedly123')
        self.stdout.write(f'Frontend: http://localhost:5174')
        self.stdout.write('')
