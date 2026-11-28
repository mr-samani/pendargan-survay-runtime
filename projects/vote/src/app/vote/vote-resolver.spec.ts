import { VoteResolver } from './vote-resolver';

describe('VoteResolver', () => {
  it('exposes a functional route resolver', () => {
    expect(VoteResolver).toBeTypeOf('function');
  });
});
