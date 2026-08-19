/**
 * Unit tests for payment flow edge cases
 * Validates: Requirements 5.8, 5.9, 5.10
 */

// Mock function references
const mockEventFindById = jest.fn();
const mockEventFindByIdAndUpdate = jest.fn();
const mockPaymentFindOne = jest.fn();
const mockPaymentFindById = jest.fn();
const mockPaymentFindByIdAndUpdate = jest.fn();
const mockRegistrationCreate = jest.fn();
const mockInitializePayment = jest.fn();

const mockCommitTransaction = jest.fn().mockResolvedValue(undefined);
const mockAbortTransaction = jest.fn().mockResolvedValue(undefined);
const mockEndSession = jest.fn().mockResolvedValue(undefined);
const mockMongoSession = {
  startTransaction: jest.fn(),
  commitTransaction: mockCommitTransaction,
  abortTransaction: mockAbortTransaction,
  endSession: mockEndSession,
};

// Module mocks - must be before imports
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
    findOne: (...args: unknown[]) => mockPaymentFindOne(...args),
    findById: (...args: unknown[]) => mockPaymentFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockPaymentFindByIdAndUpdate(...args),
  },
}));

jest.mock('@/models/Registration', () => ({
  __esModule: true,
  default: {
    create: (...args: unknown[]) => mockRegistrationCreate(...args),
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'reg-id-1', registrationId: 'CP-ABCDEF1234567890' }),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  },
}));

jest.mock('@/lib/payment', () => ({
  ...jest.requireActual('@/lib/payment'),
  initializePayment: (...args: unknown[]) => mockInitializePayment(...args),
}));

jest.mock('@/lib/mongodb', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/email', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK_QR'),
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue(mockMongoSession),
  };
});

// Imports after mocks
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/payment/init/route';
import { completeRegistration } from '@/lib/payment';

// Helpers
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/payment/init', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const fakeSession = {
  user: { id: 'user-id-1', email: 'student@test.com', role: 'student' },
};


// ---------------------------------------------------------------------------
// Test 1: Init rejects free events (HTTP 400) - Requirement 5.8
// ---------------------------------------------------------------------------

describe('Payment init - free event rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(fakeSession);
  });

  test('returns HTTP 400 when event feeType is free', async () => {
    mockEventFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'event-id-1',
        title: 'Free Workshop',
        feeType: 'free',
        feeAmount: 0,
      }),
    });

    const res = await POST(makeRequest({ eventId: 'event-id-1', provider: 'khalti' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('does not call initializePayment for free events', async () => {
    mockEventFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'event-id-1', feeType: 'free' }),
    });

    await POST(makeRequest({ eventId: 'event-id-1', provider: 'esewa' }));

    expect(mockInitializePayment).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Init rejects duplicate completed payment (HTTP 409) - Requirement 5.9
// ---------------------------------------------------------------------------

describe('Payment init - duplicate completed payment rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(fakeSession);
  });

  test('returns HTTP 409 when student already has a completed payment', async () => {
    mockEventFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'event-id-1',
        title: 'Tech Summit',
        feeType: 'paid',
        feeAmount: 500,
      }),
    });
    mockPaymentFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'payment-id-existing',
        userId: 'user-id-1',
        eventId: 'event-id-1',
        status: 'completed',
      }),
    });

    const res = await POST(makeRequest({ eventId: 'event-id-1', provider: 'khalti' }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('does not call initializePayment when duplicate completed payment exists', async () => {
    mockEventFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'event-id-1', feeType: 'paid', feeAmount: 500 }),
    });
    mockPaymentFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'payment-id-existing', status: 'completed' }),
    });

    await POST(makeRequest({ eventId: 'event-id-1', provider: 'esewa' }));

    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  test('proceeds normally when no completed payment exists', async () => {
    mockEventFindById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'event-id-1', feeType: 'paid', feeAmount: 500 }),
    });
    mockPaymentFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    mockInitializePayment.mockResolvedValue({
      success: true,
      paymentId: 'new-payment-id',
      amount: 500,
      provider: 'khalti',
    });

    const res = await POST(makeRequest({ eventId: 'event-id-1', provider: 'khalti' }));

    expect(res.status).toBe(200);
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Capacity abort in completeRegistration - Requirement 5.10
// (Covered in depth in payment.test.ts; this confirms the error message)
// ---------------------------------------------------------------------------

describe('completeRegistration - capacity abort error message', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMongoSession.startTransaction.mockClear();
    mockCommitTransaction.mockClear();
    mockAbortTransaction.mockClear();
    mockEndSession.mockClear();
  });

  test('throws "Event is full" when event is at capacity', async () => {
    mockPaymentFindById.mockResolvedValue({
      _id: 'payment-id-1',
      status: 'completed',
      amount: 500,
      provider: 'khalti',
      transactionId: 'txn-abc',
    });
    mockEventFindById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: 'event-id-1',
        title: 'Full Event',
        capacity: 10,
        registeredCount: 10,
      }),
    });

    await expect(
      completeRegistration('payment-id-1', 'user-id-1', 'event-id-1')
    ).rejects.toThrow('Event is full');
  });
});
