import { haversineDistance } from './haversine-distance';

/**
 *  الگوریتم
 * Minimum Spanning Tree (MST)
 * @param features
 * @returns
 */
export function buildMST(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  const parent = new Array(features.length).fill(0).map((_, i) => i);

  const find = (i: number): number => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: number, j: number): boolean => {
    const pi = find(i);
    const pj = find(j);
    if (pi === pj) return false;
    parent[pi] = pj;
    return true;
  };

  const edges: {
    i: number;
    j: number;
    distance: number;
  }[] = [];

  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const dist = haversineDistance(
        (features[i].geometry as any).coordinates as number[],
        (features[j].geometry as any).coordinates as number[],
      );
      edges.push({ i, j, distance: dist });
    }
  }

  edges.sort((a, b) => a.distance - b.distance);

  const lines: GeoJSON.Feature[] = [];

  for (const edge of edges) {
    if (union(edge.i, edge.j)) {
      lines.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            (features[edge.i].geometry as any).coordinates as number[],
            (features[edge.j].geometry as any).coordinates as number[],
          ],
        },
        properties: {
          distance: edge.distance,
        },
      });
    }

    // وقتی MST کامل شد (N-1 خط)، می‌شه قطع کرد
    if (lines.length === features.length - 1) break;
  }

  return lines;
}
