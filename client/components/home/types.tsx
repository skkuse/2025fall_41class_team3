export interface PolicyCardData {
  id: number;
  title: string;
  summary: string;
  reason?: string;
  tags?: string[];
}

export interface PolicyDetail extends PolicyCardData {
  description?: string;
  support?: string;
  applyMethod?: string;
  applyPeriod?: string;
  projectPeriod?: string;
  category?: string;
  rating?: number;
  badge?: string;
}
