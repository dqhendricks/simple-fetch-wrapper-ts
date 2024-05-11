/*
    usage example:

    import * as client from "./Client";

    client.request('login', {body: {username, password}}).then(
        data => {
            console.log('here the logged in user data', data);
        },
        error => {
            console.error('oh no, login failed', error);
        },
    );
*/

const API_BASE_URL = "https://dustinhendricks.com";
const LOCAL_STORAGE_KEY = "__dustin_hendricks_token__"; // storage key for API authentication tokens

export function request(
  endpoint: string,
  { body, ...customConfig }: RequestInit = {},
) {
  const token = localStorage.getItem(LOCAL_STORAGE_KEY);
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const config: RequestInit = {
    method: body ? "POST" : "GET",
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };
  // allow both FormData or {} fetch requests
  if (body) {
    if (body instanceof FormData !== true) {
      body = JSON.stringify(body);
      headers["content-type"] = "application/json";
    }
    config.body = body;
  }

  return fetch(`${API_BASE_URL}/${endpoint}`, config).then(async (response) => {
    if (response.status === 401) {
      logout();
      window.location.assign(window.location.href);
      return;
    }
    if (response.ok) {
      return await response.json();
    } else {
      const errorMessage = await response.text();
      return Promise.reject(new Error(errorMessage));
    }
  });
}

export function login(token: string) {
  localStorage.setItem(LOCAL_STORAGE_KEY, token);
}

export function logout() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function isLoggedIn() {
  return localStorage.getItem(LOCAL_STORAGE_KEY) === null;
}

export function formDataToObject(formData: FormData) {
  // does not support multi-dimensional arrays
  let objectData = {};
  for (const key of formData.keys()) {
    const allItems = formData.getAll(key);
    // creates new object each iteration to avoid Typing errors
    objectData = {
      ...objectData,
      key: allItems.length > 1 ? allItems : allItems[0],
    };
  }
  return objectData;
}

export function objectToFormData(objectData: object) {
  // does not support multi-dimensional arrays
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
