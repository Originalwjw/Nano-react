import {
  registerSimpleEvents,
  topLevelEventsToReactNames,
} from "../DOMEventProperties";
import type { DOMEventName } from "../DOMEventNames";
import type { Fiber } from "react-reconciler/src/ReactInternalTypes";
import {
  type AnyNativeEvent,
  type DispatchQueue,
  accumulateSinglePhaseListeners,
} from "../DOMPluginEventSystem";
import { IS_CAPTURE_PHASE, type EventSystemFlags } from "../EventSystemFlags";
import { SyntheticEvent, SyntheticMouseEvent } from "../SyntheticEvent";

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  // click->onClick
  const reactName = topLevelEventsToReactNames.get(domEventName);
  if (reactName === undefined) {
    return;
  }

  let SyntheticEventCtor = SyntheticEvent;
  switch (domEventName) {
    case "click":
      // Firefox creates a click event on right mouse clicks. This removes the
      // unwanted click events.
      // TODO: Fixed in https://phabricator.services.mozilla.com/D26793. Can
      // probably remove.
      if (nativeEvent.button === 2) {
        return;
      }
    /* falls through */
    case "auxclick":
    case "dblclick":
    case "mousedown":
    case "mousemove":
    case "mouseup":
    // TODO: Disabled elements should not respond to mouse events
    /* falls through */
    case "mouseout":
    case "mouseover":
    case "contextmenu":
      SyntheticEventCtor = SyntheticMouseEvent;
      break;
  }

  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  // 如果是 scroll 事件，或者是 scrollend 事件，那么只会在冒泡阶段触发
  const accumulateTargetOnly =
    !inCapturePhase &&
    (domEventName === "scroll" || domEventName === "scrollend");

  const listeners = accumulateSinglePhaseListeners(
    targetInst,
    reactName,
    nativeEvent.type,
    inCapturePhase,
    accumulateTargetOnly,
    nativeEvent
  );

  if (listeners.length > 0) {
    const event = new SyntheticEventCtor(
      reactName,
      domEventName,
      null,
      nativeEvent,
      nativeEventTarget
    );
    dispatchQueue.push({ event, listeners });
  }
}

export { registerSimpleEvents as registerEvents, extractEvents };
