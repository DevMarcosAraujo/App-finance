import { parseDurationToMs } from './duration.util';

describe('parseDurationToMs', () => {
  it('converts seconds', () => {
    expect(parseDurationToMs('30s')).toBe(30 * 1000);
  });

  it('converts minutes', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60 * 1000);
  });

  it('converts hours', () => {
    expect(parseDurationToMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('converts days', () => {
    expect(parseDurationToMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationToMs('30x')).toThrow();
    expect(() => parseDurationToMs('abc')).toThrow();
  });
});
