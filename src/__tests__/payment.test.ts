/**
 * Property-based and unit tests for completeRegistration atomicity
 *
 * **Property 2: completeRegistration either fully succeeds or leaves no partial state**
 * **Validates: Requirements 5.5, 5.10**
 *
 * Tests verify:
 * - FAILURE PATH: when event is at capacity, NO Registration is created,
 *   event.registeredCount is NOT incremented, and an error is thrown.
 * - SUCCESS PATH: Registration is created, event.registeredCount is incremented,
 *   and Payment is linked to Registration.
 */

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

// Track calls to Registration.findOneAndUpdate (upsert)
const mockRegistrationUpsert = jest.fn();
// Track calls to Event.findById (with session)
const mockEventFindById = jest.fn();
// Track calls to Event.findByIdAndUpdate (increment registeredCount)
const mockEventFindByIdAndUpdate = jest.fn();
// Track calls to Payment.findById
const mockPaymentFindById = jest.fn();
// Track calls to Payment.findByIdAndUpdate (link registrationId)
const mockPaymentFindByIdAndUpdate = jest.fn();

jest.mock('@/models/Registration', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: (...args: unknown[]) => mockRegistrationUpsert(...args),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/models/Event', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockEventFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockEventFindByIdAndUpdate(...args),
  },
}));

jest.mock('@/models/Payment', () => ({
  __esModule: true,
  default: {
    findById: (...args: unknown[]) => mockPaymentFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockPaymentFindByIdAndUpdate(...args),
  },
}));

// Mock User (used in fire-and-forget email after commit)
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  },
}));

// Mock email — fire-and-forget, should not affect atomicity
jest.mock('@/lib/email', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
}));

// Mock qrcode — avoid real QR generation in unit tests
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK_QR'),
}));

// Mock mongoose session/transaction
const mockCommitTransaction = jest.fn().mockResolvedValue(undefined);
const mockAbortTransaction = jest.fn().mockResolvedValue(undefined);
const mockEndSession = jest.fn().mockResolvedValue(undefined);

const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: mockCommitTransaction,
  abortTransaction: mockAbortTransaction,
  endSession: mockEndSession,
};

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue(mockSession),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { completeRegistration } from '@/lib/payment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'payment-id-1',
    status: 'completed',
    amount: 500,
    provider: 'khalti',
    transactionId: 'txn-abc',
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'event-id-1',
    title: 'Tech Summit',
    capacity: 100,
    registeredCount: 50,
    ...overrides,
  };
}

function makeRegistration(overrides: Record<string, unknown> = {}) {
  return [
    {
      _id: 'reg-id-1',
      registrationId: 'CP-ABCDEF1234567890',
      qrCode: 'data:image/png;base64,MOCK_QR',
      ...overrides,
    },
  ];
}

// ---------------------------------------------------------------------------
// Property 2 — FAILURE PATH: event at capacity → no partial state
// ---------------------------------------------------------------------------

