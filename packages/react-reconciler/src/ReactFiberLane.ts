import { FiberRoot } from "./ReactInternalTypes";

export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

export const TotalLanes = 31;

// lane都是数字，可以表示优先级。lane值越小，优先级越高。
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncHydrationLane: Lane = /*               */ 0b0000000000000000000000000000001;
export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000010;
export const SyncLaneIndex: number = 1;

export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000100;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000001000;

export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000010000;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000100000;

export const SyncUpdateLanes: Lane =
  SyncLane | InputContinuousLane | DefaultLane;

const TransitionHydrationLane: Lane = /*                */ 0b0000000000000000000000001000000;
const TransitionLanes: Lanes = /*                       */ 0b0000000001111111111111110000000;
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000010000000;
const TransitionLane2: Lane = /*                        */ 0b0000000000000000000000100000000;
const TransitionLane3: Lane = /*                        */ 0b0000000000000000000001000000000;
const TransitionLane4: Lane = /*                        */ 0b0000000000000000000010000000000;
const TransitionLane5: Lane = /*                        */ 0b0000000000000000000100000000000;
const TransitionLane6: Lane = /*                        */ 0b0000000000000000001000000000000;
const TransitionLane7: Lane = /*                        */ 0b0000000000000000010000000000000;
const TransitionLane8: Lane = /*                        */ 0b0000000000000000100000000000000;
const TransitionLane9: Lane = /*                        */ 0b0000000000000001000000000000000;
const TransitionLane10: Lane = /*                       */ 0b0000000000000010000000000000000;
const TransitionLane11: Lane = /*                       */ 0b0000000000000100000000000000000;
const TransitionLane12: Lane = /*                       */ 0b0000000000001000000000000000000;
const TransitionLane13: Lane = /*                       */ 0b0000000000010000000000000000000;
const TransitionLane14: Lane = /*                       */ 0b0000000000100000000000000000000;
const TransitionLane15: Lane = /*                       */ 0b0000000001000000000000000000000;

const RetryLanes: Lanes = /*                            */ 0b0000011110000000000000000000000;
const RetryLane1: Lane = /*                             */ 0b0000000010000000000000000000000;
const RetryLane2: Lane = /*                             */ 0b0000000100000000000000000000000;
const RetryLane3: Lane = /*                             */ 0b0000001000000000000000000000000;
const RetryLane4: Lane = /*                             */ 0b0000010000000000000000000000000;

export const SomeRetryLane: Lane = RetryLane1;

export const SelectiveHydrationLane: Lane = /*          */ 0b0000100000000000000000000000000;

const NonIdleLanes: Lanes = /*                          */ 0b0000111111111111111111111111111;

export const IdleHydrationLane: Lane = /*               */ 0b0001000000000000000000000000000;
export const IdleLane: Lane = /*                        */ 0b0010000000000000000000000000000;

export const OffscreenLane: Lane = /*                   */ 0b0100000000000000000000000000000;
export const DeferredLane: Lane = /*                    */ 0b1000000000000000000000000000000;

// Any lane that might schedule an update. This is used to detect infinite
// update loops, so it doesn't include hydration lanes or retries.
export const UpdateLanes: Lanes =
  SyncLane | InputContinuousLane | DefaultLane | TransitionLanes;

let nextTransitionLane: Lane = TransitionLane1;

// 是否是transitionLanes
export function isTransitionLane(lane: Lane): boolean {
  return (lane & TransitionLanes) !== NoLanes;
}

export function includesNonIdleWork(lanes: Lanes): boolean {
  return (lanes & NonIdleLanes) !== NoLanes;
}

// 获取优先级最高的lane
// 因为在 lane 的值中，值越小，代表的优先级越高。即
// 获取最低位的1，如4194240&-4194240就是64
// 负数原码转换为补码的方法：符号位保持1不变，数值位按位求反，末位加1
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}
// 是否包含某个lane或者某些lane(lanes)
export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
  return (a & b) !== NoLanes;
}

// 合并两个lane或者lanes
export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}
// 移除某个lane或者lanes，比如执行完节点的 Update 操作之后，则需要移动 fiber.flags 的 Update
export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
}

// 与 includesSomeLane 不同，includesSomeLane返回的是是否有交叉，即结果是boolean
// intersectLanes 返回交叉的lanes
export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b;
}

// 返回优先级较高的lane。如果 a < b, 则说明a的优先级高于b，因为lane越小，优先级越高。
export function higherPriorityLane(a: Lane, b: Lane): Lane {
  return a !== NoLane && a < b ? a : b;
}

export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }

  let nextLanes = getHighestPriorityLanes(pendingLanes);

  if (nextLanes === NoLanes) {
    return NoLanes;
  }
  // 如果我们已经在render阶段中，切换lanes会中断当前渲染进程，导致丢失进度。
  // 只有当新lanes的优先级更高时，我们才应该这样做。
  if (wipLanes !== NoLanes && wipLanes !== nextLanes) {
    const nextLane = getHighestPriorityLane(nextLanes);
    const wipLane = getHighestPriorityLane(wipLanes);
    if (
      nextLane >= wipLane ||
      // Default priority updates不应中断transition。default updates和transition updates之间唯一的区别在于前者不支持刷新过渡。
      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      // 继续完成正在进行中的树。不中断。
      return wipLanes;
    }
  }

  return nextLanes;
}

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
  const pendingSyncLanes = lanes & SyncUpdateLanes;
  if (pendingSyncLanes !== 0) {
    // ? sy
    // 将DefaultLane、SyncLane和ContinuousLane统一为SyncLane，并在根上使用一个单独的字段来跟踪它们应该使用queueMicrotask、requestAnimationFrame还是完全同步（在flushSync的情况下）进行调度。
    // https://github.com/facebook/react/pull/25524
    return pendingSyncLanes;
  }
  switch (getHighestPriorityLane(lanes)) {
    case SyncHydrationLane:
      return SyncHydrationLane;
    case SyncLane:
      return SyncLane;
    case InputContinuousHydrationLane:
      return InputContinuousHydrationLane;
    case InputContinuousLane:
      return InputContinuousLane;
    case DefaultHydrationLane:
      return DefaultHydrationLane;
    case DefaultLane:
      return DefaultLane;
    case TransitionHydrationLane:
      return TransitionHydrationLane;
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
      return lanes & TransitionLanes;
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
      return lanes & RetryLanes;
    case SelectiveHydrationLane:
      return SelectiveHydrationLane;
    case IdleHydrationLane:
      return IdleHydrationLane;
    case IdleLane:
      return IdleLane;
    case OffscreenLane:
      return OffscreenLane;
    case DeferredLane:
      // This shouldn't be reachable because deferred work is always entangled
      // with something else.
      return NoLanes;
    default:
      // This shouldn't be reachable, but as a fallback, return the entire bitmask.
      return lanes;
  }
}

// 是否：只包括非紧急的lanes
export function includesOnlyNonUrgentLanes(lanes: Lanes): boolean {
  // TODO: Should hydration lanes be included here? This function is only
  // used in `updateDeferredValueImpl`.
  const UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;
  return (lanes & UrgentLanes) === NoLanes;
}
export function includesOnlyTransitions(lanes: Lanes): boolean {
  return (lanes & TransitionLanes) === lanes;
}

export function claimNextTransitionLane(): Lane {
  // 循环遍历lanes，将每个新的transition分配到下一个lane。
  // 在大多数情况下，这意味着每个transition都有自己的lane，直到我们用完所有lanes并循环回到开头。
  const lane = nextTransitionLane;
  nextTransitionLane <<= 1;
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }
  return lane;
}
