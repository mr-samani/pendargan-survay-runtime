import { ExpressionAnalyzer } from 'ngx-exp-parser';
import { describe, expect, it } from 'vitest';

describe('installed ngx-exp-parser public API', () => {
  it('exposes the expression analyzer required by the runtime compiler', () => {
    expect(typeof ExpressionAnalyzer).toBe('function');
    expect(typeof ExpressionAnalyzer.prototype.analyze).toBe('function');
  });
});
