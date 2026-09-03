import type { InteractiveAnalysisParameters } from "@/domain/spectrum";

import type { CreateWorkingAnalysisInput, WorkingAnalysis } from "./working-analysis";

export interface AnalysisRunner {
  run(
    source: CreateWorkingAnalysisInput,
    parameters: InteractiveAnalysisParameters,
  ): Promise<WorkingAnalysis>;
  cancel(): void;
  dispose(): void;
}

interface AnalysisWorkerRequest {
  readonly requestId: number;
  readonly source: CreateWorkingAnalysisInput;
  readonly parameters: InteractiveAnalysisParameters;
}

interface AnalysisWorkerSuccess {
  readonly requestId: number;
  readonly status: "success";
  readonly analysis: WorkingAnalysis;
}

interface AnalysisWorkerFailure {
  readonly requestId: number;
  readonly status: "failure";
  readonly message: string;
}

export type AnalysisWorkerResponse = AnalysisWorkerSuccess | AnalysisWorkerFailure;
export type { AnalysisWorkerRequest };

export function createBrowserAnalysisRunner(): AnalysisRunner {
  if (typeof Worker === "undefined") return createFallbackAnalysisRunner();

  let worker: Worker | null = null;
  let sequence = 0;
  let pending: {
    readonly requestId: number;
    readonly resolve: (analysis: WorkingAnalysis) => void;
    readonly reject: (error: Error) => void;
  } | null = null;

  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    const failWorker = (message: string) => {
      pending?.reject(new Error(message));
      pending = null;
      worker?.terminate();
      worker = null;
    };
    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      if (!pending || event.data.requestId !== pending.requestId) return;
      const current = pending;
      pending = null;
      if (event.data.status === "success") current.resolve(event.data.analysis);
      else current.reject(new Error(event.data.message));
    };
    worker.onerror = () => failWorker("Не удалось выполнить анализ в фоновом потоке.");
    worker.onmessageerror = () => failWorker("Фоновый анализ вернул данные в неподдерживаемом формате.");
    return worker;
  };

  const cancel = () => {
    if (!pending) return;
    pending.reject(new DOMException("Расчёт отменён.", "AbortError"));
    pending = null;
    worker?.terminate();
    worker = null;
  };

  return {
    run(source, parameters) {
      cancel();
      const requestId = sequence + 1;
      sequence = requestId;
      return new Promise<WorkingAnalysis>((resolve, reject) => {
        pending = { requestId, resolve, reject };
        ensureWorker().postMessage({ requestId, source, parameters } satisfies AnalysisWorkerRequest);
      });
    },
    cancel,
    dispose() {
      cancel();
      worker?.terminate();
      worker = null;
    },
  };
}

function createFallbackAnalysisRunner(): AnalysisRunner {
  let sequence = 0;
  return {
    async run(source, parameters) {
      const requestId = sequence + 1;
      sequence = requestId;
      const { createWorkingAnalysis } = await import("./create-working-analysis");
      if (requestId !== sequence) throw new DOMException("Расчёт отменён.", "AbortError");
      return createWorkingAnalysis(source, parameters);
    },
    cancel() {
      sequence += 1;
    },
    dispose() {
      sequence += 1;
    },
  };
}
