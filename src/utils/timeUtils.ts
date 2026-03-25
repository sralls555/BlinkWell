export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatMinutes(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

export function riskColor(level: string): string {
  switch (level) {
    case 'LOW': return '#22c55e';
    case 'MEDIUM': return '#f59e0b';
    case 'HIGH': return '#ef4444';
    case 'CRITICAL': return '#7c3aed';
    default: return '#6b7280';
  }
}

export function riskLabel(level: string): string {
  switch (level) {
    case 'LOW': return 'Healthy';
    case 'MEDIUM': return 'Moderate Risk';
    case 'HIGH': return 'High Risk';
    case 'CRITICAL': return 'Critical — Take a Break';
    default: return 'Unknown';
  }
}

export function blinkRateLabel(rate: number): string {
  if (rate >= 12) return 'Normal';
  if (rate >= 8) return 'Below Normal';
  if (rate >= 5) return 'Low';
  return 'Very Low';
}
