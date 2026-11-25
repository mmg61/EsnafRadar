import React from 'react';
import { Users, MapPin, Globe } from 'lucide-react';

export const AuthMissionPanel: React.FC = () => {
  return (
    <div className="relative z-10 lg:w-[46%] bg-[var(--theme-hero-bg)] text-[var(--theme-hero-text)] border-b lg:border-b-0 lg:border-r border-[var(--theme-border)] p-8 lg:p-14 flex flex-col justify-center order-2 lg:order-1">
      <div className="flex flex-col justify-center max-w-lg mx-auto w-full py-6">
        <div className="text-center flex flex-col items-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-[var(--theme-hero-text)] leading-snug tracking-tight">
            Yerel İşletmelerin Dijital Varlıklarını Analiz Edin ve Satış Süreçlerini Yönetin
          </h2>
          <p className="mt-4 text-sm text-[var(--theme-hero-text)]/80 leading-relaxed max-w-md">
            Açık kaynaklı harita verileri üzerinden bölgesel tarama gerçekleştirin, işletmelerin web ve iletişim altyapılarını denetleyin ve potansiyel müşterilerinizi tek merkezden takip edin.
          </p>
        </div>

        <div className="mt-10 space-y-0 border-l border-white/25 ml-4 sm:ml-8 max-w-md mx-auto">
          <div className="relative pl-6 pb-7">
            <div className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--theme-primary)] border border-white/60" />
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--theme-hero-text)]">
              <MapPin size={14} />
              <span>01. Bölgesel Tarama ve Keşif</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--theme-hero-text)]/75 leading-relaxed">
              Overpass API motoru ve 40&apos;tan fazla sektör filtresi ile hedef koordinattaki ticari işletmeleri anlık olarak tespit edin.
            </p>
          </div>

          <div className="relative pl-6 pb-7">
            <div className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--theme-hero-bg)] border border-white/60" />
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--theme-hero-text)]">
              <Globe size={14} />
              <span>02. Dijital Varlık Röntgeni</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--theme-hero-text)]/75 leading-relaxed">
              HTTP durum kodu, SSL sertifikası, mobil uyumluluk sinyali ve sosyal medya varlıklarını otomatik denetleyerek fırsat puanı hesaplayın.
            </p>
          </div>

          <div className="relative pl-6">
            <div className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--theme-hero-bg)] border border-white/60" />
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--theme-hero-text)]">
              <Users size={14} />
              <span>03. Müşteri İlişkileri ve Doğrudan İletişim</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--theme-hero-text)]/75 leading-relaxed">
              İncelenen işletmeleri müşteri aday listesine kaydedin, satış aşamalarını güncelleyin ve doğrudan kurumsal iletişim başlatın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
