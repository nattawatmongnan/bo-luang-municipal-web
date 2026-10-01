# QGIS + Supabase GIS

ระบบนี้เปิด PostGIS แล้ว และใช้ view ชื่อ `public.gis_incidents` สำหรับ QGIS

## ข้อมูลที่ QGIS จะเห็น

- tracking_no
- created_at / updated_at
- category
- title
- urgency
- status
- village
- assigned_department
- public_note
- lat / lng
- geom (Point, EPSG:4326)

ข้อมูลชื่อผู้แจ้ง เบอร์โทร บ้านเลขที่ และรายละเอียดส่วนบุคคลไม่ได้อยู่ใน GIS view นี้

## เชื่อม QGIS

1. เปิด Supabase project แล้วกด **Connect**
2. เลือก connection แบบ Postgres ที่ QGIS ใช้ได้
3. ใน QGIS ไปที่ **Data Source Manager > PostgreSQL > New**
4. ใส่ Host, Port, Database, Username และ Password ตาม connection string ของ Supabase
5. Test Connection แล้ว Connect
6. เปิด schema `public`
7. เลือก view `gis_incidents`
8. Geometry column ใช้ `geom`
9. CRS ใช้ **EPSG:4326**

> อย่าแชร์ Database password หรือ secret/service-role key ใน GitHub หรือหน้าเว็บ

## การใช้งาน

เมื่อประชาชนกด **ใช้ตำแหน่งปัจจุบัน** แล้วส่งเรื่อง ระบบจะบันทึก lat/lng และสร้าง PostGIS point อัตโนมัติ จากนั้น QGIS จะเห็นจุดเมื่อ refresh layer

## ตัวอย่างสไตล์ใน QGIS

ใช้ Categorized symbology จาก field `status` หรือ `urgency` เพื่อแยกสีตามสถานะ/ความเร่งด่วน
