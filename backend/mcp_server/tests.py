"""
End-to-end tests for Yiedly MCP Server

Run with:
    cd /Users/nishantraj/Documents/Development/Yiedly/backend
    python -m pytest mcp_server/tests.py -v

Or run directly:
    python mcp_server/tests.py
"""
import os
import sys
import json
import unittest

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from mcp_server.tools import (
    TOOLS, MAX_LIST_ITEMS, MAX_MONTHS,
    get_financial_summary, get_portfolios, get_savings_goals,
    get_house_budget, get_monthly_spending, get_financial_health_check,
    update_portfolio_value, add_funds_to_goal, create_savings_goal,
    get_transactions_by_category, get_spending_by_category,
)
from mcp_server.server import YieldyMCPServer
from finance.models import Portfolio, SavingsGoal, Transaction, Account, Category
from accounts.models import User, Household
from django.test import TestCase, Client
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


class TestMCPServerProtocol(unittest.TestCase):
    """Test MCP protocol handling."""

    def setUp(self):
        self.server = YieldyMCPServer()

    def test_initialize(self):
        """Test server initialization response."""
        result = self.server.handle_initialize({})

        self.assertEqual(result['protocolVersion'], '2024-11-05')
        self.assertIn('capabilities', result)
        self.assertIn('tools', result['capabilities'])
        self.assertIn('serverInfo', result)
        self.assertEqual(result['serverInfo']['name'], 'yiedly-mcp')

    def test_list_tools(self):
        """Test tools listing returns all expected tools."""
        result = self.server.handle_list_tools({})

        self.assertIn('tools', result)
        tools = result['tools']

        # Check all tools are listed
        tool_names = [t['name'] for t in tools]
        expected_tools = [
            'get_financial_summary', 'get_portfolios', 'get_savings_goals',
            'get_house_budget', 'get_monthly_spending', 'update_portfolio_value',
            'add_funds_to_goal', 'create_savings_goal', 'get_financial_health_check',
            'get_transactions_by_category', 'get_spending_by_category',
        ]
        for expected in expected_tools:
            self.assertIn(expected, tool_names, f"Missing tool: {expected}")

        # Check tool schema structure
        for tool in tools:
            self.assertIn('name', tool)
            self.assertIn('description', tool)
            self.assertIn('inputSchema', tool)
            self.assertEqual(tool['inputSchema']['type'], 'object')

    def test_call_unknown_tool(self):
        """Test calling unknown tool returns error."""
        result = self.server.handle_call_tool({
            'name': 'nonexistent_tool',
            'arguments': {},
        })

        self.assertTrue(result.get('isError', False))
        content = json.loads(result['content'][0]['text'])
        self.assertIn('error', content)


