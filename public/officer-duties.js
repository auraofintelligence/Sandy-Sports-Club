const news = '#committee/news', meeting = '#committee/meetings', stock = '#stock';
export const officeGuides = {
  secretary: {
    name:'Secretary', tasks:[
      ['Review new member applications','Check the joining queue, confirm the category and contact details, and pass any fee decision to the Treasurer.','#committee/applications'],
      ['Prepare the meeting', 'Open the meeting desk. Pick the meeting, add its date and agenda, and check the actions carried forward.', meeting],
      ['Prepare the newsletter', 'Open the monthly edition. Pick the contributions to include and read the member preview before publishing.', news],
      ['Check club grants', 'Open the grant register with the Treasurer. Assign eligibility checks and record application dates before the next committee meeting.', '#committee/grants'],
      ['File the minutes', 'After the committee approves the minutes, open the meeting again and share the approved copy with members.', meeting]
    ], handover:'Show the next Secretary which meeting is open and which newsletter is waiting for review.'
  },
  assistantsecretary:{
    name:'Assistant Secretary', tasks:[
      ['Check the joining queue','Review applications with the Secretary and identify any welcome message or follow-up still needed.','#committee/applications'],
      ['Pick up the next edition', 'Open the shared newsletter desk. Check which edition the Secretary is preparing and agree who will publish it.', news],
      ['Send your contribution', 'Write a short update, such as a call for volunteers. Choose Send to newsletter and check its status in your history.', news],
      ['Help find local funding', 'Search the funding finder for sport, volunteer and community opportunities. Bring source links and dates to the Secretary for checking.', '#committee/grants'],
      ['Follow up the meeting', 'Open the latest meeting together. Read each unfinished action and check who is following it up.', meeting]
    ], handover:'Point out the draft edition, the next meeting date and any replies still due.'
  },
  president:{
    name:'President', tasks:[
      ['Write the President’s message', 'Open the newsletter desk. Use the example for a starting point, add your own words and choose Send to newsletter.', news],
      ['Check the message for publication', 'Read the edition under review. Approve it if it is ready. If it needs work, choose Return to draft and tell the Secretary what to change.', news],
      ['Chair the next meeting', 'Open the agenda and work through one item at a time. Check the wording of decisions with the Secretary.', meeting]
    ], handover:'Show your successor the next agenda and any President’s message waiting for a decision.'
  },
  vicepresident:{
    name:'Vice President', tasks:[
      ['Send your club update', 'Share a local sports day, a small invitational or a thank-you. Send the piece to the newsletter and check your contribution history.', news],
      ['Help with the next meeting', 'Open the agenda with the President and agree which items you will lead or follow up.', meeting],
      ['Check the club calendar', 'Confirm the date and meeting place before putting an event in your next update.', '#events']
    ], handover:'Walk through the next sports day and name the person following up each outstanding job.'
  },
  treasurer:{
    name:'Treasurer', tasks:[
      ['Set the membership categories and fees','Check each joining category and enter approved fees before paid membership offers are sent.','#stock'],
      ['Receive or count stock', 'Choose Receive stock, pick the item and enter the quantity and supplier cost. Use Delivery invoices when the invoice arrives later.', stock],
      ['Export a report', 'Choose a month, quarter or year. Check any missing counts and costs, then download the spreadsheet or print a meeting copy.', '#stock/reports'],
      ['Set the club fees and stock prices', 'Review each membership category and demo shop item. Enter approved prices before accepting paid orders or publishing fee information.', stock],
      ['Send a Treasurer’s update', 'Give members a short summary in everyday language. Keep individual orders, payment details and supplier invoices in the stock book.', news]
    ], handover:'Open a saved delivery and a report together. Point out any items that still need a count or an invoice.'
  }
};

const otherDuties = {
  secretary:[
    ['Prepare committee work lists', 'Check who owns the outstanding jobs. Print a separate sheet for each officer who wants one.'],
    ['Review the monthly birthdays', 'Open the monthly birthday check in the newsletter desk. Check with the Assistant Secretary and record the shared review there.'],
    ['Prepare the AGM papers', 'Check the AGM jobs list and the club records. Gather the agenda, previous minutes and reports from the relevant officers.']
  ],
  assistantsecretary:[
    ['Collect newsletter contributions', 'Look at the draft edition. Ask the officers whose contributions are still needed and tell them when the Secretary needs their copy.'],
    ['Record jobs returned on paper', 'Collect the sheets and enter the ticks against the correct officer. Check unclear notes with the person who wrote them.'],
    ['Prepare a member notice', 'Check the agreed wording, dates and who should receive the notice with the Secretary.']
  ],
  president:[
    ['Check the agenda with the Secretary', 'Read the meeting agenda together and agree which papers and reports the committee needs.'],
    ['Follow up committee decisions', 'Ask the officer responsible for each agreed action what is done, what is waiting and where help is needed.']
  ],
  vicepresident:[
    ['Check arrangements for the next local sports day', 'Confirm the meeting point, who will welcome newcomers, and who is bringing the club equipment.'],
    ['Check in with a neighbouring club', 'Contact the club about a small invitational and bring the proposed dates back to the committee.']
  ],
  treasurer:[
    ['Reconcile club payments', 'Match cash, card receipts and bank deposits with the club records. Follow up unmatched entries and set aside the supporting receipts.'],
    ['Prepare the Treasurer’s meeting report', 'Summarise receipts, expenses and balances for the reporting period. Bring the figures and any items needing a committee decision.']
  ]
};

export function regularDuties(office) {
  const guide=Object.hasOwn(officeGuides,office)?officeGuides[office]:null;
  return guide?[...guide.tasks,...otherDuties[office]]:[];
}

