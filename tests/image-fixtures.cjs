const zlib = require('node:zlib');
function png(width, height, pixel = () => [240,20,20,255]) {
  const chunk = (type, data) => { const t=Buffer.from(type),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(zlib.crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]); };
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=[];for(let y=0;y<height;y++){const row=Buffer.alloc(1+width*4);for(let x=0;x<width;x++)Buffer.from(pixel(x,y)).copy(row,1+x*4);rows.push(row);}
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
function decodePng(data) {
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20),type=data[25],bpp=type===6?4:type===2?3:0;
  if(!bpp||data[24]!==8)throw Error('PNG fixture reader supports RGB/RGBA8 only');
  const chunks=[];for(let i=8;i+12<=data.length;){const len=data.readUInt32BE(i),kind=data.toString('ascii',i+4,i+8);if(kind==='IDAT')chunks.push(data.subarray(i+8,i+8+len));i+=len+12;}
  const raw=zlib.inflateSync(Buffer.concat(chunks)),out=Buffer.alloc(width*height*bpp),stride=width*bpp;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const f=raw[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=bpp?out[i-bpp]:0,b=y?out[i-stride]:0,c=y&&x>=bpp?out[i-stride-bpp]:0;out[i]=(raw[y*(stride+1)+1+x]+(f===0?0:f===1?a:f===2?b:f===3?Math.floor((a+b)/2):f===4?paeth(a,b,c):NaN))&255;}}
  return {width,height,pixel:(x,y)=>[...out.subarray((y*width+x)*bpp,(y*width+x+1)*bpp),...(bpp===3?[255]:[])]};
}
module.exports={png,decodePng};
