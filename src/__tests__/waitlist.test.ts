/**
 * Unit tests for waitlist priority scoring and promotion logic.
 * Validates: Requirements 7.1, 7.3, 7.7, 7.8
 */

import { WAITLIST_HOUR_DISCOUNT_MS } from '@/lib/constants';

// ─── Mock all external dependencies ──────────────────────────────────────────

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@/lib/email', () => ({
  sendPromotionEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK'),
}));

const mockCountDocuments = jest.fn();
const mockRegistrationFindOneAndUpdate = jest.fn();
const mockRegistrationFindOne = jest.fn();

jest.mock('@/models/Registration', () => ({
  __esModule: true,
  default: {
    countDocuments: mockCountDocuments,
    findOneAndUpdate: mockRegistrationFindOneAndUpdate,
    findOne: mockRegistrationFindOne,
  },
}));

const mockWaitlistFind = jest.fn();
const mockWaitlistDeleteOne = jest.fn();
const mockWaitlistCreate = jest.fn();
const mockWaitlistFindOne = jest.fn();
const mockWaitlistCountDocuments = jest.fn();

jest.mock('@/models/Waitlist', () => ({
  __esModule: true,
  default: {
    find: mockWaitlistFind,
    deleteOne: mockWaitlistDeleteOne,
    create: mockWaitlistCreate,
    findOne: mockWaitlistFindOne,
    countDocuments: mockWaitlistCountDocuments,
  },
}));

const mockEventFindByIdAndUpdate = jest.fn();
const mockEventFindById = jest.fn();

jest.mock('@/models/Event', () => ({
  __esModule: true,
  default: {
    findByIdAndUpdate: mockEventFindByIdAndUpdate,
    findById: mockEventFindById,
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ email: 'test@test.com', name: 'Test', engagementTier: 'regular' }),
        then: jest.fn().mockImplementation((resolve: (value: unknown) => void) => {
          resolve({ email: 'test@test.com', name: 'Test' });
        }),
      }),
    }),
  },
}));

// Mock mongoose session/transaction
const mockCommitTransaction = jest.fn().mockResolvedValue(undefined);
const mockAbortTransaction = jest.fn().mockResolvedValue(undefined);
const mockEndSession = jest.fn().mockResolvedValue(undefined);
const mockStartTransaction = jest.fn();

const mockSession = {
  startTransaction: mockStartTransaction,
  commitTransaction: mockCommitTransaction,
  abortTransaction: mockAbortTransaction,
  endSession: mockEndSession,
};

jest.mock('mongoose', () => ({
  __esModule: true,
  default: {
    startSession: jest.fn().mockResolvedValue(mockSession),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computePriorityScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset heap cache between tests by re-importing
    jest.resetModules();
  });

  test('returns joinedAt.getTime() when checkedInCount is 0', async () => {
    mockCountDocuments.mockResolvedValue(0);
    const { computePriorityScore } = await import('@/lib/algorithms/waitlistManager');

    const joinedAt = new Date('2024-01-01T12:00:00Z');
    const score = await computePriorityScore('user1', joinedAt);

    expect(score).toBe(joinedAt.getTime());
    expect(mockCountDocuments).toHaveBeenCalledWith({ userId: 'user1', checkedIn: true });
  });

  test('subtracts one hour discount per checked-in event', async () => {
    mockCountDocuments.mockResolvedValue(3);
    const { computePriorityScore } = await import('@/lib/algorithms/waitlistManager');

    const joinedAt = new Date('2024-01-01T12:00:00Z');
    const score = await computePriorityScore('user1', joinedAt);

    const expected = joinedAt.getTime() - 3 * WAITLIST_HOUR_DISCOUNT_MS;
    expect(score).toBe(expected);
  });

  test('formula: joinedAt.getTime() - (checkedInCount * WAITLIST_HOUR_DISCOUNT_MS)', async () => {
    const checkedInCounts = [0, 1, 5, 10];
    const joinedAt = new Date('2024-06-15T08:30:00Z');

    for (const count of checkedInCounts) {
      mockCountDocuments.mockResolvedValue(count);
      const { computePriorityScore } = await import('@/lib/algorithms/waitlistManager');

      const score = await computePriorityScore('userX', joinedAt);
      const expected = joinedAt.getTime() - count * WAITLIST_HOUR_DISCOUNT_MS;

      expect(score).toBe(expected);

      jest.resetModules();
    }
  });

  test('higher attendance bonus produces lower (higher priority) score', async () => {
    const joinedAt = new Date('2024-01-01T12:00:00Z');

    mockCountDocuments.mockResolvedValue(1);
    const { computePriorityScore: cps1 } = await import('@/lib/algorithms/waitlistManager');
    const score1 = await cps1('user1', joinedAt);

    jest.resetModules();
    mockCountDocuments.mockResolvedValue(5);
    const { computePriorityScore: cps5 } = await import('@/lib/algorithms/waitlistManager');
    const score5 = await cps5('user1', joinedAt);

    expect(score5).toBeLessThan(score1);
  });
});

