declare module "node:dns" {
  export function setDefaultResultOrder(order: "ipv4first" | "verbatim"): void;
}
