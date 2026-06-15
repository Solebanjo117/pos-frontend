import { onUnmounted, ref, type Ref } from 'vue';

export interface UseImportPollingOptions {
    activeImportRunId: Ref<number | null>;
    refreshImportRun: () => Promise<void>;
    onPollingError: (message: string) => void;
    onPollingStopped?: () => void;
    intervalMs?: number;
}

const DEFAULT_POLLING_DELAYS_MS = [1500, 3000, 5000, 10000, 15000] as const;

export function useImportPolling({
    activeImportRunId,
    refreshImportRun,
    onPollingError,
    onPollingStopped,
    intervalMs = 1500,
}: UseImportPollingOptions) {
    const pendingPollCount = ref(0);
    const pollingDelaysMs =
        intervalMs === DEFAULT_POLLING_DELAYS_MS[0]
            ? DEFAULT_POLLING_DELAYS_MS
            : ([
                  intervalMs,
                  intervalMs,
                  intervalMs,
                  intervalMs,
                  intervalMs,
              ] as const);

    let importStatusTimer: ReturnType<typeof setTimeout> | null = null;
    let importStatusRefreshInFlight = false;
    let consecutivePollCount = 0;

    const stopImportStatusPolling = (): void => {
        if (importStatusTimer) {
            clearTimeout(importStatusTimer);
            importStatusTimer = null;
        }
        onPollingStopped?.();
    };

    const nextPollingDelayMs = (): number => {
        const delayIndex = Math.min(
            consecutivePollCount,
            pollingDelaysMs.length - 1,
        );
        consecutivePollCount += 1;

        return pollingDelaysMs[delayIndex];
    };

    const scheduleNextImportStatusRefresh = (): void => {
        if (!activeImportRunId.value) {
            return;
        }

        importStatusTimer = setTimeout(() => {
            if (importStatusRefreshInFlight || !activeImportRunId.value) {
                scheduleNextImportStatusRefresh();

                return;
            }

            importStatusRefreshInFlight = true;
            refreshImportRun()
                .catch(() => {
                    onPollingError(
                        'No se pudo actualizar el avance de la importacion.',
                    );
                    stopImportStatusPolling();
                })
                .finally(() => {
                    importStatusRefreshInFlight = false;

                    if (importStatusTimer && activeImportRunId.value) {
                        scheduleNextImportStatusRefresh();
                    }
                });
        }, nextPollingDelayMs());
    };

    const startImportStatusPolling = (): void => {
        stopImportStatusPolling();
        pendingPollCount.value = 0;
        consecutivePollCount = 0;
        scheduleNextImportStatusRefresh();
        void refreshImportRun().catch(() => undefined);
    };

    onUnmounted(stopImportStatusPolling);

    return {
        pendingPollCount,
        startImportStatusPolling,
        stopImportStatusPolling,
    };
}
