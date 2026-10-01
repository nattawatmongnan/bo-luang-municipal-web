import { FormEvent, useMemo, useState } from 'react';
import { supabase, supabaseConfigured } from './lib/supabase';

type Page='citizen'|'track'|'staff'|'executive';
type Incident={id:string;tracking_no:string;category:string;title:string;description:string;village:string;house_number?:string;urgency:string;status:string;created_at:string;assigned_department?:string;public_note?:string};

const demoSeed:Incident[]=[
 {id:'1',tracking_no:'BLM-2569-DEMO001',category:'ไฟส่องสว่าง',title:'ไฟถนนดับ',description:'ไฟถนนดับใกล้ทางแยก',village:'หมู่ 2',urgency:'HIGH',status:'IN_PROGRESS',created_at:new Date().toISOString(),assigned_department:'กองช่าง',public_note:'เจ้าหน้าที่รับเรื่องแล้ว'},
 {id:'2',tracking_no:'BLM-2569-DEMO002',category:'ถนน',title:'ถนนชำรุด',description:'มีหลุมบริเวณหน้าศาลา',village:'หมู่ 5',urgency:'MEDIUM',status:'RECEIVED',created_at:new Date().toISOString()}
];

const labels:Record<string,string>={RECEIVED:'รับเรื่องแล้ว',VERIFYING:'กำลังตรวจสอบ',IN_PROGRESS:'กำลังดำเนินการ',DONE:'ดำเนินการแล้ว',CLOSED:'ปิดเรื่อง'};

function makeTracking(){
 const y=new Date().getFullYear()+543;
 return 'BLM-'+y+'-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase();
}

