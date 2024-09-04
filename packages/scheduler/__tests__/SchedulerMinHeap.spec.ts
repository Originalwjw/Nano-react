import { describe, expect, it } from "vitest";
import { peek, push, pop, Heap, Node } from "../src/SchedulerMinHeap";

let idCounter = 0;
function createNode(val: number): Node {
  return { id: idCounter, sortIndex: val };
}

describe("test min heap", () => {
  it("empty heap return null", () => {
    const tasks: Heap<Node> = [];
    expect(peek(tasks)).toBe(null);
  });

  it("heap length === 1", () => {
    const tasks: Heap<Node> = [createNode(1)];
    expect(peek(tasks)?.sortIndex).toEqual(1);
  });

  it("heap length > 1", () => {
    const tasks: Heap<Node> = [createNode(1)];
    push(tasks, createNode(2));
    push(tasks, createNode(3));
    expect(peek(tasks)?.sortIndex).toEqual(1);
    push(tasks, createNode(0));
    expect(peek(tasks)?.sortIndex).toEqual(0);
    pop(tasks);
    expect(peek(tasks)?.sortIndex).toEqual(1);
  });
});
