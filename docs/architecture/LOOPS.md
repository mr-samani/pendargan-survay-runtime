# Repeated section runtime and submission

## Verified legacy behavior

The original client marks a section repeatable when an active InsideForm expression has target ExpressionTargetsEnum.SectionLoop. Its target key is matched against the section uniqueIdPerForm. When formulas are applied, SectionLoop results are written to the section hasLoop flag in source order; the last matching result that is applied determines whether the current section repeats on advance.

The legacy UI counter starts at zero, while auto-save sends loopIndexNumber = loopNumber + 1. The client stores one section snapshot per section and zero-based loop number. Each snapshot contains the section question answers and a dictionary of variables at that iteration. On full/temporary save, snapshots with filledData === true are serialized as ordered repeatSections, each containing voterAnswerDetails and variablesRepeatedSectionValue. An iteration is appended only when it yields at least one answer detail. On load, the backend loop number is converted back to zero-based by subtracting one.

## New runtime contract

- Loop detection is based on active InsideForm SectionLoop expressions.
- Iteration zero uses the existing root answer namespace to preserve the first pass.
- Every additional iteration receives a deterministic, section-scoped answer namespace.
- Each iteration stores its own immutable variable snapshot, optional dynamic-data record ID, and sticky isFilled flag.
- Advancing marks the current iteration filled. Re-entering an earlier iteration preserves future iteration data; advancing with true reactivates an existing future iteration rather than duplicating it.
- The flow shows only iterations up to the current cursor. The submission projection retains all previously filled iterations, matching the legacy pages store behavior.
- A finite max-iteration guard (default 100, configurable up to 1000) prevents accidental unbounded execution.

## Submission projection

serializeSurveyLoopSubmission builds the generated API envelope:
- one VoterAnswerDetailListAndSectionIdDto per section with non-empty repeated answer data;
- repeatSections ordered by zero-based iteration index;
- each repeated item contains voterAnswerDetails and variablesRepeatedSectionValue;
- variablesLastValue is merged in section/iteration order, with later values replacing earlier keys.

The generated envelope has no explicit section ID property, so outer formSections order follows definition section order. The question-specific serializer is injected because option descriptions, file references, payment, captcha, dynamic answers, and other question types have distinct payload rules. The adapter deliberately does not guess those rules.

## Deliberate boundary

This module does not evaluate formulas or decide validation policy. The caller evaluates the SectionLoop expression and passes its tri-state result. The full question-type serializer, RetailAudit conversion, and top-level CreateVoterWithDetailsDto assembly remain separate integration work.
