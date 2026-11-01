import type { Trip } from './types';
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function coverPos(t:Partial<Trip>){return `${clamp(Number(t.coverX??50)||0,0,100)}% ${clamp(Number(t.coverY??50)||0,0,100)}%`;}
export function coverZoom(t:Partial<Trip>){return clamp(Number(t.coverZoom??1.35)||1.35,1,2.5);}
export function tripPhoto(t:Partial<Trip>){
 if(t.cover&&/^data:image\/(jpeg|png|webp);base64,/.test(t.cover))return t.cover;
 const place=((t.country||'')+' '+(t.city||'')+' '+(t.name||'')).toLowerCase();
 const pics:[RegExp,string][]=[
 [/沖繩|okinawa/,'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=1200&q=85'],
 [/京都|kyoto|日本|japan/,'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=85'],
 [/法國|巴黎|france|paris/,'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=85'],
 [/美國|紐約|usa|new york/,'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=85'],
 [/義大利|羅馬|italy|rome/,'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=85'],
 [/韓國|首爾|korea|seoul/,'https://images.unsplash.com/photo-1538485399081-7c897e1a7f3a?w=1200&q=85'],
 [/英國|倫敦|uk|london/,'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=85'],
 [/台灣|臺灣|taiwan/,'https://images.unsplash.com/photo-1470004914212-05527e49370b?w=1200&q=85'],
 [/泰國|曼谷|thailand|bangkok/,'https://images.unsplash.com/photo-1508004680771-708b02aabdc0?w=1200&q=85']];
 return pics.find(([p])=>p.test(place))?.[1]||'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&q=85';
}
export function compress(file:File):Promise<string>{return new Promise((resolve,reject)=>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>15*1024*1024){reject(Error('請使用小於 15MB 的 JPG、PNG 或 WebP 圖片'));return;}
 const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),scale=Math.min(1,650/img.width,650/img.height);c.width=Math.max(1,img.width*scale);c.height=Math.max(1,img.height*scale);const context=c.getContext('2d');if(!context){URL.revokeObjectURL(url);reject(Error('Canvas unavailable'));return;}context.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.7));};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('圖片讀取失敗'));};img.src=url;
 });}
