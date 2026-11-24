import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { FormVotingService } from '@service-proxies/services';
import { VoteService } from '../questions/services/vote.service';
import { VoteComponent } from './vote.component';

describe('VoteComponent', () => {
  let fixture: ComponentFixture<VoteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoteComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { data: { guid: 'test-guid' } } } },
        },
        {
          provide: FormVotingService,
          useValue: {
            getAllFormDetailForView: vi.fn().mockReturnValue(
              of({ formQuestions: [], formExpressions: [] }),
            ),
          },
        },
        {
          provide: VoteService,
          useValue: {
            handleFormDetailsData: vi.fn().mockResolvedValue(undefined),
            questionList: () => [],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoteComponent);
  });

  it('creates the standalone vote component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
