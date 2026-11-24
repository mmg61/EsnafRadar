import React from 'react';
import { Check, Circle } from 'lucide-react';
import { getPasswordScore } from './passwordUtils';

interface PasswordStrengthBoxProps {
  password: string;
}

export const PasswordStrengthBox: React.FC<PasswordStrengthBoxProps> = ({ password }) => {
  if (!password) return null;
  const score = getPasswordScore(password);

  return (
    <div className="mt-2.5 p-3 bg-[var(--theme-canvas)] rounded-xl border border-[var(--theme-border)] space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--theme-contrast)]/80">Şifre Güvenliği:</span>
        <span className="font-bold text-[var(--theme-contrast)]">
          {score === 4 ? 'Güçlü' : score >= 2 ? 'Orta' : 'Zayıf'}
        </span>
      </div>
      <div className="flex gap-1.5 h-1.5">
        {[1, 2, 3, 4].map(step => (
          <div
            key={step}
            className={`flex-1 rounded-full ${
              score >= step ? 'bg-[var(--theme-primary)]' : 'bg-[var(--theme-muted)]'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
        <span className={`flex items-center gap-1 ${password.length >= 8 ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/55'}`}>
          {password.length >= 8 ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 8 karakter
        </span>
        <span className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/55'}`}>
          {/[A-Z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 büyük harf
        </span>
        <span className={`flex items-center gap-1 ${/[a-z]/.test(password) ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/55'}`}>
          {/[a-z]/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 küçük harf
        </span>
        <span className={`flex items-center gap-1 ${/\d/.test(password) ? 'text-[var(--theme-contrast)] font-semibold' : 'text-[var(--theme-contrast)]/55'}`}>
          {/\d/.test(password) ? <Check size={12} className="shrink-0" /> : <Circle size={8} className="shrink-0" />} En az 1 rakam
        </span>
      </div>
    </div>
  );
};
