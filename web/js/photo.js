import { config } from './common.js';

export async function uploadPhoto(file) {
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', config.uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'The photo could not be uploaded.');
  }
  return payload.secure_url;
}
