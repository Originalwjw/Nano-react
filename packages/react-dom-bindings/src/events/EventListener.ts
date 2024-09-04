export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
): Function {
  target.addEventListener(eventType, listener as any, {
    capture: false,
    passive,
  });
  return listener;
}

export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean
): Function {
  target.addEventListener(eventType, listener as any, {
    capture: true,
    passive,
  });
  return listener;
}

export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  capture: boolean
): void {
  target.removeEventListener(eventType, listener as any, capture);
}
