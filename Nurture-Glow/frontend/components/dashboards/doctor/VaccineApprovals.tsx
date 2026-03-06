import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  Clock,
  MessageCircle,
  Plus,
  XCircle
} from 'lucide-react';
import { apiFetch } from '../../../services/api';
import type { VaccineMessage, VaccineRecord } from '../../../types';

type PatientOption = {
  patientId: string;
  patientName?: string;
};

const VaccineApprovals: React.FC = () => {
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [newV, setNewV] = useState({
    patientId: '',
    name: '',
    dueDate: '',
    administeredDate: '',
    doseNumber: '',
    location: '',
    notes: ''
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeThread, setActiveThread] = useState<VaccineRecord | null>(null);
  const [threadMessages, setThreadMessages] = useState<VaccineMessage[]>([]);
  const [threadInput, setThreadInput] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);

  const loadVaccines = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiFetch<{ items: VaccineRecord[] }>(`/api/doctor/vaccines${qs}`);
      setVaccines(res.items || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load vaccine requests');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const res = await apiFetch<{ items: PatientOption[] }>('/api/doctor/accessible-patients');
      setPatients(res.items || []);
    } catch (err) {
      setPatients([]);
    }
  };

  useEffect(() => {
    loadVaccines();
  }, [statusFilter]);

  useEffect(() => {
    loadPatients();
  }, []);

  const pendingCount = useMemo(
    () => vaccines.filter((item) => item.verificationStatus === 'pending').length,
    [vaccines]
  );

  const handleApprove = async (id: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/doctor/vaccines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve' })
      });
      await loadVaccines(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve vaccine');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/doctor/vaccines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason: rejectReason })
      });
      setRejectingId(null);
      setRejectReason('');
      await loadVaccines(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to reject vaccine');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newV.patientId || !newV.name || !newV.dueDate) {
      setError('Patient, vaccine name, and due date are required.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/doctor/vaccines', {
        method: 'POST',
        body: JSON.stringify({
          patientId: newV.patientId,
          name: newV.name,
          dueDate: newV.dueDate,
          administeredDate: newV.administeredDate || null,
          doseNumber: newV.doseNumber || null,
          location: newV.location || null,
          notes: newV.notes || null,
          status: 'Taken'
        })
      });
      setShowAdd(false);
      setNewV({
        patientId: '',
        name: '',
        dueDate: '',
        administeredDate: '',
        doseNumber: '',
        location: '',
        notes: ''
      });
      await loadVaccines(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to add vaccine');
    } finally {
      setSaving(false);
    }
  };

  const openThread = async (vaccine: VaccineRecord) => {
    setActiveThread(vaccine);
    setThreadInput('');
    setThreadLoading(true);
    try {
      const res = await apiFetch<{ items: VaccineMessage[] }>(`/api/vaccines/${vaccine.id}/messages`);
      setThreadMessages(res.items || []);
    } catch (err) {
      setThreadMessages([]);
    } finally {
      setThreadLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!activeThread || !threadInput.trim()) return;
    try {
      const res = await apiFetch<{ item: VaccineMessage }>(`/api/vaccines/${activeThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: threadInput.trim() })
      });
      setThreadMessages((prev) => [...prev, res.item]);
      setThreadInput('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Vaccine Review Queue</h3>
          <p className="text-sm text-gray-500">
            {pendingCount} pending approvals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700"
          >
            <Plus size={16} /> Add Vaccine
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading vaccine entries...</div>
      ) : vaccines.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No vaccine entries found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vaccines.map((item) => (
            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{item.name}</h4>
                  <p className="text-xs text-gray-500">
                    Patient: {item.patientName || 'Patient'} · Due: {item.dueDate}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                  {item.verificationStatus || 'pending'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>Status: {item.status || 'Pending'}</span>
                </div>
                {item.location && <p>Location: {item.location}</p>}
                {item.doseNumber && <p>Dose: {item.doseNumber}</p>}
                {item.proofUrl && (
                  <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold">
                    View proof
                  </a>
                )}
                {item.verificationStatus === 'rejected' && item.verificationReason && (
                  <p className="text-red-600">Reason: {item.verificationReason}</p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {item.verificationStatus === 'pending' && (
                  <>
                    <button
                      disabled={saving}
                      onClick={() => handleApprove(item.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => setRejectingId(item.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-100"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => openThread(item)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600"
                >
                  <MessageCircle size={14} /> Message
                </button>
              </div>

              {rejectingId === item.id && (
                <div className="mt-4 space-y-2">
                  <textarea
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                    rows={3}
                    placeholder="Rejection reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(item.id)}
                      className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                      disabled={saving}
                    >
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason('');
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add Verified Vaccine</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowAdd(false)}
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Patient</label>
                <select
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={newV.patientId}
                  onChange={(e) => setNewV({ ...newV, patientId: e.target.value })}
                >
                  <option value="">Select patient</option>
                  {patients.map((p) => (
                    <option key={p.patientId} value={p.patientId}>
                      {p.patientName || p.patientId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Vaccine Name</label>
                <input
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={newV.name}
                  onChange={(e) => setNewV({ ...newV, name: e.target.value })}
                  placeholder="e.g., Tdap"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Due Date</label>
                  <input
                    type="date"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={newV.dueDate}
                    onChange={(e) => setNewV({ ...newV, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Administered Date</label>
                  <input
                    type="date"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={newV.administeredDate}
                    onChange={(e) => setNewV({ ...newV, administeredDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Dose Number</label>
                  <input
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={newV.doseNumber}
                    onChange={(e) => setNewV({ ...newV, doseNumber: e.target.value })}
                    placeholder="1, 2, Booster"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
                  <input
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={newV.location}
                    onChange={(e) => setNewV({ ...newV, location: e.target.value })}
                    placeholder="Clinic name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Notes</label>
                <textarea
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  rows={3}
                  value={newV.notes}
                  onChange={(e) => setNewV({ ...newV, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Save Vaccine
              </button>
            </div>
          </div>
        </div>
      )}

      {activeThread && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Messages for {activeThread.name}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setActiveThread(null)}
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-3 mb-4">
              {threadLoading ? (
                <p className="text-sm text-gray-400">Loading messages...</p>
              ) : threadMessages.length === 0 ? (
                <p className="text-sm text-gray-400">No messages yet.</p>
              ) : (
                threadMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-2xl text-sm ${
                      msg.senderRole === 'doctor'
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                      {msg.senderRole}
                    </p>
                    <p>{msg.message}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Type a message"
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaccineApprovals;
