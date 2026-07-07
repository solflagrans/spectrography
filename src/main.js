import { presets } from "./data/presets.js";
import { state } from "./state/store.js";
import { bindEvents } from "./ui/events.js";
import { getElements } from "./ui/dom.js";
import { renderDatabaseEditor, syncDatabaseInput } from "./ui/renderDatabase.js";

const elements = getElements();
const app = bindEvents(elements, state);

syncDatabaseInput(elements, state);
renderDatabaseEditor(elements, state.database);
app.setDataset(presets.solar.wavelengths, presets.solar.intensities);
