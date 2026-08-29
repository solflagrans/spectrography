import type { ReactNode } from "react";

<<<<<<< Updated upstream
import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
=======
import { DemoAnalysisProvider } from "@/features/demo-analysis/model/demo-analysis-context";
import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DemoAnalysisProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </DemoAnalysisProvider>
  );
>>>>>>> Stashed changes
}
