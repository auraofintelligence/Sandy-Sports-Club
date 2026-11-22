const education = 'https://education.qld.gov.au/about-us/calendar/';
const breaks = [
  ['2025-12-13','2026-01-26'], ['2026-04-03','2026-04-19'], ['2026-06-27','2026-07-12'], ['2026-09-19','2026-10-05'], ['2026-12-12','2027-01-26'],
  ['2027-03-26','2027-04-11'], ['2027-06-26','2027-07-11'], ['2027-09-18','2027-10-04'], ['2027-12-11','2028-01-23'],
  ['2028-04-01','2028-04-17'], ['2028-06-24','2028-07-09'], ['2028-09-16','2028-10-02'], ['2028-12-09','2029-01-21'],
  ['2029-03-30','2029-04-15'], ['2029-06-23','2029-07-08'], ['2029-09-15','2029-10-01'],
];
const display = new Intl.DateTimeFormat('en-AU', {day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Brisbane'});
const label = day => display.format(new Date(day+'T12:00:00+10:00'));

// Return a verified full break for the meeting date. A later unknown end date
// is left to the official calendar rather than inferred from last year's dates.
export function holidayWindow(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '2026-01-01') return null;
  const period = breaks.find(([,end]) => day<=end);
  if (!period) return null;
  const [start,end] = period;
  const source = education+(start<'2027'?'term-dates':'future-dates');
  return {start,end,active:day>=start,label:label(start)+' to '+label(end),source};
}

export function showSchoolHolidays(mount, day) {
  const period=holidayWindow(day);
  mount.querySelector('h2').textContent=period?.active?'School holidays are under way':'Plan around school holidays';
  mount.querySelector('[data-holiday-dates]').textContent=period?'Queensland state school holidays · '+period.label:'Check Queensland’s calendar for the next school break.';
  mount.querySelector('a').href=period?.source || education+'future-dates';
}