describe('Property 2 — completeRegistration failure leaves no partial state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.startTransaction.mockClear();
    mockCommitTransaction.mockClear();
    mockAbortTransaction.mockClear();
    mockEndSession.mockClear();
  });

  /**
   * Core atomicity property: when the event is at capacity, the function must:
   * 1. NOT create a Registration document
   * 2. NOT increment event.registeredCount
   * 3. Throw an error
   * 4. Abort (not commit) the transaction
   */
  test('does NOT create Registration when event is at capacity', async () => {
    mockPaymentFindById.mockResolvedValue(makePayment());
    // Event is exactly at capacity
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity: 100, registeredCount: 100 })),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow('Event is full');

    expect(mockRegistrationUpsert).not.toHaveBeenCalled();
  });

  test('does NOT increment event.registeredCount when event is at capacity', async () => {
    mockPaymentFindById.mockResolvedValue(makePayment());
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity: 50, registeredCount: 50 })),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow('Event is full');

    expect(mockEventFindByIdAndUpdate).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $inc: { registeredCount: 1 } }),
      expect.anything()
    );
  });

  test('throws an error when event is at capacity', async () => {
    mockPaymentFindById.mockResolvedValue(makePayment());
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity: 10, registeredCount: 10 })),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow();
  });

  test('aborts transaction (does not commit) when event is at capacity', async () => {
    mockPaymentFindById.mockResolvedValue(makePayment());
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity: 5, registeredCount: 5 })),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow();

    expect(mockAbortTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommitTransaction).not.toHaveBeenCalled();
  });

  test('throws when payment is not found', async () => {
    mockPaymentFindById.mockResolvedValue(null);

    await expect(
      completeRegistration('nonexistent-payment', 'user-id-1', 'event-id-1')
    ).rejects.toThrow('Payment not completed');

    expect(mockRegistrationUpsert).not.toHaveBeenCalled();
    expect(mockEventFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('throws when payment status is not completed', async () => {
    mockPaymentFindById.mockResolvedValue(makePayment({ status: 'pending' }));

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow('Payment not completed');

    expect(mockRegistrationUpsert).not.toHaveBeenCalled();
    expect(mockEventFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  /**
   * Property test: for any capacity value where registeredCount >= capacity,
   * the function must always leave no partial state.
   * We test multiple capacity/registeredCount combinations to verify the invariant holds.
   */
  test('property: no partial state for any at-capacity scenario', async () => {
    const atCapacityCases = [
      { capacity: 1, registeredCount: 1 },
      { capacity: 10, registeredCount: 10 },
      { capacity: 50, registeredCount: 55 }, // over capacity
      { capacity: 100, registeredCount: 100 },
      { capacity: 200, registeredCount: 201 },
      { capacity: 500, registeredCount: 500 },
    ];

    for (const { capacity, registeredCount } of atCapacityCases) {
      jest.clearAllMocks();
      mockSession.startTransaction.mockClear();
      mockCommitTransaction.mockClear();
      mockAbortTransaction.mockClear();

      mockPaymentFindById.mockResolvedValue(makePayment());
      mockEventFindById.mockReturnValue({
        session: jest.fn().mockResolvedValue(makeEvent({ capacity, registeredCount })),
      });

      await expect(
        completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
      ).rejects.toThrow();

      // Invariant: no Registration created, no count increment, transaction aborted
      expect(mockRegistrationUpsert).not.toHaveBeenCalled();
      expect(mockEventFindByIdAndUpdate).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ $inc: { registeredCount: 1 } }),
        expect.anything()
      );
      expect(mockAbortTransaction).toHaveBeenCalledTimes(1);
      expect(mockCommitTransaction).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2 — SUCCESS PATH: all three side-effects happen atomically
// ---------------------------------------------------------------------------

describe('Property 2 — completeRegistration success path is fully atomic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.startTransaction.mockClear();
    mockCommitTransaction.mockClear();
    mockAbortTransaction.mockClear();
    mockEndSession.mockClear();
  });

  function setupSuccessScenario(capacity = 100, registeredCount = 50) {
    mockPaymentFindById.mockResolvedValue(makePayment());
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity, registeredCount })),
    });
    mockRegistrationUpsert.mockResolvedValue({ _id: 'reg-id-1', registrationId: 'CP-ABCDEF1234567890', qrCode: 'data:image/png;base64,MOCK_QR' });
    mockEventFindByIdAndUpdate.mockResolvedValue({ registeredCount: registeredCount + 1 });
    mockPaymentFindByIdAndUpdate.mockResolvedValue({});
  }

  test('creates a Registration document on success', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    expect(mockRegistrationUpsert).toHaveBeenCalledTimes(1);
    expect(mockRegistrationUpsert).toHaveBeenCalledWith(
      { userId: 'user-id-1', eventId: 'event-id-1' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          userId: 'user-id-1',
          eventId: 'event-id-1',
          paymentId: 'payment-id-1',
        }),
      }),
      expect.objectContaining({ session: mockSession })
    );
  });

  test('increments event.registeredCount on success', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    expect(mockEventFindByIdAndUpdate).toHaveBeenCalledWith(
      'event-id-1',
      { $inc: { registeredCount: 1 } },
      { session: mockSession }
    );
  });

  test('links Payment to Registration on success', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    expect(mockPaymentFindByIdAndUpdate).toHaveBeenCalledWith(
      'payment-id-1',
      { registrationId: 'reg-id-1' },
      { session: mockSession }
    );
  });

  test('commits transaction on success', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    expect(mockCommitTransaction).toHaveBeenCalledTimes(1);
    expect(mockAbortTransaction).not.toHaveBeenCalled();
  });

  test('all three side-effects occur together (atomicity invariant)', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    // All three must happen — none can be missing
    expect(mockRegistrationUpsert).toHaveBeenCalledTimes(1);
    expect(mockEventFindByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockPaymentFindByIdAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockCommitTransaction).toHaveBeenCalledTimes(1);
  });

  /**
   * Property test: for any available-capacity scenario, all three side-effects
   * must always occur together.
   */
  test('property: all side-effects occur for any available-capacity scenario', async () => {
    const availableCases = [
      { capacity: 1, registeredCount: 0 },
      { capacity: 10, registeredCount: 5 },
      { capacity: 100, registeredCount: 99 }, // one spot left
      { capacity: 500, registeredCount: 0 },
    ];

    for (const { capacity, registeredCount } of availableCases) {
      jest.clearAllMocks();
      mockSession.startTransaction.mockClear();
      mockCommitTransaction.mockClear();
      mockAbortTransaction.mockClear();

      setupSuccessScenario(capacity, registeredCount);

      await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

      // Invariant: all three side-effects must occur
      expect(mockRegistrationUpsert).toHaveBeenCalledTimes(1);
      expect(mockEventFindByIdAndUpdate).toHaveBeenCalledWith(
        'event-id-1',
        { $inc: { registeredCount: 1 } },
        { session: mockSession }
      );
      expect(mockPaymentFindByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(mockCommitTransaction).toHaveBeenCalledTimes(1);
      expect(mockAbortTransaction).not.toHaveBeenCalled();
    }
  });

  test('Registration document contains a registrationId with CP- prefix', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    const upsertCall = mockRegistrationUpsert.mock.calls[0];
    const setOnInsert = upsertCall[1].$setOnInsert;
    expect(setOnInsert.registrationId).toMatch(/^CP-/);
  });

  test('Registration document contains a qrCode', async () => {
    setupSuccessScenario();

    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');

    const upsertCall = mockRegistrationUpsert.mock.calls[0];
    const setOnInsert = upsertCall[1].$setOnInsert;
    expect(setOnInsert.qrCode).toBeTruthy();
  });

  test('session is always ended regardless of success or failure', async () => {
    // Success case
    setupSuccessScenario();
    await completeRegistration('payment-id-1', 'user-id-1', 'event-id-1');
    expect(mockEndSession).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    // Failure case
    mockPaymentFindById.mockResolvedValue(makePayment());
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue(makeEvent({ capacity: 10, registeredCount: 10 })),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow();

    expect(mockEndSession).toHaveBeenCalledTimes(1);
  });
});
