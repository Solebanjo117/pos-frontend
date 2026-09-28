/**
 * Node 25 expone un `localStorage` global sin métodos (`setItem`, `clear`, etc.
 * son `undefined`) que tapa el que provee jsdom, porque en ese entorno
 * `window === globalThis`. Cualquier test que persista estado —sesiones del POS,
 * columnas reordenables— falla con `localStorage.clear is not a function`.
 *
 * Instalamos un almacenamiento en memoria cuando detectamos el global roto.
 * Si el entorno ya ofrece uno funcional, no se toca nada.
 */
function installMemoryLocalStorage(): void {
    if (typeof globalThis.localStorage?.setItem === 'function') {
        return;
    }

    const store = new Map<string, string>();

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, String(value));
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
            key: (index: number) => [...store.keys()][index] ?? null,
            get length() {
                return store.size;
            },
        },
    });
}

installMemoryLocalStorage();
