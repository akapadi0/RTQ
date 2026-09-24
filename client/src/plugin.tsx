import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import "./index.css";
// @ts-ignore – JSON import; Vite handles this natively
import manifestJson from "../../plannerxchange.app.json";
import { configurePlannerXchange, isPublicDemo, type ShellRuntimeContext } from "./plannerxchange";
import { configurePlannerXchangeEmail } from "./lib/px-email";

export const manifest = manifestJson;

let _root: Root | null = null;

// Both the real PlannerXchange shell and the standalone dev preview
// (main.tsx, via dev-context.ts) mount with a full ShellRuntimeContext — the
// only difference is whether it has a working `authenticatedFetch`, which is
// what isShellHosted()/isPublicDemo() actually branch on downstream.
export function mount(context: ShellRuntimeContext) {
  const container = document.getElementById("root");
  if (!container) throw new Error("No mount target: add #root to the document.");

  configurePlannerXchange(context);
  configurePlannerXchangeEmail(context);
  if (isPublicDemo(context)) {
    console.info("[PlannerXchange] public_demo runtime: no identity intake or protected data access.");
  }

  if (!_root) {
    _root = createRoot(container);
  }
  _root.render(<App appBasename={context.appBasename} />);
  return () => {
    _root?.unmount();
    _root = null;
  };
}

export const pluginModule = { mount, manifest };
