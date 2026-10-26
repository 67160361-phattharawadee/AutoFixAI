# AutoFixAI — สคริปต์ Pitching (ไม่เกิน 4 นาที, เน้น Tech Stack)

ผู้นำเสนอ: **A** = Phattharawadee (67160361) · **B** = ภาณัฏฐ์ศญา (67160173)
เวลารวมโดยประมาณ **3:45 นาที** (เผื่อ 15 วินาที)

---

## 0:00–0:25 · เปิดเรื่อง (A) — ปัญหา + ทางออก

> **หน้าจอ:** หน้าแรก https://67160361-phattharawadee.github.io/AutoFixAI/

"สวัสดีค่ะ พวกเราทำ **AutoFixAI** ร้านอะไหล่รถยนต์ออนไลน์
ปัญหาคือคนทั่วไปไม่รู้ชื่ออะไหล่ และกลัวซื้อผิดรุ่น
AutoFixAI แก้ด้วยการให้ลูกค้า 'บอกอาการรถ' แล้วระบบแนะนำอะไหล่ และเช็กว่าเข้ากับรถของเราได้ไหม
วันนี้จะเล่าว่าเบื้องหลังเว็บนี้ใช้เทคโนโลยีอะไรบ้างค่ะ"

## 0:25–0:50 · ภาพรวมสถาปัตยกรรม (A)

> **หน้าจอ:** สไลด์ไดอะแกรม
> `Browser → GitHub Pages (Frontend) → HTTPS/CORS → Render (Docker: Node.js + Express) → SQLite` และ `Stripe ↔ Webhook`

"ระบบแยกเป็น 2 ส่วน
**Frontend** เป็นไฟล์ static อยู่บน **GitHub Pages**
**Backend** เป็น REST API ที่รันใน **Docker container บน Render** ที่สิงคโปร์
ทั้งหมดเขียนด้วย **JavaScript** ภาษาเดียวทั้ง front และ back"

## 0:50–1:30 · Frontend (A) + Demo

> **หน้าจอ:** พิมพ์ "เบรกมีเสียงดัง" ในช่องค้นหา → modal SmartFit AI ขึ้นผลพร้อม % ความมั่นใจ

"Frontend ใช้ **HTML, CSS และ Vanilla JavaScript** ไม่ใช้ framework
ทำเป็น **Single Page Application** เปลี่ยนหน้าด้วย hash routing เลยโหลดเร็ว
มี Dark/Light mode ด้วย CSS variables และเป็น responsive รองรับมือถือ
การคุยกับ backend รวมไว้ในไฟล์ `ai-service.js` ไฟล์เดียว ซึ่งจะเลือก URL ของ API ให้อัตโนมัติ
ถ้าเปิดจาก GitHub Pages จะยิงไป Render แต่ถ้ารันในเครื่องจะใช้ server เดียวกัน
ตอนนี้ลองพิมพ์อาการ 'เบรกมีเสียงดัง' ระบบส่งไปให้ SmartFit AI วิเคราะห์ แล้วตอบว่าน่าจะเป็นผ้าเบรก 85% ค่ะ"

## 1:30–2:15 · Backend + Database + Index (B)

> **หน้าจอ:** โค้ด `server.js` (รายการ route) และ `database.js` (บรรทัด CREATE INDEX)

"ฝั่ง Backend ใช้ **Node.js กับ Express** ทำ **REST API** ทั้ง products, vehicles, orders, admin และ AI
ฐานข้อมูลใช้ **SQLite** เก็บผู้ใช้ รถ สินค้า คำสั่งซื้อ และประวัติซ่อมบำรุง
เราใส่ **Index** ให้ column ที่ query บ่อย เช่น `user_id` ของรถและคำสั่งซื้อ
พิสูจน์ด้วย `EXPLAIN QUERY PLAN` ว่าเปลี่ยนจาก **SCAN ทั้งตาราง** เป็น **SEARCH USING INDEX**
และมี **Unique partial index** บน Stripe session กันการตัดเงินซ้ำ
ตอนจองสต็อกใช้ **Transaction** ถ้าของไม่พอจะ rollback ทั้งออเดอร์ จึงไม่มีการขายเกินสต็อกครับ"

