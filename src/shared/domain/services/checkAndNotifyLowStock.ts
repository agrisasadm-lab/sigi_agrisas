const DEBOUNCE_MS = 24 * 60 * 60 * 1000;

export function shouldNotifyLowStock(
  newQuantity: number,
  reorderPoint: number,
  lastLowStockNotifiedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (newQuantity >= reorderPoint) return false;
  if (lastLowStockNotifiedAt === null) return true;
  return now.getTime() - lastLowStockNotifiedAt.getTime() >= DEBOUNCE_MS;
}

