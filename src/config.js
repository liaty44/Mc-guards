import 'dotenv/config';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

export const config = {
  host: required('MC_HOST'),
  port: Number(process.env.MC_PORT || 25565),
  version: process.env.MC_VERSION || '26.3',
  authMode: process.env.AUTH_MODE || 'offline',
  owner: required('OWNER_NAME'),
  guards: [
    { id: 'left', name: required('GUARD_1_NAME'), email: process.env.GUARD_1_EMAIL || '' },
    { id: 'right', name: required('GUARD_2_NAME'), email: process.env.GUARD_2_EMAIL || '' }
  ],
  portHttp: Number(process.env.PORT || 10000),
  tpaMs: Math.max(1, Number(process.env.TPA_INTERVAL_MINUTES || 30)) * 60_000,
  followDistance: Number(process.env.FOLLOW_DISTANCE || 3),
  lowHealth: Number(process.env.LOW_HEALTH_PERCENT || 35),
  criticalHealth: Number(process.env.CRITICAL_HEALTH_PERCENT || 22),
  retreatDistance: Number(process.env.SAFE_RETREAT_DISTANCE || 12),
  safeSpot: (process.env.SAFE_X && process.env.SAFE_Y && process.env.SAFE_Z)
    ? { x: Number(process.env.SAFE_X), y: Number(process.env.SAFE_Y), z: Number(process.env.SAFE_Z) }
    : null
};

if (!['offline', 'microsoft'].includes(config.authMode)) {
  throw new Error('AUTH_MODE must be offline or microsoft');
}
if (config.authMode === 'microsoft' && config.guards.some(g => !g.email)) {
  throw new Error('Set GUARD_1_EMAIL and GUARD_2_EMAIL for Microsoft auth');
}
