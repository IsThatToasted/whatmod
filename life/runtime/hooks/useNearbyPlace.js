import { useEffect, useState } from 'react';
import { nearestRelevantPlace, requestCurrentPosition } from '../lib/location.js';
export function useNearbyPlace(places, enabled) {
    const [placeName, setPlaceName] = useState(null);
    useEffect(() => {
        let active = true;
        if (!enabled) {
            setPlaceName(null);
            return;
        }
        requestCurrentPosition()
            .then(position => { if (active)
            setPlaceName(nearestRelevantPlace(position, places)?.name || null); })
            .catch(() => { if (active)
            setPlaceName(null); });
        return () => { active = false; };
    }, [enabled, places]);
    return placeName;
}
