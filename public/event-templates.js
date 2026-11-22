const council = {label:'Redland City Council event approvals',url:'https://www.redland.qld.gov.au/News-events-and-have-your-say/Events-and-whats-on/Advice-for-event-organisers/Council-approvals-for-events'};
const food = {label:'Queensland Health food safety for fundraisers',url:'https://www.qld.gov.au/health/staying-healthy/food-pantry/starting-a-food-business/non-profit-organisations/fundraising-events'};
const foodLicence = {label:'Redland City Council food stall requirements',url:'https://www.redland.qld.gov.au/Community-safety-and-health/Food-health-and-safety/Starting-a-new-food-business'};
const gaming = {label:'Business Queensland raffle categories and rules',url:'https://www.business.qld.gov.au/industries/hospitality-tourism-sport/liquor-gaming/gaming/not-profit-charitable/competitions-raffles-bingo'};
const job = (key,title,detail) => ({key,title,detail});
const lead = job('lead','Coordinate this event','Be the contact for this event. Agree who is taking each job and arrange cover for gaps before the day.');
const venue = job('venue','Confirm the site and permissions','Ask the venue or land manager about access, layout, insurance and approvals. Record the agreed place, times and wet-weather plan.');
const roster = job('roster','Arrange the volunteer shifts','Ask who is available for set-up, the busy part and pack-down. Agree a time and named contact for each shift.');
const accounts = job('tally','Count the takings and hand over receipts','Count cash together, set the float aside and match card takings to the records. Pass the totals and expense receipts to the Treasurer.');
const close = job('pack-up','Pack down and thank the helpers','Return borrowed gear, remove rubbish and check the site with the host. Thank the helpers and record one thing to improve.');
const welcome = job('welcome','Welcome people on arrival','Agree who will meet first-timers and explain how the day works. Keep access clear for other people using the site.');
const play = job('play','Explain the activity and shared space','Agree the game format, age and access needs, equipment, boundaries and safety briefing before people play.');
const invite = job('invite','Share the confirmed event details','Check the date, meeting point and contact with the organiser, then prepare the invitation in the social planner.');

export const eventTypes = {
  local:{label:'Local sand sport meet',tasks:[lead,venue,welcome,play,close],links:[council]},
  interclub:{label:'Interclub invitational',tasks:[lead,
    job('visitors','Liaise with the visiting club','Agree the group size, meeting point and contact at each club. Share the invitation once both clubs confirm.'),
    venue,welcome,play,close],links:[council]},
  workshop:{label:'Tutorial or hands-on workshop',tasks:[lead,
    job('host','Agree on the session with the tutor','Ask what people will learn or make, how long it takes and how the tutor wants to be credited. Agree any fee, materials and costs with the tutor.'),
    venue,job('places','Set the number of places and invite participants','Confirm how many people can take part, suitable ages, access needs and how to book. Tell families if a parent needs to stay.'),
    job('materials','Prepare the activity tables','Check the tools and materials with the tutor. Agree who will bring, set up and collect each item.'),
    welcome,close],links:[council]},
  bbq:{label:'Fundraising BBQ',tasks:[lead,venue,
    job('food-check','Check the menu and food safety arrangements','Confirm the menu and preparation site with the host. Check council requirements. Plan cold storage, handwashing and a way to answer allergen questions.'),
    job('supplies','Order food and collect the equipment','Agree quantities, the spending limit and who supplies the barbecue, tables, utensils, esky and bins. Keep receipts.'),
    roster,job('cook','Run the cooking shift','Agree the handover time. Check cooking and serving arrangements with the food lead and keep raw food separate from ready-to-eat food.'),
    job('serve','Run the serving shift','Put the agreed prices where people can see them. Arrange separate people for handling money and serving food.'),
    accounts,close],links:[food,foodLicence,council]},
  raffle:{label:'Raffle',tasks:[lead,
    job('rules','Check the raffle rules before selling','Identify the beneficiary, estimate total ticket sales and prize value, then check the Queensland game category, eligibility and licence requirements. Keep the outcome with the plan.'),
    job('prizes','Confirm and collect the prizes','Check the sponsorship desk for agreed prizes. Record each donor, value, collection details and preferred credit. For a class or holiday voucher, confirm how the winner books and when it expires.'),
    job('tickets','Prepare the tickets and draw details','Once the rules check is complete, confirm the ticket price, required ticket information, sales period, draw procedure and how winners will be contacted.'),
    job('sellers','Organise ticket sellers','Find willing sellers, record the ticket ranges issued to each and agree where unsold tickets and takings will be returned.'),
    job('draw','Run the draw and deliver the prizes','Follow the agreed draw procedure, record the result privately and arrange prize collection. Confirm permission before naming a winner publicly.'),
    accounts,job('records','File the raffle records and thank donors','Gather ticket and prize records, expenses and the draw result. Thank donors and confirm the amount raised after costs with the Treasurer.')
  ],links:[gaming]},
  fundraiser:{label:'Other fundraising event',tasks:[lead,venue,
    job('purpose','Agree the purpose and budget','Record who or what the fundraiser supports, expected costs and how the club will cover them. Check the club’s approval before committing money.'),
    roster,invite,accounts,close],links:[council]}
};
