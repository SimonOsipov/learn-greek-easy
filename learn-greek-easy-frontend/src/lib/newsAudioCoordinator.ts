let stopCurrent: (() => void) | null = null;

export function registerActivePlayer(stop: () => void): void {
  if (stopCurrent && stopCurrent !== stop) {
    stopCurrent();
  }
  stopCurrent = stop;
}

export function clearActivePlayer(stop: () => void): void {
  if (stopCurrent === stop) {
    stopCurrent = null;
  }
}
