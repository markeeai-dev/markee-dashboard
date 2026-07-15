'use client';

import { useState } from 'react';
import {
  X,
  BookOpen,
  Download,
  CheckCircle2,
  Zap,
  Copy,
  Database,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuideModal({ isOpen, onClose }: UserGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'install' | 'usage' | 'support'>('install');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-linear-to-r from-markee-light/5 via-white to-white border-b border-markee-border px-6 py-4 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-markee-primary" />
              <h2 className="text-xl font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">
                🚀 Cài đặt extention Markee AI Tracker
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-6 text-markee-text">
            {/* Intro */}
            <div className="mb-8 p-4 bg-markee-bg border border-markee-border rounded-lg">
              <p className="text-markee-muted text-sm leading-relaxed">
                Chào mừng bạn đến với <span className="font-bold text-markee-primary">Markee AI Tracker</span>!
                Đây là tiện ích giúp bạn lưu lại những câu lệnh hay nhất khi dùng AI và tự động ghi nhận đóng góp vào Thư viện chung.
                Chỉ mất đúng <span className="font-bold text-markee-text">2 phút</span> để cài đặt theo các bước dưới đây!
              </p>
            </div>

            {/* Warning block */}
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 font-bold text-sm leading-relaxed">
              ⚠️ LƯU Ý TỐI QUAN TRỌNG: Tài khoản Google mà bạn dùng để đăng nhập trên Trình duyệt (nơi cài Extension) BẮT BUỘC PHẢI TRÙNG KHỚP với tài khoản Google đang đăng nhập tại Center AI này. Nếu khác tài khoản, dữ liệu sẽ KHÔNG THỂ đồng bộ.
            </div>

            <div className="mb-8">
              <a
                href="https://drive.google.com/uc?export=download&id=1bFRUuE3HIrqDiAxfsZFavpwxyGxwIhhG"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-markee-primary hover:bg-markee-hover text-white font-semibold py-3 px-4 rounded-lg transition-all hover:shadow-lg hover:shadow-markee-primary/30 group"
              >
                <Download className="w-5 h-5 group-hover:animate-bounce" />
                <span>📥 Tải Extension</span>
                <ExternalLink className="w-4 h-4 opacity-60" />
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-markee-border">
              <button
                onClick={() => setActiveTab('install')}
                className={`px-4 py-2 font-medium transition-all ${activeTab === 'install'
                    ? 'text-markee-primary border-b-2 border-markee-primary'
                    : 'text-markee-muted hover:text-markee-text'
                  }`}
              >
                📦 Cài đặt
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-2 font-medium transition-all ${activeTab === 'usage'
                    ? 'text-markee-primary border-b-2 border-markee-primary'
                    : 'text-markee-muted hover:text-markee-text'
                  }`}
              >
                🚀 Sử dụng
              </button>
              <button
                onClick={() => setActiveTab('support')}
                className={`px-4 py-2 font-medium transition-all ${activeTab === 'support'
                    ? 'text-markee-primary border-b-2 border-markee-primary'
                    : 'text-markee-muted hover:text-markee-text'
                  }`}
              >
                🆘 Hỗ trợ
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'install' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <span className="bg-markee-light/10 text-markee-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                    Giải nén file
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-2">
                    <p className="text-markee-muted text-sm">✓ Tìm file vừa tải về (thường nằm ở thư mục Downloads)</p>
                    <p className="text-markee-muted text-sm">✓ Nhấn chuột phải → Chọn <span className="font-mono bg-white border border-markee-border px-2 py-1 rounded text-xs">Extract Here</span></p>
                    <p className="text-markee-muted text-sm">✓ Bạn sẽ nhận được một thư mục chứa mã nguồn (Lưu ý vị trí thư mục này)</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <span className="bg-markee-light/10 text-markee-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                    Truy cập Chrome Extensions
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-2">
                    <p className="text-markee-muted text-sm">✓ Mở Google Chrome</p>
                    <p className="text-markee-muted text-sm">✓ Copy và dán vào thanh địa chỉ: <span className="font-mono bg-white border border-markee-border px-2 py-1 rounded text-xs">chrome://extensions/</span></p>
                    <p className="text-markee-muted text-sm">Hoặc: Bấm biểu tượng 🧩 → Quản lý tiện ích</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <span className="bg-markee-light/10 text-markee-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                    Bật Developer Mode <span className="text-red-600 font-bold">⚠️</span>
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-2">
                    <p className="text-markee-muted text-sm">✓ Nhìn lên góc trên cùng bên phải trang Extensions</p>
                    <p className="text-markee-muted text-sm">✓ Tìm công tắc <span className="font-bold text-markee-primary">Developer mode</span></p>
                    <p className="text-markee-muted text-sm">✓ <span className="font-bold text-markee-primary">Bật</span> nó (công tắc sẽ chuyển sang màu đỏ thương hiệu)</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <span className="bg-markee-light/10 text-markee-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
                    Tải Extension đã giải nén
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-2">
                    <p className="text-markee-muted text-sm">✓ Bấm nút <span className="font-bold text-markee-primary">Load unpacked</span> ở góc trên bên trái</p>
                    <p className="text-markee-muted text-sm">✓ Chọn thư mục vừa giải nén ở Bước 1</p>
                    <p className="text-markee-muted text-sm">✓ Bấm <span className="font-bold">Select Folder</span></p>
                  </div>
                </div>

                <div className="bg-markee-bg border border-markee-border rounded-lg p-4">
                  <p className="text-markee-text text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-markee-primary shrink-0 mt-px" />
                    <span><span className="font-bold">🎉 Hoàn thành!</span> Biểu tượng Markee AI Tracker đã xuất hiện trên Chrome. Bấm vào biểu tượng 🧩 và nhấn 📌 để ghim nó lại để dễ sử dụng!</span>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'usage' && (
              <div className="space-y-6">
                {/* Tính năng 1 */}
                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <Copy className="w-5 h-5 text-purple-600" />
                    Tính năng 1: Đúc kết Kỹ năng (Lưu Workflow)
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-4">
                    <p className="text-markee-muted text-sm mb-3">
                      Khi bạn có một chuỗi lệnh hay và muốn lưu thành Kỹ năng cho toàn công ty học hỏi:
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">1</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Copy Lệnh</p>
                          <p className="text-markee-muted text-sm">Bấm nút <span className="font-bold text-purple-600">[Lệnh Kỹ Năng]</span> màu tím trên Extension để copy câu lệnh mồi.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">2</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Ra lệnh cho AI</p>
                          <p className="text-markee-muted text-sm">Dán (<span className="font-mono bg-white border border-markee-border px-1.5 py-0.5 rounded text-xs">Ctrl + V</span>) vào khung chat và gửi cho AI.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">3</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Lưu Kỹ năng</p>
                          <p className="text-markee-muted text-sm">Đợi AI tóm tắt xong, bấm nút <span className="font-bold text-green-600">[Lưu Kỹ Năng]</span> màu xanh lá. Hệ thống sẽ tự động đóng gói và đẩy lên Thư viện Kỹ năng.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tính năng 2 */}
                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-orange-500" />
                    Tính năng 2: Ghi nhận Tiến độ (Lưu WIP)
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-4">
                    <p className="text-markee-muted text-sm mb-3">
                      Khi bạn vừa hoàn thành một task và muốn báo cáo tiến độ/tri thức nhanh cho dự án:
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">1</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Copy Lệnh</p>
                          <p className="text-markee-muted text-sm">Bấm nút <span className="font-bold text-orange-500">[Lệnh Tóm Tắt]</span> màu cam trên Extension.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">2</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Cung cấp dữ liệu</p>
                          <p className="text-markee-muted text-sm">Dán vào khung chat, ghi thêm vài dòng tóm tắt công việc bạn vừa làm rồi gửi cho AI.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-markee-light/10 text-markee-primary rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">3</div>
                        <div>
                          <p className="text-markee-text font-medium text-sm mb-1">Lưu Tiến độ</p>
                          <p className="text-markee-muted text-sm">Đợi AI viết báo cáo chuẩn form, bấm nút <span className="font-bold text-orange-500">[Lưu Tóm Tắt]</span> màu cam. Dữ liệu sẽ được đẩy vào Lịch sử Dự án.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tính năng 3 */}
                <div>
                  <h3 className="text-lg font-bold text-markee-text mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    Tính năng 3: Theo dõi Token tự động
                  </h3>
                  <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4 space-y-3">
                    <p className="text-markee-muted text-sm flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span>Hệ thống sẽ <span className="font-bold text-markee-text">tự động chạy ngầm</span> để đếm số Token bạn đã sử dụng sau mỗi phiên chat.</span>
                    </p>
                    <p className="text-markee-muted text-sm flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span>
                        Đồng thời, tiện ích sẽ tự động đồng bộ <span className="font-bold text-markee-text">Hạn mức tuần (% Usage)</span> của các tài khoản (Claude/Gemini) lên Dashboard. Việc này giúp bạn quản lý tập trung, đồng thời <span className="font-bold text-markee-text">giúp Admin kịp thời nắm bắt để gia hạn hoặc cấp thêm tài nguyên</span> ngay khi bạn sắp hết hạn mức, đảm bảo công việc không bị gián đoạn!
                      </span>
                    </p>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-4">
                <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-markee-primary shrink-0 mt-px" />
                    <div>
                      <p className="text-markee-text font-medium text-sm mb-1">❓ Không thấy Bảng điều khiển Markee</p>
                      <p className="text-markee-muted text-sm">Hãy thử tải lại trang web bằng cách nhấn <span className="font-mono bg-white border border-markee-border px-1.5 py-0.5 rounded text-xs">F5</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-markee-primary shrink-0 mt-px" />
                    <div>
                      <p className="text-markee-text font-medium text-sm mb-1">❓ Lỡ tay tắt Bảng điều khiển</p>
                      <p className="text-markee-muted text-sm">Chỉ cần nhìn lên góc phải trình duyệt, bấm vào biểu tượng Markee để gọi nó ra lại</p>
                    </div>
                  </div>
                </div>

                <div className="bg-markee-bg/50 border border-markee-border rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-markee-primary shrink-0 mt-px" />
                    <div>
                      <p className="text-markee-text font-medium text-sm mb-1">❓ Gặp lỗi khi lưu dữ liệu</p>
                      <p className="text-markee-muted text-sm">Hãy liên hệ ngay với phòng IT hoặc quản lý để được hỗ trợ thần tốc nhé!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-markee-bg border border-markee-border rounded-lg p-4 mt-6">
                  <p className="text-markee-text text-sm leading-relaxed">
                    🌟 Chúc bạn có những trải nghiệm làm việc năng suất và đột phá cùng AI! Nếu bạn yêu thích Markee, hãy chia sẻ với đồng nghiệp nhé!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-markee-bg border-t border-markee-border px-6 py-3 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-markee-border bg-white text-markee-text hover:bg-markee-bg rounded-lg transition-colors text-sm font-medium cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}