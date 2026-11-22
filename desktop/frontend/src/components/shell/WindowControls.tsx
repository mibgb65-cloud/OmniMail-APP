import { Window } from "@wailsio/runtime";
import { type MouseEvent, useEffect, useState } from "react";
import { useApp } from "../../state/AppContext";
import { Icon } from "../common/Icon";

const INTERACTIVE_SELECTOR =
  "button, input, textarea, select, a, label, .topbar-search-wrap, .theme-segmented, .win-controls";

export function handleDragRegionDoubleClick(e: MouseEvent<HTMLElement>) {
  const target = e.target as HTMLElement | null;
  if (target?.closest(INTERACTIVE_SELECTOR)) {
    return;
  }
  void Window.ToggleMaximise().catch(() => undefined);
}

export function WindowControls() {
  const { toastStore } = useApp();
  const [isMaximised, setIsMaximised] = useState(false);

  useEffect(() => {
    let active = true;
    const syncState = () => {
      void Window.IsMaximised()
        .then((val) => {
          if (active) setIsMaximised(val);
        })
        .catch(() => undefined);
    };
    syncState();
    window.addEventListener("resize", syncState);
    return () => {
      active = false;
      window.removeEventListener("resize", syncState);
    };
  }, []);

  const handleWindowAction = async (action: "min" | "max" | "close") => {
    try {
      if (action === "min") {
        await Window.Minimise();
      } else if (action === "max") {
        await Window.ToggleMaximise();
        setIsMaximised(await Window.IsMaximised());
      } else {
        await Window.Close();
      }
    } catch {
      toastStore.pushToast({
        tone: "info",
        title: "当前为网页预览模式，桌面窗口控制需在客户端内生效",
      });
    }
  };

  return (
    <div className="win-controls">
      <button
        type="button"
        className="icon-btn"
        onClick={() => void handleWindowAction("min")}
        title="最小化"
        aria-label="最小化"
      >
        <Icon name="minus" size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => void handleWindowAction("max")}
        title={isMaximised ? "向下还原" : "最大化"}
        aria-label={isMaximised ? "向下还原" : "最大化"}
      >
        <Icon name="square" size={12} />
      </button>
      <button
        type="button"
        className="icon-btn win-close-btn"
        onClick={() => void handleWindowAction("close")}
        title="关闭窗口"
        aria-label="关闭窗口"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
