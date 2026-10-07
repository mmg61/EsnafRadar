export const API_URL = 'http://localhost:8000/api';

export const scanMerchants = async (lat: number, lon: number, radius: number, token: string) => {
  const response = await fetch(`${API_URL}/discovery/scan?lat=${lat}&lon=${lon}&radius=${radius}`, {
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

export const auditMerchant = async (osm_id: string, name: string, website: string | null, token: string) => {
  const response = await fetch(`${API_URL}/discovery/audit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ osm_id, name, website })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Röntgen çekilemedi');
  }
  return response.json();
};

export const registerUser = async (email: string, password: string, fullName: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName })
    });
    return response.json();
}

export const loginUser = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    if (!response.ok) throw new Error('Giriş başarısız');
    return response.json();
}
