import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return NextResponse.json({error:'Konfigurasi server belum lengkap'},{status:500});
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if (!token) return NextResponse.json({error:'Tidak terautentikasi'},{status:401});
  const authClient = createClient(url,anon);
  const {data:{user},error:authError} = await authClient.auth.getUser(token);
  if (authError || !user) return NextResponse.json({error:'Sesi tidak valid'},{status:401});
  const adminClient = createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:actor,error:roleError} = await adminClient.from('profiles').select('role').eq('id',user.id).single();
  if (roleError || !['admin','kasubbag'].includes((actor?.role || '').toLowerCase())) return NextResponse.json({error:'Akses ditolak'},{status:403});
  let body: {userId?:string};
  try {body = await request.json();} catch {return NextResponse.json({error:'JSON tidak valid'},{status:400});}
  const target = body.userId;
  if (!target || !/^[0-9a-f-]{36}$/i.test(target)) return NextResponse.json({error:'ID pengguna tidak valid'},{status:400});
  if (target === user.id) return NextResponse.json({error:'Tidak dapat menghapus akun sendiri'},{status:403});
  const {data:targetProfile,error:targetError} = await adminClient.from('profiles').select('role').eq('id',target).single();
  if (targetError) return NextResponse.json({error:'Pengguna tidak ditemukan'},{status:404});
  if (['admin','kasubbag','kepala_kantor'].includes((targetProfile?.role || '').toLowerCase())) return NextResponse.json({error:'Akun pengelola dilindungi'},{status:403});
  const {error} = await adminClient.auth.admin.deleteUser(target);
  if (error) return NextResponse.json({error:'Gagal menghapus akun. Periksa relasi database dan kebijakan penghapusan.'},{status:500});
  return NextResponse.json({success:true});
}
