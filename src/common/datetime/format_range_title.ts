import type { HassConfig } from "home-assistant-js-websocket";
import type { FrontendLocaleData } from "../../data/translation";
import { capitalizeFirstLetter } from "../string/capitalize-first-letter";
import { formatDate, formatDateShort } from "./format_date";

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatRangeTitle = (
  start: Date,
  end: Date,
  locale: FrontendLocaleData,
  config: HassConfig
): string => {
  const lastMoment = new Date(Math.max(start.getTime(), end.getTime() - 1));
  const startDay = startOfDay(start);
  const endDay = startOfDay(lastMoment);
  if (startDay.getTime() === endDay.getTime()) {
    const today = startOfDay(new Date());
    const diffDays = Math.round(
      (today.getTime() - startDay.getTime()) / 86400000
    );
    if (diffDays === 0 || diffDays === 1) {
      const rtf = new Intl.RelativeTimeFormat(locale.language, {
        numeric: "auto",
      });
      return capitalizeFirstLetter(rtf.format(-diffDays, "day"));
    }
    return formatDate(start, locale, config);
  }
  return `${formatDateShort(start, locale, config)} – ${formatDateShort(
    lastMoment,
    locale,
    config
  )}`;
};
