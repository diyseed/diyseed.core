import { describe, it, expect } from 'vitest';
import { codeFromSearch } from '../src/ui/codeLink';

describe('codeFromSearch', () => {
  it('reads and trims the code parameter', () => {
    expect(codeFromSearch('?code=%201-0856-0540-15-12-01-1-1%20')).toBe('1-0856-0540-15-12-01-1-1');
  });

  it('returns null when the parameter is missing or blank', () => {
    expect(codeFromSearch('')).toBeNull();
    expect(codeFromSearch('?code=')).toBeNull();
    expect(codeFromSearch('?other=1')).toBeNull();
  });
});
