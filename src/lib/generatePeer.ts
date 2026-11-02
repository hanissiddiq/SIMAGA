import { supabase } from '@/lib/supabaseClient';

export async function generatePeerAssignments() {

  const now = new Date();

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // ambil semua profile
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role').eq('role', 'pegawai');

  if (!profiles) return;

  // grouping berdasarkan job_group
  const groups: Record<string, any[]> = {};

  profiles.forEach((p) => {

    if (!groups[p.role]) {
      groups[p.role] = [];
    }

    groups[p.role].push(p);
  });

  const inserts: any[] = [];

  Object.keys(groups).forEach((groupName) => {

    const members = groups[groupName];

    members.forEach((member) => {

      // random peer selain dirinya
      const others = members.filter(
        (m) => m.id !== member.id
      );

      const shuffled = others.sort(
        () => 0.5 - Math.random()
      );

      const selected = shuffled.slice(0, 4);

      selected.forEach((target) => {

        inserts.push({
          assessor_id: member.id,
          assessed_id: target.id,
          period_month: month,
          period_year: year
        });
      });
    });
  });

  await supabase
    .from('peer_review_assignments')
    .insert(inserts);
}