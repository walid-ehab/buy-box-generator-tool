// Every free-text / image field from the BuyBox template that is not driven by data.
export interface FieldDef { id: string; label: string; placeholder?: string; rows?: number; single?: boolean; link?: boolean }
export interface GroupDef {
  id: string; eyebrow: string; title: string; intro?: string;
  fields: FieldDef[];
  images?: { id: string; label: string; hint?: string }[];
  subgroups?: { title: string; fields: FieldDef[] }[];
  /** if set, the group renders as side-by-side blocks: text fields on the left, their own reference images on the right */
  blocks?: { title: string; fields: string[]; images: string; custom?: string }[];
}

export const REG_TIERS = [
  { v: 'green', label: 'Investor-friendly', emoji: '🟢' },
  { v: 'amber', label: 'Moderate / conditional', emoji: '🟡' },
  { v: 'red', label: 'Restrictive', emoji: '🔴' },
] as const;

export const REGULATIONS: GroupDef = {
  id: 'regs', eyebrow: 'Compliance', title: 'STR regulations',
  intro: 'What an investor needs to know before underwriting a property here.',
  fields: [
    { id: 'regSummary', label: 'Regulation summary', rows: 3, placeholder: 'e.g. Protected by state preemption (statute §…) preventing outright municipal prohibitions. Unrestricted investor ownership with low administrative friction.' },
    { id: 'permit', label: 'Permit / license required?', rows: 2, placeholder: 'Y/N and details — application, renewal, inspection requirements' },
    { id: 'residency', label: 'Primary residence required?', rows: 2, placeholder: 'Y/N — are non-owner-occupied / corporate-owned properties permitted?' },
  ],
  subgroups: [
    {
      title: 'Operating limits',
      fields: [
        { id: 'cutoff', label: 'Cutoff & duration', rows: 2, placeholder: 'Defined as any stay under 30 consecutive days.' },
        { id: 'occLimits', label: 'Occupancy limits', rows: 2, placeholder: 'e.g. 2 guests per bedroom + 2 additional' },
        { id: 'caps', label: 'Caps & density limits', rows: 2, placeholder: 'Permit caps, density quotas, distance buffers' },
        { id: 'nightly', label: 'Nightly caps', rows: 2, placeholder: 'Max rental nights per year, if any' },
        { id: 'parking', label: 'Parking requirements', rows: 2 },
        { id: 'permitFee', label: 'Municipal permit fee', rows: 1, single: true, placeholder: '$0' },
        { id: 'taxes', label: 'Stacked lodging taxes', rows: 4, placeholder: '~17.5% total, made up of:\n5.5% State sales tax\n…' },
      ],
    },
    {
      title: 'Investor notes',
      fields: [
        { id: 'protections', label: 'Regulatory protections', rows: 3 },
        { id: 'boundary', label: 'Jurisdictional boundary warning', rows: 3, placeholder: 'e.g. Unincorporated county enforces stricter zoning — ensure the parcel is inside city limits.' },
        { id: 'records', label: 'Recordkeeping mandates', rows: 3 },
        { id: 'emerging', label: 'Emerging regulations', rows: 3 },
      ],
    },
  ],
  images: [{ id: 'regImages', label: 'Reference images', hint: 'Ordinance excerpts, permit screenshots, zoning maps…' }],
};

export const PROFILE: GroupDef = {
  id: 'profile', eyebrow: 'Style', title: 'Property Style',
  fields: [
    { id: 'style', label: 'Architectural style', rows: 2, placeholder: 'e.g. Both modern and older houses work.' },
    { id: 'backyard', label: 'Backyard size', rows: 2, placeholder: 'e.g. Big enough for a pool, hot tub and fire pit.' },
  ],
  images: [
    { id: 'styleImages', label: 'Reference images' },
    { id: 'backyardImages', label: 'Reference images' },
    { id: 'geoImages', label: 'Reference images' },
  ],
  blocks: [
    { title: 'Architectural style', fields: ['style'], images: 'styleImages' },
    { title: 'Backyard', fields: ['backyard'], images: 'backyardImages' },
    { title: 'View, waterfront & privacy', fields: [], images: 'geoImages', custom: 'setting' },
  ],
};

export const TRAVELERS: GroupDef = {
  id: 'travelers', eyebrow: 'Guests', title: 'Traveler demographics',
  fields: [{ id: 'icp', label: 'Traveler ICP', rows: 3, placeholder: 'e.g. Group trip (business and family) — who is the ideal guest, and what does the chart above tell us?' }],
};

export const COMPS: GroupDef[] = [
  {
    id: 'design', eyebrow: 'Design', title: 'Design comp set',
    fields: [
      { id: 'designNotes', label: 'Design style of top-performing comps', rows: 3 },
      { id: 'designLink', label: 'Alexandria design comp set', link: true },
    ],
    images: [{ id: 'designImages', label: 'Design examples' }],
  },
  {
    id: 'revcomp', eyebrow: 'Revenue', title: 'Revenue comp set',
    fields: [
      { id: 'revCompNotes', label: 'Revenue comps for this buy box', rows: 3 },
      { id: 'revCompLink', label: 'Alexandria revenue comp set', link: true },
    ],
    images: [{ id: 'revCompImages', label: 'Revenue comp screenshots' }],
  },
];
