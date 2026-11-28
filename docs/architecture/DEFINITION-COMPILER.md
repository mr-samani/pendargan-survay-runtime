# Immutable definition compiler

## Purpose

The definition compiler is the boundary between generated API DTOs and the runtime. It creates a detached, immutable snapshot and reports structural issues before runtime state is created.

It does not evaluate expressions, mutate answers, load question components, decide visibility, or create loop instances.

## Source mapping

The current API response exposes:

- formSections: section identity, section type, first question sort key, loop number and popup flag.
- formQuestions: question identity, type, section/parent references, sort order, settings and question options.
- formExpressions: expression source, action, target, scope, target key and quota-related metadata.
- formGlobalVariables: variable identity, declared type, expression and activation flags.
- formGuid and canSubmit: survey-level metadata.

The compiler preserves these fields as typed definition records and also stores a detached immutable `source` snapshot for each section, question, option, expression, and global variable. This prevents fields not yet modeled explicitly (for example, renderer-specific settings) from being silently lost. It intentionally retains inactive definitions and expression metadata; runtime policy decides which entries participate in a particular execution.

## Identity

Definition IDs prefer uniqueIdPerForm, then uniqueId. If neither exists, a deterministic index-based fallback is emitted with a warning. Such fallback IDs are only stable within the current response snapshot and must not be used as persisted answer identity.

Duplicate IDs are errors. Missing question types are errors because a renderer cannot be selected safely.

## Immutability

The compiler creates new arrays and objects. Each DTO is serialized to a plain snapshot and cloned before freezing. Nested JSON settings are also cloned before freezing, so freezing the compiled definition does not freeze or mutate the API response DTO.

## Ordering

Sections are sorted by firstQuestionSortKey; questions by sortKey; options by rowNumber. Missing sort keys are placed after explicitly ordered items. Equal keys preserve source order.

## Deliberate non-goals

- No inference that formSectionUniqueId has a particular runtime instance meaning.
- No visibility or hidden-answer policy.
- No expression parser invocation or dependency graph yet.
- No answer initialization, navigation, submission payload generation or renderer loading.

These boundaries are intentional until legacy behavior is fully characterized.
