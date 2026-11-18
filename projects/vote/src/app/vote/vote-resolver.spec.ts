import { TestBed } from '@angular/core/testing';
import { ResolveFn } from '@angular/router';
import { voteResolver } from './vote-resolver';

describe('voteResolver', () => {
  const executeResolver: ResolveFn<boolean> = (...resolverParameters) =>
    TestBed.runInInjectionContext(() => voteResolver(...resolverParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeResolver).toBeTruthy();
  });
});