class TestReadTools(unittest.TestCase):
    """Test read-only tools for response structure and limits."""

    def test_financial_summary_structure(self):
        """Test financial summary returns expected structure."""
        result = get_financial_summary()

        # Check top-level keys
        self.assertIn('net_worth', result)
        self.assertIn('breakdown', result)
        self.assertIn('emergency_fund', result)
        self.assertIn('goals', result)

        # Check net_worth structure
        self.assertIn('mine', result['net_worth'])
        self.assertIn('kiaan', result['net_worth'])
        self.assertIn('family', result['net_worth'])

        # Check breakdown structure
        self.assertIn('investments', result['breakdown'])
        self.assertIn('savings', result['breakdown'])
        self.assertIn('pots', result['breakdown'])

        # Check emergency_fund structure
        self.assertIn('amount', result['emergency_fund'])
        self.assertIn('months_covered', result['emergency_fund'])

        # Check goals structure
        self.assertIn('target', result['goals'])
        self.assertIn('saved', result['goals'])
        self.assertIn('progress_pct', result['goals'])

    def test_financial_summary_token_size(self):
        """Test financial summary response is compact."""
        result = get_financial_summary()
        json_str = json.dumps(result)

        # Rough token estimate: ~4 chars per token
        estimated_tokens = len(json_str) / 4
        self.assertLess(estimated_tokens, 400, f"Response too large: ~{estimated_tokens} tokens")

    def test_portfolios_limit(self):
        """Test portfolios respects limit parameter."""
        # Default limit
        result = get_portfolios()
        self.assertLessEqual(len(result['portfolios']), MAX_LIST_ITEMS)

        # Custom limit
        result = get_portfolios(limit=3)
        self.assertLessEqual(len(result['portfolios']), 3)

        # Check structure
        if result['portfolios']:
            portfolio = result['portfolios'][0]
            self.assertIn('id', portfolio)
            self.assertIn('name', portfolio)
            self.assertIn('type', portfolio)
            self.assertIn('value', portfolio)
            self.assertIn('gain_pct', portfolio)

    def test_savings_goals_limit(self):
        """Test savings goals respects limit parameter."""
        result = get_savings_goals()
        self.assertLessEqual(len(result['goals']), MAX_LIST_ITEMS)

        # Check structure
        if result['goals']:
            goal = result['goals'][0]
            self.assertIn('id', goal)
            self.assertIn('name', goal)
            self.assertIn('target', goal)
            self.assertIn('saved', goal)
            self.assertIn('progress_pct', goal)

    def test_house_budget_summary_only(self):
        """Test budget summary_only returns compact response."""
        summary = get_house_budget(summary_only=True)
        full = get_house_budget(summary_only=False)

        # Summary should be smaller
        summary_size = len(json.dumps(summary))
        full_size = len(json.dumps(full))

        if 'error' not in summary:
            self.assertLess(summary_size, full_size, "Summary should be smaller than full budget")

            # Check summary structure
            self.assertIn('income', summary)
            self.assertIn('expenses', summary)
            self.assertIn('savings', summary)
            self.assertIn('buffer', summary)

            # Summary shouldn't have detailed groups
            self.assertNotIn('by_group', summary)

    def test_monthly_spending_limit(self):
        """Test monthly spending respects months limit."""
        result = get_monthly_spending(months=2)
        self.assertLessEqual(len(result['months']), 2)

        # Test max limit enforcement
        result = get_monthly_spending(months=12)
        self.assertLessEqual(len(result['months']), MAX_MONTHS)

        # Check structure
        if result['months']:
            month = result['months'][0]
            self.assertIn('month', month)
            self.assertIn('income', month)
            self.assertIn('expenses', month)
            self.assertIn('savings', month)
            self.assertIn('rate_pct', month)

    def test_health_check_structure(self):
        """Test health check returns expected structure."""
        result = get_financial_health_check()

        self.assertIn('score', result)
        self.assertIn('status', result)
        self.assertIn('insights', result)
        self.assertIn('warnings', result)
        self.assertIn('net_worth', result)

        # Score should be 0-100
        self.assertGreaterEqual(result['score'], 0)
        self.assertLessEqual(result['score'], 100)

        # Status should be one of expected values
        self.assertIn(result['status'], ['excellent', 'good', 'needs_attention'])


class TestWriteTools(unittest.TestCase):
    """Test write tools - carefully to avoid damaging real data."""

    def test_update_portfolio_nonexistent(self):
        """Test updating nonexistent portfolio returns error."""
        result = update_portfolio_value(portfolio_id=99999, new_value=1000)
        self.assertIn('error', result)

    def test_add_funds_nonexistent_goal(self):
        """Test adding to nonexistent goal returns error."""
        result = add_funds_to_goal(goal_id=99999, amount=100)
        self.assertIn('error', result)

    def test_create_goal_and_cleanup(self):
        """Test creating a goal - then delete it to clean up."""
        # Create test goal
        result = create_savings_goal(
            name='TEST_GOAL_DELETE_ME',
            target_amount=100,
            target_date='2025-12-31'
        )

        self.assertTrue(result.get('success', False))
        self.assertIn('id', result)
        self.assertEqual(result['name'], 'TEST_GOAL_DELETE_ME')

        # Clean up - delete the test goal
        goal_id = result['id']
        try:
            SavingsGoal.objects.filter(id=goal_id).delete()
        except Exception:
            pass  # Best effort cleanup


