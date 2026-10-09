/**
 * Applies an action to several records, one request each.
 *
 * Deliberately not a single batch endpoint. Each record is authorised on its
 * own, scoped to its own tenant, and written to the audit trail as its own
 * entry — which is what somebody reading that trail later needs. A batch
 * endpoint would have to re-implement all three, and would record "deleted 12
 * things" where the useful record is twelve lines naming them.
 *
 * Requests run in sequence rather than at once. Twelve parallel deletes would
 * trip the write limiter, and the limiter is right: a burst of writes is
 * exactly what it is there to slow down.
 */

export interface BulkResult {
  succeeded: number;
  failed: number;
  /** The first failure's message, which is usually the only distinct one. */
  reason?: string;
}

export async function runBulk<T>(
  ids: T[],
  action: (id: T) => Promise<unknown>,
): Promise<BulkResult> {
  let succeeded = 0;
  let failed = 0;
  let reason: string | undefined;

  for (const id of ids) {
    try {
      await action(id);
      succeeded++;
    } catch (failure) {
      failed++;

      /*
       * Kept, not thrown. Stopping at the first failure would leave the
       * person with some records changed and no account of which — and the
       * usual cause is one record being refused while the rest are fine.
       */
      reason ??= failure instanceof Error ? failure.message : undefined;
    }
  }

  return { succeeded, failed, reason };
}

/** What to tell the person afterwards. */
export function describeBulk(result: BulkResult, verb: string): string {
  if (result.failed === 0) {
    return `تم ${verb} ${result.succeeded} عنصر.`;
  }

  if (result.succeeded === 0) {
    return result.reason ?? `تعذّر ${verb} أي عنصر.`;
  }

  // Both numbers, because "mostly worked" is the case somebody has to act on.
  return `تم ${verb} ${result.succeeded} عنصر، وتعذّر ${result.failed}.`;
}
