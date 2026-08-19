/**
 * Tests for RecommendationCache TTL behaviour and getRecommendations fallback.
 *
 * Validates: Requirements 8.2, 8.4
 */

import { recommendationCache } from '@/lib/recommendations/recommendationCache';
import { getRecommendations } from '@/lib/recommendations/recommender';
import { CACHE_TTL_MS } from '@/lib/constants';

// ── Mock Mongoose models ──────────────────────────────────────────────────────

jest.mock('@/models/Registration', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock('@/models/Event', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock('@/lib/mongodb', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

import Registration from '@/models/Registration';
import Event from '@/models/Event';

// ── Cache TTL tests ───────────────────────────────────────────────────────────

describe('RecommendationCache', () => {
  beforeEach(() => {
    // Clear the cache between tests by invalidating any keys we set
    recommendationCache.invalidate('user-1');
    recommendationCache.invalidate('user-2');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('cache hit returns the stored results', () => {
    const results = [
      { event: { title: 'Hackathon' } as any, score: 0.9, reason: 'Similar interests' },
    ];

    recommendationCache.set('user-1', results);
    const cached = recommendationCache.get('user-1');

    expect(cached).not.toBeNull();
    expect(cached).toEqual(results);
  });

  test('cache miss returns null for unknown userId', () => {
    const result = recommendationCache.get('nonexistent-user');
    expect(result).toBeNull();
  });

  test('get() returns null after TTL expires', () => {
    jest.useFakeTimers();

    const results = [
      { event: { title: 'Workshop' } as any, score: 0.5, reason: 'Trending on campus' },
    ];

    recommendationCache.set('user-2', results);

    // Confirm it is cached before expiry
    expect(recommendationCache.get('user-2')).not.toBeNull();

    // Advance time past the TTL (1 hour + 1 ms)
    jest.advanceTimersByTime(CACHE_TTL_MS + 1);

    // Should now be expired
    expect(recommendationCache.get('user-2')).toBeNull();
  });

  test('set() overwrites an existing entry', () => {
    const first  = [{ event: { title: 'Event A' } as any, score: 0.8, reason: 'r1' }];
    const second = [{ event: { title: 'Event B' } as any, score: 0.6, reason: 'r2' }];

    recommendationCache.set('user-1', first);
    recommendationCache.set('user-1', second);

    expect(recommendationCache.get('user-1')).toEqual(second);
  });

  test('invalidate() removes the entry', () => {
    recommendationCache.set('user-1', []);
    recommendationCache.invalidate('user-1');
    expect(recommendationCache.get('user-1')).toBeNull();
  });
});

// ── getRecommendations fallback tests ─────────────────────────────────────────

describe('getRecommendations — fallback for user with no registrations', () => {
  const trendingEvents = [
    { _id: 'evt-1', title: 'Tech Summit', registeredCount: 120, isActive: true, date: new Date(Date.now() + 86400000) },
    { _id: 'evt-2', title: 'Cultural Fest', registeredCount: 95, isActive: true, date: new Date(Date.now() + 86400000) },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Invalidate cache so each test starts fresh
    recommendationCache.invalidate('new-user-id');
  });

  test('returns trending events with reason "Trending on campus" when user has no registrations', async () => {
    // No registrations at all in the system
    (Registration.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    // Event.find returns trending events (chained .sort().limit().lean())
    const mockLean = jest.fn().mockResolvedValue(trendingEvents);
    const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
    (Event.find as jest.Mock).mockReturnValue({ sort: mockSort });

    const results = await getRecommendations('new-user-id');

    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.reason).toBe('Trending on campus');
    });
  });

  test('each fallback result contains event, score, and reason fields', async () => {
    (Registration.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const mockLean = jest.fn().mockResolvedValue(trendingEvents);
    const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
    (Event.find as jest.Mock).mockReturnValue({ sort: mockSort });

    const results = await getRecommendations('new-user-id');

    results.forEach(r => {
      expect(r).toHaveProperty('event');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('reason');
    });
  });

  test('fallback score is 0 for trending events', async () => {
    (Registration.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const mockLean = jest.fn().mockResolvedValue(trendingEvents);
    const mockLimit = jest.fn().mockReturnValue({ lean: mockLean });
    const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
    (Event.find as jest.Mock).mockReturnValue({ sort: mockSort });

    const results = await getRecommendations('new-user-id');

    results.forEach(r => {
      expect(r.score).toBe(0);
    });
  });
});