export default function App(){
 const [page,setPage]=useState<Page>('citizen');
 const [items,setItems]=useState<Incident[]>(demoSeed);
 const [message,setMessage]=useState('');
 const [tracking,setTracking]=useState('');
 const [found,setFound]=useState<Incident|null>(null);
 const demo=!supabaseConfigured || import.meta.env.VITE_DEMO_MODE==='true';

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault(); setMessage('');
  const f=new FormData(e.currentTarget);
  const payload={
   category:String(f.get('category')||'อื่นๆ'),
   title:String(f.get('title')||''),
   description:String(f.get('description')||''),
   village:String(f.get('village')||''),
   house_number:String(f.get('house')||''),
   reporter_name:String(f.get('name')||''),
   reporter_phone:String(f.get('phone')||''),
   urgency:String(f.get('urgency')||'MEDIUM'),
   status:'RECEIVED'
  };
  if(!payload.title||!payload.description||!payload.village){setMessage('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');return}
  if(demo||!supabase){
   const incident:Incident={...payload,id:crypto.randomUUID(),tracking_no:makeTracking(),created_at:new Date().toISOString()};
   setItems(x=>[incident,...x]); setMessage('ส่งเรื่องสำเร็จ เลขติดตาม: '+incident.tracking_no); e.currentTarget.reset(); return;
  }
  const {data,error}=await supabase.from('municipal_incidents').insert(payload).select('tracking_no').single();
  if(error){setMessage('ส่งเรื่องไม่สำเร็จ: '+error.message);return}
  setMessage('ส่งเรื่องสำเร็จ เลขติดตาม: '+data.tracking_no); e.currentTarget.reset();
 }

 async function doTrack(){
  setFound(null);
  if(demo||!supabase){setFound(items.find(x=>x.tracking_no.toUpperCase()===tracking.trim().toUpperCase())||null);return}
  const {data}=await supabase.rpc('track_incident',{p_tracking_no:tracking.trim(),p_phone_last4:''});
  setFound(data?.[0]||null);
 }

 const stats=useMemo(()=>({
  all:items.length,
  active:items.filter(x=>!['DONE','CLOSED'].includes(x.status)).length,
  done:items.filter(x=>['DONE','CLOSED'].includes(x.status)).length
 }),[items]);

 return <div className="app">
  <header className="top"><div className="top-inner">
   <div><div className="brand">เทศบาลตำบลบ่อหลวง · Municipal One Stop</div><div className="sub">แจ้งเหตุ · ติดตามงาน · ศูนย์งานเจ้าหน้าที่</div></div>
   <nav className="nav">
    {([['citizen','ประชาชน'],['track','ติดตามเรื่อง'],['staff','เจ้าหน้าที่'],['executive','ผู้บริหาร']] as [Page,string][]).map(([p,l])=><button className={page===p?'active':''} onClick={()=>setPage(p)} key={p}>{l}</button>)}
   </nav>
  </div></header>

  <main className="wrap">
   {demo&&<div className="notice">ขณะนี้อยู่ใน <b>Demo mode</b> — ข้อมูลตัวอย่างไม่ได้ใช้แทนฐานข้อมูลเทศบาลจริง</div>}

   {page==='citizen'&&<>
    <section className="hero"><h1>แจ้งเหตุหรือขอความช่วยเหลือ</h1><p>ส่งข้อมูลให้เทศบาลพร้อมเลขติดตามเรื่อง ใช้งานได้ทั้งมือถือและคอมพิวเตอร์</p><span className="emergency">กรณีฉุกเฉินที่เสี่ยงต่อชีวิต โปรดติดต่อหน่วยฉุกเฉินที่เกี่ยวข้องโดยตรง</span></section>
    <div className="grid">
     <section className="card" style={{gridColumn:'span 2'}}>
      <h2>แบบฟอร์มแจ้งเหตุ</h2>
      <form onSubmit={submit}>
       <div className="grid">
        <label className="field">ประเภท<select name="category"><option>ถนน</option><option>ไฟส่องสว่าง</option><option>ขยะ</option><option>น้ำประปา</option><option>น้ำท่วม</option><option>สัตว์รบกวน</option><option>ความปลอดภัย</option><option>อื่นๆ</option></select></label>
        <label className="field">หมู่บ้าน/หมู่ที่ *<input name="village" placeholder="เช่น หมู่ 3" /></label>
        <label className="field">ความเร่งด่วน<select name="urgency"><option value="LOW">ทั่วไป</option><option value="MEDIUM">เร่งด่วนปานกลาง</option><option value="HIGH">เร่งด่วน</option></select></label>
       </div>
       <label className="field">หัวข้อ *<input name="title" placeholder="สรุปเหตุสั้น ๆ" /></label>
       <label className="field">รายละเอียด *<textarea name="description" placeholder="อธิบายตำแหน่งและสิ่งที่ต้องการให้ช่วย" /></label>
       <div className="grid">
        <label className="field">บ้านเลขที่<input name="house" /></label>
        <label className="field">ชื่อผู้แจ้ง<input name="name" /></label>
        <label className="field">เบอร์โทร<input name="phone" inputMode="tel" /></label>
       </div>
       <button className="btn primary">ส่งเรื่องให้เทศบาล</button>
      </form>
      {message&&<div className={'notice '+(message.startsWith('ส่งเรื่องสำเร็จ')?'ok':'')} style={{marginTop:14}}>{message}</div>}
     </section>
     <aside className="card"><h3>บริการหลัก</h3><div className="list"><div className="item">📍 ระบุตำแหน่งและหมู่บ้าน</div><div className="item">📷 รองรับหลักฐานภาพใน Production</div><div className="item">🔎 ติดตามสถานะด้วยเลข BLM</div><div className="item">🔐 แยกสิทธิ์ประชาชน/เจ้าหน้าที่/ผู้บริหาร</div></div></aside>
    </div>
   </>}

   {page==='track'&&<section className="card">
    <h2>ติดตามเรื่อง</h2><p className="muted">กรอกเลขติดตามที่ได้รับหลังแจ้งเหตุ</p>
    <div className="row"><input style={{flex:1,minWidth:250,padding:12,borderRadius:12,border:'1px solid #cbd5e1'}} value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="BLM-2569-..." /><button className="btn primary" onClick={doTrack}>ค้นหา</button></div>
    {found?<div className="item" style={{marginTop:16}}><b>{found.title}</b><p>{found.tracking_no}</p><span className="status">{labels[found.status]||found.status}</span><p>พื้นที่: {found.village}</p><p>{found.public_note||'ยังไม่มีข้อความอัปเดต'}</p></div>:tracking&&<p className="muted">หากไม่พบข้อมูล ให้ตรวจสอบเลขติดตามอีกครั้ง</p>}
   </section>}

   {page==='staff'&&<>
    <section className="hero"><h1>ศูนย์งานเจ้าหน้าที่</h1><p>Prototype สำหรับรับเรื่อง มอบหมายงาน และอัปเดตสถานะ ก่อนใช้งานจริงต้องเปิด Supabase Auth + RLS</p></section>
    <div className="list">{items.map(i=><div className="item" key={i.id}><div className="row" style={{justifyContent:'space-between'}}><div><b>{i.title}</b><div className="muted">{i.tracking_no} · {i.village} · {i.category}</div></div><span className="status">{labels[i.status]||i.status}</span></div><p>{i.description}</p>{demo&&<div className="row"><button className="btn secondary" onClick={()=>setItems(x=>x.map(v=>v.id===i.id?{...v,status:'IN_PROGRESS',assigned_department:'กองช่าง',public_note:'เจ้าหน้าที่กำลังดำเนินการ'}:v))}>รับดำเนินการ</button><button className="btn primary" onClick={()=>setItems(x=>x.map(v=>v.id===i.id?{...v,status:'DONE',public_note:'ดำเนินการเรียบร้อย'}:v))}>ปิดงาน</button></div>}</div>)}</div>
   </>}

   {page==='executive'&&<>
    <section className="hero"><h1>Dashboard ผู้บริหาร</h1><p>แสดงข้อมูลสรุปโดยไม่จำเป็นต้องเปิดเผยข้อมูลส่วนบุคคลของผู้แจ้ง</p></section>
    <div className="grid"><div className="card"><div className="muted">เรื่องทั้งหมด</div><div className="kpi">{stats.all}</div></div><div className="card"><div className="muted">กำลังดำเนินการ</div><div className="kpi">{stats.active}</div></div><div className="card"><div className="muted">ดำเนินการแล้ว</div><div className="kpi">{stats.done}</div></div></div>
   </>}
  </main>
  <footer className="footer">Bo Luang Municipal Web · R2 Core Prototype</footer>
 </div>
}
