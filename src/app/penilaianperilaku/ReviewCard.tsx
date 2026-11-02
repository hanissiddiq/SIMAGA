'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

export default function ReviewCard({
  assignment,
  onSuccess
}: any) {

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({

    integritas: 3,
    profesionalisme: 3,
    sinergi: 3,
    pelayanan: 3,
    komitmen_kerja: 3,

    notes: ''
  });

  function updateField(
    field: string,
    value: any
  ) {

    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleSubmit() {

    try {

      setSaving(true);

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Session tidak ditemukan');
      }

      const payload = {

        assignment_id: assignment.id,

        assessor_id: user.id,
        assessed_id: assignment.assessed_id,

        period_semester:
          assignment.period_semester,

        period_year:
          assignment.period_year,

        ...form
      };

      const { error } = await supabase
        .from('peer_assessments')
        .insert(payload);

      if (error) throw error;

      await supabase
        .from('peer_review_assignments')
        .update({
          is_completed: true
        })
        .eq('id', assignment.id);

      toast.success(
        'Penilaian berhasil disimpan'
      );

      onSuccess();

    } catch (err: any) {

      toast.error(err.message);

    } finally {

      setSaving(false);

    }
  }

  const questions = [

    {
      key: 'integritas',
      label: 'Integritas',
      desc: 'Jujur, bertanggung jawab, dan dapat dipercaya'
    },

    {
      key: 'profesionalisme',
      label: 'Profesionalisme',
      desc: 'Bekerja sesuai tugas dan aturan'
    },

    {
      key: 'sinergi',
      label: 'Sinergi',
      desc: 'Mudah bekerja sama dengan tim'
    },

    {
      key: 'pelayanan',
      label: 'Pelayanan',
      desc: 'Ramah dan membantu pengguna layanan'
    },

    {
      key: 'komitmen_kerja',
      label: 'Komitmen Kerja',
      desc: 'Peduli terhadap kualitas pekerjaan'
    }
  ];

  return (

    <div className="bg-white border rounded-xl p-6 mb-6 shadow-sm">

      <h2 className="text-lg font-semibold mb-1">
        {assignment.assessed?.full_name}
      </h2>

      <p className="text-sm text-gray-500 mb-4">
        {assignment.assessed?.job_group}
      </p>

      {questions.map((q) => (

        <div
          key={q.key}
          className="mb-5"
        >

          <label className="font-medium block">
            {q.label}
          </label>

          <p className="text-sm text-gray-500 mb-2">
            {q.desc}
          </p>

          <select
            className="border rounded p-2 w-full"
            value={(form as any)[q.key]}
            onChange={(e) =>
              updateField(
                q.key,
                Number(e.target.value)
              )
            }
          >
            <option value={1}>
              1 - Kurang
            </option>

            <option value={2}>
              2 - Cukup
            </option>

            <option value={3}>
              3 - Baik
            </option>

            <option value={4}>
              4 - Sangat Baik
            </option>

          </select>

        </div>

      ))}

      <textarea
        className="border rounded p-3 w-full mb-4"
        rows={3}
        placeholder="Catatan (opsional)"
        value={form.notes}
        onChange={(e) =>
          updateField(
            'notes',
            e.target.value
          )
        }
      />

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        {saving
          ? 'Menyimpan...'
          : 'Simpan Penilaian'}
      </button>

    </div>
  );
}