import type { DOMEventName } from "./DOMEventNames";
import { allNativeEvents } from "./EventRegistry";
import * as SimpleEventPlugin from "./plugins/SimpleEventPlugin";
import * as ChangeEventPlugin from "./plugins/ChangeEventPlugin";
import type { EventSystemFlags } from "./EventSystemFlags";
import {
  IS_CAPTURE_PHASE,
  SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS,
} from "./EventSystemFlags";
import { createEventListenerWrapperWithPriority } from "./ReactDOMEventListener";
import {
  addEventBubbleListener,
  addEventCaptureListener,
} from "./EventListener";
import { Fiber } from "react-reconciler/src/ReactInternalTypes";
import { HostComponent } from "react-reconciler/src/ReactWorkTags";
import getListener from "./getListener";
import { ReactSyntheticEvent } from "./ReactSyntheticEventType";

export type AnyNativeEvent = Event | KeyboardEvent | MouseEvent | TouchEvent;

export type DispatchListener = {
  instance: null | Fiber;
  listener: Function;
  currentTarget: EventTarget;
};

type DispatchEntry = {
  event: ReactSyntheticEvent;
  listeners: Array<DispatchListener>;
};

export type DispatchQueue = Array<DispatchEntry>;

SimpleEventPlugin.registerEvents();
// EnterLeaveEventPlugin.registerEvents();
ChangeEventPlugin.registerEvents();
// SelectEventPlugin.registerEvents();
// BeforeInputEventPlugin.registerEvents();

export function extractEvents(
  dispatchQueue: DispatchQueue,
  domEventName: DOMEventName,
  targetInst: null | Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: null | EventTarget,
  eventSystemFlags: EventSystemFlags,
  targetContainer: EventTarget
) {
  SimpleEventPlugin.extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
  );

  if ((eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0) {
    ChangeEventPlugin.extractEvents(
      dispatchQueue,
      domEventName,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer
    );
  }
}

export const mediaEventTypes: Array<DOMEventName> = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "encrypted",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "resize",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting",
];

// 我们不应该将这些事件委托给容器，而是应该直接在实际的目标元素上设置它们。这主要是因为这些事件在DOM中的冒泡行为并不一致。
export const nonDelegatedEvents: Set<DOMEventName> = new Set([
  "cancel",
  "close",
  "invalid",
  "load",
  "scroll",
  "scrollend",
  "toggle",
  // In order to reduce bytes, we insert the above array of media events
  // into this Set. Note: the "error" event isn't an exclusive media event,
  // and can occur on other elements too. Rather than duplicate that event,
  // we just take it from the media events array.
  // 为了减少字节数，我们将上述媒体事件数组插入到这个 Set 中。
  // 注意："error" 事件并不是一个独占的媒体事件，也可能发生在其他元素上。我们不会重复这个事件，而是直接从媒体事件数组中取出。
  ...mediaEventTypes,
]);

// todo 事件绑定
const listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
export function listenToAllSupportedEvents(rootContainerElement: EventTarget) {
  // 防止重复绑定
  if (!(rootContainerElement as any)[listeningMarker]) {
    (rootContainerElement as any)[listeningMarker] = true;
    // 事件绑定
    allNativeEvents.forEach((domEventName) => {
      // 特殊处理 selectionchange
      if (domEventName !== "selectionchange") {
        // 捕获、冒泡
        // 有些事件在DOM上冒泡行为不一致，这些事件就不做事件委托
        if (!nonDelegatedEvents.has(domEventName)) {
          listenToNativeEvent(domEventName, false, rootContainerElement);
        }
        listenToNativeEvent(domEventName, true, rootContainerElement);
      }
    });
  }
}

export function listenToNativeEvent(
  domEventName: DOMEventName,
  isCapturePhaseListener: boolean,
  target: EventTarget
): void {
  let eventSystemFlags = 0;
  if (isCapturePhaseListener) {
    eventSystemFlags |= IS_CAPTURE_PHASE;
  }
  addTrappedEventListener(
    target,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
  );
}

function addTrappedEventListener(
  targetContainer: EventTarget,
  domEventName: DOMEventName,
  eventSystemFlags: EventSystemFlags,
  isCapturePhaseListener: boolean
) {
  // ! 1. 获取对应事件，事件定义在ReactDOMEventListener.js中
  // 如DiscreteEventPriority对应dispatchDiscreteEvent，ContinuousEventPriority对应dispatchContinuousEvent
  let listener = createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
  );

  let isPassiveListener: boolean = false;
  // sy
  // Browsers introduced an intervention, making these events
  // passive by default on document. React doesn't bind them
  // to document anymore, but changing this now would undo
  // the performance wins from the change. So we emulate
  // the existing behavior manually on the roots now.
  // 浏览器引入了一种干预措施，使这些事件在document上默认为passive状态。
  // React不再将它们绑定到document上，但是现在改变这一点将会撤销之前的性能优势。
  // 因此，我们现在在根节点上手动模拟现有的行为。
  // https://github.com/facebook/react/issues/19651
  if (
    domEventName === "touchstart" ||
    domEventName === "touchmove" ||
    domEventName === "wheel"
  ) {
    isPassiveListener = true;
  }

  // ! 2. 绑定事件
  if (isCapturePhaseListener) {
    // * 捕获阶段
    addEventCaptureListener(
      targetContainer,
      domEventName,
      listener,
      isPassiveListener
    );
  } else {
    addEventBubbleListener(
      targetContainer,
      domEventName,
      listener,
      isPassiveListener
    );
  }
}

export function accumulateSinglePhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null,
  nativeEventType: string,
  inCapturePhase: boolean,
  accumulateTargetOnly: boolean,
  nativeEvent: AnyNativeEvent
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + "Capture" : null;
  const reactEventName = inCapturePhase ? captureName : reactName;
  let listeners: Array<DispatchListener> = [];

  let instance = targetFiber;

  // 通过target -> root累积所有fiber和listeners。
  while (instance !== null) {
    const { stateNode, tag } = instance;
    // 处理位于HostComponents（即 <div> 元素）上的listeners
    if (tag === HostComponent && stateNode !== null) {
      // 标准 React on* listeners, i.e. onClick or onClickCapture
      const listener = getListener(instance, reactEventName as string);
      if (listener != null) {
        listeners.push({
          instance,
          listener,
          currentTarget: stateNode,
        });
      }
    }
    // 如果只是为target累积事件，那么我们就不会继续通过 React Fiber 树传播以查找其它listeners。
    if (accumulateTargetOnly) {
      break;
    }

    instance = instance.return;
  }
  return listeners;
}

// 支持冒泡、捕获
export function accumulateTwoPhaseListeners(
  targetFiber: Fiber | null,
  reactName: string | null
): Array<DispatchListener> {
  const captureName = reactName !== null ? reactName + "Capture" : null;
  let listeners: Array<DispatchListener> = [];

  let instance = targetFiber;

  while (instance !== null) {
    const { stateNode, tag } = instance;
    if (tag === HostComponent && stateNode !== null) {
      const captureListener = getListener(instance, captureName as string);
      if (captureListener != null) {
        // 捕获阶段
        listeners.unshift({
          instance,
          listener: captureListener,
          currentTarget: stateNode,
        });
      }
      // 冒泡
      const bubbleListener = getListener(instance, reactName as string);
      if (bubbleListener != null) {
        // 捕获阶段，捕获阶段执行是从外到内，冒泡阶段是从内到外
        listeners.unshift({
          instance,
          listener: bubbleListener,
          currentTarget: stateNode,
        });
      }
    }
    instance = instance.return;
  }

  return listeners;
}
