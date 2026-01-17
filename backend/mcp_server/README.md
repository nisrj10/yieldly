# Yiedly MCP Server

This MCP (Model Context Protocol) server allows Claude to interact with your Yiedly financial data.

## Features

### Read Tools
- **get_financial_summary** - Get comprehensive financial overview (net worth, emergency fund, investments)
- **get_portfolios** - List all investment portfolios with values and performance
- **get_savings_goals** - List all active savings goals with progress
- **get_house_budget** - Get household budget with income/expenses breakdown
- **get_monthly_spending** - Get monthly income, expenses, and savings data
- **get_financial_health_check** - Get AI-powered financial health analysis

### Write Tools
- **update_portfolio_value** - Update a portfolio's current value
- **add_funds_to_goal** - Add funds to an existing savings goal
- **create_savings_goal** - Create a new savings goal

## Setup

### 1. Add to Claude Code MCP Settings

Add this configuration to your Claude Code MCP settings (`~/.claude/claude_desktop_config.json` or via Claude Code settings):

```json
{
  "mcpServers": {
    "yiedly": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "cwd": "/Users/nishantraj/Documents/Development/Yiedly/backend",
      "env": {
        "DATABASE_URL": "your-database-url-here"
      }
    }
  }
}
```

### 2. Test the Server

Run the server manually to test:

```bash
cd /Users/nishantraj/Documents/Development/Yiedly/backend
python -m mcp_server
```

## Usage Examples

Once connected, you can ask Claude things like:

- "What's my current net worth?"
- "Show me my savings goals progress"
- "How is my emergency fund doing?"
- "Update my ISA portfolio value to £32,000"
- "Add £500 to my Emergency Fund goal"
- "Create a new goal for a family holiday with target £3,000"
- "Give me a financial health check"

## Security

- The MCP server connects to the same database as the Yiedly app
- Only household members' data is accessible
- Write operations are logged for audit purposes
