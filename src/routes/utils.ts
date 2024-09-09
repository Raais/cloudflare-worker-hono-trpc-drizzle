import { Hono } from "hono";
import moment from "moment";
import hmoment from "moment-hijri";
import { DHIVEHI_DAYS, DHIVEHI_MONTHS, HIJRI_MONTHS } from "./constants";

const utils = new Hono<{
  Bindings: {
    KV: KVNamespace;
  };
}>();

utils.get("/", (c) => c.text("Utilities for doing stuff.", 200));

utils.all("/datedhivehi", async (c) => {
  const date = new Date();
  const { dhivehi, hijri, day } = await dateToDhivehi(date);
  return c.json({ dhivehi, hijri, day });
});

export { utils };

export interface DhivehiDate {
  dhivehi: string;
  hijri: string;
  day: string;
}

const dateToDhivehi = async (date: Date = new Date()): Promise<DhivehiDate> => {
  const m = moment(date);
  const hm = hmoment(date);

  if (!m.isValid()) throw new Error("Invalid date.");

  const dhivehi = `\u{200E}${m.year()}\u{200E} \u{200F}${
    DHIVEHI_MONTHS[m.month()]
  }\u{200F} \u{200E}${m.date()}\u{200E}`;

  const hijri = `\u{200E}${hm.iYear()}\u{200E} \u{200F}${
    HIJRI_MONTHS[hm.iMonth()]
  }\u{200F} \u{200E}${hm.iDate()}\u{200E}`;

  const day = `\u{200F}${DHIVEHI_DAYS[m.day()]}\u{200F}`;

  return { dhivehi, hijri, day };
};
