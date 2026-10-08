export interface SaleItemProps {
  id: string;
  saleId: string;
  productId: string;
  productPriceId: string | null;
  dosificationId: string | null;
  numPartsSnapshot: number | null;
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

export class SaleItem {
  readonly id: string;
  readonly saleId: string;
  readonly productId: string;
  readonly productPriceId: string | null;
  readonly dosificationId: string | null;
  readonly numPartsSnapshot: number | null;
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

  private constructor(props: SaleItemProps) {
    Object.assign(this, props);
    this.id = props.id;
    this.saleId = props.saleId;
    this.productId = props.productId;
    this.productPriceId = props.productPriceId;
    this.dosificationId = props.dosificationId;
    this.numPartsSnapshot = props.numPartsSnapshot;
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

  static create(props: SaleItemProps): SaleItem {
    return new SaleItem(props);
  }
}
