import mineflayer from '@wp2508/mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import { config } from './config.js';
import { installGuardBrain } from './guard-brain.js';

export function createGuard(guard, manager) {
  const options = {
    host: config.host,
    port: config.port,
    username: guard.name,
    version: config.version,
    auth: config.authMode,
    respawn: true
  };
  if (config.authMode === 'microsoft') options.username = guard.email;

  console.log(`[${guard.id}] Connecting as ${guard.name}...`);
  const bot = mineflayer.createBot(options);
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`[${guard.id}] Spawned in world as ${bot.username}`);
    const movements = new Movements(bot);
    movements.canDig = false;
    movements.allow1by1towers = false;
    bot.pathfinder.setMovements(movements);
    installGuardBrain(bot, guard, manager);
  });

  bot.on('kicked', reason => {
    const message = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.error(`[${guard.id}] Kicked: ${message}`);
    if (/ban|banned|blacklist/i.test(message)) {
      manager.setState(guard.id, 'banned-or-blocked');
      console.error(`[${guard.id}] Account is blocked. Not rotating usernames or attempting ban evasion.`);
    }
  });
  bot.on('error', err => console.error(`[${guard.id}] Error:`, err.message));
  bot.on('end', () => {
    console.warn(`[${guard.id}] Disconnected`);
    manager.onDisconnect(guard.id);
  });
  return bot;
}
