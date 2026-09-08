#!/usr/bin/env node
/*
 * stdio transport — for Claude Desktop, which launches this file directly.
 * No hosting, no auth, no public URL required.
 */
import './load-env.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { buildServer } from './mcp.js'

const server = buildServer()
await server.connect(new StdioServerTransport())
