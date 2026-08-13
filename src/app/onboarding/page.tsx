'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Building2, MapPin, CheckCircle2, ChevronRight, Loader2, Briefcase } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';



interface OnboardingData {
  companyName: string;
  abn: string;
  industry: string;
  companySize: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  website: string;
  primaryService: string;
  teamSize: string;
}

// All 247 industries across 29 sectors
const industries = [
  // Property & Facilities (28)
  'Commercial Cleaning', 'Industrial Cleaning', 'Medical / Sterile Cleaning', 'Residential Cleaning',
  'Facility Management', 'Building Maintenance', 'HVAC Maintenance', 'Electrical Maintenance',
  'Plumbing Services', 'Pest Control', 'Waste Management', 'Recycling Services',
  'Grounds Maintenance', 'Window Cleaning', 'Carpet Cleaning', 'Pressure Washing',
  'Graffiti Removal', 'Restoration Services', 'Flood Remediation', 'Fire Damage Restoration',
  'Asbestos Removal', 'Mould Remediation', 'Hygiene Services', 'Sanitation Services',
  'Concierge Services', 'Caretaking', 'Strata Management', 'Property Inspection',
  // Trades (23)
  'Electrical Contracting', 'Plumbing Contracting', 'Gas Fitting', 'Air Conditioning Installation',
  'Refrigeration Services', 'Solar Installation', 'Roofing', 'Tiling',
  'Painting & Decorating', 'Carpentry', 'Concreting', 'Bricklaying',
  'Plastering', 'Glazing', 'Flooring Installation', 'Insulation Installation',
  'Waterproofing', 'Scaffolding', 'Rigging', 'Welding',
  'Metal Fabrication', 'Locksmithing', 'Lift Maintenance',
  // Construction (17)
  'General Construction', 'Civil Construction', 'Demolition', 'Excavation',
  'Earthmoving', 'Road Construction', 'Bridge Construction', 'Pipeline Installation',
  'Structural Engineering', 'Project Management', 'Site Supervision', 'Quantity Surveying',
  'Building Inspection', 'Surveying', 'Drafting', 'Architecture',
  'Interior Design',
  // Security (9)
  'Security Guarding', 'Mobile Patrol', 'Alarm Monitoring', 'CCTV Installation',
  'Access Control', 'Crowd Control', 'Cash in Transit', 'Cyber Security',
  'Loss Prevention',
  // Healthcare (15)
  'Aged Care', 'Disability Support', 'Home Care', 'Community Nursing',
  'Allied Health', 'Physiotherapy', 'Occupational Therapy', 'Speech Therapy',
  'Mental Health Support', 'Drug & Alcohol Services', 'Palliative Care', 'Childcare',
  'Early Childhood Education', 'School Support', 'Medical Transport',
  // Hospitality (10)
  'Hotel Management', 'Restaurant Services', 'Catering', 'Event Catering',
  'Bar Services', 'Housekeeping', 'Concierge', 'Food Delivery',
  'Vending Services', 'Coffee Services',
  // Retail (10)
  'Retail Merchandising', 'Visual Merchandising', 'Stock Management', 'Retail Cleaning',
  'Loss Prevention Retail', 'Mystery Shopping', 'Retail Audit', 'Pop-up Retail',
  'Market Stall Operations', 'Vending Machine Servicing',
  // Logistics (10)
  'Courier Services', 'Freight Transport', 'Warehousing', 'Pick & Pack',
  'Last Mile Delivery', 'Cold Chain Logistics', 'Dangerous Goods Transport', 'Removalist Services',
  'Furniture Delivery', 'Medical Courier',
  // Automotive (9)
  'Mobile Mechanic', 'Roadside Assistance', 'Fleet Maintenance', 'Tyre Services',
  'Auto Detailing', 'Windscreen Repair', 'Panel Beating', 'Smash Repairs',
  'Vehicle Inspection',
  // Agriculture (8)
  'Crop Management', 'Livestock Management', 'Irrigation Services', 'Pest & Weed Control',
  'Harvesting', 'Farm Labour', 'Horticulture', 'Viticulture',
  // Education (6)
  'Tutoring', 'Training & Assessment', 'Corporate Training', 'First Aid Training',
  'Safety Training', 'Vocational Education',
  // Government (5)
  'Local Government Services', 'Infrastructure Maintenance', 'Public Space Cleaning', 'Parks & Gardens',
  'Council Compliance',
  // Emergency Services (6)
  'Fire Protection', 'Fire Suppression Maintenance', 'Emergency Response', 'Hazmat Services',
  'Search & Rescue Support', 'Ambulance Support Services',
  // Mining & Resources (6)
  'Mine Site Services', 'Drilling Support', 'Mine Maintenance', 'Camp Management',
  'Environmental Monitoring', 'Geotechnical Services',
  // Manufacturing (8)
  'Production Line Services', 'Quality Inspection', 'Machine Maintenance', 'Tool & Die',
  'Assembly Services', 'Packaging Services', 'Forklift Operations', 'Inventory Management',
  // Professional Services (6)
  'IT Field Services', 'Telecommunications', 'Meter Reading', 'Data Collection',
  'Field Research', 'Audit Services',
  // Utilities (6)
  'Electrical Network Maintenance', 'Gas Network Maintenance', 'Water Network Maintenance', 'Meter Installation',
  'Smart Grid Services', 'Renewable Energy Maintenance',
  // Recreation (6)
  'Sports Ground Maintenance', 'Pool Maintenance', 'Gym Equipment Maintenance', 'Event Setup',
  'Amusement Ride Inspection', 'Playground Maintenance',
  // Animal Services (5)
  'Veterinary Support', 'Animal Control', 'Pet Grooming', 'Dog Walking',
  'Animal Shelter Services',
  // Personal Services (5)
  'Mobile Hairdressing', 'Mobile Beauty', 'Personal Training', 'Massage Therapy',
  'Home Cleaning',
  // Marine (5)
  'Boat Maintenance', 'Marine Cleaning', 'Dock Services', 'Marine Inspection',
  'Underwater Services',
  // Aviation (4)
  'Aircraft Maintenance', 'Ground Handling', 'Airport Cleaning', 'Baggage Services',
  // Religious & Community (5)
  'Community Services', 'Volunteer Coordination', 'Church Maintenance', 'Charity Operations',
  'Social Enterprise Services',
  // Event Services (6)
  'Event Management', 'Event Cleaning', 'Event Security', 'AV & Technical Services',
  'Staging & Rigging', 'Event Staffing',
  // Franchise Operations (5)
  'Franchise Cleaning', 'Franchise Maintenance', 'Franchise Inspection', 'Franchise Training',
  'Franchise Compliance',
  // Home Services (6)
  'Handyman Services', 'Garden Maintenance', 'Pool Cleaning', 'Gutter Cleaning',
  'Home Inspection', 'Smart Home Installation',
  // Inspection Services (7)
  'Building Inspection', 'Pre-Purchase Inspection', 'Safety Inspection', 'Compliance Audit',
  'Environmental Audit', 'Food Safety Inspection', 'Equipment Inspection',
  // Tourism (5)
  'Tour Operations', 'Tourism Transport', 'Accommodation Services', 'Tourism Cleaning',
  'Visitor Services',
  // Specialist Services (6)
  'Forensic Cleaning', 'Trauma Cleaning', 'Biohazard Cleaning', 'High-Rise Cleaning',
  'Rope Access Services', 'Confined Space Services',
  // Other
  'Other Field Services',
];

