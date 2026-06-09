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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-linear-to-r from-indigo-600/20 via-slate-900 to-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">🚀 Cài đặt Markee AI Tracker</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-6">
            {/* Intro */}
            <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <p className="text-slate-300 text-sm leading-relaxed">
                Chào mừng bạn đến với <span className="font-bold text-indigo-400">Markee AI Tracker</span>! 
                Đây là tiện ích giúp bạn lưu lại những câu lệnh hay nhất khi dùng AI và tự động ghi nhận đóng góp vào Thư viện chung. 
                Chỉ mất đúng <span className="font-bold text-white">2 phút</span> để cài đặt theo các bước dưới đây!
              </p>
            </div>

            {/* Download Button - Highlighted */}
            <div className="mb-8">
              <a
                href="https://drive.google.com/drive/u/0/folders/13nCYPip0tbEX-sdEWEFCr0cck4dV3vON"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all hover:shadow-lg hover:shadow-emerald-500/30 group"
              >
                <Download className="w-5 h-5 group-hover:animate-bounce" />
                <span>📥 Tải Extension từ Google Drive</span>
                <ExternalLink className="w-4 h-4 opacity-60" />
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-700">
              <button
                onClick={() => setActiveTab('install')}
                className={`px-4 py-2 font-medium transition-all ${
                  activeTab === 'install'
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                📦 Cài đặt
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-2 font-medium transition-all ${
                  activeTab === 'usage'
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                🚀 Sử dụng
              </button>
              <button
                onClick={() => setActiveTab('support')}
                className={`px-4 py-2 font-medium transition-all ${
                  activeTab === 'support'
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                🆘 Hỗ trợ
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'install' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-400 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                    Giải nén file
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                    <p className="text-slate-300 text-sm">✓ Tìm file vừa tải về (thường nằm ở thư mục Downloads)</p>
                    <p className="text-slate-300 text-sm">✓ Nhấn chuột phải → Chọn <span className="font-mono bg-slate-700 px-2 py-1 rounded text-xs">Extract Here</span></p>
                    <p className="text-slate-300 text-sm">✓ Bạn sẽ nhận được một thư mục chứa mã nguồn (Lưu ý vị trí thư mục này)</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-400 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                    Truy cập Chrome Extensions
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                    <p className="text-slate-300 text-sm">✓ Mở Google Chrome</p>
                    <p className="text-slate-300 text-sm">✓ Copy và dán vào thanh địa chỉ: <span className="font-mono bg-slate-700 px-2 py-1 rounded text-xs">chrome://extensions/</span></p>
                    <p className="text-slate-300 text-sm">Hoặc: Bấm biểu tượng 🧩 → Quản lý tiện ích</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-400 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                    Bật Developer Mode <span className="text-red-400 font-bold">⚠️</span>
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                    <p className="text-slate-300 text-sm">✓ Nhìn lên góc trên cùng bên phải trang Extensions</p>
                    <p className="text-slate-300 text-sm">✓ Tìm công tắc <span className="font-bold text-indigo-400">Developer mode</span></p>
                    <p className="text-slate-300 text-sm">✓ <span className="font-bold text-emerald-400">Bật</span> nó (công tắc sẽ chuyển sang màu xanh)</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-indigo-500/20 text-indigo-400 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
                    Tải Extension đã giải nén
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
                    <p className="text-slate-300 text-sm">✓ Bấm nút <span className="font-bold text-indigo-400">Load unpacked</span> ở góc trên bên trái</p>
                    <p className="text-slate-300 text-sm">✓ Chọn thư mục vừa giải nén ở Bước 1</p>
                    <p className="text-slate-300 text-sm">✓ Bấm <span className="font-bold">Select Folder</span></p>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <p className="text-slate-300 text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-px" />
                    <span><span className="font-bold text-white">🎉 Hoàn thành!</span> Biểu tượng Markee AI Tracker đã xuất hiện trên Chrome. Bấm vào biểu tượng 🧩 và nhấn 📌 để ghim nó lại để dễ sử dụng!</span>
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'usage' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Tính năng "Tàng hình": Auto Log
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                    <p className="text-slate-300 text-sm">
                      Khi bạn truy cập ChatGPT, Claude hoặc Gemini và trò chuyện bình thường, Markee sẽ âm thầm chạy ngầm, tự động đếm Token và ghi nhận đóng góp.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Copy className="w-5 h-5 text-indigo-400" />
                    Tính năng "Đúc kết": Lưu Prompt xuất sắc
                  </h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
                    <p className="text-slate-300 text-sm mb-3">
                      Khi bạn có một phiên trò chuyện hay và muốn lưu lại cách làm đó, hãy làm theo 2 bước sau:
                    </p>

                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="shrink-0 bg-indigo-500/20 text-indigo-400 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">1️⃣</div>
                        <div>
                          <p className="text-white font-medium text-sm mb-1">Copy Lệnh Đúc Kết</p>
                          <p className="text-slate-300 text-sm">Bấm Nút 1️⃣ ở bảng điều khiển Markee. Hệ thống sẽ tự động copy một câu lệnh bí mật vào clipboard của bạn.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="shrink-0 bg-indigo-500/20 text-indigo-400 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">2️⃣</div>
                        <div>
                          <p className="text-white font-medium text-sm mb-1">Nhập lệnh vào AI</p>
                          <p className="text-slate-300 text-sm">Nhấp vào ô chat, ấn <span className="font-mono bg-slate-700 px-1.5 py-0.5 rounded text-xs">Ctrl + V</span> để dán và gửi cho AI.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="shrink-0 bg-indigo-500/20 text-indigo-400 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">3️⃣</div>
                        <div>
                          <p className="text-white font-medium text-sm mb-1">Lưu vào Thư viện</p>
                          <p className="text-slate-300 text-sm">Đợi AI gõ xong bảng tóm tắt kỹ năng, bấm Nút 2️⃣. Markee sẽ tự động quét, đóng gói và gửi kỹ năng lên Thư viện công ty.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded p-3 border-l-2 border-emerald-500">
                      <p className="text-emerald-400 text-xs font-semibold mb-1">📥 Thêm một lợi ích</p>
                      <p className="text-slate-300 text-sm">Ngay sau khi lưu thành công, bạn có thể bấm nút 📥 để tải file .md về máy làm tài sản riêng của mình!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-px" />
                    <div>
                      <p className="text-white font-medium text-sm mb-1">❓ Không thấy Bảng điều khiển Markee</p>
                      <p className="text-slate-300 text-sm">Hãy thử tải lại trang web bằng cách nhấn <span className="font-mono bg-slate-700 px-1.5 py-0.5 rounded text-xs">F5</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-px" />
                    <div>
                      <p className="text-white font-medium text-sm mb-1">❓ Lỡ tay tắt Bảng điều khiển</p>
                      <p className="text-slate-300 text-sm">Chỉ cần nhìn lên góc phải trình duyệt, bấm vào biểu tượng Markee để gọi nó ra lại</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex gap-3 items-start">
                    <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-px" />
                    <div>
                      <p className="text-white font-medium text-sm mb-1">❓ Gặp lỗi khi lưu dữ liệu</p>
                      <p className="text-slate-300 text-sm">Hãy liên hệ ngay với phòng IT hoặc quản lý để được hỗ trợ thần tốc nhé!</p>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 mt-6">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    🌟 Chúc bạn có những trải nghiệm làm việc năng suất và đột phá cùng AI! Nếu bạn yêu thích Markee, hãy chia sẻ với đồng nghiệp nhé!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-800/50 border-t border-slate-800 px-6 py-3 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
