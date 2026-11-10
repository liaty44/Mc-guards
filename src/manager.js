import { createGuard } from './bot.js';
import { config } from './config.js';

export function createManager() {
  const bots = new Map();
  const states = new Map(config.guards.map(g => [g.id, { name: g.name, state: 'starting', mode: 'booting' }]));
  const manager = {
    start() {
      for (const guard of config.guards) {
        try {
          states.get(guard.id).state = 'connecting';
          createGuard(guard, manager);
        } catch (err) {
          states.get(guard.id).state = 'error';
          console.error(`[${guard.id}] Could not start:`, err);
        }
      }
    },
    attachBot(id, bot, brainState) {
      bots.set(id, { bot, brainState });
      states.get(id).state = 'online';
    },
    setState(id, state) { if (states.has(id)) states.get(id).state = state; },
    setTarget(id, entity) {
      const record = bots.get(id);
      if (record) record.brainState.target = entity;
    },
    onDisconnect(id) {
      const s = states.get(id);
      if (!s || s.state === 'banned-or-blocked' || s.state === 'reconnecting') return;
      s.state = 'reconnecting';
      console.warn(`[${id}] Reconnecting in 15 seconds...`);
      setTimeout(() => {
        if (s.state === 'banned-or-blocked') return;
        const guard = config.guards.find(g => g.id === id);
        if (!guard) return;
        try {
          s.state = 'connecting';
          createGuard(guard, manager);
        } catch (err) {
          s.state = 'error';
          console.error(`[${id}] Reconnect failed:`, err.message);
        }
      }, 15000);
    },
    status() {
      return {
        owner: config.owner,
        guards: [...states.entries()].map(([id, value]) => ({ id, ...value }))
      };
    }
  };
  return manager;
}
