import { haversineDistance } from './haversine-distance';

/**
 * الگوریتم
 * Nearest Neighbor Heuristic
 * @param features
 * @returns
 */
export function buildPathFromNearestNeighbor(features: GeoJSON.Feature[]): GeoJSON.Feature {
  if (features.length < 2) return null!;

  const visited = new Set<number>();
  const path: number[][] = [];

  let currentIndex = 0;
  visited.add(currentIndex);
  path.push((features[currentIndex].geometry as any).coordinates as number[]);

  while (visited.size < features.length) {
    let minDist = Infinity;
    let nextIndex = -1;

    for (let i = 0; i < features.length; i++) {
      if (visited.has(i)) continue;

      const dist = haversineDistance(
        (features[currentIndex].geometry as any).coordinates as number[],
        (features[i].geometry as any).coordinates as number[],
      );

      if (dist < minDist) {
        minDist = dist;
        nextIndex = i;
      }
    }

    if (nextIndex !== -1) {
      visited.add(nextIndex);
      path.push((features[nextIndex].geometry as any).coordinates as number[]);
      currentIndex = nextIndex;
    } else {
      break;
    }
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: path,
    },
    properties: {},
  };
}
