export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isCredit: boolean;
  createdAt: Date;
  updatedAt: Date;
}
