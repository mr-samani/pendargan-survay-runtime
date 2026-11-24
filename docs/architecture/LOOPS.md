# Repeated section runtime

## Verified legacy behavior

The original client marks a section repeatable when an active InsideForm expression has target ExpressionTargetsEnum.SectionLoop. Its target key is matched against the section uniqueIdPerForm. When formulas are applied, SectionLoop results are written to the section's hasLoop flag in source order; the last matching result that is applied determines whether the current section repeats on advance.

The legacy UI counter starts at zero, while auto-save sends loopIndexNumber = loopNumber + 1. The client stores one section snapshot per section and zero-based loop number. Each snapshot contains the section question answers and a dictionary of variables at that iteration. On full/temporary save, snapshots with filledData === true are serialized as ordered repeatSections, each containing voterAnswerDetails and variablesRepeatedSectionValue. On load, the backend loop number is converted back to zero-based by subtracting one.

## New runtime contract

- Loop detection is based on active InsideForm SectionLoop expressions, not merely on the section type enum.
- Iteration zero uses the existing root answer namespace to preserve the first pass.
- Every additional iteration receives a deterministic, section-scoped answer namespace: loop:<encoded-section-id>:<zero-based-index>.
- A repeated iteration contains only questions belonging to that section, including nested child questions whose formSectionUniqueId matches the section.
- Each iteration stores its own immutable variable snapshot and optional dynamic-data record ID.
- The caller evaluates formulas and passes the SectionLoop decision. An unresolved result never advances.
- Re-entering an earlier iteration reactivates it and preserves any already-created future iteration and its answers. Advancing with a true result reuses that future iteration rather than duplicating it.
- A false result completes the current path. Future iteration snapshots remain stored but are excluded from the visible flow until the user revisits and advances into them again.
- A finite max-iteration guard (default 100, configurable up to 1000) prevents accidental unbounded execution.

## Deliberate boundary

This module does not evaluate formulas, decide validation policy, or serialize the final backend DTO. Formula evaluation and navigation orchestration must call advanceSurveyLoopFromEvaluation at the section transition. Final submission still needs a dedicated adapter that serializes completed/filled iterations into the legacy ordered repeatSections payload. RetailAudit conversion to synthetic DynamicAnswer questions remains a separate adapter concern.
