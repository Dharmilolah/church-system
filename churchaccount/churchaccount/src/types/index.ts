export interface Church {
  id: string;
  name: string;
  church_code: string;
  plan: string;
  created_at: string;
}

export interface Branch {
  id: string;
  church_id: string;
  name: string;
  address: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
  role: "admin" | "treasurer";
  church_id: string;
}

export interface Member {
  id: string;
  church_id: string;
  branch_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  added_by: string | null;
  added_at: string;
  branches?: Branch;
}

export interface TitheRecord {
  id: string;
  church_id: string;
  branch_id: string | null;
  member_id: string | null;
  member_name: string | null;
  amount: number;
  date: string;
  is_anonymous: boolean;
  recorded_by: string | null;
  recorded_at: string;
  members?: Member;
  branches?: Branch;
}

export interface Transaction {
  id: string;
  church_id: string;
  branch_id: string | null;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  description: string | null;
  added_by: string | null;
  added_at: string;
  branches?: Branch;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  church_id: string;
}

export interface DashboardStats {
  totalMembers: number;
  totalTithes: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}
