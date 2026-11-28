export interface MatrixDynamicChild {
  readonly uniqueId?: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly questionType?: number;
}

export interface MatrixDynamicColumn {
  readonly id: string;
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
      questionType: child?.questionType,
      description: child?.description ?? '',
    });
  });

  const rows: MatrixDynamicRow<TChild>[] = [];
  if (isValid) {
    for (let offset = 0; offset < children.length; offset += columnCount) {
      const cells = Object.freeze(children.slice(offset, offset + columnCount));
      const first = cells[0];
      rows.push(Object.freeze({
        id: first?.uniqueId ?? `row-${rows.length}`,
        title: first?.title ?? '',
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
