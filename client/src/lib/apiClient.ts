import axios, {
    type InternalAxiosRequestConfig,
    type AxiosResponse,
    type AxiosError,
} from "axios";
import { getAuthToken, clearAuth } from "./authUtils";

const baseURL =
    process.env.NEXT_PUBLIC_EGROUPS_BASE_URL || "http://localhost:4004";

export const apiClient = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            clearAuth();
            window.location.href = "/login";
        }
        return Promise.reject(error);
    },
);
