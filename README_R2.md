# R2 Web Core

โครงสร้างเว็บหลัก:
- `/` Citizen Portal
- Tracking อยู่ในหน้าเมนู “ติดตามเรื่อง”
- Staff workspace
- Executive dashboard
- Supabase-ready schema + RLS starter
- Demo mode สำหรับทดสอบโดยไม่ใช้ข้อมูลจริง

## Local
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Production
1. สร้าง Supabase project ใหม่
2. ตรวจและรัน `supabase/schema.sql`
3. ตั้ง `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
4. เปลี่ยน `VITE_DEMO_MODE=false`
5. ทดสอบ RLS ด้วยบัญชี role ต่าง ๆ ก่อนใช้ข้อมูลประชาชนจริง

ห้าม commit service-role key, Gemini key หรือ secret ใด ๆ ลง GitHub
