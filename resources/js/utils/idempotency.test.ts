import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey } from './idempotency';

describe('createIdempotencyKey', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('generates a valid UUID when randomUUID is unavailable on HTTP', () => {
        vi.stubGlobal('crypto', {
            getRandomValues(bytes: Uint8Array) {
                bytes.forEach((_, index) => {
                    bytes[index] = index + 1;
                });
                return bytes;
            },
        });

        expect(createIdempotencyKey()).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
    });
});