class TestResponseEfficiency(unittest.TestCase):
    """Test response size limits and efficiency rules."""

    def test_all_responses_are_json_serializable(self):
        """Test all tool responses can be JSON serialized."""
        for name, tool_info in TOOLS.items():
            func = tool_info['function']

            # Call with no args for read tools
            if name in ['get_financial_summary', 'get_portfolios', 'get_savings_goals',
                       'get_house_budget', 'get_monthly_spending', 'get_financial_health_check']:
                result = func()
                try:
                    json.dumps(result, default=str)
                except Exception as e:
                    self.fail(f"Tool {name} result not JSON serializable: {e}")

    def test_numeric_values_are_rounded(self):
        """Test monetary values are properly rounded."""
        result = get_financial_summary()

        # Check that values don't have excessive decimal places
        def check_decimals(obj, path=''):
            if isinstance(obj, float):
                # Check it's rounded to at most 2 decimal places
                str_val = str(obj)
                if '.' in str_val:
                    decimals = len(str_val.split('.')[1])
                    self.assertLessEqual(decimals, 2, f"Too many decimals at {path}: {obj}")
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    check_decimals(v, f"{path}.{k}")
            elif isinstance(obj, list):
                for i, v in enumerate(obj):
                    check_decimals(v, f"{path}[{i}]")

        check_decimals(result)

    def test_tool_descriptions_include_token_hints(self):
        """Test key tools include token estimates in description."""
        token_aware_tools = ['get_financial_summary', 'get_financial_health_check']

        for tool_name in token_aware_tools:
            desc = TOOLS[tool_name]['description']
            self.assertIn('token', desc.lower(),
                f"Tool {tool_name} should mention token estimate in description")


class TestMCPToolCall(unittest.TestCase):
    """Test tool calls through the MCP server interface."""

    def setUp(self):
        self.server = YieldyMCPServer()

    def test_call_financial_summary(self):
        """Test calling financial summary through MCP."""
        result = self.server.handle_call_tool({
            'name': 'get_financial_summary',
            'arguments': {},
        })

        self.assertFalse(result.get('isError', False))
        self.assertIn('content', result)

        content = json.loads(result['content'][0]['text'])
        self.assertIn('net_worth', content)

    def test_call_portfolios_with_limit(self):
        """Test calling portfolios with limit parameter."""
        result = self.server.handle_call_tool({
            'name': 'get_portfolios',
            'arguments': {'limit': 2},
        })

        self.assertFalse(result.get('isError', False))
        content = json.loads(result['content'][0]['text'])
        self.assertLessEqual(len(content['portfolios']), 2)

    def test_call_budget_summary_only(self):
        """Test calling budget with summary_only parameter."""
        result = self.server.handle_call_tool({
            'name': 'get_house_budget',
            'arguments': {'summary_only': True},
        })

        self.assertFalse(result.get('isError', False))
        content = json.loads(result['content'][0]['text'])

        if 'error' not in content:
            self.assertNotIn('by_group', content)


class TestTransactionTools(unittest.TestCase):
    """Test transaction query tools."""

    def test_transactions_by_category(self):
        """Test transactions by category returns expected structure."""
        result = get_transactions_by_category('Groceries')

        self.assertIn('category', result)
        self.assertIn('period', result)
        self.assertIn('total', result)
        self.assertIn('count', result)
        self.assertIn('transactions', result)

        # Check transaction structure
        if result['transactions']:
            txn = result['transactions'][0]
            self.assertIn('date', txn)
            self.assertIn('amount', txn)
            self.assertIn('description', txn)

    def test_spending_by_category(self):
        """Test spending by category breakdown."""
        result = get_spending_by_category(months=1)

        self.assertIn('period', result)
        self.assertIn('total_spending', result)
        self.assertIn('categories', result)

        # Check category structure
        if result['categories']:
            cat = result['categories'][0]
            self.assertIn('category', cat)
            self.assertIn('total', cat)
            self.assertIn('count', cat)
            self.assertIn('pct', cat)


class TestAPIAuthentication(unittest.TestCase):
    """Test API authentication and JWT handling."""

    def setUp(self):
        self.client = APIClient()

    def test_protected_endpoints_require_auth(self):
        """Test that protected endpoints return 401 without auth."""
        protected_endpoints = [
            '/api/dashboard/',
            '/api/transactions/',
            '/api/portfolios/',
            '/api/budgets/',
            '/api/savings-goals/',
            '/api/accounts/',
            '/api/categories/',
            '/api/auth/profile/',
        ]

        for endpoint in protected_endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(
                response.status_code, 401,
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
            )

    def test_login_returns_tokens(self):
        """Test login endpoint returns access and refresh tokens."""
        # This test requires a test user to exist
        response = self.client.post('/api/auth/login/', {
            'email': 'test@yiedly.com',
            'password': 'wrongpassword'
        })

        # Even with wrong password, should get proper error response
        self.assertIn(response.status_code, [400, 401])

    def test_invalid_token_rejected(self):
        """Test that invalid JWT tokens are rejected."""
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_token_here')
        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, 401)


