import type { AuditResult, DemoSiteResponse, LeadNote, Merchant, OutreachLog, SavedLead, UserProfile } from './types';

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const API_BASE_URL: string = API_URL.replace(/\/api\/?$/, '');

export const scanMerchants = async (
  lat: number,
  lon: number,
  radius: number,
  token: string,
  category: string = 'all'
): Promise<Merchant[]> => {
  const response = await fetch(`${API_URL}/discovery/scan?lat=${lat}&lon=${lon}&radius=${radius}&category=${category}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Tarama başarısız oldu');
  }
  return response.json();
};

export const auditMerchant = async (
  osm_id: string,
  name: string,
  website: string | null,
  token: string,
  category?: string,
  force_refresh: boolean = false
): Promise<AuditResult> => {
  const response = await fetch(`${API_URL}/discovery/audit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ osm_id, name, website, category, force_refresh })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'İnceleme raporu oluşturulamadı');
  }
  return response.json();
};

export const getAiStatus = async (token: string): Promise<{ configured: boolean; masked_key?: string | null; model: string }> => {
  const response = await fetch(`${API_URL}/discovery/ai-status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Yapay zeka durumu alınamadı');
  }
  return response.json();
};

export const saveAiConfig = async (apiKey: string, token: string): Promise<{ configured: boolean; masked_key?: string | null; model: string }> => {
  const response = await fetch(`${API_URL}/discovery/ai-config`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ api_key: apiKey })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Gemini API anahtarı kaydedilemedi');
  }
  return response.json();
};

export const generateCustomPitch = async (
  payload: {
    osm_id?: string;
    merchant_name: string;
    category?: string;
    tone: string;
    focus_service: string;
    sender_name?: string;
    agency_name?: string;
    special_offer?: string;
    custom_instruction?: string;
    audit_context?: Record<string, unknown>;
    gemini_api_key?: string;
  },
  token: string
) => {
  const response = await fetch(`${API_URL}/discovery/generate-pitch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Kişiselleştirilmiş teklif üretilemedi');
  }
  return response.json();
};

export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  turnstileToken?: string
) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      turnstile_token: turnstileToken
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Kayıt başarısız oldu');
  }
  return response.json();
};

export const loginUser = async (email: string, password: string, turnstileToken?: string) => {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);
  if (turnstileToken) {
    formData.append('client_secret', turnstileToken);
  }

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Giriş başarısız');
  }
  return response.json();
};

export const forgotPassword = async (email: string, turnstileToken?: string): Promise<{ message: string; cooldown_seconds: number }> => {
  const response = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, turnstile_token: turnstileToken })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Şifre sıfırlama talebi başarısız oldu.');
  }
  return response.json();
};

export const resetPassword = async (email: string, code: string, newPassword: string): Promise<{ message: string }> => {
  const response = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, new_password: newPassword })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Şifre güncellenemedi.');
  }
  return response.json();
};

export const getUserProfile = async (token: string): Promise<UserProfile> => {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Profil bilgisi alınamadı');
  }
  return response.json();
};

export const updateUserProfile = async (
  data: { first_name?: string; last_name?: string; current_password?: string; new_password?: string },
  token: string
): Promise<UserProfile> => {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Profil güncellenemedi');
  }
  return response.json();
};

export const saveLead = async (
  leadData: {
    osm_id: string;
    name: string;
    latitude: number;
    longitude: number;
    category?: string;
    phone?: string;
    email?: string;
    website?: string | null;
    address?: string;
    opportunity_score?: number;
    audit_data?: AuditResult;
  },
  token: string
): Promise<SavedLead> => {
  const response = await fetch(`${API_URL}/leads/save`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leadData)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Müşteri kaydedilemedi');
  }
  return response.json();
};

export const getSavedLeads = async (
  token: string,
  statusFilter?: string,
  skip: number = 0,
  limit: number = 500
): Promise<SavedLead[]> => {
  const params = new URLSearchParams();
  if (statusFilter) params.set('status_filter', statusFilter);
  params.set('skip', String(skip));
  params.set('limit', String(limit));

  const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Kayıtlı müşteriler alınamadı');
  }
  return response.json();
};

export const updateLeadStatus = async (leadId: number, status: string, token: string): Promise<SavedLead> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Durum güncellenemedi');
  }
  return response.json();
};

export const deleteLead = async (leadId: number, token: string): Promise<boolean> => {
  const response = await fetch(`${API_URL}/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Müşteri silinemedi');
  }
  return true;
};

export const addLeadNote = async (leadId: number, content: string, token: string): Promise<LeadNote> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Not eklenemedi');
  }
  return response.json();
};

export const updateLeadNote = async (leadId: number, noteId: number, content: string, token: string): Promise<LeadNote> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/notes/${noteId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Not güncellenemedi');
  }
  return response.json();
};

export const deleteLeadNote = async (leadId: number, noteId: number, token: string): Promise<boolean> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/notes/${noteId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Not silinemedi');
  }
  return true;
};

export const logLeadOutreach = async (
  leadId: number,
  channel: string,
  messageContent: string,
  isAiGenerated: boolean,
  token: string
): Promise<OutreachLog> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/outreach`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel,
      message_content: messageContent,
      is_ai_generated: isAiGenerated
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'İletişim kaydı oluşturulamadı');
  }
  return response.json();
};

export const exportLeadsCsv = async (token: string): Promise<void> => {
  const response = await fetch(`${API_URL}/leads/export/csv`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('CSV dışa aktarımı başarısız oldu');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `esnafradar_musteriler_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const exportAuditPdf = async (payload: Record<string, unknown>, token: string): Promise<void> => {
  const response = await fetch(`${API_URL}/discovery/export-pdf`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'PDF raporu oluşturulamadı');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const safeName = String(payload.merchant_name || 'isletme')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç]/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_inceleme_raporu.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const updateLeadReminder = async (
  leadId: number,
  payload: {
    reminder_at: string | null;
    reminder_note?: string | null;
    reminder_completed?: boolean;
  },
  token: string
): Promise<SavedLead> => {
  const response = await fetch(`${API_URL}/leads/${leadId}/reminder`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Hatırlatıcı güncellenemedi');
  }
  return response.json();
};

export const generateDemoSite = async (
  payload: {
    merchant_name: string;
    category?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    opening_hours?: string | null;
    instagram?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  token: string
): Promise<DemoSiteResponse> => {
  const response = await fetch(`${API_URL}/discovery/demo-site`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Örnek site taslağı oluşturulamadı');
  }
  return response.json();
};
