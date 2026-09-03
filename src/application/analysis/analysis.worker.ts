/// <reference lib="webworker" />

import { createWorkingAnalysis } from "./create-working-analysis";
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from "./analysis-runner";

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const { requestId, source, parameters } = event.data;
  let response: AnalysisWorkerResponse;
  try {
    response = {
      requestId,
      status: "success",
      analysis: createWorkingAnalysis(source, parameters),
    };
  } catch (error) {
    response = {
      requestId,
      status: "failure",
      message: error instanceof Error
        ? error.message
        : "Не удалось выполнить анализ спектра.",
    };
  }
  workerScope.postMessage(response);
};

export {};
