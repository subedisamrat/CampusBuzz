import { RECOMMENDATION_CONFIG } from '@/lib/constants';
import { RecommendationResult } from './recommender';

interface CacheEntry {
  results: RecommendationResult[];
  expiresAt: number;
}

class RecommendationCache {
  private store = new Map<string, CacheEntry>();
  private readonly TTL_MS = RECOMMENDATION_CONFIG.CACHE_TTL_MS;

  get(userId: string): RecommendationResult[] | null {
    const entry = this.store.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(userId);
      return null;
    }
    return entry.results;
  }

  set(userId: string, results: RecommendationResult[]): void {
    this.store.set(userId, {
      results,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  invalidate(userId: string): void {
    this.store.delete(userId);
  }

  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: [...this.store.keys()] };
  }
}

export const recommendationCache = new RecommendationCache();
