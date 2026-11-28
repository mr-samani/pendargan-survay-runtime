import { computed, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { buildMatrixDynamicLayout, projectVisibleMatrixDynamicLayout } from './matrix-dynamic-layout';

const children = [
  { uniqueId: 'r1c1', title: 'Region A', description: 'Score', questionType: 15 },
  { uniqueId: 'r1c2', title: 'Region A', description: 'Comment', questionType: 4 },
  { uniqueId: 'r2c1', title: 'Region B', description: 'Score', questionType: 15 },
  { uniqueId: 'r2c2', title: 'Region B', description: 'Comment', questionType: 4 },
];

describe('buildMatrixDynamicLayout', () => {
  it('uses first row descriptions as column headers and each row first child as row title', () => {
    const layout = buildMatrixDynamicLayout(children, 2);
    expect(layout.isValid).toBe(true);
    expect(layout.columns).toEqual([
      { id: 'r1c1', columnIndex: 0, questionType: 15, description: 'Score' },
      { id: 'r1c2', columnIndex: 1, questionType: 4, description: 'Comment' },
    ]);
    expect(layout.rows.map((row) => ({
      id: row.id,
      title: row.title,
      cells: row.cells.map((cell) => cell.uniqueId),
    }))).toEqual([
      { id: 'r1c1', title: 'Region A', cells: ['r1c1', 'r1c2'] },
      { id: 'r2c1', title: 'Region B', cells: ['r2c1', 'r2c2'] },
    ]);
  });

  it('preserves the legacy default of one column', () => {
    const layout = buildMatrixDynamicLayout(children.slice(0, 2), undefined);
    expect(layout.isValid).toBe(true);
    expect(layout.columnCount).toBe(1);
    expect(layout.rows).toHaveLength(2);
  });

  it('rejects incomplete child groups instead of rendering shifted cells', () => {
    const layout = buildMatrixDynamicLayout(children.slice(0, 3), 2);
    expect(layout.isValid).toBe(false);
    expect(layout.rows).toEqual([]);
    expect(layout.childCount).toBe(3);
  });

  it('rejects zero, negative, fractional and non-finite column counts', () => {
    for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(buildMatrixDynamicLayout(children, count).isValid).toBe(false);
    }
  });

  it('does not mutate or retain mutable copies of the source child array', () => {
    const source = [...children];
    const layout = buildMatrixDynamicLayout(source, 2);
    expect(source).toEqual(children);
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.rows)).toBe(true);
    expect(Object.isFrozen(layout.rows[0].cells)).toBe(true);
  });

  it('keeps an empty matrix structurally valid, matching the legacy grouping rule', () => {
    const layout = buildMatrixDynamicLayout([], 3);
    expect(layout.isValid).toBe(true);
    expect(layout.columns).toHaveLength(3);
    expect(layout.rows).toEqual([]);
  });

  it('keeps visible rows and columns while preserving blank cell alignment', () => {
    const layout = buildMatrixDynamicLayout(children, 2);
    const visible = projectVisibleMatrixDynamicLayout(layout, (child) =>
      child.uniqueId === 'r1c1' || child.uniqueId === 'r2c2',
    );

    expect(visible.columns.map((column) => column.id)).toEqual(['r1c1', 'r1c2']);
    expect(visible.rows.map((row) => row.id)).toEqual(['r1c1', 'r2c1']);
    expect(visible.rows[0].cells.map((cell) => cell.child?.uniqueId)).toEqual(['r1c1', undefined]);
    expect(visible.rows[1].cells.map((cell) => cell.child?.uniqueId)).toEqual([undefined, 'r2c2']);
  });

  it('hides a column when every cell in that column is hidden', () => {
    const layout = buildMatrixDynamicLayout(children, 2);
    const visible = projectVisibleMatrixDynamicLayout(layout, (child) =>
      child.uniqueId === 'r1c1' || child.uniqueId === 'r2c1',
    );
    expect(visible.columns.map((column) => column.description)).toEqual(['Score']);
    expect(visible.rows.every((row) => row.cells.length === 1)).toBe(true);
  });

  it('hides a row when all of its child questions are hidden', () => {
    const layout = buildMatrixDynamicLayout(children, 2);
    const visible = projectVisibleMatrixDynamicLayout(layout, (child) =>
      child.uniqueId === 'r1c1' || child.uniqueId === 'r1c2',
    );
    expect(visible.rows.map((row) => row.title)).toEqual(['Region A']);
  });

  it('returns an empty visible matrix when no child question is visible', () => {
    const visible = projectVisibleMatrixDynamicLayout(
      buildMatrixDynamicLayout(children, 2),
      () => false,
    );
    expect(visible.columns).toEqual([]);
    expect(visible.rows).toEqual([]);
  });


  it('reacts to runtime title and description interpolation updates without rebuilding child identities', () => {
    const rowTitle = signal('Base row');
    const columnDescription = signal('Base column');
    const reactiveChildren = [{
      uniqueId: 'cell-1',
      title: 'Static row',
      description: 'Static column',
      effectiveTitle: () => rowTitle(),
      effectiveDescription: () => columnDescription(),
    }];
    const layout = computed(() => buildMatrixDynamicLayout(reactiveChildren, 1));

    expect(layout().rows[0].title).toBe('Base row');
    expect(layout().columns[0].description).toBe('Base column');
    rowTitle.set('Updated row');
    columnDescription.set('Updated column');

    expect(layout().rows[0].title).toBe('Updated row');
    expect(layout().columns[0].description).toBe('Updated column');
    expect(layout().rows[0].cells[0]).toBe(reactiveChildren[0]);
  });


  it('treats runtime EndForm child flags as invisible cells without shifting the matrix', () => {
    const endedChildren = children.map((child, index) => ({
      ...child,
      runtimeEndForm: () => index === 1 || index === 3,
    }));
    const layout = buildMatrixDynamicLayout(endedChildren, 2);
    const visible = projectVisibleMatrixDynamicLayout(layout, (child) =>
      child.runtimeEndForm?.() !== true,
    );
    expect(visible.columns.map((column) => column.id)).toEqual(['r1c1']);
    expect(visible.rows.map((row) => row.title)).toEqual(['Region A', 'Region B']);
    expect(visible.rows.map((row) => row.cells.map((cell) => cell.child?.uniqueId)))
      .toEqual([['r1c1'], ['r2c1']]);
  });

});