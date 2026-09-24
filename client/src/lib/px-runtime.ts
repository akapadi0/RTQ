import { isPublicDemo, isShellHosted, type ShellRuntimeContext } from "@/plannerxchange";

export type PxRuntimeMode = "public_demo" | "shell_hosted" | "local_dev";

// Runtime mode is resolved once at mount from the live PlannerXchange
// ShellRuntimeContext. Detection is purely runtime — isPublicDemo/isShellHosted
// read the injected context, never a build-time env var or publicationEnvironment
// — so the same committed artifact behaves correctly whether it is served as a
// public demo, hosted in the authenticated shell, or run standalone in local dev.
// Per the PlannerXchange contract, check public demo before shell-hosted.
let _mode: PxRuntimeMode = "local_dev";

export function initPxRuntime(ctx: ShellRuntimeContext | undefined): void {
  if (ctx && isPublicDemo(ctx)) {
    _mode = "public_demo";
  } else if (ctx && isShellHosted(ctx)) {
    _mode = "shell_hosted";
  } else {
    _mode = "local_dev";
  }
}

export function getPxRuntimeMode(): PxRuntimeMode {
  return _mode;
}

export function isDemoMode(): boolean {
  return _mode === "public_demo";
}
