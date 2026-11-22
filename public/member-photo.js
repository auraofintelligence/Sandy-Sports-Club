export async function preparePhoto(file) {
  if (!file?.size) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>12*1024*1024) throw Error('Choose a JPG, PNG or WebP photo under 12 MB.');
  const bitmap=await createImageBitmap(file);
  try {
    const ratio=Math.min(1,1050/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.8,.65,.5,.35]){
      const encoded=canvas.toDataURL('image/jpeg',quality);
      if(encoded.length<=245000)return encoded;
    }
    throw Error('This photo is still too large. Choose a smaller copy.');
  } finally {bitmap.close();}
}
