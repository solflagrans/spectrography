import type { ReactNode } from "react";

import { AnalysisWorkspaceProvider } from "@/features/demo-analysis/model/analysis-workspace-context";
import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AnalysisWorkspaceProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </AnalysisWorkspaceProvider>
  );
}
