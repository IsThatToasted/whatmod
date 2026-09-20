import { useEffect, useState } from 'react'
import type { Place } from '../types'
import { nearestRelevantPlace, requestCurrentPosition } from '../lib/location'

export function useNearbyPlace(places: Place[], enabled: boolean) {
  const [placeName, setPlaceName] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!enabled) { setPlaceName(null); return }
    requestCurrentPosition()
      .then(position => { if (active) setPlaceName(nearestRelevantPlace(position, places)?.name || null) })
      .catch(() => { if (active) setPlaceName(null) })
    return () => { active = false }
  }, [enabled, places])
  return placeName
}
