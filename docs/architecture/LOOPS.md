# Repeated section runtime

## Verified legacy behavior

The original client identifies a repeatable section through an active expression whose target is ExpressionTargetsEnum.SectionLoop; its target key is matched against the section uniqueIdPerForm. The expression result controls whether the current section repeats when the user advances. The legacy UI counter starts at zero, while the auto-save request sends loopIndexNumber = loopNumber + 1.

The client stores one section snapshot per section and zero-based loop number. Each snapshot contains the section question answers and a dictionary of the variables at that iteration. On full/temporary save, snapshots with filledData === true are serialized as ordered repeatSections, each containing voterAnswerDetails and variablesRepeatedSectionValue. On load, the backend loop number is converted back to zero-based by subtracting one.

## New runtime contract

- Iteration zero uses the existing root answer namespace to preserve the first pass.
- Every additional iteration receives a deterministic, section-scoped answer namespace: loop:<encoded-section-id>:<zero-based-index>.
- A repeated iteration contains only questions belonging to that section, including nested child questions whose formSectionUniqueId matches the section.
- Each iteration stores its own immutable variable snapshot and optional dynamic-data record ID.
- The SectionLoop expression is evaluated outside this module. The caller passes its tri-state result to advanceSurveyLoop; unknown results never advance.
- A finite max-iteration guard (default 100, configurable up to 1000) prevents accidental unbounded execution.
- Stopping a loop marks its current iteration complete; repeating creates a new answer instance atomically.

## Deliberate boundary

This module does not evaluate formulas, decide when a section is valid, or serialize the final backend DTO. The next integration step must map ordered completed iterations to the legacy repeatSections contract and ensure only filled iterations are submitted. RetailAudit conversion to synthetic DynamicAnswer questions remains a separate adapter concern.
