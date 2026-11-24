# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 0 — repository and legacy behavior discovery

## Repository facts

- The repository currently has one branch, `master`; the GitHub default branch is `master`. There is no `main` branch to merge into.
- The checked-in app is an Angular 22 application under `projects/vote`.
- Dependencies include `ngx-exp-parser@^1.0.2` and `ngx-kit@^9.5.2`.
- `FormQuestionTypesEnum` contains many question type IDs. The current checked-in renderer registry in `projects/vote/src/app/questions/definitions.ts` has dynamic imports for only `HtmlFrame`, `UniqueSelect`, and `MultiSelect`.
- The current `QuestionModel` still extends the generated API DTO and combines data normalization, rendering component reference, expression buckets, and UI state.
- `VoteService` currently owns the expression engine, reactive form model, question collection, pagination flags, state-key mapping, loading, and expression registration.
- `QuestionModel.canShow` is a computed signal that calls `checkOptionExpr()`; that method iterates options and writes `opt.canShow`. This is a side effect inside a derived computation and must be removed in the new design.
- `checkOptionExpr()` evaluates Show/Hide/Select/UnSelect expressions, but the current code only assigns the Show/Hide result to `opt.canShow`; the Select/UnSelect results are computed and not applied in the inspected implementation.
- `VoteService.iniitlizeQuestions()` awaits each renderer load in a sequential loop. Dynamic import provides code splitting, but initialization currently serializes the per-question awaits.
- The current view renders visible questions using `NgComponentOutlet` and a per-question component reference.
- The generated enum currently lists types from UniqueSelect/MultiSelect through Payment/Group/PostalCode. A renderer implementation for a type must not be assumed merely because the enum member exists.

## Expression library

- `ngx-exp-parser` PR #2 (bytecode engine and dependency analysis) is merged into `main` as of 2026-11-24.
- Merged PR: https://github.com/mr-samani/ExpParser/pull/2
- Merge commit: `597168c038d99fda3f81676a09c6cb7c6767855f`
- The app currently declares `ngx-exp-parser: ^1.0.2`. Verify the published npm artifact includes the merged implementation before relying on new public APIs. A Git merge alone does not prove an npm release contains it.

## Not yet done

- No legacy behavior inventory is complete.
- No production/anonymized survey fixtures have been committed.
- No performance baseline exists.
- No new runtime architecture or engine has been implemented.
- No tests currently prove parity with the legacy implementation.
- No code has been merged to `main`; `main` does not exist in this repository.

## Important repository setting

GitHub currently reports this repository visibility as **public**. Confirm this is intentional before adding any non-public production source, credentials, respondent data, or proprietary configuration. Do not put sensitive production data in fixtures.
