// Simple wrapper for toast notifications using react-toastify
import { toast } from 'react-toastify';

export const toastify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  info: (msg: string) => toast.info(msg),
  warn: (msg: string) => toast.warn(msg),
};
