let uris: string[] = [];

export function setPickedPhotos(next: string[]) {
  uris = next;
}

export function getPickedPhotos() {
  return uris;
}
