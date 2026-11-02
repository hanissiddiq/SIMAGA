'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation'
import ReviewCard from './ReviewCard';
import { ChevronLeft, FileText } from 'lucide-react';

interface Assignment {
  id: string;
  assessor_id: string;
  assessed_id: string;
  period_semester: number;
  period_year: number;
  is_completed: boolean;

  assessed?: {
    id: string;
    full_name: string;
    position: string;
  };
}

export default function PeerReviewPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {

    try {

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('peer_review_assignments')
        .select('*')
        .eq('assessor_id', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      if (!data || data.length === 0) {
        setAssignments([]);
        return;
      }

      const assessedIds = data.map(
        (item) => item.assessed_id
      );

      const {
        data: profiles
      } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .in('id', assessedIds);

      const merged = data.map((item) => ({
        ...item,
        assessed: profiles?.find(
          (p) => p.id === item.assessed_id
        )
      }));

      setAssignments(merged);

    } catch (err: any) {

      toast.error(err.message);

    } finally {

      setLoading(false);

    }
  }

  if (loading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="flex items-center text-blue-700 font-medium hover:underline">
          <ChevronLeft size={20} className="mr-1" /> Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-2 text-blue-600" /> Penilaian Perilaku Rekan Kerja
        </h1>
      </header>

      {assignments.length === 0 && (
        <div className="bg-green-50 border rounded-lg p-4">
          Tidak ada penilaian yang harus diisi.
        </div>
      )}

      {assignments.map((item) => (

        <ReviewCard
          key={item.id}
          assignment={item}
          onSuccess={loadAssignments}
        />

      ))}

    </div>
  );
}