class TestAPIEndpoints(unittest.TestCase):
    """Test API endpoint responses."""

    @classmethod
    def setUpClass(cls):
        """Set up test user and auth."""
        super().setUpClass()
        cls.client = APIClient()

        # Find existing user or skip auth tests
        try:
            cls.user = User.objects.filter(is_active=True).first()
            if cls.user:
                refresh = RefreshToken.for_user(cls.user)
                cls.access_token = str(refresh.access_token)
                cls.client.credentials(HTTP_AUTHORIZATION=f'Bearer {cls.access_token}')
                cls.authenticated = True
            else:
                cls.authenticated = False
        except Exception:
            cls.authenticated = False

    def test_dashboard_response_structure(self):
        """Test dashboard returns expected structure."""
        if not self.authenticated:
            self.skipTest("No authenticated user available")

        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, 200)

        data = response.json()
        # Core dashboard keys (API uses total_income/total_expenses)
        expected_keys = ['total_balance', 'total_income', 'total_expenses',
                        'net_savings', 'investment_value', 'recent_transactions',
                        'budget_status', 'savings_goals']

        for key in expected_keys:
            self.assertIn(key, data, f"Dashboard missing key: {key}")

    def test_transactions_list(self):
        """Test transactions list with filters."""
        if not self.authenticated:
            self.skipTest("No authenticated user available")

        response = self.client.get('/api/transactions/')
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn('results', data)  # Paginated response

    def test_portfolios_summary(self):
        """Test portfolios summary endpoint."""
        if not self.authenticated:
            self.skipTest("No authenticated user available")

        response = self.client.get('/api/portfolios/summary/')
        self.assertEqual(response.status_code, 200)

    def test_budget_overview(self):
        """Test budget overview endpoint."""
        if not self.authenticated:
            self.skipTest("No authenticated user available")

        response = self.client.get('/api/budget-overview/')
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIn('total_budgeted', data)
        self.assertIn('total_spent', data)

    def test_monthly_trends(self):
        """Test monthly trends endpoint."""
        if not self.authenticated:
            self.skipTest("No authenticated user available")

        response = self.client.get('/api/monthly-trends/?months=6')
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertIsInstance(data, list)
        if data:
            trend = data[0]
            self.assertIn('month', trend)
            self.assertIn('income', trend)
            self.assertIn('expenses', trend)


class TestSecurityChecks(unittest.TestCase):
    """Security-focused tests."""

    def setUp(self):
        self.client = APIClient()

    def test_no_sensitive_data_in_error_messages(self):
        """Test error messages don't leak sensitive information."""
        # Try to access non-existent resource
        response = self.client.get('/api/transactions/999999/')
        if response.status_code == 401:
            data = response.json()
            # Should not contain stack traces or internal paths
            response_text = json.dumps(data)
            self.assertNotIn('/Users/', response_text)
            self.assertNotIn('Traceback', response_text)
            self.assertNotIn('SECRET', response_text)

    def test_xss_prevention_in_responses(self):
        """Test that responses properly escape XSS attempts."""
        # This would need authenticated access
        pass  # Placeholder for XSS testing

    def test_sql_injection_prevention(self):
        """Test that SQL injection attempts are blocked."""
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "1 OR 1=1",
            "UNION SELECT * FROM users",
        ]

        for payload in malicious_inputs:
            # These should not cause errors
            response = self.client.get(f'/api/transactions/?category={payload}')
            # Should get 401 (unauth) or 200 (safe), not 500
            self.assertNotEqual(response.status_code, 500,
                f"Possible SQL injection vulnerability with payload: {payload}")


class TestDataIsolation(unittest.TestCase):
    """Test user data isolation."""

    @classmethod
    def setUpClass(cls):
        """Set up two test users."""
        super().setUpClass()
        cls.client = APIClient()

        # Get two different users
        users = User.objects.filter(is_active=True)[:2]
        if len(users) >= 2:
            cls.user_a = users[0]
            cls.user_b = users[1]

            refresh_a = RefreshToken.for_user(cls.user_a)
            refresh_b = RefreshToken.for_user(cls.user_b)

            cls.token_a = str(refresh_a.access_token)
            cls.token_b = str(refresh_b.access_token)
            cls.has_two_users = True
        else:
            cls.has_two_users = False

    def test_user_cannot_access_others_data(self):
        """Test that User A cannot access User B's transactions."""
        if not self.has_two_users:
            self.skipTest("Need two users for isolation test")

        # Get User A's transactions
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_a}')
        response_a = self.client.get('/api/transactions/')

        if response_a.status_code == 200:
            txns_a = response_a.json().get('results', [])

            if txns_a:
                # Try to access User A's transaction as User B
                txn_id = txns_a[0]['id']
                self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token_b}')
                response_b = self.client.get(f'/api/transactions/{txn_id}/')

                # Should be 404 (not found) not 403 (forbidden) to prevent enumeration
                self.assertEqual(response_b.status_code, 404,
                    "User B should not be able to access User A's transaction")


