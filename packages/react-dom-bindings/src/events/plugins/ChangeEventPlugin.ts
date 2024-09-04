import { registerTwoPhaseEvent } from "../EventRegistry";
import type { DOMEventName } from "../DOMEventNames";
import type { Fiber } from "react-reconciler/src/ReactInternalTypes";
import {
  type AnyNativeEvent,
  type DispatchQueue,
  accumulateTwoPhaseListeners,
} from "../DOMPluginEventSystem";
import { type EventSystemFlags } from "../EventSystemFlags";
import isTextInputElement from "../isTextInputElement";
import { SyntheticEvent } from "../SyntheticEvent";

function registerEvents() {
  registerTwoPhaseEvent("onChange", [
    "change",
    "click",
    "focusin",
    "focusout",
    "input",
    "keydown",
    "keyup",
    "selectionchange",
  ]);
}

function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
): void {
  // textarea input， 文本。其它的类型先不考虑
  const targetNode = targetInst ? targetInst.stateNode : null;
  if (isTextInputElement(targetNode)) {
    if (domEventName === "input" || domEventName === "change") {
      const inst = getInstIfValueChanged(targetInst as Fiber, targetNode);
      if (!inst) {
        return;
      }
      // input textarea,文本。
      const listeners = accumulateTwoPhaseListeners(targetInst, "onChange");
      if (listeners.length > 0) {
        const event = new SyntheticEvent(
          "onChange",
          "change",
          null,
          nativeEvent,
          nativeEventTarget
        );
        dispatchQueue.push({ event, listeners });
      }
    }
  }
}

function getInstIfValueChanged(
  targetInst: Fiber,
  targetNode: HTMLInputElement
): boolean {
  const oldValue = targetInst.pendingProps.value;
  const newValue = targetNode.value;
  return oldValue !== newValue;
}

export { registerEvents, extractEvents };
