/*
 * Vercel serverless entry point.
 *
 * Vercel routes every /api/* and /mcp request here (see vercel.json) and
 * invokes the exported Express app as a handler. Nothing calls listen():
 * the platform owns the server lifecycle.
 *
 * Configuration comes from Vercel project environment variables, not from
 * server/.env — that file is local development only and is never deployed.
 */
export { default } from '../server/app.js'
