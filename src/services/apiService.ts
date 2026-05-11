import axios, { AxiosError } from 'axios';
import type { ExerciseRequest, ExerciseResponse } from '../types/board.types';

// Use relative URL so requests go through the Vite dev proxy → no CORS issues
const API_BASE = '/api/v1';
const EXERCISES_URL = `${API_BASE}/exercises`;

/**
 * Sends the board image and subject to the backend for AI analysis.
 */
export const analyzeBoard = async (data: ExerciseRequest): Promise<ExerciseResponse> => {
    try {
        const response = await axios.post<ExerciseResponse>(`${EXERCISES_URL}/analyze`, data, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 60_000, // 60 s – AI analysis can be slow
        });
        return response.data;
    } catch (error) {
        const axiosErr = error as AxiosError<{ message?: string; error?: string }>;

        if (axiosErr.response) {
            // The server responded with a non-2xx status
            const status = axiosErr.response.status;
            const serverMsg =
                axiosErr.response.data?.message ||
                axiosErr.response.data?.error ||
                axiosErr.message;

            console.error(`[apiService] Error ${status} from backend:`, serverMsg);

            if (status === 429) {
                throw new Error('Cuota de Gemini AI agotada. Intenta de nuevo en unos minutos.');
            }
            if (status === 503 || status === 502) {
                throw new Error('El backend no está disponible. Verifica que Spring Boot esté corriendo en el puerto 8080.');
            }
            throw new Error(`Error del servidor (${status}): ${serverMsg}`);
        } else if (axiosErr.request) {
            // Request was made but no response received (backend down / wrong port)
            console.error('[apiService] No response from backend – is it running on port 8080?', axiosErr.message);
            throw new Error('Sin respuesta del servidor. Verifica que el backend esté activo en el puerto 8080.');
        } else {
            console.error('[apiService] Request setup error:', axiosErr.message);
            throw new Error(`Error al configurar la petición: ${axiosErr.message}`);
        }
    }
};

/**
 * Lightweight health-check: hits the backend and returns true if reachable.
 * Uses HEAD to avoid triggering business logic; any response (even 4xx) means the server is up.
 */
export const checkBackendHealth = async (): Promise<boolean> => {
    try {
        // Try actuator health first (if Spring Actuator is enabled)
        await axios.get('/actuator/health', { timeout: 5_000 });
        return true;
    } catch (actuatorErr) {
        const ae = actuatorErr as AxiosError;
        // If we got ANY HTTP response (even 404/405), the server IS reachable
        if (ae.response) return true;

        // Fallback: try the exercises endpoint with a HEAD-like OPTIONS request
        try {
            await axios.options(`${API_BASE}/exercises`, { timeout: 5_000 });
            return true;
        } catch (fallbackErr) {
            const fe = fallbackErr as AxiosError;
            // Any HTTP response means server is up
            return !!fe.response;
        }
    }
};
