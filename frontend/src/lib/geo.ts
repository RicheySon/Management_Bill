/** Valid finite map coordinate (rejects NaN / Infinity / empty). */
export function isValidCoord(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function toCoord(value: unknown): number | undefined {
    if (isValidCoord(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

export type DetectLocationResult = {
    lat: number;
    lng: number;
    accuracy: number;
};

export function detectDeviceLocation(options?: PositionOptions): Promise<DetectLocationResult> {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('Geolocation is not supported on this device/browser.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                });
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    reject(
                        new Error(
                            'Location permission was denied. Allow location for this site, or use “Select on Map” to pin the place.'
                        )
                    );
                    return;
                }
                if (error.code === error.POSITION_UNAVAILABLE) {
                    reject(new Error('Location unavailable. Try again outdoors, or use “Select on Map”.'));
                    return;
                }
                if (error.code === error.TIMEOUT) {
                    reject(new Error('Location request timed out. Try again, or use “Select on Map”.'));
                    return;
                }
                reject(new Error(error.message || 'Failed to get location'));
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
                ...options,
            }
        );
    });
}
