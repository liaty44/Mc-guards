import { goals } from 'mineflayer-pathfinder';
import { config } from './config.js';

const { GoalFollow, GoalNear } = goals;
const hostileNames = /zombie|skeleton|creeper|spider|witch|phantom|drowned|husk|stray|pillager|vindicator|ravager|blaze|ghast|slime|magma_cube|enderman|hoglin|piglin_brute|warden/i;

const distance = (a, b) => a && b ? a.position.distanceTo(b.position) : Infinity;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function installGuardBrain(bot, guard, manager) {
  const state = {
    owner: null, lastOwnerHurt: 0, suspectedAttacker: null,
    lastTpa: 0, pendingTpa: false, mode: 'guard',
    target: null, lastFood: 0
  };
  manager.attachBot(guard.id, bot, state);

  bot.on('health', () => {
    if (bot.health <= 0) return;
    const percent = (bot.health / 20) * 100;
    if (percent <= config.criticalHealth) retreatToOwner();
  });

  // Detect a nearby player swinging immediately after the owner's health drops.
  bot.on('entitySwingArm', entity => {
    if (!entity || entity.type !== 'player' || entity.username === config.owner) return;
    if (Date.now() - state.lastOwnerHurt < 2500 && distance(entity, bot.entity) < 5) {
      state.suspectedAttacker = entity;
      manager.setTarget(guard.id, entity);
    }
  });

  bot.on('entityHurt', entity => {
    if (!entity) return;
    if (entity === bot.entity) {
      const percent = (bot.health / 20) * 100;
      if (percent <= config.lowHealth) retreatToOwner();
      return;
    }
    if (entity.username === config.owner) {
      state.lastOwnerHurt = Date.now();
      state.mode = guard.id === 'left' ? 'intercept' : 'protect';
      if (guard.id === 'right') followOwner();
    }
  });

  bot.on('entityGone', entity => {
    if (state.target && entity.id === state.target.id) {
      state.target = null;
      followOwner();
    }
  });

  async function findOwner() {
    const player = bot.players[config.owner]?.entity;
    state.owner = player || null;
    return state.owner;
  }

  function followOwner() {
    if (!bot.entity || state.pendingTpa) return;
    const owner = state.owner;
    if (!owner) return;
    const offset = guard.id === 'left' ? -1 : 1;
    const pos = owner.position.offset(offset * 1.4, 0, 1.5);
    bot.pathfinder.setGoal(new GoalNear(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z), 1));
    state.mode = 'guard';
  }

  function retreatToOwner() {
    if (!bot.entity) return;
    state.mode = 'retreat';
    const owner = state.owner;
    if (owner) bot.pathfinder.setGoal(new GoalFollow(owner, 2), true);
    else bot.pathfinder.setGoal(null);
  }

  async function safeTpaCycle() {
    if (!bot.entity || state.pendingTpa) return;
    const now = Date.now();
    if (now - state.lastTpa < config.tpaMs) return;
    const owner = await findOwner();
    if (!owner) return;
    state.pendingTpa = true;
    state.lastTpa = now;
    state.mode = 'moving-to-safe-tpa-point';
    try {
      // Optional safe waiting point configured by SAFE_X/Y/Z.
      if (config.safeSpot) {
        const { x, y, z } = config.safeSpot;
        bot.pathfinder.setGoal(new GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), 1));
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline && bot.entity &&
               bot.entity.position.distanceTo({ x, y, z }) > 2) {
          await sleep(1000);
        }
      }
      // Stand still before sending the request. Owner must accept manually.
      bot.pathfinder.setGoal(null);
      state.mode = 'waiting-for-tpa';
      bot.chat(`/tpa ${config.owner}`);
      console.log(`[${guard.id}] TPA request sent; waiting for owner to accept.`);
      await sleep(45_000);
    } finally {
      state.pendingTpa = false;
      if (bot.entity) followOwner();
    }
  }

  async function equipBest() {
    const items = bot.inventory.items();
    const slots = ['head', 'torso', 'legs', 'feet'];
    const types = [
      /helmet/i, /chestplate/i, /leggings/i, /boots/i
    ];
    for (let i = 0; i < slots.length; i++) {
      const candidates = items.filter(item => types[i].test(item.name));
      if (!candidates.length) continue;
      const rank = item => /netherite/i.test(item.name) ? 5 :
        /diamond/i.test(item.name) ? 4 : /iron/i.test(item.name) ? 3 :
        /chainmail/i.test(item.name) ? 2 : /gold/i.test(item.name) ? 1 : 0;
      candidates.sort((a,b) => rank(b) - rank(a));
      try { await bot.equip(candidates[0], slots[i]); } catch {}
    }
    const weapon = items.filter(item => /sword|axe|trident/i.test(item.name))
      .sort((a,b) => weaponRank(b.name) - weaponRank(a.name))[0];
    if (weapon) try { await bot.equip(weapon, 'hand'); } catch {}
    const shield = items.find(item => item.name === 'shield');
    if (shield) try { await bot.equip(shield, 'off-hand'); } catch {}
  }

  function weaponRank(name) {
    return /netherite/i.test(name) ? 6 : /diamond/i.test(name) ? 5 :
      /iron/i.test(name) ? 4 : /stone/i.test(name) ? 3 :
      /gold/i.test(name) ? 2 : 1;
  }

  async function eatIfNeeded() {
    if (bot.food >= 16 || Date.now() - state.lastFood < 5000) return;
    const food = bot.inventory.items().find(item => /bread|cooked|apple|carrot|potato|beef|porkchop|chicken|mutton|fish/i.test(item.name));
    if (!food) return;
    state.lastFood = Date.now();
    try { await bot.equip(food, 'hand'); await bot.consume(); } catch {}
  }

  async function defend() {
    if (!bot.entity || !bot.health) return;
    const percent = (bot.health / 20) * 100;
    if (percent <= config.lowHealth) {
      retreatToOwner();
      return;
    }

    const owner = await findOwner();
    const entities = Object.values(bot.entities);
    const mobs = entities.filter(e => e.type === 'mob' && hostileNames.test(e.name || '') && distance(e, bot.entity) < 12);
    const ownerThreats = owner ? mobs.filter(e => distance(e, owner) < 10) : [];
    const attacker = state.target && bot.entities[state.target.id] ? state.target : null;
    const target = attacker || [...ownerThreats, ...mobs].sort((a,b) => distance(a, bot.entity)-distance(b, bot.entity))[0];

    // Split mode: left guard intercepts threats; right guard prioritizes staying with owner.
    if (target && (guard.id === 'left' || !owner || distance(target, owner) < 3)) {
      state.target = target;
      state.mode = 'combat';
      try {
        await equipBest();
        bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
        if (distance(target, bot.entity) < 4) bot.attack(target);
      } catch (err) {
        console.warn(`[${guard.id}] Combat action failed: ${err.message}`);
      }
    } else if (owner && distance(owner, bot.entity) > config.followDistance + 1) {
      followOwner();
    } else if (!target) {
      state.target = null;
      if (owner && distance(owner, bot.entity) > config.followDistance) followOwner();
    }
    await eatIfNeeded();
  }

  const brainTimer = setInterval(() => {
    if (!bot.entity) return;
    defend().catch(err => console.error(`[${guard.id}] Brain error:`, err.message));
    safeTpaCycle().catch(err => console.error(`[${guard.id}] TPA error:`, err.message));
  }, 1500);

  bot.once('end', () => clearInterval(brainTimer));
  bot.on('death', () => {
    state.mode = 'dead';
    state.target = null;
    console.log(`[${guard.id}] Died. Waiting for server respawn behavior.`);
  });
}
