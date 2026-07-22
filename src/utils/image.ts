export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mime });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob as data URL"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export async function resizeImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
  const img = await loadImage(dataUrl);

  let { width, height } = img;

  if (width <= maxWidth && height <= maxHeight) {
    return dataUrl;
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

export async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

export async function cropImage(
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<string> {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  return canvas.toDataURL("image/png");
}

export function createThumbnail(
  dataUrl: string,
  thumbSize: number = 150
): Promise<string> {
  return resizeImage(dataUrl, thumbSize, thumbSize);
}

export async function getDataUrlFileSize(dataUrl: string): Promise<number> {
  const blob = dataUrlToBlob(dataUrl);
  return blob.size;
}
