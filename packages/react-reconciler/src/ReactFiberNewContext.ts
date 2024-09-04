import { ReactContext } from "shared/ReactTypes";
import { StackCursor, createCursor, pop, push } from "./ReactFiberStack";

const valueCursor: StackCursor<any> = createCursor(null);

// 1. 记录下context、value到stack(push)
export function pushProvider<T>(context: ReactContext<T>, nextValue: T): void {
  push(valueCursor, context._currentValue);
  context._currentValue = nextValue;
}

// 2. 后代组件消费
export function readContext<T>(context: ReactContext<T>): T {
  return context._currentValue;
}

// 3. 消费完后出栈(pop),context._currentValue设置为上一个栈尾元素
export function popProvider<T>(context: ReactContext<T>): void {
  const currentValue = valueCursor.current;
  pop(valueCursor);
  context._currentValue = currentValue;
}
