# Indexing Lab — คำตอบ

ชื่อ: Phattharawadee Chokwisitkul | รหัสนิสิต: 67160361

ชื่อ: ภาณัฏฐ์ศญา โชติ | รหัสนิสิต: 67160173

> ช่อง `____ ms` ให้กรอกเวลาจริงจาก `EXPLAIN ANALYZE` บนเครื่องตัวเอง (บรรทัด `Execution Time`)

## LAB 06 — Workshop (รันบน pg_with_index)

### โจทย์ 1: ออกแบบ index ให้ query ที่ช้า

```sql
-- ก่อน: จด Execution Time = ____ ms
EXPLAIN ANALYZE
SELECT transaction_date, sum(amount)
FROM transactions
WHERE status = 'pending' AND transaction_date >= '2026-09-01'
GROUP BY transaction_date
ORDER BY transaction_date;

-- สร้าง composite index: column ที่เทียบด้วย "=" ไว้ซ้าย, column ที่เป็น "ช่วง" ไว้ขวา
CREATE INDEX idx_tx_status_date ON transactions (status, transaction_date) INCLUDE (amount);
ANALYZE transactions;

-- หลัง: จด Execution Time = ____ ms
EXPLAIN ANALYZE
SELECT transaction_date, sum(amount)
FROM transactions
WHERE status = 'pending' AND transaction_date >= '2026-09-01'
GROUP BY transaction_date
ORDER BY transaction_date;

DROP INDEX idx_tx_status_date;  -- คืนค่าตามโจทย์
```

เหตุผล
- `status = 'pending'` เป็นเงื่อนไขเท่ากับ จึงวางไว้ซ้ายสุดตาม Leftmost rule แล้วต่อด้วย `transaction_date` ที่เป็นช่วง ทำให้ index ตัดแถวได้ทั้ง 2 เงื่อนไขพร้อมกัน
- แถวใน index เรียงตาม `transaction_date` อยู่แล้ว (เมื่อ status คงที่) จึงช่วยลดงาน `GROUP BY` / `ORDER BY`
- `INCLUDE (amount)` ทำให้ได้ **Index Only Scan** ไม่ต้องกลับไปอ่าน table
- ถ้าใช้แค่ `idx_tx_date` เดิม ฐานข้อมูลต้องอ่านทุกแถวตั้งแต่ 1 ก.ย. (ทุกสถานะ) แล้วค่อยกรอง `status` ทิ้งประมาณ 80%
- สิ่งที่ควรเห็นใน plan: ก่อน = `Seq Scan` หรือ `Bitmap Heap Scan on idx_tx_date` + `Filter: status`, หลัง = `Index Only Scan using idx_tx_status_date`

### โจทย์ 2: ลูกค้า 5 อันดับที่ยอดสูงสุดในเดือน 2026-08

```sql
EXPLAIN ANALYZE
SELECT customer_id, sum(amount) AS total
FROM transactions
WHERE transaction_date >= '2026-08-01'
  AND transaction_date <  '2026-09-01'
  AND status = 'paid'            -- นับเฉพาะยอดที่จ่ายแล้ว (ถ้าโจทย์ต้องการทุกสถานะให้ลบบรรทัดนี้)
GROUP BY customer_id
ORDER BY total DESC
LIMIT 5;
```

index ที่ถูกใช้: **`idx_tx_date`** (`Bitmap Index Scan on idx_tx_date`) เพราะเงื่อนไขที่ตัดข้อมูลได้มากที่สุดคือช่วงวันที่ 1 เดือน (ประมาณ 8.5% ของ 1 ล้านแถว)
ส่วน `idx_tx_customer` ไม่ถูกใช้ เพราะ query ไม่ได้กรองด้วย `customer_id` แต่ใช้ group อย่างเดียว

### โจทย์ 3: แก้ query ให้ใช้ index ได้ (ห้ามสร้าง index เพิ่ม)

```sql
-- เดิม: to_char(transaction_date, ...) ครอบ column ไว้ ทำให้ index ใช้ไม่ได้ -> Seq Scan
-- แก้: เปลี่ยนเป็นช่วงวันที่ตรง ๆ (sargable)
EXPLAIN ANALYZE
SELECT * FROM transactions
WHERE transaction_date >= '2026-08-01'
  AND transaction_date <  '2026-09-01';
```

เหตุผล: index เก็บค่า `transaction_date` ดิบ ถ้าเอาฟังก์ชันไปครอบ column ฐานข้อมูลต้องคำนวณ `to_char()` ทุกแถวก่อนเทียบ จึงต้อง Seq Scan
เมื่อเขียนเป็นช่วง `>= ... AND < ...` ฐานข้อมูลจะกระโดดเข้า `idx_tx_date` ได้ทันที
ก่อน = ____ ms (Seq Scan) / หลัง = ____ ms (Bitmap/Index Scan on idx_tx_date)

## LAB 07 — ทำไมไม่ทำ index ทุก column

| ข้อสังเกต | คำอธิบาย |
|---|---|
| Cardinality | `customer_id` (~10,000 ค่า) และ `transaction_date` (~366 ค่า) เลือกได้แคบ จึงคุ้มทำ index ส่วน `status` มีแค่ 3 ค่า ตอบกลับทีละ 20-60% ของ table ฐานข้อมูลมักเลือก Seq Scan อยู่ดี |
| INSERT ช้าลง | มี 2 index ≈ ____ s, ทำครบทุก column ≈ ____ s เพราะทุก INSERT ต้องเขียนลงทุก index |
| พื้นที่ | index ทุก column รวมกันอาจใหญ่เกือบเท่าหรือมากกว่าตัว table |
| index ที่ไม่ถูกใช้ | ดูจาก `pg_stat_user_indexes` ถ้า `idx_scan = 0` เป็นภาระเปล่า ควร DROP |

สรุป: ทำ index เฉพาะ column ที่อยู่ใน `WHERE` / `JOIN` / `ORDER BY` บ่อย และมีค่าหลากหลาย

## นำไปใช้กับโปรเจค AutoFixAI (SQLite)

| Index | ใช้กับ query |
|---|---|
| `idx_orders_user_created (user_id, created_at DESC)` | ประวัติคำสั่งซื้อของลูกค้า |
| `idx_orders_stripe_session` (UNIQUE, partial) | Stripe webhook หา order จาก session id และกันจ่ายซ้ำ |
| `idx_vehicles_user (user_id)` | รายการรถใน Garage |
| `idx_maintenance_user_date (user_id, service_date DESC)` | ประวัติการซ่อมบำรุง |

ตรวจด้วย `EXPLAIN QUERY PLAN` แล้ว จาก `SCAN vehicles` (อ่านทั้ง table) เปลี่ยนเป็น `SEARCH vehicles USING INDEX idx_vehicles_user (user_id=?)`
