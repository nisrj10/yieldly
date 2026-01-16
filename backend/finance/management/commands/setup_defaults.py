from django.core.management.base import BaseCommand
from finance.models import Category


class Command(BaseCommand):
    help = 'Setup default categories for Yiedly'

    def handle(self, *args, **options):
        default_categories = [
            # Income categories
            {'name': 'Salary', 'type': 'income', 'color': '#22c55e'},
            {'name': 'Freelance', 'type': 'income', 'color': '#10b981'},
            {'name': 'Investments', 'type': 'income', 'color': '#14b8a6'},
            {'name': 'Gifts', 'type': 'income', 'color': '#06b6d4'},
            {'name': 'Other Income', 'type': 'income', 'color': '#0ea5e9'},

            # Expense categories
            {'name': 'Food & Dining', 'type': 'expense', 'color': '#ef4444'},
            {'name': 'Groceries', 'type': 'expense', 'color': '#f97316'},
            {'name': 'Transportation', 'type': 'expense', 'color': '#f59e0b'},
            {'name': 'Housing', 'type': 'expense', 'color': '#eab308'},
            {'name': 'Utilities', 'type': 'expense', 'color': '#84cc16'},
            {'name': 'Healthcare', 'type': 'expense', 'color': '#22c55e'},
            {'name': 'Entertainment', 'type': 'expense', 'color': '#10b981'},
            {'name': 'Shopping', 'type': 'expense', 'color': '#14b8a6'},
            {'name': 'Education', 'type': 'expense', 'color': '#06b6d4'},
            {'name': 'Personal Care', 'type': 'expense', 'color': '#0ea5e9'},
            {'name': 'Insurance', 'type': 'expense', 'color': '#3b82f6'},
            {'name': 'Subscriptions', 'type': 'expense', 'color': '#6366f1'},
            {'name': 'Travel', 'type': 'expense', 'color': '#8b5cf6'},
            {'name': 'Gifts & Donations', 'type': 'expense', 'color': '#a855f7'},
            {'name': 'Other Expenses', 'type': 'expense', 'color': '#d946ef'},
        ]

        created_count = 0
        for cat_data in default_categories:
            category, created = Category.objects.get_or_create(
                name=cat_data['name'],
                type=cat_data['type'],
                is_default=True,
                defaults={'color': cat_data['color']}
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} default categories')
        )
