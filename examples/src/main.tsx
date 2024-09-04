import {
  ReactDOM,
  Fragment,
  Component,
  useReducer,
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
  useEffect,
  createContext,
  useContext,
  useDeferredValue,
} from "../which-react";
import MySlowList from "./MySlowList";
import "./index.css";

function FunctionComponent() {
  const [count, setCount] = useReducer((x) => x + 1, 0);
  const [text, setText] = useState("hello");

  const deferredText = useDeferredValue(text);

  return (
    <div className="border">
      <h1>函数组件</h1>
      <button
        onClick={(e) => {
          setCount();
        }}
      >
        {count}
      </button>

      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <p>{text}</p>

      {/* 非紧急更新 */}
      <b>{deferredText}</b>
      <MySlowList text={deferredText} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  (<FunctionComponent />) as any
);

// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//   "omg"
// );

// div.root 对应的是根fiber，Fiber, tag = HostRoot=3

// 原生标签Fiber, tag = HostComponent=5

// Host
// 1. HostRoot
// 2. HostComponent
// 3. HostText // 不能有子节点

// 函数组件
// 类组件
