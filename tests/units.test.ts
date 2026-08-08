import { describe, it, expect } from 'vitest';
import { mm, size, point, toMm } from '../src/units';

describe('units', () => {
  it('converts millimeters to points at 2.834645669291339 pt/mm', () => {
    expect(mm(1)).toBeCloseTo(2.834645669291339, 10);
    expect(mm(10)).toBeCloseTo(28.34645669291339, 8);
    expect(mm(0)).toBe(0);
  });

  it('builds Size and Point values', () => {
    expect(size(10, 20)).toEqual({ width: 10, height: 20 });
    expect(point(1, 2)).toEqual({ x: 1, y: 2 });
  });

  it('converts points back to millimeters via toMm', () => {
    expect(toMm(mm(1))).toBeCloseTo(1, 10);
    expect(toMm(mm(100))).toBeCloseTo(100, 8);
    expect(toMm(0)).toBe(0);
  });
});
