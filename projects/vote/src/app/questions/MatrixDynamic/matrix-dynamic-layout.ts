export interface MatrixDynamicChild {
  readonly uniqueId?: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly questionType?: number;
  readonly effectiveTitle?: () => string;
  readonly effectiveDescription?: () => string;
}

export interface MatrixDynamicColumn {
  readonly id: string;
  readonly columnIndex: number;
  readonly questionType?: number;
  readonly description: string;
}

export interface MatrixDynamicRow<TChild extends MatrixDynamicChild> {
  readonly id: string;
  readonly title: string;
  readonly cells: readonly TChild[];
}

export interface MatrixDynamicLayout<TChild extends MatrixDynamicChild> {
  readonly columns: readonly MatrixDynamicColumn[];
  readonly rows: readonly MatrixDynamicRow<TChild>[];
  readonly isValid: boolean;
  readonly columnCount: number;
  readonly childCount: number;
}

/**
 * Reconstructs the legacy Matrix_Dynamic row-major child layout.
 * The first child of each row supplies its row title; the first row supplies
 * the column descriptions. Every child remains a real question/cell renderer.
 */
export function buildMatrixDynamicLayout<TChild extends MatrixDynamicChild>(
  children: readonly TChild[],
  configuredColumnCount: number | null | undefined,
): MatrixDynamicLayout<TChild> {
  const columnCount = configuredColumnCount ?? 1;
  const isColumnCountValid = Number.isInteger(columnCount) && columnCount > 0;
  if (!isColumnCountValid) {
    return Object.freeze({
      columns: Object.freeze([]),
      rows: Object.freeze([]),
      isValid: false,
      columnCount,
      childCount: children.length,
    });
  }

  const isValid = children.length % columnCount === 0;
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const child = children[index];
    return Object.freeze({
      id: child?.uniqueId ?? `column-${index}`,
      columnIndex: index,
      questionType: child?.questionType,
      description: child ? (child.effectiveDescription?.() ?? child.description ?? '') : '',
    });
  });

  const rows: MatrixDynamicRow<TChild>[] = [];
  if (isValid) {
    for (let offset = 0; offset < children.length; offset += columnCount) {
      const cells = Object.freeze(children.slice(offset, offset + columnCount));
      const first = cells[0];
      rows.push(Object.freeze({
        id: first?.uniqueId ?? `row-${rows.length}`,
        title: first ? (first.effectiveTitle?.() ?? first.title ?? '') : '',
        cells,
      }));
    }
  }

  return Object.freeze({
    columns: Object.freeze(columns),
    rows: Object.freeze(rows),
    isValid,
    columnCount,
    childCount: children.length,
  });
}

export interface MatrixDynamicVisibleCell<TChild extends MatrixDynamicChild> {
  readonly column: MatrixDynamicColumn;
  readonly child: TChild | undefined;
  readonly originalColumnIndex: number;
}

export interface MatrixDynamicVisibleRow<TChild extends MatrixDynamicChild> {
  readonly id: string;
  readonly title: string;
  readonly cells: readonly MatrixDynamicVisibleCell<TChild>[];
}

export interface MatrixDynamicVisibleLayout<TChild extends MatrixDynamicChild> {
  readonly columns: readonly MatrixDynamicColumn[];
  readonly rows: readonly MatrixDynamicVisibleRow<TChild>[];
}

/** Mirrors the legacy row/column visibility directives without DOM inspection. */
export function projectVisibleMatrixDynamicLayout<TChild extends MatrixDynamicChild>(
  layout: MatrixDynamicLayout<TChild>,
  isVisible: (child: TChild) => boolean,
): MatrixDynamicVisibleLayout<TChild> {
  if (!layout.isValid) {
    return Object.freeze({ columns: Object.freeze([]), rows: Object.freeze([]) });
  }

  const visibleColumnIndexes = layout.columns
    .map((_, index) => index)
    .filter((columnIndex) => layout.rows.some((row) => {
      const child = row.cells[columnIndex];
      return child !== undefined && isVisible(child);
    }));

  const columns = Object.freeze(visibleColumnIndexes.map((index) => layout.columns[index]!));
  const rows = layout.rows.flatMap((row) => {
    const hasVisibleChild = row.cells.some(isVisible);
    if (!hasVisibleChild) return [];
    const cells = visibleColumnIndexes.map((originalColumnIndex) => {
      const child = row.cells[originalColumnIndex];
      return Object.freeze({
        column: layout.columns[originalColumnIndex]!,
        child: child !== undefined && isVisible(child) ? child : undefined,
        originalColumnIndex,
      });
    });
    return [Object.freeze({
      id: row.id,
      title: row.title,
      cells: Object.freeze(cells),
    })];
  });

  return Object.freeze({
    columns,
    rows: Object.freeze(rows),
  });
}
