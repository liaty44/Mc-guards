import { config } from './config.js';
import { startHttp } from './http.js';
import { createManager } from './manager.js';

const manager = createManager();
const server = startHttp(config.portHttp, () => manager.status());
console.log('[Guardian AI] Starting two guards...');
manager.start();

function shutdown(signal) {
  console.log(`[Guardian AI] ${signal}; shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
