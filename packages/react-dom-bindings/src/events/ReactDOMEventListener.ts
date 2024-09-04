import type { EventPriority } from "react-reconciler/src/ReactEventPriorities";
import {
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  IdleEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from "react-reconciler/src/ReactEventPriorities";
import type { DOMEventName } from "./DOMEventNames";
import * as Scheduler from "scheduler";
import {
  IdlePriority,
  ImmediatePriority,
  LowPriority,
  NormalPriority,
  UserBlockingPriority,
} from "scheduler/src/SchedulerPriorities";
import { EventSystemFlags, IS_CAPTURE_PHASE } from "./EventSystemFlags";
import { extractEvents } from "./DOMPluginEventSystem";
import { getClosestInstanceFromNode } from "../client/ReactDOMComponentTree";
import type {
  DispatchListener,
  AnyNativeEvent,
  DispatchQueue,
} from "./DOMPluginEventSystem";
import { invokeGuardedCallbackAndCatchFirstError } from "shared/ReactErrorUtils";
import { ReactSyntheticEvent } from "./ReactSyntheticEventType";
import { Fiber } from "react-reconciler/src/ReactInternalTypes";

export function createEventListenerWrapperWithPriority(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: number
): Function {
  // 根据事件名称，获取优先级。比如click、input、drop等对应DiscreteEventPriority，drag、scroll等对应ContinuousEventPriority，
  // message也许处于Scheduler中，根据getCurrentSchedulerPriorityLevel()获取优先级。其它是DefaultEventPriority。
  const eventPriority = getEventPriority(domEventName);
  let listenerWrapper;
  switch (eventPriority) {
    case DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent;
      break;
    case ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent;
      break;
    case DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent;
      break;
  }
  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer
  );
}

// todo 不同的事件派发方法
function dispatchDiscreteEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  // ! 1. 记录上一次的事件优先级
  const previousPriority = getCurrentUpdatePriority();
  try {
    // !4. 设置当前事件优先级为DiscreteEventPriority
    setCurrentUpdatePriority(DiscreteEventPriority);
    // !5. 调用dispatchEvent，执行事件
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    // !6. 恢复
    setCurrentUpdatePriority(previousPriority);
  }
}

function dispatchContinuousEvent(
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  container: EventTarget,
  nativeEvent: AnyNativeEvent
) {
  const previousPriority = getCurrentUpdatePriority();
  try {
    setCurrentUpdatePriority(ContinuousEventPriority);
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
  } finally {
    setCurrentUpdatePriority(previousPriority);
  }
}

export function dispatchEvent(
  domEventName: DOMEventName,
  eventSystemFlags: number,
  targetContainer: EventTarget,
  nativeEvent: AnyNativeEvent
): void {
  const nativeEventTarget = nativeEvent.target;

  const return_targetInst = getClosestInstanceFromNode(nativeEventTarget);

  const dispatchQueue: DispatchQueue = [];

  // 给dispatchQueue添加事件
  extractEvents(
    dispatchQueue,
    domEventName,
    return_targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );

  processDispatchQueue(dispatchQueue, eventSystemFlags);
}

export function processDispatchQueue(
  dispatchQueue: DispatchQueue,
  eventSystemFlags: EventSystemFlags
): void {
  const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
  for (let i = 0; i < dispatchQueue.length; i++) {
    const { event, listeners } = dispatchQueue[i];
    processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
  }
}

function processDispatchQueueItemsInOrder(
  event: ReactSyntheticEvent,
  dispatchListeners: Array<DispatchListener>,
  inCapturePhase: boolean
): void {
  let prevInstance: Fiber | null = null;
  if (inCapturePhase) {
    // 捕获阶段，从上往下执行
    for (let i = dispatchListeners.length - 1; i >= 0; i--) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (prevInstance !== instance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      prevInstance = instance;
    }
  } else {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const { instance, currentTarget, listener } = dispatchListeners[i];
      if (prevInstance !== instance && event.isPropagationStopped()) {
        return;
      }
      executeDispatch(event, listener, currentTarget);
      prevInstance = instance;
    }
  }
}

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget
): void {
  const type = event.type || "unknown-event";
  // event.currentTarget = currentTarget;
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
  // event.currentTarget = null;
}

export function getEventPriority(domEventName: DOMEventName): EventPriority {
  switch (domEventName) {
    // Used by SimpleEventPlugin:
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    // Used by polyfills: (fall through)
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    // Only enableCreateEventHandleAPI: (fall through)
    case "beforeblur":
    case "afterblur":
    // Not used by React but could be by user code: (fall through)
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return DiscreteEventPriority;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    // Not used by React but could be by user code: (fall through)
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return ContinuousEventPriority;
    case "message": {
      // 我们可能在调度器回调中。
      // 最终，这种机制将被替换为检查本机调度器上的当前优先级。
      const schedulerPriority = Scheduler.getCurrentPriorityLevel();
      switch (schedulerPriority) {
        case ImmediatePriority:
          return DiscreteEventPriority;
        case UserBlockingPriority:
          return ContinuousEventPriority;
        case NormalPriority:
        case LowPriority:
          return DefaultEventPriority;
        case IdlePriority:
          return IdleEventPriority;
        default:
          return DefaultEventPriority;
      }
    }
    default:
      return DefaultEventPriority;
  }
}
