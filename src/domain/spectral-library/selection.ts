import type { SpectralLineElement } from "./types";

export const NIST_ASD_VERSION = "5.12";
export const NIST_ASD_DOI = "10.18434/T4W30F";
export const NIST_ASD_SHORT_LABEL = `NIST ASD ${NIST_ASD_VERSION}`;
export const NIST_ASD_ATTRIBUTION = "Kramida, A., Ralchenko, Yu., Reader, J., and NIST ASD Team (2024). NIST Atomic Spectra Database (ver. 5.12), [Online]. National Institute of Standards and Technology, Gaithersburg, MD. Available: https://physics.nist.gov/asd. DOI: 10.18434/T4W30F.";

export const NIST_ASD_SELECTED_ELEMENTS = [
  { atomicNumber: 1, symbol: "H", name: "Водород" },
  { atomicNumber: 2, symbol: "He", name: "Гелий" },
  { atomicNumber: 6, symbol: "C", name: "Углерод" },
  { atomicNumber: 7, symbol: "N", name: "Азот" },
  { atomicNumber: 8, symbol: "O", name: "Кислород" },
  { atomicNumber: 10, symbol: "Ne", name: "Неон" },
  { atomicNumber: 11, symbol: "Na", name: "Натрий" },
  { atomicNumber: 12, symbol: "Mg", name: "Магний" },
  { atomicNumber: 13, symbol: "Al", name: "Алюминий" },
  { atomicNumber: 14, symbol: "Si", name: "Кремний" },
  { atomicNumber: 16, symbol: "S", name: "Сера" },
  { atomicNumber: 18, symbol: "Ar", name: "Аргон" },
  { atomicNumber: 20, symbol: "Ca", name: "Кальций" },
  { atomicNumber: 22, symbol: "Ti", name: "Титан" },
  { atomicNumber: 24, symbol: "Cr", name: "Хром" },
  { atomicNumber: 25, symbol: "Mn", name: "Марганец" },
  { atomicNumber: 26, symbol: "Fe", name: "Железо" },
  { atomicNumber: 28, symbol: "Ni", name: "Никель" },
  { atomicNumber: 29, symbol: "Cu", name: "Медь" },
  { atomicNumber: 30, symbol: "Zn", name: "Цинк" },
  { atomicNumber: 80, symbol: "Hg", name: "Ртуть" },
] as const satisfies readonly SpectralLineElement[];
