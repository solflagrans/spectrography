import { z } from "zod";
import { compositionSettingsSchema } from "./composition-schema";
import type { CreateWorkingAnalysisInput, WorkingAnalysis } from "@/application/analysis/working-analysis";
import type { AnalysisSession } from "@/domain/session/model";
import { resolveCompositionSettings } from "@/domain/spectrum/composition-settings";
import { validateInteractiveAnalysisParameters } from "@/domain/spectrum/interactive-analysis";
import { loadOrCreateBrowserSession } from "./session-manager";
import { IndexedDbAnalysisSessionRepository } from "./indexed-db-session-repository";

const datasetSchema = z.object({ wavelengths: z.array(z.number().finite()), intensities: z.array(z.number().finite()) });
const sourceSchema = z.object({
  id: z.string(), title: z.string(), rawDataset: datasetSchema,
  channels: z.array(z.object({ id: z.string(), name: z.string(), dataset: datasetSchema }).passthrough()).optional(),
  auxiliaryData: z.object({ dark: z.array(z.number().finite()), reference: z.array(z.number().finite()) }).optional(),
  instrumentMetadata: z.object({ serialNumber: z.string(), integrationTimeMs: z.number().finite(), averages: z.number().finite(), channelCount: z.literal(1), startPixel: z.number().int(), stopPixel: z.number().int() }).optional(),
  spectrumType: z.enum(["plasma-emission", "unspecified"]).optional(),
  source: z.object({ kind: z.enum(["NASA PDS", "Пользовательский файл"]), fileName: z.string(), format: z.enum(["CSV", "JSON", "XLSX", "RAW8"]), units: z.enum(["нм / отн. ед.", "нм / отсчёты прибора"]) }),
}).passthrough();
type WorkspaceSession = AnalysisSession & { workspaceSource?: CreateWorkingAnalysisInput };
const repository = new IndexedDbAnalysisSessionRepository();
let saveQueue: Promise<unknown> = Promise.resolve();
export async function restoreWorkspace() {
  const session = await loadOrCreateBrowserSession(repository) as WorkspaceSession;
  if (!session.workspaceSource) return null;
  const source = sourceSchema.parse(session.workspaceSource) as CreateWorkingAnalysisInput;
  const parameters = { ...session.analysisOptions, composition: resolveCompositionSettings(session.analysisOptions.composition ? compositionSettingsSchema.parse(session.analysisOptions.composition) : undefined) };
  validateInteractiveAnalysisParameters(parameters);
  source.channels?.forEach((channel) => { if (channel.parameters) validateInteractiveAnalysisParameters(channel.parameters); });
  return { source, parameters };
}
export function persistWorkspace(source: CreateWorkingAnalysisInput, analysis: WorkingAnalysis): Promise<unknown> {
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    const session = await loadOrCreateBrowserSession(repository);
    const next: WorkspaceSession = { ...session, updatedAt: new Date().toISOString(), status: "analyzed", spectrumType: analysis.spectrumType, dataset: source.rawDataset, analysisOptions: analysis.parameters, analysisResult: analysis, spectralLibraryVersion: analysis.libraryVersion, workspaceSource: source };
    await repository.save(next);
  });
  return saveQueue;
}