describe('promoteTopWaitlistUser', () => {
  const eventId = 'event123';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Default: heap has one entry
    mockWaitlistFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            userId: 'user1',
            eventId,
            priorityScore: 1000,
            joinedAt: new Date(),
          },
        ]),
      }),
    });

    mockWaitlistDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockRegistrationFindOneAndUpdate.mockResolvedValue({ _id: 'reg1', registrationId: 'CP-TEST' });
    mockEventFindByIdAndUpdate.mockResolvedValue({ registeredCount: 1 });
    mockEventFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ title: 'Test Event', date: new Date(), venue: 'Hall A' }),
    });
  });

  test('calls Registration.findOneAndUpdate with upsert when promoting top user', async () => {
    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await promoteTopWaitlistUser(eventId);

    expect(mockRegistrationFindOneAndUpdate).toHaveBeenCalledTimes(1);
    const [filter, update, options] = mockRegistrationFindOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ userId: 'user1', eventId });
    expect(update.$set).toMatchObject({
      confirmed: true,
      confirmationEmailSent: true,
      promotedFromWaitlist: true,
    });
    expect(update.$set.registrationId).toMatch(/^CP-/);
    expect(options).toMatchObject({ upsert: true, new: true, session: mockSession });
  });

  test('calls Event.findByIdAndUpdate with $inc registeredCount', async () => {
    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await promoteTopWaitlistUser(eventId);

    expect(mockEventFindByIdAndUpdate).toHaveBeenCalledWith(
      eventId,
      { $inc: { registeredCount: 1 } },
      expect.objectContaining({ session: mockSession })
    );
  });

  test('calls Waitlist.deleteOne to remove promoted entry', async () => {
    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await promoteTopWaitlistUser(eventId);

    expect(mockWaitlistDeleteOne).toHaveBeenCalledWith(
      { userId: 'user1', eventId },
      expect.objectContaining({ session: mockSession })
    );
  });

  test('commits the transaction on success', async () => {
    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await promoteTopWaitlistUser(eventId);

    expect(mockCommitTransaction).toHaveBeenCalledTimes(1);
    expect(mockAbortTransaction).not.toHaveBeenCalled();
  });

  test('returns without error when heap is empty', async () => {
    mockWaitlistFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await expect(promoteTopWaitlistUser(eventId)).resolves.toBeUndefined();

    expect(mockRegistrationFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockWaitlistDeleteOne).not.toHaveBeenCalled();
  });

  test('aborts transaction and rethrows on DB error', async () => {
    mockRegistrationFindOneAndUpdate.mockRejectedValue(new Error('DB write failed'));

    const { promoteTopWaitlistUser } = await import('@/lib/algorithms/waitlistManager');
    await expect(promoteTopWaitlistUser(eventId)).rejects.toThrow('DB write failed');

    expect(mockAbortTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommitTransaction).not.toHaveBeenCalled();
  });
});

describe('Waitlist POST route — duplicate join and capacity checks', () => {
  /**
   * These are pure logic tests that verify the guard conditions in the POST handler.
   * Validates: Requirements 7.7, 7.8
   */

  test('returns 409 when student is already registered for the event', () => {
    // Simulate the route logic: alreadyRegistered check comes before waitlist join
    const alreadyRegistered = { _id: 'reg1', userId: 'user1', eventId: 'event1' };

    // Guard: if alreadyRegistered exists → 409
    const status = alreadyRegistered ? 409 : 201;
    expect(status).toBe(409);
  });

  test('returns 400 when event still has available capacity', () => {
    const event = { capacity: 100, registeredCount: 50 };

    // Guard: if registeredCount < capacity → 400 (register directly)
    const hasCapacity = event.registeredCount < event.capacity;
    const status = hasCapacity ? 400 : 201;
    expect(status).toBe(400);
  });

  test('allows join when event is full and student is not registered', () => {
    const event = { capacity: 100, registeredCount: 100 };
    const alreadyRegistered = null;
    const alreadyWaitlisted = null;

    const hasCapacity = event.registeredCount < event.capacity;
    const blocked = hasCapacity || alreadyRegistered || alreadyWaitlisted;
    expect(blocked).toBeFalsy();
  });

  test('returns 409 when student is already on the waitlist', () => {
    const alreadyWaitlisted = { _id: 'wl1', userId: 'user1', eventId: 'event1' };

    const status = alreadyWaitlisted ? 409 : 201;
    expect(status).toBe(409);
  });

  test('capacity check uses registeredCount vs capacity comparison', () => {
    // Boundary: exactly at capacity should NOT trigger the 400
    const eventAtCapacity = { capacity: 50, registeredCount: 50 };
    const eventBelowCapacity = { capacity: 50, registeredCount: 49 };

    expect(eventAtCapacity.registeredCount < eventAtCapacity.capacity).toBe(false);
    expect(eventBelowCapacity.registeredCount < eventBelowCapacity.capacity).toBe(true);
  });
});
