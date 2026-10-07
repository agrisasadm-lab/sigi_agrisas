import { shouldNotifyLowStock } from "@/shared/domain/services/checkAndNotifyLowStock";

describe("shouldNotifyLowStock", () => {
  it("returns true on first crossing (lastLowStockNotifiedAt null)", () => {
    expect(shouldNotifyLowStock(8, 10, null)).toBe(true);
  });

  it("returns false within the 24h debounce window", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const lastNotified = new Date("2026-01-01T22:00:00Z");
    expect(shouldNotifyLowStock(5, 10, lastNotified, now)).toBe(false);
  });

  it("returns true after 24h have passed since the last notification", () => {
    const now = new Date("2026-01-02T23:00:01Z");
    const lastNotified = new Date("2026-01-01T23:00:00Z");
    expect(shouldNotifyLowStock(5, 10, lastNotified, now)).toBe(true);
  });

  it("returns false when quantity is at or above reorderPoint", () => {
    expect(shouldNotifyLowStock(10, 10, null)).toBe(false);
    expect(shouldNotifyLowStock(15, 10, null)).toBe(false);
  });

  it("a rebound above threshold does not reset the debounce for a later drop", () => {
    const lastNotified = new Date("2026-01-01T00:00:00Z");
    const reboundThenDropAgain = new Date("2026-01-01T03:00:00Z");
    expect(shouldNotifyLowStock(3, 10, lastNotified, reboundThenDropAgain)).toBe(false);
  });
});

