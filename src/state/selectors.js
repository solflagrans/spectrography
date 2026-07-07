export function selectFilteredPeaks(state, filters) {
  const query = filters.query.trim().toLowerCase();
  const min = Number(filters.min);
  const max = Number(filters.max);

  return state.peaks
    .filter((peak) => {
      const match = peak.match;
      if (filters.matchedOnly && !match) return false;
      if (filters.matchType === "matched" && !match) return false;
      if (filters.matchType === "unmatched" && match) return false;
      if (Number.isFinite(min) && filters.min !== "" && peak.wavelength < min) return false;
      if (Number.isFinite(max) && filters.max !== "" && peak.wavelength > max) return false;
      if (!query) return true;

      const haystack = [peak.wavelength, peak.intensity, match?.symbol, match?.name, match?.line]
        .filter((value) => value !== undefined && value !== null)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => comparePeaks(a, b, state.sort));
}

function comparePeaks(a, b, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const left = getPeakSortValue(a, sort.key);
  const right = getPeakSortValue(b, sort.key);
  if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
  return String(left).localeCompare(String(right), "ru") * direction;
}

function getPeakSortValue(peak, key) {
  if (key === "intensity") return peak.intensity;
  if (key === "element") return peak.match ? peak.match.symbol : "яяя";
  if (key === "delta") return peak.match ? peak.match.delta : Number.POSITIVE_INFINITY;
  return peak.wavelength;
}
