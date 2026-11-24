# Typed dependency graph

## Purpose

The graph links mutable survey inputs to registered formula nodes and formula nodes to opaque action targets. It is a data-flow description only: graph construction does not evaluate formulas or execute actions.

## Node kinds

- `question-input`: one question's answer-derived fields.
- `option-input`: one option selection value.
- `global-variable`: the value produced by a global-variable formula.
- `formula`: one registered question expression or global-variable expression.
- `scope-input`: a regular identifier/property path or a wildcard dynamic-index path.
- `external-reference`: a dependency that could not be resolved against the current definition.
- `action-target`: an opaque target/action descriptor copied from the expression DTO.

## Legacy reference mapping confirmed in the checked-in source

The current `VoteService` builds reactive form keys as `@Q` + `uniqueIdPerForm` with hyphens removed. It creates an `answer` property on each question object and an `A` + option-fid property for each option. The current selection renderers write these fields.

The graph therefore resolves:
- `@Q{questionFid}.A{optionFid}` to an option input node;
- other `@Q{questionFid}.{field}` references to the owning question input node;
- `[%name%]` to a global variable only when the name exactly matches its compiled ID/source ID.

This exact mapping is based on the checked-in `VoteService`, `QuestionModel`, `AnswerModel`, and renderer code. It must be extended only when further production reference formats are found.

## Unresolved references

Unresolved question/option/global-variable references remain explicit external nodes and produce warnings. Ambiguous or duplicate legacy formula keys are errors. This avoids silently dropping dependencies or binding a formula to the wrong input.

Regular identifiers and dynamic array paths remain scope-input nodes. Dynamic paths such as `rows[*]` stay wildcard dependencies; the graph does not guess an array index.

## Edges and cycles

Edges point from dependency to dependent:
- input/global-variable `reads` formula;
- formula `produces` global-variable value;
- formula `triggers` action target.

Topological ordering uses iterative Kahn traversal. Strongly connected components are found with iterative Kosaraju traversal, avoiding recursive call-stack growth. The graph reports exact cyclic components separately from all nodes blocked behind a cycle.

## Important limitation

The current checked-in `VoteService` registers expressions but does not initialize `formGlobalVariables`, and its expression dispatcher only attaches InsideForm Question/Answer expressions. It does not implement the remaining action/target enum cases. The graph preserves those target descriptors but does not invent their behavior. Full production fixtures or additional source are needed before implementing those semantics.
