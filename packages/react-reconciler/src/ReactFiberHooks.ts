import { isFn } from "shared/utils";
import {
  requestDeferredLane,
  scheduleUpdateOnFiber,
} from "./ReactFiberWorkLoop";
import type { Fiber, FiberRoot } from "./ReactInternalTypes";
import { HostRoot } from "./ReactWorkTags";
import { Flags, Passive, Update } from "./ReactFiberFlags";
import { HookFlags, HookLayout, HookPassive } from "./ReactHookEffectTags";
import { readContext } from "./ReactFiberNewContext";
import { ReactContext } from "shared/ReactTypes";
import {
  Lanes,
  NoLanes,
  includesOnlyNonUrgentLanes,
  mergeLanes,
} from "./ReactFiberLane";

type Hook = {
  memoizedState: any;
  next: null | Hook;
};

type Effect = {
  tag: HookFlags;
  create: () => (() => void) | void;
  deps: Array<any> | void | null;
  next: null | Effect;
};

// These are set right before calling the component.
let renderLanes: Lanes = NoLanes;
// 当前正在工作的函数组件的fiber
let currentlyRenderingFiber: Fiber | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

export function renderWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  props: Props,
  nextRenderLanes: Lanes
): any {
  renderLanes = nextRenderLanes;

  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;

  let children = Component(props);

  finishRenderingHooks();

  return children;
}

function finishRenderingHooks() {
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;
}

// 1. 返回当前useX函数对应的hook
// 2. 构建hook链表
function updateWorkInProgressHook(): Hook {
  let hook: Hook;
  const current = currentlyRenderingFiber?.alternate;
  if (current) {
    // update阶段
    currentlyRenderingFiber!.memoizedState = current.memoizedState;

    if (workInProgressHook != null) {
      workInProgressHook = hook = workInProgressHook.next!;
      currentHook = currentHook?.next as Hook;
    } else {
      // hook单链表的头结点
      hook = workInProgressHook = currentlyRenderingFiber?.memoizedState;
      currentHook = current.memoizedState;
    }
  } else {
    // mount阶段
    currentHook = null;
    hook = {
      memoizedState: null,
      next: null,
    };

    if (workInProgressHook) {
      workInProgressHook = workInProgressHook.next = hook;
    } else {
      // hook单链表的头结点
      workInProgressHook = currentlyRenderingFiber!.memoizedState = hook;
    }
  }

  return hook;
}

export function useReducer<S, I, A>(
  reducer: ((state: S, action: A) => S) | null,
  initialArg: I,
  init?: (initialArg: I) => S
) {
  // ! 1.  构建hook链表(mount、update)
  const hook: Hook = updateWorkInProgressHook(); //{ memoizedState: null, next: null };

  let initialState: S;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = initialArg as any;
  }

  // ! 2. 区分函数组件是初次挂载还是更新
  if (!currentlyRenderingFiber?.alternate) {
    // mount
    hook.memoizedState = initialState;
  }

  // ! 3. dispatch
  const dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber!,
    hook,
    reducer as any
  );

  return [hook.memoizedState, dispatch];
}

function dispatchReducerAction<S, I, A>(
  fiber: Fiber,
  hook: Hook,
  reducer: ((state: S, action: A) => S) | null,
  action: any
) {
  hook.memoizedState = reducer ? reducer(hook.memoizedState, action) : action;

  const root = getRootForUpdatedFiber(fiber);

  fiber.alternate = { ...fiber };
  if (fiber.sibling) {
    fiber.sibling.alternate = fiber.sibling;
  }

  scheduleUpdateOnFiber(root, fiber, true);
}

// 根据 sourceFiber 找根节点
function getRootForUpdatedFiber(sourceFiber: Fiber): FiberRoot {
  let node = sourceFiber;
  let parent = node.return;

  while (parent !== null) {
    node = parent;
    parent = node.return;
  }

  return node.tag === HostRoot ? node.stateNode : null;
}

// 源码中useState与useReducer对比
// useState,如果state没有改变，不引起组件更新。useReducer不是如此。
// reducer 代表state修改规则，useReducer比较方便服用这个规则
export function useState<S>(initialState: (() => S) | S) {
  const init = isFn(initialState) ? (initialState as any)() : initialState;
  return useReducer(null, init);
}

