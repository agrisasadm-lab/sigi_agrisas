export interface QuoteItemProps {
  id: string;
  quoteId: string;
  productId: string;
  productPriceId: string | null;
  productCodeSnapshot: string;
  productNameSnapshot: string;
  priceNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  discountPct: number | null;
  discountAmount: number;
  ivaRate: number | null;
  iepsRate: number | null;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export class QuoteItem {
  readonly id: string;
  readonly quoteId: string;
  readonly productId: string;
  readonly productPriceId: string | null;
  readonly productCodeSnapshot: string;
  readonly productNameSnapshot: string;
  readonly priceNameSnapshot: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPct: number | null;
  readonly discountAmount: number;
  readonly ivaRate: number | null;
  readonly iepsRate: number | null;
  readonly lineSubtotal: number;
  readonly lineTax: number;
  readonly lineTotal: number;

  private constructor(props: QuoteItemProps) {
    this.id = props.id;
    this.quoteId = props.quoteId;
    this.productId = props.productId;
    this.productPriceId = props.productPriceId;
    this.productCodeSnapshot = props.productCodeSnapshot;
    this.productNameSnapshot = props.productNameSnapshot;
    this.priceNameSnapshot = props.priceNameSnapshot;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discountPct = props.discountPct;
    this.discountAmount = props.discountAmount;
    this.ivaRate = props.ivaRate;
    this.iepsRate = props.iepsRate;
    this.lineSubtotal = props.lineSubtotal;
    this.lineTax = props.lineTax;
    this.lineTotal = props.lineTotal;
  }

  static create(props: QuoteItemProps): QuoteItem {
    return new QuoteItem(props);
  }
}
