import { describe, expect, it } from "vitest";
import {
  addMinor,
  assertIntegerMinor,
  clamp,
  computeOrderTotals,
  money,
  multiplyMinor,
  percentOfMinor,
  subtractMinor,
  toMajorUnits,
} from "./money";

describe("assertIntegerMinor", () => {
  it("accepts integers", () => {
    expect(() => {
      assertIntegerMinor(1250);
    }).not.toThrow();
    expect(() => {
      assertIntegerMinor(0);
    }).not.toThrow();
    expect(() => {
      assertIntegerMinor(-500);
    }).not.toThrow();
  });

  it("rejects floats — the reason money is stored as minor units", () => {
    expect(() => {
      assertIntegerMinor(12.5);
    }).toThrow(/integer in minor units/);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => {
      assertIntegerMinor(Number.NaN);
    }).toThrow();
    expect(() => {
      assertIntegerMinor(Number.POSITIVE_INFINITY);
    }).toThrow();
  });
});

describe("toMajorUnits", () => {
  it("scales by the currency exponent (2 for both EGP and USD)", () => {
    expect(toMajorUnits(1250, "EGP")).toBe(12.5);
    expect(toMajorUnits(1250, "USD")).toBe(12.5);
    expect(toMajorUnits(0, "EGP")).toBe(0);
    expect(toMajorUnits(1, "EGP")).toBe(0.01);
    expect(toMajorUnits(99, "EGP")).toBe(0.99);
  });

  it("produces the same numeric value regardless of currency", () => {
    // Both supported currencies have exponent 2. This test guards the invariant
    // that switching currency (open decision D1) is a display concern only.
    expect(toMajorUnits(4999, "EGP")).toBe(toMajorUnits(4999, "USD"));
  });
});

describe("integer arithmetic", () => {
  it("adds and subtracts minor units", () => {
    expect(addMinor(1250, 750)).toBe(2000);
    expect(subtractMinor(2000, 750)).toBe(1250);
  });

  it("rejects float operands so a float cannot enter the total path", () => {
    expect(() => {
      addMinor(1250, 0.5);
    }).toThrow();
    expect(() => {
      subtractMinor(1250, 0.5);
    }).toThrow();
  });

  it("multiplies by a whole quantity", () => {
    expect(multiplyMinor(1250, 3)).toBe(3750);
    expect(multiplyMinor(1250, 0)).toBe(0);
  });

  it("rejects fractional quantities", () => {
    expect(() => {
      multiplyMinor(1250, 2.5);
    }).toThrow(/quantity must be an integer/);
  });
});

describe("percentOfMinor", () => {
  it("rounds half-up at the MINOR UNIT level", () => {
    // 10% of 333 = 33.3 -> 33. Rounding at major-unit level would give 3.33 - 0.33 = 3.00,
    // a whole-unit error, which is why this rounds on the integer.
    expect(percentOfMinor(333, 10)).toBe(33);
    // 50% of 5 = 2.5 -> 3 (half-up)
    expect(percentOfMinor(5, 50)).toBe(3);
    // 15% of 7 = 1.05 -> 1
    expect(percentOfMinor(7, 15)).toBe(1);
  });

  it("handles exact percentages without drift", () => {
    expect(percentOfMinor(1000, 10)).toBe(100);
    expect(percentOfMinor(1000, 50)).toBe(500);
    expect(percentOfMinor(1000, 100)).toBe(1000);
    expect(percentOfMinor(1000, 0)).toBe(0);
  });

  it("clamps out-of-range percentages", () => {
    expect(percentOfMinor(1000, 150)).toBe(1000);
    expect(percentOfMinor(1000, -20)).toBe(0);
  });

  it("rejects non-finite percentages", () => {
    expect(() => {
      percentOfMinor(1000, Number.NaN);
    }).toThrow(/finite/);
  });

  it("never exceeds the original amount", () => {
    expect(percentOfMinor(999, 100)).toBe(999);
  });
});

describe("clamp", () => {
  it("bounds a value to the range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(50, 1, 10)).toBe(10);
  });
});

describe("computeOrderTotals", () => {
  it("computes a normal order", () => {
    const result = computeOrderTotals({
      subtotalMinor: 5000,
      discountMinor: 500,
      deliveryFeeMinor: 3000,
      taxMinor: 0,
    });
    expect(result).toEqual({
      subtotalMinor: 5000,
      discountMinor: 500,
      deliveryFeeMinor: 3000,
      taxMinor: 0,
      totalMinor: 7500,
    });
  });

  it("supports tax-inclusive pricing (D2 shape B: tax already inside subtotal)", () => {
    // When VAT is inclusive, subtotal already contains it and taxMinor is 0
    // for display purposes. The arithmetic is identical either way, which is why
    // the unresolved D2 decision does not change this function.
    const result = computeOrderTotals({
      subtotalMinor: 11500,
      discountMinor: 1500,
      deliveryFeeMinor: 0,
      taxMinor: 0,
    });
    expect(result?.totalMinor).toBe(10000);
  });

  it("supports tax-added-at-checkout (D2 shape A)", () => {
    const result = computeOrderTotals({
      subtotalMinor: 10000,
      discountMinor: 0,
      deliveryFeeMinor: 2000,
      taxMinor: 1400,
    });
    expect(result?.totalMinor).toBe(13400);
  });

  it("returns null for a discount exceeding the subtotal instead of clamping", () => {
    // DATA_MODEL.md §3.11.3 step 8: a negative total must ABORT, not become 0.
    const result = computeOrderTotals({
      subtotalMinor: 1000,
      discountMinor: 1500,
      deliveryFeeMinor: 0,
      taxMinor: 0,
    });
    expect(result).toBeNull();
  });

  it("returns null for a negative discount", () => {
    const result = computeOrderTotals({
      subtotalMinor: 1000,
      discountMinor: -100,
      deliveryFeeMinor: 0,
      taxMinor: 0,
    });
    expect(result).toBeNull();
  });

  it("returns null when delivery and tax cannot cover a discount", () => {
    const result = computeOrderTotals({
      subtotalMinor: 1000,
      discountMinor: 5000,
      deliveryFeeMinor: 100,
      taxMinor: 0,
    });
    expect(result).toBeNull();
  });

  it("allows a zero-total order (100% discount, free delivery)", () => {
    const result = computeOrderTotals({
      subtotalMinor: 2000,
      discountMinor: 2000,
      deliveryFeeMinor: 0,
      taxMinor: 0,
    });
    expect(result?.totalMinor).toBe(0);
  });

  it("rejects float inputs at the boundary", () => {
    expect(() =>
      computeOrderTotals({
        subtotalMinor: 100.5,
        discountMinor: 0,
        deliveryFeeMinor: 0,
        taxMinor: 0,
      }),
    ).toThrow();
  });
});

describe("money", () => {
  it("pairs an amount with its currency", () => {
    expect(money(1250, "EGP")).toEqual({ minor: 1250, currency: "EGP" });
  });
});