export function useMemo<T>(
  nextCreate: () => T,
  deps: Array<any> | void | null
): T {
  const hook = updateWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;

  const prevState = hook.memoizedState;
  // 检查依赖项是否发生变化
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖项没有变化，返回上一次计算的结果，就是缓存的值
        return prevState[0];
      }
    }
  }

  const nextValue = nextCreate();

  hook.memoizedState = [nextValue, nextDeps];

  return nextValue;
}

// 检查hook依赖是否变化
export function areHookInputsEqual(
  nextDeps: Array<any>,
  prevDeps: Array<any> | null
): boolean {
  if (prevDeps === null) {
    return false;
  }

  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

export function useCallback<T>(callback: T, deps: Array<any> | void | null): T {
  const hook = updateWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;

  const prevState = hook.memoizedState;
  // 检查依赖项是否发生变化
  if (prevState !== null) {
    if (nextDeps !== null) {
      const prevDeps = prevState[1];
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖项没有变化，返回上一次缓存的callback
        return prevState[0];
      }
    }
  }

  hook.memoizedState = [callback, nextDeps];

  return callback;
}

export function useRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  if (currentHook === null) {
    hook.memoizedState = { current: initialValue };
  }
  return hook.memoizedState;
}

// useEffect与useLayoutEffect的区别
// sy 存储结构一样
// sy effect和destroy函数的执行时机不同
export function useLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
) {
  return updateEffectImpl(Update, HookLayout, create, deps);
}

export function useEffect(
  create: () => (() => void) | void,
  deps: Array<any> | void | null
) {
  return updateEffectImpl(Passive, HookPassive, create, deps);
}

// 存储 effect
function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
) {
  const hook = updateWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;
  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevDeps = currentHook.memoizedState.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        return;
      }
    }
  }

  currentlyRenderingFiber!.flags |= fiberFlags;
  // * 1. 保存effect 2. 构建effect链表
  hook.memoizedState = pushEffect(hookFlags, create, nextDeps);
}

function pushEffect(
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<any> | void | null
) {
  const effect: Effect = {
    tag: hookFlags,
    create,
    deps,
    next: null,
  };

  let componentUpdateQueue = currentlyRenderingFiber!.updateQueue;
  // 单向循环链表
  if (componentUpdateQueue === null) {
    // 第一个effect
    componentUpdateQueue = {
      lastEffect: null,
    };
    currentlyRenderingFiber!.updateQueue = componentUpdateQueue;
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const lastEffect = componentUpdateQueue.lastEffect;
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    componentUpdateQueue.lastEffect = effect;
  }

  return effect;
}

export function useContext<T>(context: ReactContext<T>): T {
  return readContext(context);
}

export function useDeferredValue<T>(value: T): T {
  const hook = updateWorkInProgressHook();

  const prevValue: T = hook.memoizedState;

  if (currentHook !== null) {
    // 更新阶段
    if (Object.is(value, prevValue)) {
      // 传入的值与当前渲染的值是相同的，因此我们可以快速bail out
      return value;
    } else {
      // 收到一个与当前数值不同的新值
      const shouldDeferValue = !includesOnlyNonUrgentLanes(renderLanes);
      if (shouldDeferValue) {
        // sy-input
        // 这是一个紧急更新。由于数值已更改，可以继续使用先前的数值，并生成一个延迟渲染以稍后更新它。
        // 调度一个延迟渲染。
        const deferredLane = requestDeferredLane();
        currentlyRenderingFiber!.lanes = mergeLanes(
          currentlyRenderingFiber!.lanes, // 0
          deferredLane // 128
        );

        markSkippedUpdateLanes(deferredLane);
        // 复用先前的数值。我们不需要将其标记一个update，因为我们没有渲染新值。
        return prevValue;
      } else {
        // 非紧急更新
        // 这不是一个紧急更新，所以我们可以使用最新的数值，而不必拖延。
        // 将其标记为一个update，以防止fiber bailout
        hook.memoizedState = value;

        return value;
      }
    }
  }
  hook.memoizedState = value;

  return value;
}
