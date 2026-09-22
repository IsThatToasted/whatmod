function distanceMeters(a, b) {
    const earth = 6371000;
    const rad = (n) => n * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const lat1 = rad(a.latitude);
    const lat2 = rad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earth * Math.asin(Math.sqrt(h));
}
export function nearestRelevantPlace(position, places) {
    return places
        .filter(p => p.latitude != null && p.longitude != null)
        .map(place => ({ place, distance: distanceMeters(position, { latitude: place.latitude, longitude: place.longitude }) }))
        .filter(result => result.distance <= result.place.radius_meters)
        .sort((a, b) => a.distance - b.distance)[0]?.place ?? null;
}
export function requestCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator))
            return reject(new Error('Location is not supported on this device.'));
        navigator.geolocation.getCurrentPosition(pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }), err => reject(new Error(err.message || 'Location permission was not granted.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
    });
}
