# Compatibility matrix

Status values: **Observed** = code is present in this snapshot; **Unknown** = enum/DTO exists but behavior is not established here; **Not registered** = no renderer loader appears in the current registry.

| Area | Current evidence | Rewrite requirement | Status |
|---|---|---|---|
| API question DTO | Generated `GetFormQuestionQuestionOptionDto` | Adapter; do not mutate generated contract | Observed |
| Question type IDs | `FormQuestionTypesEnum` lists 43 IDs (including gaps) | Preserve numeric IDs; explicit registry | Observed |
| HtmlFrame renderer | Dynamic loader and component | Parity fixture and lazy-chunk test | Observed |
| UniqueSelect renderer | Dynamic loader and component | Preserve selected answer + description behavior | Observed |
| MultiSelect renderer | Dynamic loader and component | Preserve multi-answer serialization and option descriptions | Observed |
| Other enum types | Enum values exist | Inspect source/production implementation and implement individually | Unknown / Not registered |
| Show/Hide question rules | Evaluated in QuestionModel.canShow | Define precedence and dependencies; test | Partial |
| Show/Hide option rules | Evaluated in checkOptionExpr | Incremental evaluation and visibility aggregation | Partial |
| Select/UnSelect option rules | Evaluated but results are not applied in inspected method | Verify intended legacy behavior | Unknown |
| Formula/variable references | Expression DTOs and FormulaEngineService use | Build dependency graph from real expressions | Partial |
| One-question-per-page | Poll DTO flag and slicing in VoteService | Flow runtime parity | Partial |
| Section loops | Section DTO types exist in API model set | Need source/fixtures before modeling | Unknown |
| Answer retention when hidden | No policy established in inspected code | Verify legacy behavior explicitly | Unknown |
| Validation and submit | Not established in inspected files | Inspect full save/submit path | Unknown |
| RTL/LTR and accessibility | Not fully inventoried | Capture screenshots and interaction tests | Unknown |

Do not mark an Unknown row as implemented based only on a type name, DTO property, or UI mockup.
