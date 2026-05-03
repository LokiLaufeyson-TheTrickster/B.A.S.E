export function extractJSON(text: string): any {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function normalizeBatchResponse(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  
  // Look for common wrapper keys: 'result', 'results', 'items', 'analysis'
  const keys = ['result', 'results', 'items', 'analysis'];
  for (const key of keys) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  
  // If no obvious array, return the object itself as a single-item list
  return [parsed];
}
