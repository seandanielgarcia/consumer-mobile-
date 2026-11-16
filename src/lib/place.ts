export const formatPlace = (place: { neighborhood: string; city?: string }) =>
  place.city && place.city !== place.neighborhood ? `${place.neighborhood}, ${place.city}` : place.neighborhood;
