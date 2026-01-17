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
)
from mcp_server.server import YieldyMCPServer
from finance.models import Portfolio, SavingsGoal


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


def run_tests():
    """Run all tests and print summary."""
    print("=" * 60)
    print("Yiedly MCP Server - End-to-End Tests")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestMCPServerProtocol))
    suite.addTests(loader.loadTestsFromTestCase(TestReadTools))
    suite.addTests(loader.loadTestsFromTestCase(TestWriteTools))
    suite.addTests(loader.loadTestsFromTestCase(TestResponseEfficiency))
    suite.addTests(loader.loadTestsFromTestCase(TestMCPToolCall))

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