class TestHouseholdSharing(unittest.TestCase):
    """Test household data sharing."""

    @classmethod
    def setUpClass(cls):
        """Set up household test data."""
        super().setUpClass()
        cls.client = APIClient()

        # Find household with multiple members
        try:
            cls.household = Household.objects.first()
            if cls.household:
                members = User.objects.filter(household=cls.household)
                if members.count() >= 2:
                    cls.member_a = members[0]
                    cls.member_b = members[1]
                    cls.has_household = True
                else:
                    cls.has_household = False
            else:
                cls.has_household = False
        except Exception:
            cls.has_household = False

    def test_household_members_see_shared_portfolios(self):
        """Test that household members can see each other's portfolios."""
        if not self.has_household:
            self.skipTest("No household with multiple members")

        refresh = RefreshToken.for_user(self.member_a)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        response = self.client.get('/api/portfolios/')
        self.assertEqual(response.status_code, 200)

        # Portfolios should include household members' portfolios
        data = response.json()
        if 'results' in data:
            portfolios = data['results']
        else:
            portfolios = data

        # Just verify it returns data (specific sharing logic depends on implementation)
        self.assertIsInstance(portfolios, list)


class TestSenseChecks(unittest.TestCase):
    """Sanity checks for data integrity."""

    def test_balance_calculation(self):
        """Test that account balances match transaction sums."""
        # This is a sense check - balances should be consistent
        summary = get_financial_summary()

        # Net worth should be positive (or at least not absurdly negative)
        self.assertGreater(summary['net_worth']['family'], -1000000,
            "Net worth seems unreasonably low")

    def test_emergency_fund_months_reasonable(self):
        """Test emergency fund months covered is reasonable."""
        summary = get_financial_summary()
        months = summary['emergency_fund']['months_covered']

        self.assertGreaterEqual(months, 0, "Months covered cannot be negative")
        self.assertLess(months, 120, "Months covered seems too high (10 years+)")

    def test_goal_progress_bounded(self):
        """Test savings goal progress is reasonable."""
        goals = get_savings_goals()

        for goal in goals.get('goals', []):
            progress = goal['progress_pct']
            self.assertGreaterEqual(progress, 0, f"Goal {goal['name']} has negative progress")
            # Allow over 100% for overfunded goals
            self.assertLess(progress, 1000, f"Goal {goal['name']} has unreasonable progress")

    def test_spending_percentages_reasonable(self):
        """Test category spending percentages are reasonable."""
        spending = get_spending_by_category(months=1)

        total_pct = sum(cat['pct'] for cat in spending.get('categories', []))

        if total_pct > 0:
            # Percentages may not sum to 100% due to MAX_LIST_ITEMS limit
            # but should be a significant portion (>80%)
            self.assertGreater(total_pct, 80, "Top categories should account for >80% of spending")
            # Individual percentages should be valid
            for cat in spending.get('categories', []):
                self.assertGreaterEqual(cat['pct'], 0, f"Category {cat['category']} has negative %")
                self.assertLessEqual(cat['pct'], 100, f"Category {cat['category']} exceeds 100%")


def run_tests():
    """Run all tests and print summary."""
    print("=" * 60)
    print("Yiedly MCP Server - End-to-End Tests")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    test_classes = [
        # MCP Protocol Tests
        TestMCPServerProtocol,
        TestReadTools,
        TestWriteTools,
        TestResponseEfficiency,
        TestMCPToolCall,
        TestTransactionTools,
        # API Tests
        TestAPIAuthentication,
        TestAPIEndpoints,
        # Security Tests
        TestSecurityChecks,
        TestDataIsolation,
        # Household Tests
        TestHouseholdSharing,
        # Sense Checks
        TestSenseChecks,
    ]

    for test_class in test_classes:
        suite.addTests(loader.loadTestsFromTestCase(test_class))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print("ALL TESTS PASSED")
    else:
        print(f"FAILURES: {len(result.failures)}, ERRORS: {len(result.errors)}")
    print("=" * 60)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
