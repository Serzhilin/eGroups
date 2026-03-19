const TOKEN_KEY = "egroups_token";
const USER_ID_KEY = "egroups_user_id";

export const setAuthToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const getAuthToken = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
};
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

export const setAuthId = (id: string) => localStorage.setItem(USER_ID_KEY, id);
export const getAuthId = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(USER_ID_KEY);
};
export const removeAuthId = () => localStorage.removeItem(USER_ID_KEY);

export const clearAuth = () => {
    removeAuthToken();
    removeAuthId();
};
