import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load local env manually
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: chatMessages, error: err1 } = await supabase.from("chat_messages").select("*").limit(1);
  if (err1) {
    console.error("Error fetching chat_messages:", err1);
  } else {
    console.log("chat_messages sample record:", chatMessages[0] ? Object.keys(chatMessages[0]) : "No records");
  }

  const { data: messages, error: err2 } = await supabase.from("messages").select("*").limit(1);
  if (err2) {
    console.error("Error fetching messages:", err2);
  } else {
    console.log("messages sample record:", messages[0] ? Object.keys(messages[0]) : "No records");
  }
}

main();
