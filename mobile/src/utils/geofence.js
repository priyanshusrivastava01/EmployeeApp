/**
 * Geofencing & Distance Utilities using Haversine formula
 */

/**
 * Calculates distance between two GPS coordinates in meters.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Evaluates current GPS coordinates against office geofence and work mode.
 */
export function evaluateGeofence(coords, officeGeofence, mode) {
  if (!coords || coords.latitude == null || coords.longitude == null) {
    return {
      isConfigured: false,
      distanceMeters: null,
      isInside: false,
      statusLabel: 'GPS Coordinates Missing',
      color: '#ef4444'
    };
  }

  // If WFH mode: remote session check
  if (mode === 'WFH') {
    return {
      isConfigured: true,
      distanceMeters: null,
      isInside: true,
      statusLabel: 'Remote Session (WFH - Location Acquired)',
      color: '#a855f7'
    };
  }

  // WFO mode: check office geofence configuration
  if (
    !officeGeofence ||
    officeGeofence.latitude == null ||
    officeGeofence.longitude == null ||
    !officeGeofence.radiusMeters
  ) {
    return {
      isConfigured: false,
      distanceMeters: null,
      isInside: false,
      statusLabel: 'Office geofence not configured',
      color: '#f59e0b'
    };
  }

  const distance = calculateHaversineDistance(
    coords.latitude,
    coords.longitude,
    officeGeofence.latitude,
    officeGeofence.longitude
  );

  const isInside = distance <= officeGeofence.radiusMeters;

  if (isInside) {
    return {
      isConfigured: true,
      distanceMeters: distance,
      isInside: true,
      statusLabel: `Verified (Within ${distance}m of office, allowed: ${officeGeofence.radiusMeters}m)`,
      color: '#10b981'
    };
  }

  return {
    isConfigured: true,
    distanceMeters: distance,
    isInside: false,
    statusLabel: `Outside Office Geofence (${distance}m away, allowed: ${officeGeofence.radiusMeters}m)`,
    color: '#ef4444'
  };
}
