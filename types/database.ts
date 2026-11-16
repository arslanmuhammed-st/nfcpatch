export type NfcType = 'standard' | 'anti_metal'
export type ProductStatus = 'unassigned' | 'active' | 'disabled'

export interface Business {
  id: string
  business_name: string
  google_review_url: string
  city: string | null
  notes: string | null
  created_at: string
}

export interface Product {
  id: string
  product_code: string
  display_code: string
  nfc_type: NfcType
  status: ProductStatus
  business_id: string | null
  activated_at: string | null
  created_at: string
  businesses?: Business | Business[] | null
}

export function getProductBusiness(product: Product): Business | null {
  if (!product.businesses) return null
  if (Array.isArray(product.businesses)) {
    return product.businesses[0] || null
  }
  return product.businesses
}
