/**
 * The "Store demo" mode's fake catalog (docs/fix.txt).
 *
 * Pure, hardcoded constants: no network, no database, no env, no portfolio
 * data. Client-safe — the chat UI imports the sample hints directly, and the
 * two local tools read the same objects on the server.
 *
 * "Demo Store" is a fictional clothing store. Every price carries the
 * currency prefix exactly ONCE ("Rs. 2,500") — never doubled ("Rs.Rs.").
 */

export const STORE_DEMO_NAME = "Demo Store";

export type StoreDemoProduct = {
  name: string;
  /** The shelf price, currency prefix written once. */
  price: string;
  stock: number;
  sizes?: string[];
};

export type StoreDemoOrder = {
  orderNumber: string;
  items: string[];
  status: "Processing" | "Shipped" | "Delivered" | "Cancelled";
  expectedDelivery: string;
  city: string;
};

export const STORE_DEMO_PRODUCTS: StoreDemoProduct[] = [
  { name: "Hoodie", price: "Rs. 2,500", stock: 24, sizes: ["S", "M", "L", "XL"] },
  { name: "Sneakers", price: "Rs. 4,200", stock: 8, sizes: ["40", "41", "42", "43", "44"] },
  { name: "Denim Jacket", price: "Rs. 3,800", stock: 0, sizes: ["M", "L"] },
  { name: "Cotton T-Shirt", price: "Rs. 1,200", stock: 42, sizes: ["S", "M", "L", "XL"] },
  { name: "Cargo Pants", price: "Rs. 2,900", stock: 15, sizes: ["30", "32", "34", "36"] },
  { name: "Wool Cap", price: "Rs. 900", stock: 5 },
];

export const STORE_DEMO_ORDERS: StoreDemoOrder[] = [
  {
    orderNumber: "1021",
    items: ["Hoodie x1"],
    status: "Delivered",
    expectedDelivery: "Delivered on 12 October",
    city: "Lahore",
  },
  {
    orderNumber: "1022",
    items: ["Sneakers x1", "Cotton T-Shirt x2"],
    status: "Shipped",
    expectedDelivery: "Expected by 2 November",
    city: "Karachi",
  },
  {
    orderNumber: "1023",
    items: ["Denim Jacket x1"],
    status: "Processing",
    expectedDelivery: "Expected by 6 November",
    city: "Islamabad",
  },
  {
    orderNumber: "1024",
    items: ["Cargo Pants x1", "Wool Cap x1"],
    status: "Shipped",
    expectedDelivery: "Expected by 3 November",
    city: "Lahore",
  },
  {
    orderNumber: "1025",
    items: ["Cotton T-Shirt x3"],
    status: "Cancelled",
    expectedDelivery: "Refunded on 20 October",
    city: "Multan",
  },
  {
    orderNumber: "1026",
    items: ["Hoodie x2"],
    status: "Processing",
    expectedDelivery: "Expected by 8 November",
    city: "Faisalabad",
  },
];

/** Sample order numbers for the "Try this" hint in the drawer. */
export const STORE_DEMO_SAMPLE_ORDER_NUMBERS = ["1021", "1022", "1023"];

/** Sample product names for the "Try this" hint in the drawer. */
export const STORE_DEMO_SAMPLE_PRODUCT_NAMES = ["Hoodie", "Sneakers", "Denim Jacket"];
