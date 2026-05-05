export interface Character {
  id: string;
  user_id: string;
  name: string;
  description: string;
  itemId?: string;
  color?: string;
  created_at: number;
}
