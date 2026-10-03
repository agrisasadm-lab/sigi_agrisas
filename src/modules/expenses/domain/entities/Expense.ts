export interface ExpenseProps {
  branchId: string;
  branchName: string | null;
  concept: string;
  amount: string;
  notes: string | null;
  photoUrl: string | null;
  expenseDate: Date;
  creatorId: string;
  creatorName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Expense {
  readonly id: string;
  readonly branchId: string;
  readonly branchName: string | null;
  readonly concept: string;
  readonly amount: string;
  readonly notes: string | null;
  readonly photoUrl: string | null;
  readonly expenseDate: Date;
  readonly creatorId: string;
  readonly creatorName: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(id: string, props: ExpenseProps) {
    this.id = id;
    this.branchId = props.branchId;
    this.branchName = props.branchName;
    this.concept = props.concept;
    this.amount = props.amount;
    this.notes = props.notes;
    this.photoUrl = props.photoUrl;
    this.expenseDate = props.expenseDate;
    this.creatorId = props.creatorId;
    this.creatorName = props.creatorName;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(id: string, props: ExpenseProps): Expense {
    return new Expense(id, props);
  }
}
