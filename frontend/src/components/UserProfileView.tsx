import React, { useState, useEffect } from 'react';
import { getUserProfile, updateUserProfile, deleteUserAccount } from '../api';
import type { UserProfile } from '../types';
import { User, KeyRound, Database, CheckCircle2, AlertCircle, Eye, EyeOff, Check, Circle, Trash2 } from 'lucide-react';

interface UserProfileViewProps {
  token: string;
  onProfileUpdated?: (fullName: string) => void;
  onAccountDeleted?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ token, onProfileUpdated, onAccountDeleted }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Account delete states
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    if (!deletePassword.trim()) {
      setDeleteError('Hesabınızı silmek için mevcut şifrenizi girmelisiniz.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await deleteUserAccount(deletePassword, token);
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Hesap silinemedi.');
      setIsDeletingAccount(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserProfile(token);
      setProfile(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
    } catch (err: unknown) {
      setInfoError(err instanceof Error ? err.message : 'Profil yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const rules = [
    { label: 'En az 8 karakter', valid: newPassword.length >= 8 },
    { label: 'En az 1 büyük harf (A-Z)', valid: /[A-Z]/.test(newPassword) },
    { label: 'En az 1 küçük harf (a-z)', valid: /[a-z]/.test(newPassword) },
    { label: 'En az 1 rakam (0-9)', valid: /\d/.test(newPassword) },
  ];
  const passedRules = rules.filter(r => r.valid).length;

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoError(null);
    setInfoSuccess(null);

    if (!firstName.trim() || !lastName.trim()) {
      setInfoError('Ad ve soyad boş bırakılamaz.');
      return;
    }

    setIsUpdatingInfo(true);
    try {
      const updated = await updateUserProfile({ first_name: firstName.trim(), last_name: lastName.trim() }, token);
      setProfile(updated);
      setInfoSuccess('Profil bilgileriniz başarıyla güncellendi.');
      if (onProfileUpdated && updated.full_name) onProfileUpdated(updated.full_name);
      setTimeout(() => setInfoSuccess(null), 3000);
    } catch (err: unknown) {
      setInfoError(err instanceof Error ? err.message : 'Güncelleme başarısız oldu.');
    } finally {
      setIsUpdatingInfo(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Lütfen mevcut şifrenizi girin.');
      return;
    }

    if (passedRules < 4) {
      setPasswordError('Yeni şifreniz tüm güvenlik kurallarını karşılamalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateUserProfile({ current_password: currentPassword, new_password: newPassword }, token);
      setPasswordSuccess('Şifreniz başarıyla değiştirildi.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Şifre değiştirilemedi.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[var(--theme-contrast)] font-semibold animate-pulse">
        Profil bilgileri yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profil Başlık & Özet Kartı */}
      <div className="bg-[var(--theme-surface)] p-6 rounded-xl border border-[var(--theme-border)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--theme-primary)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-on-primary)] font-bold text-2xl">
            {(profile?.first_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--theme-contrast)]">
              {profile?.full_name || 'Kullanıcı'}
            </h2>
            <p className="text-sm text-[var(--theme-contrast)]/80">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] font-semibold">
                <CheckCircle2 size={12} /> Hesap Aktif
              </span>
            </div>
          </div>
        </div>

        {/* İstatistik Rozetleri */}
        <div className="grid grid-cols-1 gap-3 w-full md:w-auto">
          <div className="bg-[var(--theme-canvas)] p-3 rounded-xl border border-[var(--theme-border)] text-center min-w-[140px]">
            <p className="text-xs text-[var(--theme-contrast)] font-semibold flex items-center justify-center gap-1">
              <Database size={13} className="text-[var(--theme-contrast)]" /> Kayıtlı Müşterilerim
            </p>
            <p className="text-xl font-extrabold text-[var(--theme-contrast)] mt-0.5">
              {profile?.saved_leads_count || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form 1: Temel Bilgiler */}
        <div className="bg-[var(--theme-surface)] p-6 rounded-xl border border-[var(--theme-border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[var(--theme-contrast)] mb-4 pb-3 border-b border-[var(--theme-border)]">
              <User size={20} />
              <h3 className="font-bold text-lg text-[var(--theme-contrast)]">Kişisel Bilgiler</h3>
            </div>

            {infoSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--theme-muted)] border border-[var(--theme-border)] text-[var(--theme-contrast)] font-medium text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> {infoSuccess}
              </div>
            )}
            {infoError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-100 border border-rose-700 text-rose-900 font-medium text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {infoError}
              </div>
            )}

            <form onSubmit={handleUpdateInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">E-posta (Değiştirilemez)</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full bg-[var(--theme-canvas)]/60 border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-contrast)]/70 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Adınız</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Soyadınız</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Hesap Oluşturulma Tarihi</label>
                <p className="text-xs text-[var(--theme-contrast)] bg-[var(--theme-canvas)] p-2.5 rounded-lg border border-[var(--theme-border)]">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : '-'}
                </p>
              </div>

              <button
                type="submit"
                disabled={isUpdatingInfo}
                className="w-full mt-4 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-lg border border-[var(--theme-border)] transition-colors text-sm disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingInfo ? 'Kaydediliyor...' : 'Bilgileri Güncelle'}
              </button>
            </form>
          </div>
        </div>

        {/* Form 2: Güvenlik & Şifre Değiştirme */}
        <div className="bg-[var(--theme-surface)] p-6 rounded-xl border border-[var(--theme-border)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[var(--theme-contrast)] mb-4 pb-3 border-b border-[var(--theme-border)]">
              <KeyRound size={20} />
              <h3 className="font-bold text-lg text-[var(--theme-contrast)]">Şifre Değiştir</h3>
            </div>

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--theme-muted)] border border-[var(--theme-border)] text-[var(--theme-contrast)] font-medium text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-100 border border-rose-700 text-rose-900 font-medium text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {passwordError}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Mevcut Şifreniz</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Mevcut şifreniz"
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Yeni Şifreniz</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Yeni şifreniz"
                    className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-[var(--theme-contrast)] hover:text-[var(--theme-primary)] cursor-pointer"
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1 p-2.5 bg-[var(--theme-canvas)] rounded-lg border border-[var(--theme-border)]">
                    <div className="h-1.5 w-full bg-[var(--theme-surface)] rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map(idx => (
                        <div
                          key={idx}
                          className={`h-full flex-1 transition-all ${
                            idx <= passedRules ? 'bg-[var(--theme-primary)]' : 'bg-[var(--theme-surface)]'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-[11px] pt-1">
                      {rules.map((r, i) => (
                        <span key={i} className={`flex items-center gap-1.5 ${r.valid ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/60'}`}>
                          {r.valid ? <Check size={12} /> : <Circle size={8} />} {r.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Yeni şifrenizi tekrar giriniz"
                  className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-[var(--theme-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full mt-2 bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-on-primary)] font-semibold py-2.5 rounded-lg border border-[var(--theme-border)] transition-colors text-sm disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingPassword ? 'Şifre Değiştiriliyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Hesap Silme Bölümü (Ayrı Butonla Açılır) */}
      <div className="bg-[var(--theme-surface)] p-6 rounded-xl border border-[var(--theme-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-[var(--theme-contrast)] flex items-center gap-2">
              <Trash2 size={18} className="text-rose-500" />
              <span>Hesabı Kalıcı Olarak Sil</span>
            </h3>
            <p className="text-xs text-[var(--theme-contrast)]/70 mt-1">
              Hesabınızı sildiğinizde kayıtlı tüm müşterileriniz, görüşme notlarınız ve hatırlatıcılarınız kalıcı olarak kaldırılır.
            </p>
          </div>

          {!showDeleteSection && (
            <button
              type="button"
              onClick={() => {
                setShowDeleteSection(true);
                setDeleteError(null);
                setDeletePassword('');
              }}
              className="px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              Hesabımı Silmek İstiyorum
            </button>
          )}
        </div>

        {showDeleteSection && (
          <form onSubmit={handleDeleteAccount} className="mt-5 pt-5 border-t border-[var(--theme-border)] space-y-4">
            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="max-w-md">
              <label className="block text-xs font-semibold text-[var(--theme-contrast)] mb-1.5">
                İşlemi onaylamak için mevcut şifrenizi girin
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Mevcut şifreniz"
                required
                className="w-full bg-[var(--theme-canvas)] border border-[var(--theme-border)] rounded-lg px-3.5 py-2 text-sm text-[var(--theme-contrast)] focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isDeletingAccount || !deletePassword.trim()}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingAccount ? 'Hesap Siliniyor...' : 'Onayla ve Hesabımı Kalıcı Olarak Sil'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSection(false);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-lg bg-[var(--theme-canvas)] hover:bg-[var(--theme-muted)] text-[var(--theme-contrast)] border border-[var(--theme-border)] text-xs font-semibold transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
