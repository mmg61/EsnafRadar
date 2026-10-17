export const API_URL = 'http://localhost:8000/api';

export const scanMerchants = async (lat: number, lon: number, radius: number, token: string, category: string = 'all') => {
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
) => {
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
    throw new Error(err.detail || 'Röntgen çekilemedi');
  }
  return response.json();
};

export const getScanHistory = async (token: string) => {
  const response = await fetch(`${API_URL}/discovery/history`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Tarama geçmişi alınamadı');
  }
  return response.json();
};

export const deleteScanHistoryItem = async (scanId: number, token: string) => {
  const response = await fetch(`${API_URL}/discovery/history/${scanId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Tarama kaydı silinemedi');
  }
  return true;
};

export const registerUser = async (email: string, password: string, firstName: string, lastName: string, turnstileToken?: string) => {
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
}

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

export const forgotPassword = async (email: string, turnstileToken?: string) => {
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

export const resetPassword = async (email: string, code: string, newPassword: string) => {
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

export const getUserProfile = async (token: string) => {
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
}

export const updateUserProfile = async (data: { first_name?: string; last_name?: string; current_password?: string; new_password?: string }, token: string) => {
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
}

export const saveLead = async (leadData: any, token: string) => {
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
    throw new Error(err.detail || 'Lead kaydedilemedi');
  }
  return response.json();
};

export const getSavedLeads = async (token: string) => {
  const response = await fetch(`${API_URL}/leads`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Leadler alınamadı');
  }
  return response.json();
};

export const updateLeadStatus = async (leadId: number, status: string, token: string) => {
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

export const deleteLead = async (leadId: number, token: string) => {
  const response = await fetch(`${API_URL}/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Lead silinemedi');
  }
  return true;
};

export const addLeadNote = async (leadId: number, content: string, token: string) => {
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

export const updateLeadNote = async (leadId: number, noteId: number, content: string, token: string) => {
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

export const deleteLeadNote = async (leadId: number, noteId: number, token: string) => {
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
) => {
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

export const exportLeadsCsv = async (token: string) => {
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
