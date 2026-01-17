#!/usr/bin/env python3
"""
Yiedly MCP Server

This server implements the Model Context Protocol (MCP) to allow Claude
to interact with Yiedly financial data.

Usage:
    python -m mcp_server.server

The server communicates via stdio using JSON-RPC style messages.
"""
import sys
import json
import logging
from typing import Any

# Setup logging to stderr (stdout is for MCP communication)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger('yiedly-mcp')

# Import tools after Django setup
from mcp_server.tools import TOOLS


class YieldyMCPServer:
    """MCP Server for Yiedly financial data."""

    def __init__(self):
        self.tools = TOOLS

    def handle_initialize(self, params: dict) -> dict:
        """Handle the initialize request."""
        return {
            'protocolVersion': '2024-11-05',
            'capabilities': {
                'tools': {},
            },
            'serverInfo': {
                'name': 'yiedly-mcp',
                'version': '1.0.0',
            },
        }

    def handle_list_tools(self, params: dict) -> dict:
        """Return list of available tools."""
        tools = []
        for name, tool_info in self.tools.items():
            tool_schema = {
                'name': name,
                'description': tool_info['description'],
                'inputSchema': {
                    'type': 'object',
                    'properties': {},
                    'required': [],
                },
            }

            for param_name, param_info in tool_info.get('parameters', {}).items():
                tool_schema['inputSchema']['properties'][param_name] = {
                    'type': param_info.get('type', 'string'),
                    'description': param_info.get('description', ''),
                }
                if param_info.get('required', False):
                    tool_schema['inputSchema']['required'].append(param_name)

            tools.append(tool_schema)

        return {'tools': tools}

    def handle_call_tool(self, params: dict) -> dict:
        """Execute a tool and return the result."""
        tool_name = params.get('name')
        arguments = params.get('arguments', {})

        if tool_name not in self.tools:
            return {
                'content': [
                    {
                        'type': 'text',
                        'text': json.dumps({'error': f'Unknown tool: {tool_name}'}),
                    }
                ],
                'isError': True,
            }

        try:
            tool_func = self.tools[tool_name]['function']
            result = tool_func(**arguments)

            return {
                'content': [
                    {
                        'type': 'text',
                        'text': json.dumps(result, indent=2, default=str),
                    }
                ],
            }
        except Exception as e:
            logger.error(f'Error executing tool {tool_name}: {e}')
            return {
                'content': [
                    {
                        'type': 'text',
                        'text': json.dumps({'error': str(e)}),
                    }
                ],
                'isError': True,
            }

    def handle_request(self, request: dict) -> dict:
        """Handle an incoming JSON-RPC request."""
        method = request.get('method', '')
        params = request.get('params', {})
        request_id = request.get('id')

        logger.info(f'Handling request: {method}')

        handlers = {
            'initialize': self.handle_initialize,
            'tools/list': self.handle_list_tools,
            'tools/call': self.handle_call_tool,
        }

        handler = handlers.get(method)
        if handler:
            try:
                result = handler(params)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': result,
                }
            except Exception as e:
                logger.error(f'Error handling {method}: {e}')
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'error': {
                        'code': -32603,
                        'message': str(e),
                    },
                }
        else:
            # For notifications (no id) or unknown methods
            if method == 'notifications/initialized':
                return None  # No response for notifications
            logger.warning(f'Unknown method: {method}')
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32601,
                    'message': f'Method not found: {method}',
                },
            }

    def run(self):
        """Run the MCP server, reading from stdin and writing to stdout."""
        logger.info('Yiedly MCP Server starting...')

        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                line = line.strip()
                if not line:
                    continue

                logger.debug(f'Received: {line}')
                request = json.loads(line)
                response = self.handle_request(request)

                if response is not None:
                    response_json = json.dumps(response)
                    logger.debug(f'Sending: {response_json}')
                    print(response_json, flush=True)

            except json.JSONDecodeError as e:
                logger.error(f'JSON decode error: {e}')
            except Exception as e:
                logger.error(f'Error: {e}')


def main():
    """Main entry point."""
    server = YieldyMCPServer()
    server.run()


if __name__ == '__main__':
    main()
