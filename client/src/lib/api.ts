import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const teamId = useAuthStore.getState().teamId;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (teamId) headers["x-team-id"] = teamId;
    if (options.body instanceof FormData) delete headers["Content-Type"];

    // CSRF token from previous response header (Double-Submit Cookie pattern)
    if (this.csrfToken) headers["x-csrf-token"] = this.csrfToken;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });

    // Store CSRF token from response header for subsequent requests
    const newCsrfToken = response.headers.get("x-csrf-token");
    if (newCsrfToken) this.csrfToken = newCsrfToken;

    if (response.status === 204) {
      return { success: true } as ApiResponse<T>;
    }

    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data.error || "Request failed", response.status);
    }
    return data;
  }

  async get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body:
        body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PUT",
      body:
        body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async upload<T>(
    endpoint: string,
    file: File,
    data?: Record<string, string>,
    maxSizeMB = 50,
  ) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new ApiError(`Datei zu groß (max. ${maxSizeMB} MB)`, 413);
    }
    const formData = new FormData();
    formData.append("file", file);
    if (data)
      Object.entries(data).forEach(([k, v]) => formData.append(k, v));
    return this.request<T>(endpoint, { method: "POST", body: formData });
  }
}

export const api = new ApiClient(API_URL);
