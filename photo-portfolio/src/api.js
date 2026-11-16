import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

export function cloudinaryUrl(url, width = 1200) {
  if (!url || !url.includes('res.cloudinary.com')) return url || '';
  if (url.includes('/upload/f_auto,q_auto/')) {
    return url.replace('/upload/f_auto,q_auto/', `/upload/f_auto,q_auto,w_${width}/`);
  }
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}
