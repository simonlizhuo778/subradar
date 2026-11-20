/**
 * 客户端图片压缩:截图/拍照先压再上传,省流量也省模型 token。
 * 长边 ≤1280px,JPEG 质量 0.85。
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('只支持图片文件');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('浏览器不支持 Canvas,无法压缩图片');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图片压缩失败'));
          }
        },
        'image/jpeg',
        0.85,
      );
    });
  } finally {
    bitmap.close();
  }
}
