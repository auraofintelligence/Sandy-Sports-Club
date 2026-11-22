const encoder=new TextEncoder();
const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  return value>>>0;
});

// Stored ZIP entries keep the exact club JPEG bytes. Each Blob part can be
// released from JS memory as the next page of a large collection arrives.
export class DownloadZip {
  constructor(created){
    this.offset=0;this.files=[];this.directory=[];
    this.dosDay=((Math.max(1980,created.getUTCFullYear())-1980)<<9)|((created.getUTCMonth()+1)<<5)|created.getUTCDate();
    this.dosTime=(created.getUTCHours()<<11)|(created.getUTCMinutes()<<5)|(created.getUTCSeconds()>>1);
  }
  add(filename,data){
    const name=encoder.encode(filename),bytes=typeof data==='string'?encoder.encode(data):data;
    let sum=-1;
    for(let i=0;i<bytes.length;i++)sum=crcTable[(sum^bytes[i])&255]^(sum>>>8);
    const crc=(sum^-1)>>>0;
    const local=new Uint8Array(30+name.length),central=new Uint8Array(46+name.length);
    for(const [header,isDirectory] of [[local,false],[central,true]]){
      const view=new DataView(header.buffer);
      view.setUint32(0,isDirectory?0x02014b50:0x04034b50,true);
      if(isDirectory)view.setUint16(4,20,true);
      const start=isDirectory?6:4;
      view.setUint16(start,20,true);
      view.setUint16(start+2,0x0800,true);
      view.setUint16(start+6,this.dosTime,true);view.setUint16(start+8,this.dosDay,true);
      view.setUint32(start+10,crc,true);view.setUint32(start+14,bytes.length,true);view.setUint32(start+18,bytes.length,true);
      view.setUint16(start+22,name.length,true);
      if(isDirectory)view.setUint32(42,this.offset,true);
      header.set(name,isDirectory?46:30);
    }
    this.files.push(local,new Blob([bytes]));this.directory.push(central);
    this.offset+=local.length+bytes.length;
  }
  close(){
    const end=new Uint8Array(22),view=new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);
    view.setUint16(8,this.directory.length,true);view.setUint16(10,this.directory.length,true);
    view.setUint32(12,this.directory.reduce((n,x)=>n+x.length,0),true);view.setUint32(16,this.offset,true);
    return new Blob([...this.files,...this.directory,end],{type:'application/zip'});
  }
}

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={id:'Record ID',displayName:'Member name',message:'Message',title:'Title',recorded:'Recorded',entered:'Entered',caughtOn:'Caught on',
  guestLimit:'Guest places (blank if unlimited)',
  lengthCm:'Length (cm)',lengthMm:'Length (mm)',area:'General area',notes:'Notes',species:'Species',competition:'Competition',status:'Status',
  placing:'Placing',prize:'Prize',listed:'Listed in member search',avatar:'Avatar',pin:'Map pin',catch:'Linked catch',photo:'Photo file',
  repliedTo:'Reply to post',kind:'Type',scope:'Offer',event:'Event',agreed:'Agreed on',withdrawn:'Withdrawn on',accepted:'Agreement accepted',edition:'Agreement edition',
  venueType:'Meeting place type',startsAt:'Starts at (UTC)',partySize:'Number attending',sideDish:'Side dish',hostName:'Host name',menu:'On the menu',byo:'Bring along',jobs:'Shared jobs',mealId:'Meal reference',response:'My reply',dietary:'My private dietary notes',contribution:'What I offered',cancelled:'Cancelled',revoked:'Invitation withdrawn',nickname:'Junior nickname',resultConsent:'Club members may see result',nicknameConsent:'Club members may see nickname',photoConsent:'Club members may see photo'};
const label=k=>names[k]||k;
const printable=v=>v==null?'':typeof v==='object'?Object.entries(v).map(([k,val])=>label(k)+' = '+printable(val)).join(', '):String(v);
const format=(key,value)=>['cancelled','revoked','listed','accepted','resultConsent','nicknameConsent','photoConsent'].includes(key)?(value?'Yes':'No'):printable(value);
function csvCell(value){
  const text=/^\s*[=+@-]|^[\t\r]/.test(value)?"'"+value:value;
  return '"'+text.replaceAll('"','""')+'"';
}

export class MemberArchive {
  constructor(groups,createdAt){
    this.groups=groups.map(g=>({...g,entries:[]}));
    this.created=new Date(createdAt);this.part=new DownloadZip(this.created);this.parts=[];this.photoCount=0;
  }
  add(groupId,memberRow){
    const group=this.groups.find(g=>g.id===groupId),{photo,...row}=memberRow;
    if(photo){
      const path='Photos/'+groupId+'-'+String(group.entries.length+1).padStart(4,'0')+'.jpg';
      const binary=atob(photo),data=new Uint8Array(binary.length);
      for(let i=0;i<data.length;i++)data[i]=binary.charCodeAt(i);
      this.part.add(path,data);row.photo=path;this.photoCount++;
      if(this.part.offset>=128*1024*1024 || this.part.directory.length>=20000){
        this.parts.push(this.part.close());this.part=new DownloadZip(this.created);
      }
    }
    group.entries.push(row);
  }
  finish(){
    const out=this.part;
    const index=['<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' file:; style-src \'unsafe-inline\'"><title>My club contributions</title><style>body{max-width:850px;margin:2rem auto;padding:0 1rem;font:17px/1.5 system-ui;color:#153f42}section{margin-block:2.5rem}article{border-top:1px solid #afc7bd;padding:1rem 0}img{max-width:100%;max-height:320px}dt{font-weight:bold}dd{margin:0 0 .4rem;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#005b60}</style></head><body><h1>My club contributions</h1><p>Sandy Sports Club</p><p>Saved '+escape(this.created.toISOString().slice(0,10))+'. These are the contributions and photo copies held by the clubhouse when your download was prepared.</p>'];
    index.push('<nav aria-label="Contents"><ul>'+this.groups.map(g=>'<li><a href="#'+g.id+'">'+escape(g.title)+'</a> ('+g.entries.length+')</li>').join('')+'</ul></nav>');
    for(const g of this.groups){
      index.push('<section id="'+g.id+'"><h2>'+escape(g.title)+'</h2>');
      if(!g.entries.length){index.push('<p>No entries.</p></section>');continue;}
      const keys=[...new Set(g.entries.flatMap(r=>Object.keys(r)))];
      const rows=[keys.map(k=>csvCell(label(k))).join(',')];
      for(const row of g.entries){
        rows.push(keys.map(k=>csvCell(format(k,row[k]))).join(','));
        const details=Object.entries(row).filter(([k,v])=>k!=='photo' && v!==null && v!=='').map(([k,v])=>'<dt>'+escape(label(k))+'</dt><dd>'+escape(format(k,v))+'</dd>').join('');
        index.push('<article><dl>'+details+'</dl>'+(row.photo?'<a href="'+row.photo+'"><img loading="lazy" alt="Photo saved with this entry" src="'+row.photo+'"></a>':'')+'</article>');
      }
      out.add('Spreadsheets/'+g.id+'.csv','\uFEFF'+rows.join('\r\n')+'\r\n');index.push('</section>');
    }
    index.push('</body></html>');
    out.add('Start here.html',index.join('\n'));
    out.add('My contributions.json',JSON.stringify(Object.fromEntries(this.groups.map(g=>[g.id,g.entries])),null,2));
    return [out.close(),...this.parts];
  }
}
