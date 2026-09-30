# TuXianDB

Web tra cứu nhân vật truyện tu tiên. Mọi thông tin gắn với khoảng chương, nên người đọc chỉ thấy những gì đã xảy ra tới chương họ đang đọc.

- **Web:** Next.js 16 (App Router) + Postgres. Giao diện "mực loang", dùng asset của [Shuimo UI](https://github.com/shuimo-design/shuimo-ui) (MIT).
- **Pipeline:** script TypeScript gọi Claude qua Batch API. Pipeline biến text chương thành nhân vật, bí danh, cảnh giới, thế lực và quan hệ theo khoảng chương.
- **Kiểm duyệt:** trang `/admin`. Người duyệt "đóng dấu" fact; fact đã đóng dấu hiện dấu son 验 trên trang public.

## Chạy local

```bash
cp .env.example .env         # đặt ADMIN_PASSWORD
npm install
npm run db:up                # Postgres trong Docker, cổng 5433
npm run db:seed              # schema + dữ liệu MẪU (có banner "dữ liệu mẫu")
npm run dev                  # http://localhost:3000
```

Admin ở `/admin`, đăng nhập bằng `ADMIN_USER` / `ADMIN_PASSWORD`.

## Chặn spoiler hoạt động thế nào

- Chương đang đọc được lưu trong cookie `ch_<truyện>`, riêng cho từng truyện. Link không mang theo số chương, nên chia sẻ link không làm lộ spoiler cho người nhận.
- Server render đủ dữ liệu, còn phần nằm sau chương đang đọc thì bị làm mờ. Người đọc và Googlebot nhận cùng một HTML.
- Người đọc chưa chọn chương thì mọi thứ trừ tiểu truyện bị che, và hộp "Đạo hữu đọc tới đâu rồi?" tự mở.
- Title và meta description chỉ lấy từ tiểu truyện, là phần viết từ lần xuất hiện đầu tiên. Vì vậy kết quả Google không lộ kết cục.
- Một quan hệ kết thúc sau chương đang đọc được hiển thị như vẫn còn. Thứ tự sắp xếp và mật độ xuất hiện chỉ tính tới chương đang đọc.
- Search không trả về tên nhân vật hoặc bí danh xuất hiện sau chương đang đọc, chỉ trả về số lượng kết quả bị ẩn.
- Mọi luật nằm trong `lib/spoiler.ts` và `lib/profile.ts`, có test trong `test/`.

## Pipeline cho một truyện thật

Text truyện là thứ **bạn tự cung cấp** từ nguồn hợp pháp. Không commit và không deploy text: `data/raw/` và `data/work/` đã nằm trong `.gitignore`.

1. **Cấu hình truyện:** `data/novels/<slug>.json` gồm tên, thang cảnh giới, nhân vật chính, và `name_overrides` cho tên đã quen dùng. Có sẵn mẫu Phàm Nhân Tu Tiên.
2. **Text:** đặt vào `data/raw/<slug>/`, dạng một file `.txt` mỗi chương, hoặc một file lớn có tiêu đề `第…章`.
3. Chạy lần lượt:

```bash
npm run pipeline:ingest  -- <slug>                               # tách chương -> data/work/<slug>/chapters.jsonl
npm run pipeline:extract -- submit <slug> --to 50 --dry-run      # đếm token, ước tính chi phí
npm run pipeline:extract -- submit <slug> --to 50                # chạy thử 50 chương
npm run pipeline:extract -- collect <slug>                       # tải kết quả (chạy lại tới khi xong)
npm run pipeline:eval    -- <slug>                               # so với gold set, cần data/gold/<slug>/<n>.json
npm run pipeline:extract -- submit <slug>                        # cả truyện, khi eval đạt ngưỡng
npm run pipeline:extract -- collect <slug>
npm run pipeline:build   -- <slug>                               # nạp DB (chưa public)
npm run pipeline:build   -- <slug> --publish                     # bật truyện lên site
```

- **Model:** mặc định `claude-opus-5-5`, effort `medium`. Đổi qua `PIPELINE_MODEL` / `PIPELINE_EFFORT`. Chỉ đổi sang model rẻ hơn khi `pipeline:eval` cho thấy vẫn giữ được ngưỡng chất lượng.
- **Chạy lại an toàn:**
  - `submit` bỏ qua chương đã có kết quả, nên chạy lại chính là retry các chương lỗi.
  - `build` không ghi đè fact người duyệt đã đóng dấu hoặc bác bỏ.
- **Refusal:** Batch API không hỗ trợ server-side fallback. Chương bị từ chối được ghi vào `failed.json`.
- **Tên tiếng Việt:** chuyển tất định từ `data/hanviet.json`. Chữ Hán nào không có âm được liệt kê trong `data/work/<slug>/missing-readings.txt`; bổ sung bằng `name_overrides`.
- **Gộp bí danh:**
  - Nhân vật mà text thường xuyên gọi bằng tên của một nhân vật lớn hơn thì được gộp vào nhân vật đó (ví dụ 韩老魔 → 韩立).
  - Bí danh dùng chung cho nhiều người được đưa vào tab "Gộp bí danh" trong admin.
- **Fact bị gắn cờ:** cảnh giới đi lùi, hoặc nhân vật đã chết mà vẫn còn xuất hiện, thì fact đó bị ẩn và đứng đầu hàng đợi duyệt.

## Deploy (Vercel + Neon, hoặc tương đương)

1. Tạo Postgres (Neon) và lấy **pooled** connection string.
2. Đặt biến môi trường: `DATABASE_URL`, `SITE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `REPORT_SALT`.
3. `npm run db:migrate` với `DATABASE_URL` của production. Schema idempotent, chạy lại lúc nào cũng được.
4. Chạy pipeline ở máy local, trỏ `DATABASE_URL` vào production. Pipeline không chạy trên server web.
5. Theo dõi uptime qua `/api/health`.

**Không** chạy `db:seed` trên production. Nếu lỡ chạy, bước `pipeline:build` của truyện đó sẽ tự xoá dữ liệu mẫu.

## Kiểm thử

```bash
npm run typecheck
npm test            # luật spoiler, gộp tên, khoảng chương, Hán Việt, validate báo sai
npm run test:db     # ingest + build trên Postgres thật, dùng truyện giả "zz-fixture"
npm run build
```

CI (`.github/workflows/ci.yml`) chạy cả bốn lệnh trên.

## Checklist trước khi launch (theo kế hoạch sản phẩm)

- [ ] Chốt nguồn text hợp pháp, và có luật sư xem điều khoản
- [ ] Gold set 30 chương: fact precision ≥ 95%, recall ≥ 80% (`pipeline:eval`)
- [ ] 200 nhân vật xuất hiện nhiều nhất đã đóng dấu hết (xem số liệu trên `/admin`)
- [ ] Có trang "Liên hệ bản quyền" và quy trình gỡ bỏ
- [ ] `ADMIN_PASSWORD` mạnh, `SITE_URL` đúng domain, `/api/health` được giám sát

## Giới hạn đã biết (có chủ đích)

- **Tìm kiếm:** dùng `LIKE` trên bảng alias. Khi bảng vượt vài trăm nghìn dòng, thêm `pg_trgm`.
- **Admin:** chỉ một tài khoản basic auth. Khi có nhiều người duyệt, chuyển sang Auth.js.
- **Cache:** chưa có, mỗi request đọc DB trực tiếp (khoảng 4 query song song cho trang hồ sơ). Thêm cache khi traffic cần.
- **Thế lực và địa danh:** chưa có trang riêng, mới chỉ hiện như giá trị của fact.
- **Hộp chọn chương:** chưa có tab "Theo ký ức". Câu hỏi kiểu "bạn đọc tới đoạn X chưa?" luôn làm lộ sự kiện X.
- **Donghua:** chưa hỗ trợ chọn chương theo tập phim.

## License và nguồn dữ liệu

- Asset thủy mặc (giấy, núi, viền cọ, khung, giọt mực, vòng son): Shuimo UI, MIT. Xem `LICENSES/shuimo-ui.txt`. Bản cho nền tối và texture mực loang được tạo từ `scripts/data/inkgen.py`.
- `data/hanviet.json` được tạo từ [hanviet-pinyin-wordlist](https://github.com/ph0ngp/hanviet-pinyin-wordlist) (MIT, `LICENSES/hanviet-pinyin-wordlist.txt`) và Unicode Unihan (`LICENSES/unicode.txt`), bằng `scripts/data/build_hanviet.py`.
- Font: Google Fonts, license OFL, được self-host qua `next/font`.
