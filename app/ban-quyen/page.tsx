import type { Metadata } from 'next'
import { SiteHeader } from '@/components/SiteHeader.tsx'

export const metadata: Metadata = { title: 'Bản quyền và đóng góp' }

export default function Copyright() {
  const email = process.env.CONTACT_EMAIL ?? '[email liên hệ]'
  return (
    <div className="page">
      <SiteHeader />
      <main className="wrap above" style={{ maxWidth: 820, paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 16, lineHeight: 1.65 }}>
        <h1 className="display" style={{ fontSize: 44 }}>Bản quyền và đóng góp</h1>
        <h2 className="display" style={{ fontSize: 28 }}>TuXianDB lưu gì</h2>
        <p style={{ margin: 0 }}>Chúng tôi chỉ hiển thị thông tin dạng dữ kiện (tên, quan hệ, cảnh giới, số chương) và các câu tóm tắt tự viết. Chúng tôi không đăng nội dung chương truyện.</p>
        <h2 className="display" style={{ fontSize: 28 }}>Tranh</h2>
        <p style={{ margin: 0 }}>Mọi tranh họa sĩ đều do chính tác giả gửi, kèm giấy phép tác giả chọn, và luôn ghi tên tác giả. Tranh ghi “Tranh AI minh họa” được tạo bằng AI từ mô tả chữ trong truyện, và sẽ được thay khi có tranh của họa sĩ.</p>
        <h2 className="display" style={{ fontSize: 28 }}>Yêu cầu gỡ bỏ</h2>
        <p style={{ margin: 0 }}>
          Nếu bạn là chủ sở hữu và thấy nội dung vi phạm quyền của mình, hãy gửi email tới <b>{email}</b>. Email cần có đường dẫn tới trang, mô tả tác phẩm gốc, và thông tin liên hệ của bạn. Chúng tôi xử lý trong 5 ngày làm việc. Nội dung bị gỡ ngừng hiển thị ngay, và bộ nhớ đệm hết hạn trong vòng 24 giờ.
        </p>
      </main>
    </div>
  )
}
