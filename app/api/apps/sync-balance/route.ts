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

async function sendTelegramAlert(appName: string, providerName: string, balance: number, limit: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID;

  if (!token || !chatId) {
    console.error("Thiếu cấu hình Telegram Bot Token hoặc Chat ID.");
    return;
  }

  const usagePercent = limit > 0 ? ((limit - balance) / limit) * 100 : 0;
  const text = `⚠️ <b>CẢNH BÁO SẮP CẠN SỐ DƯ API</b> ⚠️\n\nỨng dụng: <b>${appName}</b> (${providerName})\nHạn mức còn lại: <code>$${balance.toFixed(2)}</code> (~ ${(balance * 3250).toLocaleString("vi-VN")}đ)\nTỷ lệ sử dụng: <b>${usagePercent.toFixed(1)}%</b>`;

  try {
    const payload: any = {
      chat_id: chatId,
      parse_mode: "HTML",
      text: text,
    };
    if (threadId) payload.message_thread_id = threadId;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Lỗi gửi Telegram:", error);
  }
}

async function syncAppBalance(app: any, supabaseAdmin: any) {
  const provider = app.provider || "shopaikey";
  const providerLabel = provider === "dataforseo" ? "DataForSEO" : "ShopAIKey";

  const now = new Date();
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split("T")[0];
  const startDate = `${currentYear}-01-01`;
  const endDate = todayStr;

  let hardLimitUsd = 0;
  let totalUsedUsd = 0;
  let balanceUsd = 0;

  if (provider === "dataforseo") {
    const apiLogin = app.api_login;
    const apiPassword = app.secret_key;

    if (!apiLogin || !apiPassword || !apiLogin.trim() || !apiPassword.trim()) {
      throw new Error("Thiếu API Login (Email) hoặc API Password cho DataForSEO");
    }

    const authHeader = `Basic ${Buffer.from(`${apiLogin.trim()}:${apiPassword.trim()}`).toString("base64")}`;

    const res = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      method: "GET",
      headers: { Authorization: authHeader },
      cache: "no-store",
    });

    if (res.status === 401) {
      throw new Error("Sai API Login hoặc API Password cho DataForSEO. Kiểm tra lại thông tin đăng nhập.");
    }

    if (!res.ok) {
      throw new Error(`Lỗi kết nối DataForSEO (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (data.status_code !== 20000) {
      throw new Error(data.message || `Lỗi DataForSEO (Code ${data.status_code})`);
    }

    const moneyData = data.tasks?.[0]?.result?.[0]?.money;
    if (!moneyData) {
      throw new Error("Không thể đọc thông tin số dư tài chính từ DataForSEO");
    }

    balanceUsd = Math.round(Number(moneyData.balance || 0) * 100) / 100;
    hardLimitUsd = Math.round(Number(moneyData.total || 0) * 100) / 100;
    totalUsedUsd = Math.round(Math.max(0, hardLimitUsd - balanceUsd) * 100) / 100;
  } else {
    // ShopAIKey
    const key = app.secret_key;
    if (!key || !key.trim()) {
      throw new Error("Secret Key của ShopAIKey bị trống");
    }

    const subRes = await fetch("https://api.shopaikey.com/v1/dashboard/billing/subscription", {
      method: "GET",
      headers: { Authorization: `Bearer ${key.trim()}` },
      cache: "no-store",
    });

    if (!subRes.ok) {
      throw new Error(`Lỗi kết nối Billing ShopAIKey (HTTP ${subRes.status})`);
    }

    const subData = await subRes.json();
    hardLimitUsd = Math.round(Number(subData.hard_limit_usd || 0) * 100) / 100;

    const usageRes = await fetch(
      `https://api.shopaikey.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${key.trim()}` },
        cache: "no-store",
      }
    );

    if (!usageRes.ok) {
      throw new Error(`Lỗi kết nối Usage ShopAIKey (HTTP ${usageRes.status})`);
    }

    const usageData = await usageRes.json();
    const totalUsageCents = Number(usageData.total_usage || 0);
    totalUsedUsd = Math.round((totalUsageCents / 100) * 100) / 100;
    balanceUsd = Math.round((hardLimitUsd - totalUsedUsd) * 100) / 100;
  }

  const status = balanceUsd > 0 ? "active" : "depleted";

  let isLowBalanceAlerted = app.is_low_balance_alerted || false;
  if (hardLimitUsd > 0 && balanceUsd <= hardLimitUsd * 0.1) {
    if (!isLowBalanceAlerted) {
      await sendTelegramAlert(app.name, providerLabel, balanceUsd, hardLimitUsd);
      isLowBalanceAlerted = true;
    }
  } else {
    isLowBalanceAlerted = false;
  }

  // Update apps
  const { data: updatedApp, error: updateError } = await supabaseAdmin
    .from("apps")
    .update({
      total_granted: hardLimitUsd,
      total_used: totalUsedUsd,
      balance: balanceUsd,
      status,
      is_low_balance_alerted: isLowBalanceAlerted,
    })
    .eq("id", app.id)
    .select("*")
    .single();

  if (updateError) throw updateError;

  // Insert balance_history
  await supabaseAdmin.from("balance_history").insert({
    app_id: app.id,
    total_used: totalUsedUsd,
    balance: balanceUsd,
  });

  return {
    id: updatedApp.id,
    name: updatedApp.name,
    provider: updatedApp.provider || "shopaikey",
    api_login: updatedApp.api_login || null,
    secret_key: updatedApp.secret_key,
    app_url: updatedApp.app_url,
    status: updatedApp.status,
    total_granted: Number(updatedApp.total_granted || 0),
    total_used: Number(updatedApp.total_used || 0),
    balance: Number(updatedApp.balance || 0),
    is_low_balance_alerted: updatedApp.is_low_balance_alerted || false,
    created_at: updatedApp.created_at ? updatedApp.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { appId } = body;

    const supabaseAdmin = getSupabaseAdmin();

    if (appId) {
      // Sync single app
      const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
      const { data: app, error: appError } = await supabaseAdmin
        .from("apps")
        .select("*")
        .eq("id", parsedId)
        .single();

      if (appError || !app) {
        return NextResponse.json({ error: "Không tìm thấy ứng dụng với ID cung cấp" }, { status: 404 });
      }

      try {
        const updatedApp = await syncAppBalance(app, supabaseAdmin);
        return NextResponse.json({
          success: true,
          message: `Đã đồng bộ số dư ứng dụng ${app.name}`,
          app: updatedApp,
        });
      } catch (err: any) {
        console.error(`Lỗi đồng bộ app ${app.name}:`, err);
        await supabaseAdmin.from("apps").update({ status: "depleted" }).eq("id", app.id);
        return NextResponse.json({ error: err.message || "Đồng bộ thất bại" }, { status: 500 });
      }
    } else {
      // Sync all apps
      const { data: apps, error: appsError } = await supabaseAdmin.from("apps").select("*");
      if (appsError) {
        return NextResponse.json({ error: appsError.message }, { status: 500 });
      }

      const results = [];
      const updatedApps = [];

      for (const app of apps || []) {
        try {
          const updatedApp = await syncAppBalance(app, supabaseAdmin);
          results.push({ app_id: app.id, status: "success" });
          updatedApps.push(updatedApp);
        } catch (err: any) {
          await supabaseAdmin.from("apps").update({ status: "depleted" }).eq("id", app.id);
          results.push({ app_id: app.id, status: "failed", reason: err.message });
        }
      }

      return NextResponse.json({
        success: true,
        message: "Đã đồng bộ tất cả ứng dụng",
        results,
        apps: updatedApps,
      });
    }
  } catch (error: any) {
    console.error("Lỗi POST /api/apps/sync-balance:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
