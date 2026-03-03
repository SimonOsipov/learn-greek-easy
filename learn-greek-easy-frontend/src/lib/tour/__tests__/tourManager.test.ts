import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDestroy = vi.fn();
const mockDrive = vi.fn();
const mockGetActiveIndex = vi.fn(() => 0);
const mockHasNextStep = vi.fn(() => false);

const mockDriverInstance = {
  drive: mockDrive,
  destroy: mockDestroy,
  getActiveIndex: mockGetActiveIndex,
  hasNextStep: mockHasNextStep,
};

// Capture the config passed to driver() so we can access callbacks even after vi.clearAllMocks()
let lastDriverConfig: Record<string, unknown> = {};

const mockDriverFn = vi.fn((config: Record<string, unknown>) => {
  lastDriverConfig = config;
  return mockDriverInstance;
});

vi.mock('driver.js', () => ({
  driver: mockDriverFn,
}));

vi.mock('driver.js/dist/driver.css', () => ({}));

vi.mock('@/utils/tourStatus', () => ({
  setTourCompleted: vi.fn(),
}));

vi.mock('../tour.css', () => ({}));

import { startTour, getTourDriver, isTourActive } from '../tourManager';
import type { TourOptions } from '../tourManager';
import { setTourCompleted } from '@/utils/tourStatus';

const mockT = vi.fn((key: string) => key) as unknown as TourOptions['t'];

function getOnDestroyed(): () => void {
  return lastDriverConfig.onDestroyed as () => void;
}

function getOnDestroyStarted(): () => void {
  return lastDriverConfig.onDestroyStarted as () => void;
}

/** Reset module-level activeDriver by simulating a full destroy cycle */
async function resetTourState() {
  if (isTourActive()) {
    mockHasNextStep.mockReturnValue(false);
    getOnDestroyStarted()();
    getOnDestroyed()();
  }
}

describe('tourManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTourState();
  });

  it('startTour with empty steps is a no-op', async () => {
    await startTour([], { t: mockT });
    expect(mockDriverFn).not.toHaveBeenCalled();
  });

  it('startTour creates driver instance and calls drive()', async () => {
    await startTour([{ element: '#test', popover: { title: 'Test' } }], { t: mockT });
    expect(mockDriverFn).toHaveBeenCalledTimes(1);
    expect(mockDrive).toHaveBeenCalledTimes(1);
  });

  it('startTour prevents double-start when already active', async () => {
    await startTour([{ element: '#test1', popover: { title: 'Test1' } }], { t: mockT });
    const callsBefore = mockDriverFn.mock.calls.length;
    await startTour([{ element: '#test2', popover: { title: 'Test2' } }], { t: mockT });
    expect(mockDriverFn.mock.calls.length).toBe(callsBefore);
  });

  it('getTourDriver returns instance during active tour', async () => {
    await startTour([{ element: '#active', popover: { title: 'Active' } }], { t: mockT });
    expect(getTourDriver()).toBe(mockDriverInstance);
  });

  it('isTourActive returns true during active tour', async () => {
    await startTour([{ element: '#active2', popover: { title: 'Active2' } }], { t: mockT });
    expect(isTourActive()).toBe(true);
  });

  it('onDestroyed calls setTourCompleted', async () => {
    await startTour([{ element: '#test', popover: { title: 'Test' } }], { t: mockT });
    mockHasNextStep.mockReturnValue(false);
    getOnDestroyStarted()();
    getOnDestroyed()();
    expect(setTourCompleted).toHaveBeenCalled();
  });

  it('getTourDriver returns null after destroy', async () => {
    await startTour([{ element: '#test', popover: { title: 'Test' } }], { t: mockT });
    mockHasNextStep.mockReturnValue(false);
    getOnDestroyStarted()();
    getOnDestroyed()();
    expect(getTourDriver()).toBeNull();
  });

  it('onDestroyed fires tour_completed when all steps viewed', async () => {
    const onAnalyticsEvent = vi.fn();
    mockHasNextStep.mockReturnValue(false);
    await startTour([{ element: '#test3', popover: { title: 'T3' } }], {
      t: mockT,
      onAnalyticsEvent,
    });
    getOnDestroyStarted()();
    getOnDestroyed()();
    expect(onAnalyticsEvent).toHaveBeenCalledWith(
      'tour_completed',
      expect.objectContaining({ trigger: 'manual' })
    );
  });

  it('onDestroyed fires tour_dismissed when closed early', async () => {
    const onAnalyticsEvent = vi.fn();
    mockHasNextStep.mockReturnValue(true);
    await startTour([{ element: '#test4', popover: { title: 'T4' } }], {
      t: mockT,
      onAnalyticsEvent,
    });
    getOnDestroyStarted()();
    getOnDestroyed()();
    expect(onAnalyticsEvent).toHaveBeenCalledWith(
      'tour_dismissed',
      expect.objectContaining({ trigger: 'manual' })
    );
  });
});
