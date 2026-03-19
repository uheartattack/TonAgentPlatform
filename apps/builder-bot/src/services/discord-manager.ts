/**
 * DiscordManager — manages Discord bot connections for agents
 * Each agent can have its own Discord bot token, or share one.
 * Uses Discord HTTP API directly (REST only, no gateway).
 */

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordConfig {
  botToken: string;
  guildIds?: string[];    // which servers to operate in
  channelIds?: string[];  // which channels to respond in
}

export class DiscordManager {
  private configs = new Map<number, DiscordConfig>(); // agentId -> config

  async registerAgent(agentId: number, config: DiscordConfig): Promise<void> {
    this.configs.set(agentId, config);
  }

  async sendMessage(agentId: number, channelId: string, content: string): Promise<any> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured for this agent');
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${cfg.botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  async getMessages(agentId: number, channelId: string, limit = 20): Promise<any[]> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=${limit}`, {
      headers: { 'Authorization': `Bot ${cfg.botToken}` },
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return await res.json() as any[];
  }

  async getGuildChannels(agentId: number, guildId: string): Promise<any[]> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { 'Authorization': `Bot ${cfg.botToken}` },
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return await res.json() as any[];
  }

  async createWebhook(agentId: number, channelId: string, name: string): Promise<any> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/webhooks`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${cfg.botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return await res.json();
  }

  async addReaction(agentId: number, channelId: string, messageId: string, emoji: string): Promise<void> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const encodedEmoji = encodeURIComponent(emoji);
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`, {
      method: 'PUT',
      headers: { 'Authorization': `Bot ${cfg.botToken}` },
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
  }

  async getGuildMembers(agentId: number, guildId: string, limit = 50): Promise<any[]> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=${limit}`, {
      headers: { 'Authorization': `Bot ${cfg.botToken}` },
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return await res.json() as any[];
  }

  async getBotInfo(agentId: number): Promise<any> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('Discord not configured');
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { 'Authorization': `Bot ${cfg.botToken}` },
    });
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    return await res.json();
  }
}

export const discordManager = new DiscordManager();
export default discordManager;
