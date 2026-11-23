// Queensland-wide public holidays with the appointed City of Redland show holiday.
// Sources: https://www.qld.gov.au/recreation/travel/holidays/public
// and https://www.qld.gov.au/recreation/travel/holidays/show
// Show holidays are regional appointments: never infer Redland dates for unpublished years.
// Christmas Eve is a PART-DAY holiday from 18:00; it is displayed as a notice only,
// not treated as a full-day holiday for daily posting targets.
const entries=[
  ['2026-01-01',"New Year's Day"],['2026-01-26','Australia Day'],
  ['2026-04-03','Good Friday'],['2026-04-04','The day after Good Friday'],
  ['2026-04-05','Easter Sunday'],['2026-04-06','Easter Monday'],
  ['2026-04-25','Anzac Day'],['2026-05-04','Labour Day'],
  ['2026-08-10','Royal Queensland Show (City of Redland)'],
  ['2026-10-05',"King's Birthday"],['2026-12-25','Christmas Day'],
  ['2026-12-26','Boxing Day'],['2026-12-28','Additional Boxing Day holiday'],
  ['2027-01-01',"New Year's Day"],['2027-01-26','Australia Day'],
  ['2027-03-26','Good Friday'],['2027-03-27','The day after Good Friday'],
  ['2027-03-28','Easter Sunday'],['2027-03-29','Easter Monday'],
  ['2027-04-26','Anzac Day observed'],['2027-05-03','Labour Day'],
  ['2027-08-09','Royal Queensland Show (City of Redland)'],
  ['2027-10-04',"King's Birthday"],['2027-12-25','Christmas Day'],
  ['2027-12-26','Boxing Day'],['2027-12-27','Additional Christmas Day holiday'],
  ['2027-12-28','Additional Boxing Day holiday'],
  ['2028-01-01',"New Year's Day"],['2028-01-03',"Additional New Year's Day holiday"],
  ['2028-01-26','Australia Day'],['2028-04-14','Good Friday'],
  ['2028-04-15','The day after Good Friday'],['2028-04-16','Easter Sunday'],
  ['2028-04-17','Easter Monday'],['2028-04-25','Anzac Day'],
  ['2028-05-01','Labour Day'],['2028-10-02',"King's Birthday"],
  ['2028-12-25','Christmas Day'],['2028-12-26','Boxing Day'],
  ['2029-01-01',"New Year's Day"],['2029-01-26','Australia Day'],
  ['2029-03-30','Good Friday'],['2029-03-31','The day after Good Friday'],
  ['2029-04-01','Easter Sunday'],['2029-04-02','Easter Monday'],
  ['2029-04-25','Anzac Day'],['2029-05-07','Labour Day'],
  ['2029-10-01',"King's Birthday"],['2029-12-25','Christmas Day'],
  ['2029-12-26','Boxing Day']
];
export const QLD_REDLAND_PUBLIC_HOLIDAYS=Object.freeze(Object.fromEntries(entries));
const publicHoliday=new Map(entries);
const oneDay=86400000;
const asDate=day=>Date.parse(day+'T00:00:00Z');
const formatDate=ms=>new Date(ms).toISOString().slice(0,10);
const weekday=day=>new Date(asDate(day)).getUTCDay();
const nonworkingDay=day=>Boolean(publicHoliday.get(day))||[0,6].includes(weekday(day));
export function calendarDaySignals(day){
  const start=asDate(day),dow=weekday(day);
  const name=publicHoliday.get(day)||'';
  let lower=start,upper=start;
  for(let n=0;n<6&&nonworkingDay(formatDate(lower-oneDay));n++)lower-=oneDay;
  for(let n=0;n<6&&nonworkingDay(formatDate(upper+oneDay));n++)upper+=oneDay;
  const days=(upper-lower)/oneDay+1;
  const longWeekend=nonworkingDay(day)&&days>=3&&
    Array.from({length:days},(_,i)=>weekday(formatDate(lower+i*oneDay))).some(w=>w===0||w===6);
  return {
    publicHoliday:Boolean(name),publicHolidayName:name,longWeekend,
    partialPublicHoliday:day.endsWith('-12-24')?'Christmas Eve (from 6 pm)':'',
    redlandShowHoliday:name.includes('City of Redland'),
    weekday:dow
  };
}
