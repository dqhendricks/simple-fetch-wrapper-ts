type ResponseInterceptor = (data: any, endpoint: string) => any;
type StatusCode = number | string;

const API_BASE_URL = process.env.API_BASE_URL || "https://exampledomain.com/api";
const LOCAL_STORAGE_KEY = "__exampledomain_auth_token__"; // storage key for API token

let lastResponse: Response | null = null;
const statusHandlers: Record<string, () => void> = {};
const responseInterceptors: ResponseInterceptor[] = [];

/**
 * Performs a fetch request to the specified endpoint.
 *
 * @param endpoint - The API endpoint to fetch data from.
 * @param customConfig - Custom configuration for the fetch request.
 * @returns A promise resolving to the response data.
 */
export async function fetch<T = any>(endpoint: string, customConfig: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem(LOCAL_STORAGE_KEY);
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  let body = customConfig.body;
  if (body && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    method: body ? "POST" : "GET",
    ...customConfig,
    body,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  try {
    const response = await window.fetch(`${API_BASE_URL}/${endpoint}`, config);
    lastResponse = response;

    if (response.status.toString() in statusHandlers) {
      statusHandlers[response.status.toString()]();
    }

    if (response.ok) {
      let data = await processResponseData(response);
      responseInterceptors.forEach((interceptor) => {
        data = interceptor(data, endpoint);
      });
      return data;
    } else {
      const errorText = await response.text();
      return Promise.reject(new Error(`Error ${response.status}: ${errorText}`));
    }
  } catch (error) {
    return Promise.reject(new Error(`Fetch to ${endpoint} failed: ${error.message}`));
  }
}

/**
 * Processes the response data based on its content type.
 *
 * @param response - The fetch response object.
 * @returns A promise resolving to the processed response data.
 */
async function processResponseData(response: Response): Promise<any> {
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return response.json();
  if (contentType.includes("image/") || contentType.includes("video/") || contentType.includes("application/")) {
    return response.blob();
  }
  return response.text();
}

/**
 * Retrieves the filename from the last response's Content-Disposition header.
 *
 * @returns The filename if available, otherwise undefined.
 */
export function getFilenameFromLastResponse(): string | undefined {
  const contentDisposition = lastResponse?.headers.get("Content-Disposition");
  const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
  const matches = filenameRegex.exec(contentDisposition || '');
  return matches ? matches[1].replace(/['"]/g, "") : undefined;
}

/**
 * Sets the authentication token in session storage.
 *
 * @param token - The authentication token.
 */
export function setAuthToken(token: string): void {
  sessionStorage.setItem(LOCAL_STORAGE_KEY, token);
}

/**
 * Removes the authentication token from session storage.
 */
export function removeAuthToken(): void {
  sessionStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Checks if an authentication token is set in session storage.
 *
 * @returns True if the token is set, otherwise false.
 */
export function isAuthTokenSet(): boolean {
  return sessionStorage.getItem(LOCAL_STORAGE_KEY) !== null;
}

/**
 * Adds a handler for a specific HTTP status code.
 *
 * @param statusCode - The HTTP status code.
 * @param handler - The handler function to execute for the status code.
 */
export function addStatusHandler(statusCode: StatusCode, handler: () => void): void {
  statusHandlers[statusCode.toString()] = handler;
}

/**
 * Removes a handler for a specific HTTP status code.
 *
 * @param statusCode - The HTTP status code.
 */
export function removeStatusHandler(statusCode: StatusCode): void {
  delete statusHandlers[statusCode.toString()];
}

/**
 * Adds a response interceptor to handle or mutate response data.
 *
 * @param interceptor - The interceptor function to add.
 */
export function addResponseInterceptor(interceptor: ResponseInterceptor): void {
  responseInterceptors.push(interceptor);
}

/**
 * Removes a response interceptor.
 *
 * @param interceptor - The interceptor function to remove.
 */
export function removeResponseInterceptor(interceptor: ResponseInterceptor): void {
  const index = responseInterceptors.indexOf(interceptor);
  if (index !== -1) responseInterceptors.splice(index, 1);
}

/**
 * Converts FormData to a plain object.
 *
 * @param formData - The FormData object to convert.
 * @returns The resulting plain object.
 */
export function formDataToObject(formData: FormData): Record<string, any> {
  const objectData: Record<string, any> = {};
  formData.forEach((value, key) => {
    if (!objectData[key]) {
      objectData[key] = value;
    } else {
      if (!Array.isArray(objectData[key])) {
        objectData[key] = [objectData[key]];
      }
      objectData[key].push(value);
    }
  });
  return objectData;
}

/**
 * Converts a plain object to FormData.
 *
 * @param objectData - The object to convert to FormData.
 * @returns The resulting FormData object.
 */
export function objectToFormData(objectData: Record<string, any>): FormData {
  const formData = new FormData();
  Object.entries(objectData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((subValue) => formData.append(key, subValue));
    } else {
      formData.append(key, value);
    }
  });
  return formData;
}
