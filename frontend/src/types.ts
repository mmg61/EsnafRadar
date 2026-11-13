export interface Merchant {
  id?: number;
  osm_id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  category_group?: string;
  category_label?: string;
  category_icon?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  website_source?: string;
  is_corporate_chain?: boolean;
  instagram?: string;
  opening_hours?: string;
  opportunity_badge?: string;
  lead_potential_score?: number;
  audit_data?: AuditResult;
}

export interface SocialLinks {
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
}

export interface AuditResult {
  has_website: boolean;
  website_status: number | null;
  ssl_valid: boolean;
  mobile_ready: boolean;
  score: number;
  opportunities: string[];
  response_time_ms?: number | null;
  final_url?: string | null;
  discovered_website?: string | null;
  website_source?: string | null;
  page_title?: string | null;
  meta_description?: string | null;
  h1_heading?: string | null;
  has_title?: boolean;
  has_meta_description?: boolean;
  has_h1?: boolean;
  has_favicon?: boolean;
  has_og_tags?: boolean;
  has_schema?: boolean;
  has_analytics?: boolean;
  has_pixel?: boolean;
  has_maps_embed?: boolean;
  cms_platform?: string | null;
  scraped_emails?: string[];
  scraped_phones?: string[];
  scraped_whatsapp?: string | null;
  social_links?: SocialLinks;
  ai_summary?: string | null;
  recommended_package?: string | null;
  detected_pain_points?: string[];
  value_propositions?: string[];
  sales_pitch_whatsapp?: string | null;
  sales_pitch_email_subject?: string | null;
  sales_pitch_email?: string | null;
  sales_pitch_instagram?: string | null;
  sales_pitch_cold_call?: string | null;
  pitch_engine?: string | null;
  merchantName?: string;
  merchant?: Merchant;
}

export interface LeadNote {
  id: number;
  saved_lead_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface OutreachLog {
  id: number;
  saved_lead_id: number;
  channel: string;
  message_content: string;
  is_ai_generated: boolean;
  sent_at: string;
}

export interface SavedLead {
  id: number;
  status: string;
  opportunity_score: number;
  saved_at: string;
  reminder_at?: string | null;
  reminder_note?: string | null;
  reminder_completed?: boolean;
  notes?: LeadNote[];
  outreach_logs?: OutreachLog[];
  merchant: Merchant & { id: number };
}

export interface UserProfile {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  created_at: string;
  saved_leads_count: number;
}

export interface DemoSiteResponse {
  merchant_name: string;
  sector_title: string;
  primary_color: string;
  accent_color: string;
  html_content: string;
}
