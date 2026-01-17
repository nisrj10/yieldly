# Yiedly MCP - Usage Guidelines for Claude

## Quick Questions Reference

Use these exact phrases for instant answers:

| You Ask | Tool to Use | Response |
|---------|-------------|----------|
| "net worth" / "how much do I have" | `get_financial_summary` | Family, yours, Kiaan's totals |
| "emergency fund" | `get_financial_summary` | Amount + months covered |
| "am I on track" / "financial health" | `get_financial_health_check` | Score + insights + warnings |
| "goals" / "savings progress" | `get_savings_goals` | All goals with progress % |
| "investments" / "portfolios" | `get_portfolios` | All portfolios with gains |
| "budget" / "monthly budget" | `get_house_budget(summary_only=true)` | Income vs expenses vs savings |
| "spending this month" | `get_monthly_spending(months=1)` | Income, expenses, savings rate |
| "spent on [category]" | `get_transactions_by_category` | Total + transaction list |
| "update [portfolio] to [value]" | `update_portfolio_value` | Confirms change |
| "add [amount] to [goal]" | `add_funds_to_goal` | New total + progress |

### Quick Answers Cheatsheet

```
"How am I doing?"           → get_financial_health_check
"What's my net worth?"      → get_financial_summary
"Show my ISAs"              → get_portfolios
"How much on groceries?"    → get_transactions_by_category(category="Groceries")
"Where does my money go?"   → get_spending_by_category(months=1)
"Am I saving enough?"       → get_monthly_spending(months=3)
"Budget breakdown"          → get_house_budget
"Goal progress"             → get_savings_goals
```

### Category Keywords

For `get_transactions_by_category`, use these common categories:
- `Groceries` - supermarket shopping
- `Dining` - restaurants, takeaway
- `Transport` - fuel, parking, Uber
- `Shopping` - Amazon, retail
- `Bills` - utilities, subscriptions
- `Entertainment` - cinema, streaming
- `Health` - pharmacy, fitness

---

## Efficiency Rules

This MCP server is designed with token efficiency in mind. Follow these guidelines to minimize context usage:

### 1. Start with Summary Tools

**Always start with `get_financial_summary`** for general questions about finances. This single call provides:
- Net worth breakdown
- Emergency fund status (months covered)
- Investment totals and returns
- Savings goal progress summary

Only call more specific tools if detailed information is needed.

### 2. Response Size Limits

All tools have built-in limits:
- **Lists**: Maximum 10 items returned (portfolios, goals, etc.)
- **Monthly data**: Maximum 6 months of history
- **Budget details**: Use `summary_only=true` for totals without line items

### 3. Tool Selection Guide

| Question Type | Best Tool | Avoid |
|--------------|-----------|-------|
| "What's my net worth?" | `get_financial_summary` | Multiple separate calls |
| "How are my investments?" | `get_financial_summary` | `get_portfolios` (unless details needed) |
| "Emergency fund status?" | `get_financial_summary` | Separate calculations |
| "Goal progress?" | `get_financial_summary` | `get_savings_goals` (unless all goals needed) |
| "Specific portfolio details" | `get_portfolios` | - |
| "Budget breakdown" | `get_house_budget(summary_only=true)` | Full budget unless needed |
| "Monthly spending trends" | `get_monthly_spending` | Multiple month queries |
| "Health assessment" | `get_financial_health_check` | Multiple tool calls |

### 4. Write Operations

Write tools return minimal confirmation responses:
- `update_portfolio_value` - Updates and returns new value only
- `add_funds_to_goal` - Returns updated progress only
- `create_savings_goal` - Returns new goal ID and name only

### 5. Parameter Usage

Use optional parameters to limit data:
```
get_portfolios(limit=5)           # Only first 5 portfolios
get_savings_goals(limit=3)        # Only first 3 goals
get_monthly_spending(months=3)    # Only 3 months of data
get_house_budget(summary_only=true)  # Totals without line items
```

### 6. Avoid

- Calling multiple tools when `get_financial_summary` answers the question
- Requesting full budget details when only totals are needed
- Fetching all months of data when recent data suffices
- Making write calls without confirming values with user first

### 7. Token Estimates

Approximate response sizes:
- `get_financial_summary`: ~300 tokens
- `get_portfolios` (10 items): ~400 tokens
- `get_savings_goals` (10 items): ~350 tokens
- `get_house_budget` (summary): ~150 tokens
- `get_house_budget` (full): ~500 tokens
- `get_monthly_spending` (6 months): ~400 tokens
- `get_financial_health_check`: ~600 tokens
- Write operations: ~50 tokens each

## Common Scenarios

### "Give me a financial overview"
1. Call `get_financial_summary` - DONE (single call)

### "How should I allocate my savings?"
1. Call `get_financial_health_check` - provides AI analysis with recommendations

### "Update my ISA value"
1. Call `update_portfolio_value(name="ISA", value=32000)`

### "Show detailed investment breakdown"
1. Call `get_portfolios()` - only when user specifically asks for details
