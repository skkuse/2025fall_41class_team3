export interface BasicInfo {
  nickname: string;
  email: string;
  birthDate: string; // YYYY-MM-DD
  location: string;
}

export interface DetailInfo {
  income?: number | "";
  maritalStatus?: "기혼" | "미혼" | "";
  education?: string;
  major?: string;
  employmentStatus: string[];
  specialGroup: string[];
  interests: string[];
}

export interface MyPageData {
  basic: BasicInfo;
  detail: DetailInfo;
}

export interface FieldOption {
  label: string;
  value: string;
}
