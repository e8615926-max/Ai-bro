import type { BackendStatus } from '../shared/aiTools.js';
import { aiStatus } from './gemini.js';
import { handle, sendJson } from './http.js';
import { marketStatus } from './market.js';

/** /api/status — which capabilities this server has. Never returns secrets. */
export const statusHandler = handle(async (_req, res) => {
  const status: BackendStatus = { ai: await aiStatus(), market: marketStatus() };
  sendJson(res, 200, status);
});
