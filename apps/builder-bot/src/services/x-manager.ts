/**
 * XManager — manages X (Twitter) API connections for agents
 * Uses X API v2 with OAuth 2.0 Bearer Token
 */

const X_API = 'https://api.x.com/2';

interface XConfig {
  bearerToken: string;
  userId?: string;
}

export class XManager {
  private configs = new Map<number, XConfig>();

  async registerAgent(agentId: number, config: XConfig): Promise<void> {
    this.configs.set(agentId, config);
  }

  private getHeaders(agentId: number): Record<string, string> {
    const cfg = this.configs.get(agentId);
    if (!cfg) throw new Error('X/Twitter not configured for this agent');
    return { 'Authorization': `Bearer ${cfg.bearerToken}`, 'Content-Type': 'application/json' };
  }

  /** Validate that an ID is safe to interpolate into a URL path */
  private validateId(id: string, name: string): void {
    if (!/^\d+$/.test(id)) throw new Error(`Invalid ${name}: must be numeric`);
  }

  async searchTweets(agentId: number, query: string, maxResults = 10): Promise<any> {
    const headers = this.getHeaders(agentId);
    const params = new URLSearchParams({ query, max_results: String(maxResults), 'tweet.fields': 'created_at,public_metrics,author_id' });
    const res = await fetch(`${X_API}/tweets/search/recent?${params}`, { headers });
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  async getTweet(agentId: number, tweetId: string): Promise<any> {
    this.validateId(tweetId, 'tweetId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/tweets/${tweetId}?tweet.fields=created_at,public_metrics,author_id`, { headers });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }

  async getUserByUsername(agentId: number, username: string): Promise<any> {
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(username)) throw new Error('Invalid username format');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/users/by/username/${encodeURIComponent(username)}?user.fields=public_metrics,description`, { headers });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }

  async getUserTimeline(agentId: number, userId: string, maxResults = 10): Promise<any> {
    this.validateId(userId, 'userId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`, { headers });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }

  async postTweet(agentId: number, text: string): Promise<any> {
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/tweets`, {
      method: 'POST', headers,
      body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  async replyToTweet(agentId: number, tweetId: string, text: string): Promise<any> {
    this.validateId(tweetId, 'tweetId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/tweets`, {
      method: 'POST', headers,
      body: JSON.stringify({ text: text.slice(0, 280), reply: { in_reply_to_tweet_id: tweetId } }),
    });
    if (!res.ok) throw new Error(`X API ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  async likeTweet(agentId: number, userId: string, tweetId: string): Promise<any> {
    this.validateId(userId, 'userId');
    this.validateId(tweetId, 'tweetId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/users/${userId}/likes`, {
      method: 'POST', headers,
      body: JSON.stringify({ tweet_id: tweetId }),
    });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }

  async retweet(agentId: number, userId: string, tweetId: string): Promise<any> {
    this.validateId(userId, 'userId');
    this.validateId(tweetId, 'tweetId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/users/${userId}/retweets`, {
      method: 'POST', headers,
      body: JSON.stringify({ tweet_id: tweetId }),
    });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }

  async getFollowers(agentId: number, userId: string, maxResults = 50): Promise<any> {
    this.validateId(userId, 'userId');
    const headers = this.getHeaders(agentId);
    const res = await fetch(`${X_API}/users/${userId}/followers?max_results=${maxResults}&user.fields=public_metrics`, { headers });
    if (!res.ok) throw new Error(`X API ${res.status}`);
    return await res.json();
  }
}

export const xManager = new XManager();
export default xManager;
