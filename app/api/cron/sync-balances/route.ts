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

async function sendTelegramAlert(appName: string, balance: number, limit: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID;

  if (!token || !chatId) {
    console.error("Thiếu cấu hình Telegram Bot Token hoặc Chat ID trong biến môi trường.");
    return;
  }

  const usagePercent = limit > 0 ? ((limit - balance) / limit) * 100 : 0;
  
  const text = `⚠️ <b>CẢNH BÁO SẮP CẠN SỐ DƯ API</b> ⚠️\n\nỨng dụng: <b>${appName}</b>\nHạn mức còn lại: <code>$${balance.toFixed(2)}</code> (~ ${(balance * 3250).toLocaleString('vi-VN')}đ)\nTổng ngân sách cấp: <code>$${limit.toFixed(2)}</code> (~ ${(limit * 3250).toLocaleString('vi-VN')}đ)\nTỷ lệ sử dụng: <b>${usagePercent.toFixed(1)}%</b>\n\n🔴 <i>Vui lòng nạp thêm ngân sách tại ShopAIKey để tránh gián đoạn dịch vụ AI.</i>`;

  try {
    const payload: any = {
      chat_id: chatId,
      parse_mode: "HTML",
      text: text,
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
    } else {
      console.log(`Đã gửi cảnh báo Telegram thành công cho app: ${appName}`);
    }
  } catch (error) {
    console.error("Lỗi khi kết nối gửi tin nhắn Telegram:", error);
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {

    const supabaseAdmin = getSupabaseAdmin();

    // 2. Lấy tất cả apps
    const { data: apps, error: appsError } = await supabaseAdmin
      .from("apps")
      .select("*");

    if (appsError) {
      console.error("Lỗi lấy danh sách apps trong cronjob:", appsError);
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({ success: true, message: "Không có app nào để đồng bộ", results: [] });
    }

    // Lấy ngày động
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const startDate = `${currentYear}-01-01`;
    const endDate = todayStr;

    const results = [];

    // 3. Lặp qua từng app để đồng bộ số dư ShopAIKey
    for (const app of apps) {
      const key = app.secret_key;
      if (!key || !key.trim()) {
        results.push({ app_id: app.id, app_name: app.name, status: "skipped", reason: "Secret Key rỗng" });
        continue;
      }

      try {
        // API 1: Lấy billing subscription
        const subRes = await fetch("https://api.shopaikey.com/v1/dashboard/billing/subscription", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
          },
          cache: "no-store",
        });

        if (!subRes.ok) {
          throw new Error(`Billing API error (HTTP ${subRes.status})`);
        }

        const subData = await subRes.json();
        const hardLimitUsdRaw = Number(subData.hard_limit_usd || 0);
        const hardLimitUsd = Math.round(hardLimitUsdRaw * 100) / 100;

        // API 2: Lấy usage
        const usageRes = await fetch(
          `https://api.shopaikey.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${key}`,
            },
            cache: "no-store",
          }
        );

        if (!usageRes.ok) {
          throw new Error(`Usage API error (HTTP ${usageRes.status})`);
        }

        const usageData = await usageRes.json();
        const totalUsageCents = Number(usageData.total_usage || 0);
        const totalUsedUsd = Math.round((totalUsageCents / 100) * 100) / 100;

        // Tính toán số dư
        const balanceUsd = Math.round((hardLimitUsd - totalUsedUsd) * 100) / 100;
        const status = balanceUsd > 0 ? "active" : "depleted";

        // Logic Cảnh báo Telegram số dư thấp (còn lại <= 10%)
        let isLowBalanceAlerted = app.is_low_balance_alerted || false;
        
        if (hardLimitUsd > 0 && balanceUsd <= hardLimitUsd * 0.1) {
          if (!isLowBalanceAlerted) {
            await sendTelegramAlert(app.name, balanceUsd, hardLimitUsd);
            isLowBalanceAlerted = true;
          }
        } else {
          // Reset cờ cảnh báo khi đã nạp thêm vượt trên 10%
          isLowBalanceAlerted = false;
        }

        // Update bảng apps
        await supabaseAdmin
          .from("apps")
          .update({
            total_granted: hardLimitUsd,
            total_used: totalUsedUsd,
            balance: balanceUsd,
            status,
            is_low_balance_alerted: isLowBalanceAlerted
          })
          .eq("id", app.id);

        // Insert bảng balance_history
        await supabaseAdmin
          .from("balance_history")
          .insert({
            app_id: app.id,
            total_used: totalUsedUsd,
            balance: balanceUsd,
          });

        results.push({
          app_id: app.id,
          app_name: app.name,
          status: "success",
          total_granted: hardLimitUsd,
          total_used: totalUsedUsd,
          balance: balanceUsd,
        });

      } catch (err: any) {
        console.error(`Cron sync failed for app ${app.name}:`, err.message || err);
        
        await supabaseAdmin
          .from("apps")
          .update({
            status: "depleted",
          })
          .eq("id", app.id);

        results.push({
          app_id: app.id,
          app_name: app.name,
          status: "failed",
          reason: err.message || String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cronjob đồng bộ số dư hoàn tất",
      date_range: { start_date: startDate, end_date: endDate },
      results,
    });
  } catch (error: any) {
    console.error("Lỗi Cronjob /api/cron/sync-balances:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
