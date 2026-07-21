import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration env variables.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function sendTelegramBatchAlert(messageText: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_EXPIRATION_THREAD_ID;

  if (!token || !chatId) {
    console.error("Thiếu cấu hình Telegram Bot Token hoặc Chat ID trong biến môi trường.");
    return false;
  }

  try {
    const payload: any = {
      chat_id: chatId,
      parse_mode: "HTML",
      text: messageText,
    };

    if (threadId) {
      payload.message_thread_id = threadId;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Telegram API error (HTTP ${res.status}): ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn Telegram:", error);
    return false;
  }
}

export async function GET(request: Request) {
  return handleCheck(request);
}

export async function POST(request: Request) {
  return handleCheck(request);
}

async function handleCheck(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {

    const supabaseAdmin = getSupabaseAdmin();

    // Tính toán ngày mai theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
    const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const vnTomorrow = new Date(vnNow);
    vnTomorrow.setDate(vnTomorrow.getDate() + 1);

    const yyyy = vnTomorrow.getFullYear();
    const mm = String(vnTomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(vnTomorrow.getDate()).padStart(2, '0');
    
    const tomorrowDbStr = `${yyyy}-${mm}-${dd}`; // Định dạng YYYY-MM-DD để query Supabase
    const tomorrowDisplayStr = `${dd}/${mm}/${yyyy}`; // Định dạng dd/mm/yyyy hiển thị trên báo cáo

    // 2. Fetch tất cả licenses hết hạn đúng ngày mai
    const { data: licenses, error: fetchError } = await supabaseAdmin
      .from("ai_licenses")
      .select("*")
      .eq("expiration_date", tomorrowDbStr);

    if (fetchError) {
      console.error("Lỗi fetch licenses trong cron check-expiration:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!licenses || licenses.length === 0) {
      return NextResponse.json({ success: true, message: `Không có license nào hết hạn ngày mai (${tomorrowDbStr})` });
    }

    // 3. Lọc theo Business Logic:
    // - Label/Tag: "Công ty" (plan_name không chứa "(Cá nhân)")
    // - Cost: > 0 (monthly_cost > 0)
    const companyLicenses = licenses.filter((lic) => {
      const isPersonal = lic.plan_name && lic.plan_name.includes("(Cá nhân)");
      const hasCost = lic.monthly_cost && lic.monthly_cost > 0;
      return !isPersonal && hasCost;
    });

    if (companyLicenses.length === 0) {
      return NextResponse.json({ success: true, message: `Không có license Công ty có phí nào hết hạn ngày mai (${tomorrowDbStr})` });
    }

    // 4. Build batched Telegram message
    const lines: string[] = [];
    companyLicenses.forEach((lic) => {
      const costFormatted = lic.monthly_cost.toLocaleString("vi-VN");
      lines.push(`- <code>${lic.email}</code> (Công cụ: ${lic.ai_tool} - Gói: ${lic.plan_name}) - Chi phí: ${costFormatted} VNĐ`);
    });

    const messageText = `⚠️ <b>BÁO CÁO SẮP HẾT HẠN BẢN QUYỀN AI</b>\n\n⏳ <b>CÁC TÀI KHOẢN SẼ HẾT HẠN VÀO NGÀY MAI (${tomorrowDisplayStr}):</b>\n${lines.join("\n")}\n\n👉 Đề nghị bộ phận liên quan chuẩn bị gia hạn để không gián đoạn dịch vụ!`;

    // 5. Gửi báo cáo qua Telegram
    const sent = await sendTelegramBatchAlert(messageText);

    return NextResponse.json({
      success: true,
      message: `Đã xử lý check-expiration thành công cho ngày mai ${tomorrowDbStr}`,
      telegramSent: sent,
      checkedCount: companyLicenses.length,
    });
  } catch (error: any) {
    console.error("Lỗi trong API check-expiration:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
