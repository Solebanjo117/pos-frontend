export const getPosSessionDetailId = (urlValue: string): number | null => {
    const url = new URL(urlValue, window.location.origin);
    const value =
        url.searchParams.get('session_id') ?? url.searchParams.get('session');
    const parsed = Number(value);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const setPosSessionDetailId = (
    urlValue: string,
    sessionId: number | null,
): string => {
    const url = new URL(urlValue, window.location.origin);
    url.searchParams.delete('session');
    url.searchParams.delete('session_id');

    if (sessionId !== null) {
        url.searchParams.set('session_id', String(sessionId));
    }

    return `${url.pathname}${url.search}${url.hash}`;
};
