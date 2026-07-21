import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Đảm bảo bucket chat-attachments tồn tại
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets?.some(b => b.name === 'chat-attachments');
    if (!exists) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket('chat-attachments', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
      if (createErr) throw createErr;
    }

    // 2. Upload file lên bucket chat-attachments
    const fileBuffer = await file.arrayBuffer();
    const fileExt = file.name.split('.').pop() || '';
    const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `uploads/${uniqueFileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('chat-attachments')
      .upload(filePath, new Uint8Array(fileBuffer), {
        contentType: file.type,
        duplex: 'half'
      });

    if (uploadErr) throw uploadErr;

    // 3. Lấy public URL của file vừa upload
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrl,
      name: file.name,
      type: file.type
    });
  } catch (err: any) {
    console.error('File upload API error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
