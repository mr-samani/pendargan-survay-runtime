export function getCurrentLocationHelper(): Promise<[number, number] | undefined> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation is not supported');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        resolve(coords);
      },
      (err) => {
        console.error(err);
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  });
}