## 2:15–2:45 · Security + Payment + AI (B)

"ด้าน **ความปลอดภัย**: รหัสผ่าน hash ด้วย **scrypt + salt**
login แล้วได้ token ที่เซ็นด้วย **HMAC-SHA256** และเทียบแบบ timing-safe
แยกสิทธิ์ customer กับ admin และเปิด **CORS** ให้เฉพาะโดเมน GitHub Pages ของเรา
**การชำระเงิน** ใช้ **Stripe Checkout** แล้วยืนยันผลผ่าน **Webhook** ที่ตรวจ signature
ส่วน **SmartFit AI** เป็น **rule-based engine** วิเคราะห์อาการจาก keyword และเช็กความเข้ากันได้จาก ยี่ห้อ-รุ่น-ปี-เครื่องยนต์ ของรถใน Garage ครับ"

## 2:45–3:30 · DevOps: Docker + CI/CD (A)

> **หน้าจอ:** แท็บ GitHub Actions → run สีเขียว: `test ✓ → deploy ✓`

"ด้าน **DevOps** เราใช้ **Docker**
มี `docker-compose` ที่รัน 2 container คือ API กับ **Nginx** ซึ่งทำ reverse proxy และมี healthcheck
Dockerfile ใช้ **multi-stage build** ทำให้ image เล็ก
**CI/CD** ใช้ **GitHub Actions** ทุกครั้งที่ push ขึ้น `main`
job แรก **test** จะติดตั้ง package ตรวจ syntax และรัน **unit/API test ด้วย node:test**
ถ้าผ่าน job **deploy** ถึงจะ build แล้วขึ้น **GitHub Pages** อัตโนมัติ
ถ้า test พัง เว็บจริงจะไม่ถูกแตะเลย
ฝั่ง backend ใช้ `render.yaml` แบบ **Infrastructure as Code** ให้ Render build Docker ใหม่ทุก commit และเช็ก `/api/health` ค่ะ"

## 3:30–3:45 · ปิด (B)

"สรุปครับ AutoFixAI ใช้ **JavaScript ทั้งระบบ, Express REST API, SQLite พร้อม Index, Stripe, Docker และ CI/CD ด้วย GitHub Actions**
ทำให้ได้เว็บที่ deploy อัตโนมัติ ปลอดภัย และขยายต่อได้
ขอบคุณครับ"

---

## Tech Stack สรุป (ใช้ทำสไลด์ 1 หน้า)

| ชั้น | เทคโนโลยี |
|---|---|
| Frontend | HTML5, CSS3 (variables, responsive), Vanilla JS SPA |
| Backend | Node.js, Express.js, REST API |
| Database | SQLite + Index + Transaction |
| Security | scrypt, HMAC-SHA256 token, Role-based access, CORS |
| Payment | Stripe Checkout + Webhook signature |
| AI | Rule-based SmartFit (symptom → part, vehicle compatibility) |
| Container | Docker (multi-stage), Docker Compose, Nginx reverse proxy |
| Hosting | GitHub Pages (frontend), Render (backend, Singapore) |
| CI/CD | GitHub Actions: test (npm ci, check, node:test) → deploy |

## Checklist ก่อนอัดวิดีโอ

- [ ] เข้า Render ก่อนอัด ~1 นาที (free plan หลับ ถ้าเปิดครั้งแรกจะช้า 30-50 วินาที)
- [ ] login admin ในหน้า "จัดการร้าน" แล้วใส่จำนวนสต็อก (ตอนนี้ทุกชิ้นขึ้น "หมดสต็อก")
- [ ] เปิดแท็บ GitHub Actions ให้เห็น run ล่าสุดเป็นสีเขียว (test → deploy)
- [ ] จับเวลาซ้อม ให้ไม่เกิน 4:00
