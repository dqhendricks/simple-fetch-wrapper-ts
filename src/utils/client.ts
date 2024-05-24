/*
    usage example:

    import * as client from "./client";

    client.request('login', {body: {username, password}}).then(
        data => {
            console.log('here the logged in user data', data);
        },
        error => {
            console.error('oh no, login failed', error);
        },
    );
*/

const API_BASE_URL = "https://exampledomain.com";
const LOCAL_STORAGE_KEY = "__your_site_token__"; // storage key for API authentication tokens

interface StatusHandlers {
  [key: string]: () => void;
}

type StatusCode = string | number;

type ResponseInterceptor = (data: Record<string, unknown>) => void;

type FormDataAsObject = Record<string, string | Blob | Array<string | Blob>>;

type ObjectToFormData = Record<
  string,
  string | Blob | number | Array<string | Blob | number>
>;

const statusHandlers: StatusHandlers = {};
const responseInterceptors: Array<ResponseInterceptor> = [];

export function fetch(
  endpoint: string,
  { body, ...customConfig }: RequestInit = {}
) {
  // add bearer token if exists
  const token = localStorage.getItem(LOCAL_STORAGE_KEY);
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const config: RequestInit = {
    method: body ? "POST" : "GET", // auto set method if not set in config
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };
  // allow both FormData or object fetch requests
  if (body) {
    if (body instanceof FormData !== true) {
      body = JSON.stringify(body);
      headers["content-type"] = "application/json";
    }
    config.body = body;
  }

  return window
    .fetch(`${API_BASE_URL}/${endpoint}`, config)
    .then(async (response) => {
      // execute any set status handlers for expected errors
      if (response.status.toString() in statusHandlers) {
        statusHandlers[response.status.toString()]();
      }
      if (response.ok) {
        // success
        const data = await response.json();
        // execute any set response interceptors
        responseInterceptors.forEach((interceptor) => interceptor(data));
        return data;
      } else {
        // unexpected error
        const errorMessage = await response.text();
        return Promise.reject(new Error(errorMessage));
      }
    });
}

export function setAuthToken(token: string) {
  localStorage.setItem(LOCAL_STORAGE_KEY, token);
}

export function formDataToObject(formData: FormData): FormDataAsObject {
  // does not support multi-dimensional arrays
  const objectData: FormDataAsObject = {};
  for (const key of formData.keys()) {
    const allItems = formData.getAll(key);
    objectData[key] = allItems.length > 1 ? allItems : allItems[0];
  }
  return objectData;
}

export function objectToFormData(objectData: ObjectToFormData): FormData {
  // does not support multi-dimensional arrays
  const formData = new FormData();
  Object.entries(objectData).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((subValue) =>
        formData.append(
          key,
          typeof subValue !== "number" ? subValue : subValue.toString()
        )
      );
    } else {
      formData.append(
        key,
        typeof value !== "number" ? value : value.toString()
      );
    }
  });
  return formData;
}

// set status handlers to universally handle things like 401 unauthorized request responses
export function addStatusHandler(
  statusCode: StatusCode,
  handler: StatusHandlers[string]
) {
  statusHandlers[statusCode.toString()] = handler;
}

export function removeStatusHandler(statusCode: StatusCode) {
  delete statusHandlers[statusCode.toString()];
}

// add response interceptors to universally handle certain data in responses
export function addResponseInterceptor(interceptor: ResponseInterceptor) {
  responseInterceptors.push(interceptor);
}

export function removeResponseInterceptor(interceptor: ResponseInterceptor) {
  const index = responseInterceptors.indexOf(interceptor);
  if (index !== -1) responseInterceptors.splice(index, 1);
}