const companySizes = [
  { value: '1-5', label: '1–5 employees' },
  { value: '6-20', label: '6–20 employees' },
  { value: '21-50', label: '21–50 employees' },
  { value: '51-200', label: '51–200 employees' },
  { value: '200+', label: '200+ employees' },
];

const steps = [
  { id: 1, label: 'Company', icon: Building2 },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Operations', icon: Briefcase },
  { id: 4, label: 'Done', icon: CheckCircle2 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [industrySearch, setIndustrySearch] = useState('');
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    abn: '',
    industry: '',
    companySize: '',
    address: '',
    city: '',
    state: 'NSW',
    postcode: '',
    phone: '',
    website: '',
    primaryService: '',
    teamSize: '',
  });

  const update = (field: keyof OnboardingData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const filteredIndustries = industrySearch.trim()
    ? industries.filter((ind) => ind.toLowerCase().includes(industrySearch.toLowerCase()))
    : industries;

  const handleSkip = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: {
          onboarding_complete: true,
          onboarding_skipped: true,
        },
      });
    } catch {
      // Skip onboarding error — redirect to dashboard regardless
    }
    router.push('/dashboard');
  };

  const canProceed = () => {
    if (step === 1) return data.companyName.trim().length > 0 && data.industry.length > 0;
    if (step === 2) return data.city.trim().length > 0 && data.state.length > 0;
    if (step === 3) return data.companySize.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: data.companyName,
          abn: data.abn || null,
          industry: data.industry,
          size: data.companySize,
          address: data.address,
          city: data.city,
          state: data.state,
          postcode: data.postcode,
          phone: data.phone,
          website: data.website,
          primary_service: data.primaryService,
          owner_id: user?.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      await supabase.auth.updateUser({
        data: {
          company_id: company.id,
          company_name: data.companyName,
          role: 'admin',
          onboarding_complete: true,
        },
      });

      await supabase.from('user_roles').upsert({
        user_id: user?.id,
        company_id: company.id,
        role: 'admin',
      }, { onConflict: 'user_id,company_id' });

      await supabase.from('activity_log').insert({
        user_id: user?.id,
        company_id: company.id,
        action: 'company_created',
        entity_type: 'company',
        entity_id: company.id,
        description: `Company "${data.companyName}" created during onboarding`,
      });

      // Force session refresh so the in-memory JWT picks up the updated
      // user_metadata (company_id, role, onboarding_complete) written by
      // updateUser() above. Without this the AuthContext user object still
      // carries the pre-onboarding metadata and AppLayout re-routes to /onboarding.
      await supabase.auth.refreshSession();

      setStep(4);
    } catch {
      // Onboarding save error — user can retry
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted-foreground';
  const labelClass = 'block text-sm font-600 text-foreground mb-1.5';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AppLogo variant="full" size={36} />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--secondary)',
                      color: isDone || isActive ? 'white' : 'var(--muted-foreground)',
                    }}
                  >
                    {isDone ? <CheckCircle2 size={18} /> : <StepIcon size={18} />}
                  </div>
                  <span className="text-xs font-500" style={{ color: isActive ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className="flex-1 h-px mt-[-16px]"
                    style={{ backgroundColor: step > s.id ? 'var(--success)' : 'var(--border)' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div className="card-elevated p-8">
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-700 text-foreground">Tell us about your company</h2>
                <p className="text-sm text-muted-foreground mt-1">This helps us configure your workspace correctly</p>
              </div>
              <div>
                <label className={labelClass}>Company Name *</label>
                <input
                  suppressHydrationWarning
                  type="text"
                  className={inputClass}
                  placeholder="Acme Cleaning Services Pty Ltd"
                  value={data.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  ABN <span className="text-muted-foreground font-400">(optional)</span>
                </label>
                <input
                  suppressHydrationWarning
                  type="text"
                  className={inputClass}
                  placeholder="12 345 678 901"
                  value={data.abn}
                  onChange={(e) => update('abn', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Industry * <span className="text-muted-foreground font-400 text-xs">(247 industries across 29 sectors)</span></label>
                {/* Search */}
                <input
                  suppressHydrationWarning
                  type="text"
                  className={`${inputClass} mb-2`}
                  placeholder="Search industries..."
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                />
                {data.industry && (
                  <div className="mb-2 px-3 py-2 rounded-lg text-sm font-600 text-accent" style={{ backgroundColor: 'rgba(37,99,235,0.08)', border: '1px solid var(--accent)' }}>
                    ✓ Selected: {data.industry}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  {filteredIndustries.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">No industries match your search</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {filteredIndustries.map((ind) => (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => update('industry', ind)}
                          className="w-full px-3 py-2.5 text-xs font-500 text-left transition-all hover:bg-secondary"
                          style={{
                            backgroundColor: data.industry === ind ? 'rgba(37,99,235,0.08)' : undefined,
                            color: data.industry === ind ? 'var(--accent)' : 'var(--foreground)',
                          }}
                        >
                          {data.industry === ind && '✓ '}{ind}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-700 text-foreground">Where are you based?</h2>
                <p className="text-sm text-muted-foreground mt-1">Your primary business address</p>
              </div>
              <div>
                <label className={labelClass}>Street Address</label>
                <input
                  suppressHydrationWarning
                  type="text"
                  className={inputClass}
                  placeholder="123 Main Street"
                  value={data.address}
                  onChange={(e) => update('address', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>City / Suburb *</label>
                  <input
                    suppressHydrationWarning
                    type="text"
                    className={inputClass}
                    placeholder="Sydney"
                    value={data.city}
                    onChange={(e) => update('city', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Postcode</label>
                  <input
                    suppressHydrationWarning
                    type="text"
                    className={inputClass}
                    placeholder="2000"
                    value={data.postcode}
                    onChange={(e) => update('postcode', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>State *</label>
                <select
                  suppressHydrationWarning
                  className={inputClass}
                  value={data.state}
                  onChange={(e) => update('state', e.target.value)}
                >
                  {['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    suppressHydrationWarning
                    type="tel"
                    className={inputClass}
                    placeholder="+61 2 9000 0000"
                    value={data.phone}
                    onChange={(e) => update('phone', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Website</label>
                  <input
                    suppressHydrationWarning
                    type="url"
                    className={inputClass}
                    placeholder="https://yourcompany.com.au"
                    value={data.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-700 text-foreground">Your operations</h2>
                <p className="text-sm text-muted-foreground mt-1">Help us set up the right tools for your team</p>
              </div>
              <div>
                <label className={labelClass}>Company Size *</label>
                <div className="space-y-2">
                  {companySizes.map((cs) => (
                    <button
                      key={cs.value}
                      type="button"
                      onClick={() => update('companySize', cs.value)}
                      className="w-full px-4 py-3 text-sm font-600 rounded-xl border text-left transition-all flex items-center justify-between"
                      style={{
                        borderColor: data.companySize === cs.value ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: data.companySize === cs.value ? 'rgba(37,99,235,0.08)' : 'var(--card)',
                        color: data.companySize === cs.value ? 'var(--accent)' : 'var(--foreground)',
                      }}
                    >
                      <span>{cs.label}</span>
                      {data.companySize === cs.value && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Primary Service Type</label>
                <input
                  suppressHydrationWarning
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Commercial office cleaning"
                  value={data.primaryService}
                  onChange={(e) => update('primaryService', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-4 animate-fade-in py-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-success" />
              </div>
              <h2 className="text-xl font-700 text-foreground">You&apos;re all set!</h2>
              <p className="text-sm text-muted-foreground">
                Your workspace for <strong>{data.companyName}</strong> is ready. Let&apos;s get started.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { label: 'Add Contractors', href: '/contractors' },
                  { label: 'Create a Job', href: '/jobs' },
                  { label: 'View Dashboard', href: '/dashboard' },
                ].map((item) => (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="px-3 py-3 rounded-xl border text-xs font-600 transition-all hover:bg-secondary"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3.5 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <button
                onClick={() => step > 1 ? setStep(step - 1) : handleSkip()}
                className="px-4 py-2 rounded-xl text-sm font-600 border transition-all hover:bg-secondary"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {step === 1 ? 'Skip for now' : 'Back'}
              </button>
              <button
                onClick={() => step < 3 ? setStep(step + 1) : handleFinish()}
                disabled={!canProceed() || saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-700 text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Setting up…</>
                ) : step === 3 ? (
                  'Finish Setup'
                ) : (
                  <><span>Continue</span><ChevronRight size={16} /></>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update all of this later in Settings
        </p>
      </div>
    </div>
  );
}
