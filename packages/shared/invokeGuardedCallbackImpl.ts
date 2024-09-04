export default function invokeGuardedCallbackImpl(
  this: { onError: (error: any) => void },
  name: string | null,
  func: (...Args) => any,
  context: any
): void {
  const funcArgs = Array.prototype.slice.call(arguments, 3);
  try {
    func.apply(context, funcArgs);
  } catch (error) {
    this.onError(error);
  }
}
