import { flushPromises } from '@vue/test-utils';
import type { DOMWrapper } from '@vue/test-utils';

/**
 * Ayudantes de pruebas para <AppSelect> (el selector estándar que reemplazó a los <select> nativos).
 * La lista de opciones se teletransporta al body, así que se busca ahí.
 */
// Acepta lo que devuelven mount(), find() y get() (get() omite exists()).
type Findable = { find: (selector: string) => DOMWrapper<Element> };
type Clickable = Pick<DOMWrapper<Element>, 'trigger' | 'text'> & {
    exists?: () => boolean;
};

/** Botón del selector por su aria-label (equivale a `select[aria-label="…"]`). */
export const appSelectButton = (wrapper: Findable, ariaLabel: string) =>
    wrapper.find(`button[aria-label="${ariaLabel}"]`);

/** Abre el selector y elige la opción cuyo texto coincide. */
export async function chooseAppSelectOption(
    trigger: Clickable,
    label: string,
): Promise<void> {
    if (trigger.exists && !trigger.exists()) {
        throw new Error(`No se encontró el selector para elegir "${label}"`);
    }
    await trigger.trigger('click');
    await flushPromises();
    const option = Array.from(
        document.body.querySelectorAll<HTMLElement>('li[role="option"]'),
    ).find((item) => item.textContent?.trim() === label);
    if (!option) {
        const available = Array.from(
            document.body.querySelectorAll<HTMLElement>('li[role="option"]'),
        ).map((item) => item.textContent?.trim());
        throw new Error(
            `Opción "${label}" no encontrada. Disponibles: ${available.join(', ')}`,
        );
    }
    option.click();
    await flushPromises();
}

/** Texto que muestra el selector (la opción elegida o el placeholder). */
export const appSelectText = (trigger: Clickable) => trigger.text().trim();
