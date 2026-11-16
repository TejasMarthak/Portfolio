import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 30000
});

let csrfToken = '';

function readCookie(name) {
  const entry = document.cookie.split('; ').find((value) => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes(config.method?.toLowerCase() || 'get')) {
    const token = csrfToken || readCookie('csrfToken');
    if (token) config.headers.set('X-CSRF-Token', token);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config.url?.includes('/api/auth/me') && response.data?.csrfToken) {
      csrfToken = response.data.csrfToken;
    }
    return response;
  },
  (error) => {
    const requestUrl = error.config?.url || '';
    if (error.response?.status === 401 && !requestUrl.includes('/api/auth/me')) {
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export function cloudinaryUrl(url, width = 900) {
  if (!url || !url.includes('res.cloudinary.com')) return url || '';
  if (url.includes('/upload/f_auto,q_auto/')) {
    return url.replace('/upload/f_auto,q_auto/', `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
