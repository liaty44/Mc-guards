import express from 'express';

export function startHttp(port, getStatus) {
  const app = express();
  app.get('/', (_req, res) => res.type('text').send('Guardian AI is running'));
  app.get('/health', (_req, res) => {
    const status = getStatus();
    const ready = status.guards.some(g => g.state === 'online');
    res.status(ready ? 200 : 503).json({ service: 'guardian-ai', ...status });
  });
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[HTTP] Health server listening on 0.0.0.0:${port}`);
  });
  return server;
}
