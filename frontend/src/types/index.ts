export interface Tag {
  id: number;
  slug: string;
  label: string;
}
export interface Author {
  id: number;
  display_name: string;
  role: string;
}
export interface Prompt {
  key: string;
  label: string;
  answer: string;
  order: number;
  visible: boolean;
}
export interface ProfilePhoto {
  id: number;
  url: string;
  caption: string;
  order: number;
}
export interface PromptOption {
  key: string;
  label: string;
}
export interface Profile extends Author {
  pronouns: string;
  bio: string;
  university: string;
  goals: string;
  intent: 'learn' | 'mentor' | 'both';
  discoverable: boolean;
  onboarding_complete: boolean;
  interests: number[];
  skills: number[];
  learning: number[];
  prompts: Prompt[];
  reasons: string[];
  saved: boolean;
  photos: ProfilePhoto[];
  resume_url: string;
  linkedin_url: string;
  github_url: string;
}
export interface User {
  id: number;
  email: string;
  profile: Profile;
}
export interface Room {
  id: number;
  host: Author;
  title: string;
  description: string;
  format: string;
  tags: number[];
  starts_at: string;
  ends_at: string;
  meeting_url?: string;
  status: 'scheduled' | 'cancelled';
  rsvp_status: 'going' | 'cancelled' | 'removed' | null;
  attendee_count: number;
  is_owner: boolean;
}
export interface Project {
  id: number;
  owner: Author;
  title: string;
  description: string;
  tags: number[];
  needed_skills: number[];
  repository_url: string;
  status: 'open' | 'closed';
  interest_status: 'pending' | 'withdrawn' | null;
  is_owner: boolean;
}
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface HomeData {
  rooms: Room[];
  mentors: Profile[];
  projects: Project[];
}
export interface Attendee {
  user: Author;
  status: string;
}
export interface Interest {
  requester: Author;
  introduction: string;
  status: string;
  updated_at: string;
}
export interface Connection {
  id: number;
  member: Profile;
  direction: 'incoming' | 'outgoing';
  target: { kind: string; label: string; text: string; url?: string | null };
  note: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  created_at: string;
}
export interface Message {
  id: number;
  sender: Author;
  body: string;
  created_at: string;
}
export interface SharedResource {
  id: number;
  owner: Author;
  is_owner: boolean;
  title: string;
  description: string;
  category: string;
  sharing: 'loan' | 'give';
  condition: string;
  location: string;
  status: 'available' | 'paused' | 'given';
  reservations: { start_date: string; end_date: string }[];
  my_request: { id: number; status: string } | null;
}
export interface BorrowRequest {
  id: number;
  resource: SharedResource;
  borrower: Author;
  project: number | null;
  project_title: string | null;
  is_owner: boolean;
  start_date: string;
  end_date: string;
  note: string;
  owner_note: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'returned' | 'collected';
  created_at: string;
}
export type Impact = {
  parts_shared: number;
  parts_reused: number;
  active_loans: number;
  weekly: { day: string; event_type: string; events: number }[];
  live_rollup: boolean;
};
