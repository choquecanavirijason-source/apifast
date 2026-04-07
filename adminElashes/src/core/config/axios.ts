import axios from 'axios';
import variables from './variables';

const instance = axios.create({
  baseURL: variables.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use(config => {
  const token = localStorage.getItem(variables.session.tokenName);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default instance;
